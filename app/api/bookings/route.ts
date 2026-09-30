import { NextRequest, NextResponse } from "next/server";
import {
  bookingReadAuthError,
  bookingWriteAuthError,
  identifyCaller,
  kvNotConfiguredResponse,
} from "@/lib/bookingsApiAuth";
import type { Booking } from "@/lib/types";
import {
  capDeletedIds,
  casWriteBookingsKV,
  kvConfigured,
  purgeExpiredTrash,
  readBookingsKV,
  type KVBookingsPayload,
} from "@/lib/kvCas";
import { appendAuditEntries, buildAuditEntries } from "@/lib/auditLog";
import { validateBookingsPayload } from "@/lib/validation";
import {
  notifyN8NBookingEvents,
  type N8nBookingEventName,
  type N8nBookingEventPayload,
} from "@/lib/n8nBookingWebhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };
const PROPERTY = "residence-le-farfalle";
/** Tentativi di scrittura CAS prima di dichiarare il conflitto irrisolvibile. */
const MAX_CAS_ATTEMPTS = 4;

function calculateNights(checkIn: string, checkOut: string) {
  const toUtc = (iso: string): number => {
    const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
    if (!y || !m || !d) return NaN;
    return Date.UTC(y, m - 1, d);
  };
  const start = toUtc(checkIn);
  const end = toUtc(checkOut);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, Math.round((end - start) / 86_400_000));
}

function toBookingEvent(event: N8nBookingEventName, booking: Booking): N8nBookingEventPayload {
  return {
    event,
    bookingId: booking.id,
    property: PROPERTY,
    guestName: booking.guestName,
    guestEmail: booking.guestProfile?.email ?? "",
    guestPhone: booking.guestProfile?.phone ?? "",
    checkin: booking.checkIn,
    checkout: booking.checkOut,
    nights: calculateNights(booking.checkIn, booking.checkOut),
    guests: booking.guestsCount,
    lodge: booking.lodge,
    totalAmount: booking.totalAmount,
    depositAmount: booking.depositAmount,
    depositPaid: booking.depositReceived,
    notes: booking.notes,
    source: "booking-board",
  };
}

function hasBookingChanged(previous: Booking, current: Booking) {
  return (
    previous.guestName !== current.guestName ||
    previous.lodge !== current.lodge ||
    previous.checkIn !== current.checkIn ||
    previous.checkOut !== current.checkOut ||
    previous.status !== current.status ||
    previous.channel !== current.channel ||
    previous.notes !== current.notes ||
    previous.guestsCount !== current.guestsCount ||
    previous.totalAmount !== current.totalAmount ||
    previous.depositAmount !== current.depositAmount ||
    previous.depositReceived !== current.depositReceived
  );
}

function collectBookingEvents(previousBookings: Booking[], nextBookings: Booking[]) {
  const previousMap = new Map(previousBookings.map((booking) => [booking.id, booking]));
  const nextMap = new Map(nextBookings.map((booking) => [booking.id, booking]));
  const events: N8nBookingEventPayload[] = [];

  for (const booking of nextBookings) {
    const previous = previousMap.get(booking.id);
    if (!previous) {
      events.push(toBookingEvent("BOOKING_CREATED", booking));
      continue;
    }
    if (!previous.depositReceived && booking.depositReceived) {
      events.push(toBookingEvent("DEPOSIT_RECEIVED", booking));
      continue;
    }
    if (previous.status !== "cancelled" && booking.status === "cancelled") {
      events.push(toBookingEvent("BOOKING_CANCELLED", booking));
      continue;
    }
    if (hasBookingChanged(previous, booking)) {
      events.push(toBookingEvent("BOOKING_MODIFIED", booking));
    }
  }

  for (const booking of previousBookings) {
    if (!nextMap.has(booking.id)) {
      events.push(toBookingEvent("BOOKING_CANCELLED", booking));
    }
  }

  return events;
}

export async function GET(req: NextRequest) {
  const authErr = bookingReadAuthError(req);
  if (authErr) return authErr;
  if (!kvConfigured()) return NextResponse.json({ v: 0, ts: "", data: [] }, { headers: NO_STORE });

  try {
    const payload = await readBookingsKV();
    return NextResponse.json(payload ?? { v: 0, ts: "", data: [] }, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ v: 0, ts: "", data: [] }, { headers: NO_STORE });
  }
}

export async function POST(req: NextRequest) {
  const authErr = bookingWriteAuthError(req);
  if (authErr) return authErr;
  if (!kvConfigured()) return kvNotConfiguredResponse();

  const caller = identifyCaller(req);
  const actor = caller?.role ?? "unknown";

  let incoming: Booking[];
  try {
    const body = (await req.json()) as Booking[] | { bookings: Booking[] };
    incoming = Array.isArray(body) ? body : (body.bookings ?? []);
  } catch {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400, headers: NO_STORE });
  }

  // Il form non è una barriera: quello che arriva qui va validato comunque.
  const { errors, overbookings } = validateBookingsPayload(incoming);
  if (errors.length > 0) {
    return NextResponse.json(
      { ok: false, error: "validation_failed", invalid: errors.slice(0, 20), invalidCount: errors.length },
      { status: 422, headers: NO_STORE }
    );
  }

  try {
    for (let attempt = 1; attempt <= MAX_CAS_ATTEMPTS; attempt += 1) {
      const current = await readBookingsKV();
      const previous = current?.data ?? [];
      const expectedVersion = current?.v ?? 0;

      const { kept, purged } = purgeExpiredTrash(incoming);
      const payload: KVBookingsPayload = {
        v: expectedVersion + 1,
        ts: new Date().toISOString(),
        data: kept,
        deletedIds: capDeletedIds([...(current?.deletedIds ?? []), ...purged.map((b) => b.id)]),
      };

      const written = await casWriteBookingsKV(expectedVersion, payload);
      if (!written) continue; // qualcun altro ha scritto: rileggi e riprova

      const events = collectBookingEvents(previous, kept);
      await notifyN8NBookingEvents(events, "api/bookings");
      await appendAuditEntries(buildAuditEntries(previous, kept, actor));

      return NextResponse.json(
        {
          ok: true,
          v: payload.v,
          ts: payload.ts,
          syncedEvents: events.length,
          purged: purged.length,
          overbookings,
        },
        { headers: NO_STORE }
      );
    }

    return NextResponse.json(
      { ok: false, error: "conflict", message: "Modifica concorrente in corso: ricarica e riprova." },
      { status: 409, headers: NO_STORE }
    );
  } catch {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500, headers: NO_STORE });
  }
}
