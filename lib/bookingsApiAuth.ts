import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, getServerWriteSecret, isServiceToken, verifySessionToken } from "@/lib/serverAuth";

/** Vercel deploy o build production: le API mutanti richiedono autenticazione. */
export function isBookingsApiProductionLike(): boolean {
  return process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
}

export function getBookingApiWriteSecret(): string {
  return getServerWriteSecret();
}

export type ApiCaller = { role: "owner" | "staff" | "service" };

/**
 * Chi sta chiamando: sessione del browser (cookie httpOnly firmato) oppure
 * header X-Internal-Token per cron e automazioni. Il segreto non compare mai
 * nel bundle client.
 */
export function identifyCaller(req: NextRequest): ApiCaller | null {
  const secret = getBookingApiWriteSecret();
  if (!secret) return { role: "owner" }; // sviluppo locale senza secret

  const token = (req.headers.get("x-internal-token") ?? "").trim();
  if (token && isServiceToken(token)) return { role: "service" };

  const verified = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value, secret);
  return verified.valid ? { role: verified.role } : null;
}

export function bookingWriteAuthError(req: NextRequest): NextResponse | null {
  const secret = getBookingApiWriteSecret();

  if (isBookingsApiProductionLike() && !secret) {
    return NextResponse.json(
      { ok: false, error: "Server misconfigured: API_WRITE_SECRET o CRON_SECRET è obbligatorio in questo ambiente." },
      { status: 503 }
    );
  }

  return identifyCaller(req) ? null : NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

/** Le letture seguono le stesse regole delle scritture. */
export function bookingReadAuthError(req: NextRequest): NextResponse | null {
  if (!getBookingApiWriteSecret()) return null;
  return identifyCaller(req) ? null : NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export function kvNotConfiguredResponse(): NextResponse {
  return NextResponse.json({ ok: false, error: "KV not configured" }, { status: 503 });
}
