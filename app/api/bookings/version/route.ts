import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
    if (Array.isArray(parsed)) {
      return NextResponse.json({ v: 1, ts: '' }, {
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      });
    }
    return NextResponse.json({ v: parsed.v ?? 0, ts: parsed.ts ?? '' }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch {
    return NextResponse.json({ v: 0, ts: '' }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  }
}
