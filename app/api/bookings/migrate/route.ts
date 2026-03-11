import { NextRequest, NextResponse } from 'next/server';
import type { Booking } from '@/lib/types';

const BASE = process.env.KV_REST_API_URL ?? '';
const TOKEN = process.env.KV_REST_API_TOKEN ?? '';
const KEY = 'lfb_bookings';

type KVPayload = { v: number; ts: string; data: Booking[] };

async function readKV(): Promise<KVPayload> {
  if (!BASE || !TOKEN) return { v: 0, ts: '', data: [] };
  const res = await fetch(`${BASE}/get/${KEY}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
    cache: 'no-store',
  });
  const json = (await res.json()) as { result: string | null };
  if (!json.result) return { v: 0, ts: '', data: [] };
  const parsed = JSON.parse(json.result) as KVPayload | Booking[];
  if (Array.isArray(parsed)) return { v: 1, ts: '', data: parsed };
  return parsed;
}

export async function POST(req: NextRequest) {
  if (!BASE || !TOKEN) return NextResponse.json({ ok: false }, { status: 503 });
  try {
    const body = (await req.json()) as Booking[] | { bookings: Booking[] };
    const incoming: Booking[] = Array.isArray(body) ? body : (body.bookings ?? []);

    const current = await readKV();
    const existingIds = new Set(current.data.map((b) => b.id));

    let inserted = 0;
    let skipped = 0;
    const merged = [...current.data];

    for (const booking of incoming) {
      if (!booking.id || existingIds.has(booking.id)) {
        skipped += 1;
      } else {
        merged.push(booking);
        existingIds.add(booking.id);
        inserted += 1;
      }
    }

    const newPayload: KVPayload = {
      v: current.v + 1,
      ts: new Date().toISOString(),
      data: merged,
    };

    await fetch(`${BASE}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([['SET', KEY, JSON.stringify(newPayload)]]),
    });

    return NextResponse.json({ ok: true, inserted, skipped, v: newPayload.v });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
