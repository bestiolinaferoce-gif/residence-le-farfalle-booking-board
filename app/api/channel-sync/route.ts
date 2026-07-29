import { NextRequest, NextResponse } from "next/server";
import { bookingWriteAuthError, kvNotConfiguredResponse } from "@/lib/bookingsApiAuth";
import { loadIcalSyncConfigFromEnv } from "@/lib/channelSync";
import { ChannelSyncConfigError, isChannelSyncStorageReady, runChannelSync } from "@/lib/runChannelSync";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const configs = loadIcalSyncConfigFromEnv();
    return NextResponse.json({
      ok: true,
      configuredSources: configs.map((item) => ({
        channel: item.channel,
        lodge: item.lodge ?? null,
        scope: item.lodge ? "lodge" : "property",
        label: item.label ?? `${item.channel}:${item.lodge ?? "struttura"}`,
      })),
      sourceCount: configs.length,
      mode: "ical-pull",
    }, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "Configurazione sync non valida.",
    }, {
      status: 500,
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  }
}

export async function POST(req: NextRequest) {
  const authErr = bookingWriteAuthError(req);
  if (authErr) return authErr;
  if (!isChannelSyncStorageReady()) return kvNotConfiguredResponse();

  try {
    const result = await runChannelSync();
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "Errore sync canali.",
    }, {
      status: error instanceof ChannelSyncConfigError ? 400 : 500,
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  }
}
