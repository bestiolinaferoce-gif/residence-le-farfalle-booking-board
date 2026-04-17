import { NextRequest, NextResponse } from 'next/server';
import { bookingWriteAuthError, kvNotConfiguredResponse } from '@/lib/bookingsApiAuth';
import type { Booking } from '@/lib/types';
import {
  notifyN8NBookingEvents,
  type N8nBookingEventName,
  type N8nBookingEventPayload,
} from '@/lib/n8nBookingWebhook';

const BASE = process.env.KV_REST_API_URL ?? '';
const TOKEN = process.env.KV_REST_API_TOKEN ?? '';
const KEY = 'lfb_bookings';

type KVPayload = { v: number; ts: string; data: Booking[] };

const PROPERTY = 'residence-le-farfalle';

function calculateNights(checkIn: string, checkOut: string) {
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
}

function toBookingEvent(event: N8nBookingEventName, booking: Booking): N8nBookingEventPayload {
  return {
    event,
    bookingId: booking.id,
    property: PROPERTY,
    guestName: booking.guestName,
    guestEmail: booking.guestProfile?.email ?? '',
    guestPhone: booking.guestProfile?.phone ?? '',
    checkin: booking.checkIn,
    checkout: booking.checkOut,
    nights: calculateNights(booking.checkIn, booking.checkOut),
    guests: booking.guestsCount,
    lodge: booking.lodge,
    totalAmount: booking.totalAmount,
    depositAmount: booking.depositAmount,
    depositPaid: booking.depositReceived,
    notes: booking.notes,
    source: 'booking-board',
  };
}

function hasBookingChanged(previous: Booking, current: Booking) {
  return previous.guestName !== current.guestName ||
    previous.lodge !== current.lodge ||
    previous.checkIn !== current.checkIn ||
    previous.checkOut !== current.checkOut ||
    previous.status !== current.status ||
    previous.channel !== current.channel ||
    previous.notes !== current.notes ||
    previous.guestsCount !== current.guestsCount ||
    previous.totalAmount !== current.totalAmount ||
    previous.depositAmount !== current.depositAmount ||
    previous.depositReceived !== current.depositReceived;
}

function collectBookingEvents(previousBookings: Booking[], nextBookings: Booking[]) {
  const previousMap = new Map(previousBookings.map((booking) => [booking.id, booking]));
  const nextMap = new Map(nextBookings.map((booking) => [booking.id, booking]));
  const events: N8nBookingEventPayload[] = [];

  for (const booking of nextBookings) {
    const previous = previousMap.get(booking.id);
    if (!previous) {
      events.push(toBookingEvent('BOOKING_CREATED', booking));
      continue;
    }
    if (!previous.depositReceived && booking.depositReceived) {
      events.push(toBookingEvent('DEPOSIT_RECEIVED', booking));
      continue;
    }
    if (previous.status !== 'cancelled' && booking.status === 'cancelled') {
      events.push(toBookingEvent('BOOKING_CANCELLED', booking));
      continue;
    }
    if (hasBookingChanged(previous, booking)) {
      events.push(toBookingEvent('BOOKING_MODIFIED', booking));
    }
  }

  for (const booking of previousBookings) {
    if (!nextMap.has(booking.id)) {
      events.push(toBookingEvent('BOOKING_CANCELLED', booking));
    }
  }

  return events;
}

async function readKV(): Promise<{ payload: KVPayload | null; raw: string | null }> {
  if (!BASE || !TOKEN) return { payload: null, raw: null };
  const res = await fetch(`${BASE}/get/${KEY}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
    cache: 'no-store',
  });
  const json = (await res.json()) as { result: string | null };
  if (!json.result) return { payload: null, raw: null };
  const parsed = JSON.parse(json.result) as KVPayload | Booking[];
  if (Array.isArray(parsed)) {
    return { payload: { v: 1, ts: new Date().toISOString(), data: parsed }, raw: json.result };
  }
  return { payload: parsed as KVPayload, raw: json.result };
}

export async function GET() {
  if (!BASE || !TOKEN) return NextResponse.json({ v: 0, ts: '', data: [] });
  try {
    const { payload } = await readKV();
    return NextResponse.json(payload ?? { v: 0, ts: '', data: [] });
  } catch {
    return NextResponse.json({ v: 0, ts: '', data: [] });
  }
}

export async function POST(req: NextRequest) {
  const authErr = bookingWriteAuthError(req);
  if (authErr) return authErr;

  if (!BASE || !TOKEN) return kvNotConfiguredResponse();
  try {
    const body = (await req.json()) as Booking[] | { bookings: Booking[] };
    const bookings: Booking[] = Array.isArray(body) ? body : (body.bookings ?? []);
    const { payload: current } = await readKV();
    const events = collectBookingEvents(current?.data ?? [], bookings);
    const newPayload: KVPayload = {
      v: (current?.v ?? 0) + 1,
      ts: new Date().toISOString(),
      data: bookings,
    };
    await fetch(`${BASE}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([['SET', KEY, JSON.stringify(newPayload)]]),
    });
    await notifyN8NBookingEvents(events, 'api/bookings');
    return NextResponse.json({ ok: true, v: newPayload.v, ts: newPayload.ts, syncedEvents: events.length });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
