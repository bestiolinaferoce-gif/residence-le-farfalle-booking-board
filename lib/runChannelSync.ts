import {
  detectPossibleDuplicates,
  eventToSyncedBookingCandidate,
  findFirstFreeLodge,
  loadIcalSyncConfigFromEnv,
  parseIcsEvents,
  sameStay,
  type SyncedBookingCandidate,
} from "@/lib/channelSync";
import { UNASSIGNED_LODGE, type Booking } from "@/lib/types";

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

/** Prenotazione importata in attesa che l'host confermi l'unità. */
type PendingAssignment = {
  bookingId: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  channel: "airbnb" | "booking";
  proposedLodge: string | null;
  overbooking: boolean;
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

/** ICAL_SYNC_CONFIG assente o malformato: errore di configurazione, non di rete. */
export class ChannelSyncConfigError extends Error {}

export function isChannelSyncStorageReady(): boolean {
  return Boolean(BASE && TOKEN);
}

/**
 * Scarica i feed configurati e riconcilia la board.
 * Condiviso fra il pulsante "Sync canali" e il cron giornaliero.
 */
export async function runChannelSync() {
    const configs = loadIcalSyncConfigFromEnv();
    if (configs.length === 0) {
      throw new ChannelSyncConfigError("ICAL_SYNC_CONFIG non configurato.");
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
    const byBookingRef = new Map(
      existing
        .filter((booking) => booking.bookingRef)
        .map((booking) => [booking.bookingRef as string, booking])
    );
    const seenSyncKeys = new Set<string>();
    // I feed di struttura coprono ogni unità del canale, quindi lo scope è il canale intero.
    const propertyWideChannels = new Set(
      results.filter(({ config }) => !config.lodge).map(({ config }) => config.channel)
    );
    const scopeKeys = new Set(
      results
        .filter(({ config }) => config.lodge)
        .map(({ config }) => syncScopeKey(config.channel, config.lodge as Booking["lodge"]))
    );
    const conflicts: SyncConflict[] = [];
    const pendingAssignments: PendingAssignment[] = [];

    let created = 0;
    let updated = 0;
    let cancelled = 0;
    let importedEvents = 0;
    let unassigned = 0;
    let overbookings = 0;

    for (const { events } of results) {
      for (const candidate of events) {
        importedEvents += 1;
        seenSyncKeys.add(candidate.syncKey);

        // Deduplica a cascata: UID del feed, poi numero prenotazione, poi stessa permanenza.
        const exact = bySyncKey.get(candidate.syncKey);
        const byRef = candidate.bookingRef ? byBookingRef.get(candidate.bookingRef) : undefined;
        const sameDates = existing.find((booking) => sameStay(booking, candidate));
        const target = exact ?? byRef ?? sameDates;

        if (!target) {
          const createdAt = new Date().toISOString();
          const id = `sync-${candidate.channel}-${candidate.syncKey.slice(0, 16)}`;

          // Feed di struttura: il lodge non arriva dal canale, lo decide l'host.
          if (candidate.lodge === UNASSIGNED_LODGE) {
            const proposal = findFirstFreeLodge(
              Array.from(byId.values()),
              candidate.checkIn,
              candidate.checkOut
            );
            const booking: Booking = {
              id,
              guestName: candidate.guestName,
              lodge: UNASSIGNED_LODGE,
              checkIn: candidate.checkIn,
              checkOut: candidate.checkOut,
              status: candidate.status,
              channel: candidate.channel,
              notes: proposal
                ? candidate.notes
                : `${candidate.notes}\nOVERBOOKING: nessuna unità libera per queste date. Da risolvere a mano.`,
              guestsCount: 2,
              totalAmount: 0,
              depositAmount: 0,
              depositReceived: false,
              breakfastIncluded: true,
              createdAt,
              updatedAt: createdAt,
              dataOrigin: "sync",
              isNew: true,
              bookingRef: candidate.bookingRef,
              ...(proposal ? { proposedLodge: proposal } : { overbooking: true }),
              externalSyncKey: candidate.syncKey,
              externalCalendarName: candidate.externalCalendarName,
              externalLastSeenAt: createdAt,
            };
            existing.push(booking);
            byId.set(id, booking);
            bySyncKey.set(candidate.syncKey, booking);
            if (candidate.bookingRef) byBookingRef.set(candidate.bookingRef, booking);
            created += 1;
            unassigned += 1;
            if (!proposal) overbookings += 1;
            pendingAssignments.push({
              bookingId: id,
              guestName: booking.guestName,
              checkIn: booking.checkIn,
              checkOut: booking.checkOut,
              channel: candidate.channel,
              proposedLodge: proposal,
              overbooking: !proposal,
            });
            continue;
          }

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
            bookingRef: candidate.bookingRef,
            externalSyncKey: candidate.syncKey,
            externalCalendarName: candidate.externalCalendarName,
            externalLastSeenAt: createdAt,
          };
          existing.push(booking);
          byId.set(id, booking);
          bySyncKey.set(candidate.syncKey, booking);
          if (candidate.bookingRef) byBookingRef.set(candidate.bookingRef, booking);
          created += 1;
          continue;
        }

        // Un feed di struttura non conosce l'unità: mai sovrascrivere una scelta dell'host.
        const nextLodge = candidate.lodge === UNASSIGNED_LODGE ? target.lodge : candidate.lodge;

        const next: Booking = {
          ...target,
          guestName: pickGuestName(target, candidate),
          checkIn: candidate.checkIn,
          checkOut: candidate.checkOut,
          status: candidate.status,
          channel: candidate.channel,
          lodge: nextLodge,
          notes: mergeNotes(target, candidate),
          updatedAt: new Date().toISOString(),
          bookingRef: target.bookingRef ?? candidate.bookingRef,
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
      const inScope =
        propertyWideChannels.has(booking.channel as "airbnb" | "booking") ||
        scopeKeys.has(syncScopeKey(booking.channel, booking.lodge));
      if (!inScope) continue;
      if (!booking.externalSyncKey) continue;
      if (seenSyncKeys.has(booking.externalSyncKey)) continue;
      if (booking.status === "cancelled") continue;
      if (!isFutureOrActive(booking, today)) continue;

      // Il record resta, cambia solo lo status: lo storico non si cancella mai.
      const detectedAt = new Date().toISOString();
      const cancelledBooking: Booking = {
        ...booking,
        status: "cancelled",
        updatedAt: detectedAt,
        externalLastSeenAt: detectedAt,
        notes: `${booking.notes}\nDisdetta rilevata il ${detectedAt} dal feed iCal di ${
          booking.channel === "booking" ? "Booking.com" : "Airbnb"
        }: non più presente nel feed di origine. Record conservato per storico.`.trim(),
      };
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

    return {
      ok: true as const,
      configuredSources: configs.length,
      importedEvents,
      created,
      updated,
      cancelled,
      unassigned,
      overbookings,
      pendingAssignments,
      conflicts,
      possibleDuplicates: detectPossibleDuplicates(data),
      v: payload.v,
      ts: payload.ts,
    };
}
