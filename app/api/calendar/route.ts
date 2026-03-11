import { NextRequest, NextResponse } from 'next/server';
import type { Booking } from '@/lib/types';

const BASE = process.env.KV_REST_API_URL ?? '';
const TOKEN = process.env.KV_REST_API_TOKEN ?? '';
const KEY = 'lfb_bookings';

function toIcalDate(iso: string): string {
  return iso.slice(0, 10).replace(/-/g, '');
}

function escapeIcal(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function foldLine(line: string): string {
  const MAX = 74;
  if (line.length <= MAX) return line;
  let out = '';
  let pos = 0;
  while (pos < line.length) {
    if (pos === 0) {
      out += line.slice(0, MAX);
      pos = MAX;
    } else {
      out += '\r\n ' + line.slice(pos, pos + MAX - 1);
      pos += MAX - 1;
    }
  }
  return out;
}

export async function GET(req: NextRequest) {
  const lodgeFilter = req.nextUrl.searchParams.get('lodge');

  let bookings: Booking[] = [];

  if (BASE && TOKEN) {
    try {
      const res = await fetch(`${BASE}/get/${KEY}`, {
        headers: { Authorization: `Bearer ${TOKEN}` },
        cache: 'no-store',
      });
      const json = (await res.json()) as { result: string | null };
      if (json.result) {
        const parsed = JSON.parse(json.result);
        bookings = Array.isArray(parsed) ? parsed : (parsed.data ?? []);
      }
    } catch {
      /* fallback: feed vuoto ma valido */
    }
  }

  const filtered = bookings.filter((b) => {
    if (lodgeFilter && b.lodge !== lodgeFilter) return false;
    return b.status !== 'cancelled';
  });

  const now = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';

  const events = filtered.map((b) => {
    const status = b.status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED';
    const desc = `${b.channel} | ${b.status} | ${b.guestsCount}p | ${b.totalAmount}€`;
    const raw = b.updatedAt ?? b.createdAt ?? '';
    const lastMod = raw
      ? raw.replace(/[-:]/g, '').replace(/\.\d+Z?$/, 'Z')
      : '';
    const lines = [
      'BEGIN:VEVENT',
      foldLine(`UID:${b.id}@le-farfalle`),
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${toIcalDate(b.checkIn)}`,
      `DTEND;VALUE=DATE:${toIcalDate(b.checkOut)}`,
      foldLine(`SUMMARY:${escapeIcal(b.guestName)} — ${escapeIcal(b.lodge)}`),
      foldLine(`DESCRIPTION:${escapeIcal(desc)}`),
      foldLine(`LOCATION:Residence Le Farfalle — ${escapeIcal(b.lodge)}`),
      `STATUS:${status}`,
      ...(lastMod ? [`LAST-MODIFIED:${lastMod}`] : []),
      'END:VEVENT',
    ];
    return lines.join('\r\n');
  });

  const cal = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Residence Le Farfalle//Booking Board//IT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    foldLine('X-WR-CALNAME:Residence Le Farfalle — Booking Board'),
    'X-WR-TIMEZONE:Europe/Rome',
    'X-WR-CALDESC:Prenotazioni Residence Le Farfalle',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n');

  return new NextResponse(cal, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="le-farfalle.ics"',
      'Cache-Control': 'no-store',
    },
  });
}
