import { NextRequest, NextResponse } from "next/server";
import { kvConfigured, kvGet, kvSet, SETTINGS_KEY_KV } from "@/lib/kv";
import { readBookingsKV } from "@/lib/kvCas";
import type { BoardSettings } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

/**
 * Snapshot notturno di prenotazioni e configurazione.
 *
 * Il CAS protegge dalle scritture concorrenti, non da un errore umano: se
 * qualcuno cancella mezza stagione, l'unica rete è una copia di ieri. Ne
 * teniamo sette, indicizzate per data.
 */

const INDEX_KEY = "lfb_backup_index";
const KEEP = 7;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET non configurato: backup disattivato." }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  if (!kvConfigured()) {
    return NextResponse.json({ ok: false, error: "KV non configurato" }, { status: 503 });
  }

  const payload = await readBookingsKV();
  const settings = await kvGet<BoardSettings>(SETTINGS_KEY_KV);
  const day = new Date().toISOString().slice(0, 10);
  const key = `lfb_backup_${day}`;

  const written = await kvSet(key, {
    createdAt: new Date().toISOString(),
    version: payload?.v ?? 0,
    bookings: payload?.data ?? [],
    settings,
  });
  if (!written) {
    return NextResponse.json({ ok: false, error: "write_failed" }, { status: 502 });
  }

  const index = (await kvGet<string[]>(INDEX_KEY)) ?? [];
  const nextIndex = [key, ...index.filter((entry) => entry !== key)].slice(0, KEEP);
  await kvSet(INDEX_KEY, nextIndex);

  console.log("[cron/backup]", JSON.stringify({ key, bookings: payload?.data?.length ?? 0, kept: nextIndex.length }));

  return NextResponse.json(
    { ok: true, key, bookings: payload?.data?.length ?? 0, snapshots: nextIndex },
    { headers: { "Cache-Control": "no-store" } }
  );
}
