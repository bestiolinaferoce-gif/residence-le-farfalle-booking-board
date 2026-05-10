import { NextRequest, NextResponse } from "next/server";
import { bookingWriteAuthError, kvNotConfiguredResponse } from "@/lib/bookingsApiAuth";
import {
  eventToSyncedBookingCandidate,
  loadIcalSyncConfigFromEnv,
  parseIcsEvents,
  sameStay,
  type SyncedBookingCandidate,
} from "@/lib/channelSync";
import type { Booking } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const BASE = process.env.KV_REST_API_URL ?? "";
const TOKEN = process.env.KV_REST_API_TOKEN ?? "";
const KEY = "lfb_bookings";

type KVPayload = { v: number; ts: string; data: Booking[] };

type SyncConflict = {
  channel: "airbnb" | "booking";
  lodge: string;
  checkIn: string;
  checkOut: string;
  incomingGuestName: string;
  existingGuestName: string;
  existingId: string;
};

async function readKV(): Promise<KVPayload | null> {
  if (!BASE || !TOKEN) return null;
  const res = await fetch(`${BASE}/get/${KEY}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
    cache: "no-store",
  });
  const json = (await res.json()) as { result: string | null };
  if (!json.result) return null;
  const parsed = JSON.parse(json.result) as KVPayload | Booking[];
  if (Array.isArray(parsed)) {
    return { v: 1, ts: new Date().toISOString(), data: parsed };
  }
  return parsed;
}

async function writeKV(payload: KVPayload): Promise<void> {
  await fetch(`${BASE}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([["SET", KEY, JSON.stringify(payload)]]),
  });
}

function syncScopeKey(channel: Booking["channel"], lodge: Booking["lodge"]): string {
  return `${channel}::${lodge}`;
}

function bookingUpdatedMs(booking: Booking): number {
  const ts = Date.parse(booking.updatedAt || booking.createdAt || "");
  return Number.isFinite(ts) ? ts : 0;
}

function mergeNotes(existing: Booking, candidate: SyncedBookingCandidate): string {
  if (!existing.notes.trim()) return candidate.notes;
  if (
    existing.notes.includes("Sincronizzata automaticamente da Booking.com") ||
    existing.notes.includes("Sincronizzata automaticamente da Airbnb")
  ) {
    return candidate.notes;
  }
  return existing.notes;
}

function pickGuestName(existing: Booking, candidate: SyncedBookingCandidate): string {
  if (!existing.guestName.trim()) return candidate.guestName;
  if (existing.guestName === existing.lodge) return candidate.guestName;
  if (existing.guestName.startsWith("Booking.com ·") || existing.guestName.startsWith("Airbnb ·")) {
    return candidate.guestName;
  }
  return existing.guestName;
}

function isFutureOrActive(booking: Booking, today: string): boolean {
  return booking.checkOut >= today;
}

export async function GET() {
  try {
    const configs = loadIcalSyncConfigFromEnv();
    return NextResponse.json({
      ok: true,
      configuredSources: configs.map((item) => ({
        channel: item.channel,
        lodge: item.lodge,
        label: item.label ?? `${item.channel}:${item.lodge}`,
      })),
      sourceCount: configs.length,
      mode: "ical-pull",
    }, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "Configurazione sync non valida.",
    }, {
      status: 500,
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  }
}

export async function POST(req: NextRequest) {
  const authErr = bookingWriteAuthError(req);
  if (authErr) return authErr;
  if (!BASE || !TOKEN) return kvNotConfiguredResponse();

  try {
    const configs = loadIcalSyncConfigFromEnv();
    if (configs.length === 0) {
      return NextResponse.json({
        ok: false,
        error: "ICAL_SYNC_CONFIG non configurato.",
      }, { status: 400 });
    }

    const results = await Promise.all(
      configs.map(async (config) => {
        const res = await fetch(config.url, { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`Feed ${config.label ?? `${config.channel}:${config.lodge}`} non raggiungibile (${res.status}).`);
        }
        const raw = await res.text();
        const events = parseIcsEvents(raw)
          .map((event) => eventToSyncedBookingCandidate(config, event))
          .sort((a, b) => a.checkIn.localeCompare(b.checkIn));
        return { config, events };
      })
    );

    const current = await readKV();
    const existing = [...(current?.data ?? [])];
    const byId = new Map(existing.map((booking) => [booking.id, booking]));
    const bySyncKey = new Map(
      existing
        .filter((booking) => booking.externalSyncKey)
        .map((booking) => [booking.externalSyncKey as string, booking])
    );
    const seenSyncKeys = new Set<string>();
    const scopeKeys = new Set(results.map(({ config }) => syncScopeKey(config.channel, config.lodge)));
    const conflicts: SyncConflict[] = [];

    let created = 0;
    let updated = 0;
    let cancelled = 0;
    let importedEvents = 0;

    for (const { events } of results) {
      for (const candidate of events) {
        importedEvents += 1;
        seenSyncKeys.add(candidate.syncKey);

        const exact = bySyncKey.get(candidate.syncKey);
        const sameDates = existing.find((booking) => sameStay(booking, candidate));
        const target = exact ?? sameDates;

        if (!target) {
          const overlapping = existing.find((booking) => {
            if (booking.lodge !== candidate.lodge) return false;
            if (booking.status === "cancelled" || candidate.status === "cancelled") return false;
            return booking.checkIn < candidate.checkOut && candidate.checkIn < booking.checkOut;
          });

          if (overlapping) {
            conflicts.push({
              channel: candidate.channel,
              lodge: candidate.lodge,
              checkIn: candidate.checkIn,
              checkOut: candidate.checkOut,
              incomingGuestName: candidate.guestName,
              existingGuestName: overlapping.guestName,
              existingId: overlapping.id,
            });
            continue;
          }

          const id = `sync-${candidate.channel}-${candidate.syncKey.slice(0, 16)}`;
          const createdAt = new Date().toISOString();
          const booking: Booking = {
            id,
            guestName: candidate.guestName,
            lodge: candidate.lodge,
            checkIn: candidate.checkIn,
            checkOut: candidate.checkOut,
            status: candidate.status,
            channel: candidate.channel,
            notes: candidate.notes,
            guestsCount: 2,
            totalAmount: 0,
            depositAmount: 0,
            depositReceived: false,
            breakfastIncluded: true,
            createdAt,
            updatedAt: createdAt,
            dataOrigin: "sync",
            isNew: true,
            externalSyncKey: candidate.syncKey,
            externalCalendarName: candidate.externalCalendarName,
            externalLastSeenAt: createdAt,
          };
          existing.push(booking);
          byId.set(id, booking);
          bySyncKey.set(candidate.syncKey, booking);
          created += 1;
          continue;
        }

        const next: Booking = {
          ...target,
          guestName: pickGuestName(target, candidate),
          checkIn: candidate.checkIn,
          checkOut: candidate.checkOut,
          status: candidate.status,
          channel: candidate.channel,
          lodge: candidate.lodge,
          notes: mergeNotes(target, candidate),
          updatedAt: new Date().toISOString(),
          externalSyncKey: candidate.syncKey,
          externalCalendarName: candidate.externalCalendarName,
          externalLastSeenAt: new Date().toISOString(),
        };

        if (!target.dataOrigin) {
          next.dataOrigin = "sync";
        }

        if (
          next.checkIn !== target.checkIn ||
          next.checkOut !== target.checkOut ||
          next.status !== target.status ||
          next.externalSyncKey !== target.externalSyncKey ||
          next.externalCalendarName !== target.externalCalendarName ||
          next.guestName !== target.guestName ||
          next.notes !== target.notes
        ) {
          updated += 1;
        }

        byId.set(target.id, next);
        bySyncKey.set(candidate.syncKey, next);
      }
    }

    const today = new Date().toISOString().slice(0, 10);
    for (const booking of existing) {
      const scope = syncScopeKey(booking.channel, booking.lodge);
      if (!scopeKeys.has(scope)) continue;
      if (!booking.externalSyncKey) continue;
      if (seenSyncKeys.has(booking.externalSyncKey)) continue;
      if (booking.status === "cancelled") continue;
      if (!isFutureOrActive(booking, today)) continue;

      const cancelledBooking: Booking = {
        ...booking,
        status: "cancelled",
        updatedAt: new Date().toISOString(),
        externalLastSeenAt: new Date().toISOString(),
      };
      if (
        cancelledBooking.notes.includes("Sync iCal") ||
        cancelledBooking.notes.includes("Sincronizzata automaticamente")
      ) {
        cancelledBooking.notes = `${cancelledBooking.notes}\nAggiornata da sync iCal: prenotazione non più presente nel feed esterno.`;
      }
      byId.set(booking.id, cancelledBooking);
      cancelled += 1;
    }

    const data = Array.from(byId.values()).sort((a, b) => {
      const dateOrder = a.checkIn.localeCompare(b.checkIn);
      if (dateOrder !== 0) return dateOrder;
      return bookingUpdatedMs(b) - bookingUpdatedMs(a);
    });

    const payload: KVPayload = {
      v: (current?.v ?? 0) + 1,
      ts: new Date().toISOString(),
      data,
    };

    await writeKV(payload);

    return NextResponse.json({
      ok: true,
      configuredSources: configs.length,
      importedEvents,
      created,
      updated,
      cancelled,
      conflicts,
      v: payload.v,
      ts: payload.ts,
    }, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "Errore sync canali.",
    }, {
      status: 500,
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  }
}
