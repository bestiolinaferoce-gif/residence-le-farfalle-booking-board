import { NextRequest, NextResponse } from "next/server";
import type { Booking } from "@/lib/types";

const BASE = process.env.KV_REST_API_URL ?? "";
const TOKEN = process.env.KV_REST_API_TOKEN ?? "";
const KEY = "lfb_bookings";

type KVPayload = { v: number; ts: string; data: Booking[] };

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
  return parsed as KVPayload;
}

async function writeKV(payload: KVPayload): Promise<void> {
  if (!BASE || !TOKEN) return;
  await fetch(`${BASE}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([["SET", KEY, JSON.stringify(payload)]]),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { bookings: Booking[] };
    const incoming = body?.bookings;
    if (!Array.isArray(incoming)) {
      return NextResponse.json({ error: "invalid payload" }, { status: 400 });
    }

    const current = await readKV();
    const existing = (current?.data ?? []) as Booking[];
    const existingIds = new Set(existing.map((b) => b.id));

    const toAdd = incoming.filter((b) => b && b.id && !existingIds.has(b.id));
    const merged = [...existing, ...toAdd].sort((a, b) =>
      a.checkIn.localeCompare(b.checkIn)
    );

    const newPayload: KVPayload = {
      v: (current?.v ?? 0) + 1,
      ts: new Date().toISOString(),
      data: merged,
    };

    await writeKV(newPayload);

    return NextResponse.json({
      merged: toAdd.length,
      total: merged.length,
    });
  } catch (err) {
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}
