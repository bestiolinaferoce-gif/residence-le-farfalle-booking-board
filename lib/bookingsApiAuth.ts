import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/** Vercel deploy o build production: richiede secret di scrittura per le API mutanti. */
export function isBookingsApiProductionLike(): boolean {
  return process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
}

export function getBookingApiWriteSecret(): string {
  return (
    process.env.NEXT_PUBLIC_API_WRITE_SECRET ??
    process.env.API_WRITE_SECRET ??
    process.env.CRON_SECRET ??
    ""
  ).trim();
}

/**
 * Header X-Internal-Token uguale a API_WRITE_SECRET o CRON_SECRET.
 * In ambiente production-like senza secret configurato → 503.
 */
export function bookingWriteAuthError(req: NextRequest): NextResponse | null {
  const apiSecret = getBookingApiWriteSecret();
  const clientToken = (req.headers.get("x-internal-token") ?? "").trim();

  if (isBookingsApiProductionLike() && !apiSecret) {
    return NextResponse.json(
      {
        ok: false,
        error: "Server misconfigured: API_WRITE_SECRET or CRON_SECRET is required in this environment.",
      },
      { status: 503 }
    );
  }

  if (apiSecret && clientToken !== apiSecret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return null;
}

export function kvNotConfiguredResponse(): NextResponse {
  return NextResponse.json({ ok: false, error: "KV not configured" }, { status: 503 });
}
