import { NextRequest, NextResponse } from 'next/server';
import type { Booking } from '@/lib/types';

const BASE = process.env.KV_REST_API_URL ?? '';
const TOKEN = process.env.KV_REST_API_TOKEN ?? '';
const KEY = 'lfb_bookings';

type KVPayload = { v: number; ts: string; data: Booking[] };

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
  if (!BASE || !TOKEN) return NextResponse.json({ ok: false });
  try {
    const body = (await req.json()) as Booking[] | { bookings: Booking[] };
    const bookings: Booking[] = Array.isArray(body) ? body : (body.bookings ?? []);
    const { payload: current } = await readKV();
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
    return NextResponse.json({ ok: true, v: newPayload.v, ts: newPayload.ts });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
