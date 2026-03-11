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

async function writeKV(payload: KVPayload): Promise<void> {
  await fetch(`${BASE}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([['SET', KEY, JSON.stringify(payload)]]),
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!BASE || !TOKEN) return NextResponse.json({ ok: false }, { status: 503 });
  try {
    const { id } = await params;
    const updates = (await req.json()) as Partial<Booking>;
    const current = await readKV();
    const idx = current.data.findIndex((b) => b.id === id);
    if (idx === -1) return NextResponse.json({ ok: false }, { status: 404 });
    const updated: Booking = {
      ...current.data[idx],
      ...updates,
      id,
      updatedAt: new Date().toISOString(),
    };
    const newData = [...current.data];
    newData[idx] = updated;
    const newPayload: KVPayload = {
      v: current.v + 1,
      ts: new Date().toISOString(),
      data: newData,
    };
    await writeKV(newPayload);
    return NextResponse.json({ ok: true, booking: updated, v: newPayload.v });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!BASE || !TOKEN) return NextResponse.json({ ok: false }, { status: 503 });
  try {
    const { id } = await params;
    const current = await readKV();
    const newData = current.data.filter((b) => b.id !== id);
    if (newData.length === current.data.length) {
      return NextResponse.json({ ok: false }, { status: 404 });
    }
    const newPayload: KVPayload = {
      v: current.v + 1,
      ts: new Date().toISOString(),
      data: newData,
    };
    await writeKV(newPayload);
    return NextResponse.json({ ok: true, v: newPayload.v });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
