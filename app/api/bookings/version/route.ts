import { NextResponse } from 'next/server';

const BASE = process.env.KV_REST_API_URL ?? '';
const TOKEN = process.env.KV_REST_API_TOKEN ?? '';
const KEY = 'lfb_bookings';

export async function GET() {
  if (!BASE || !TOKEN) return NextResponse.json({ v: 0, ts: '' });
  try {
    const res = await fetch(`${BASE}/get/${KEY}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
      cache: 'no-store',
    });
    const json = (await res.json()) as { result: string | null };
    if (!json.result) return NextResponse.json({ v: 0, ts: '' });
    const parsed = JSON.parse(json.result) as { v?: number; ts?: string } | unknown[];
    if (Array.isArray(parsed)) return NextResponse.json({ v: 1, ts: '' });
    return NextResponse.json({ v: parsed.v ?? 0, ts: parsed.ts ?? '' });
  } catch {
    return NextResponse.json({ v: 0, ts: '' });
  }
}
