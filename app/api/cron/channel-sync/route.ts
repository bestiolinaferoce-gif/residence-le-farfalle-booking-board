import { NextRequest, NextResponse } from "next/server";
import { kvNotConfiguredResponse } from "@/lib/bookingsApiAuth";
import { ChannelSyncConfigError, isChannelSyncStorageReady, runChannelSync } from "@/lib/runChannelSync";

export const dynamic = "force-dynamic";
export const revalidate = 0;
/** I feed dei canali possono essere lenti: il default di 10s non basta. */
export const maxDuration = 60;

/**
 * Endpoint del Vercel Cron (vedi la sezione `crons` in vercel.json).
 * Vercel chiama in GET con `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();

  // Senza secret l'endpoint sarebbe una scrittura pubblica: meglio spento che aperto.
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET non configurato: cron disattivato." },
      { status: 503 }
    );
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  if (!isChannelSyncStorageReady()) return kvNotConfiguredResponse();

  const startedAt = Date.now();
  try {
    const result = await runChannelSync();
    console.log("[cron/channel-sync]", JSON.stringify({
      importedEvents: result.importedEvents,
      created: result.created,
      updated: result.updated,
      cancelled: result.cancelled,
      unassigned: result.unassigned,
      overbookings: result.overbookings,
      conflicts: result.conflicts.length,
      possibleDuplicates: result.possibleDuplicates.length,
      v: result.v,
      ms: Date.now() - startedAt,
    }));
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore sync canali.";
    console.error("[cron/channel-sync] fallito:", message);
    return NextResponse.json(
      { ok: false, error: message },
      {
        status: error instanceof ChannelSyncConfigError ? 400 : 500,
        headers: { "Cache-Control": "no-store, max-age=0" },
      }
    );
  }
}
