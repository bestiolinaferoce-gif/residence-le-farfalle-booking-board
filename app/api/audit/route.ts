import { NextRequest, NextResponse } from "next/server";
import { bookingReadAuthError } from "@/lib/bookingsApiAuth";
import { readAuditLog } from "@/lib/auditLog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Registro modifiche: chi ha toccato cosa, in ordine dal più recente. */
export async function GET(req: NextRequest) {
  const authErr = bookingReadAuthError(req);
  if (authErr) return authErr;

  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 100) || 100, 500);
  const bookingId = req.nextUrl.searchParams.get("bookingId");

  const entries = await readAuditLog();
  const filtered = bookingId ? entries.filter((entry) => entry.bookingId === bookingId) : entries;

  return NextResponse.json(
    { ok: true, entries: filtered.slice(0, limit), total: filtered.length },
    { headers: { "Cache-Control": "no-store" } }
  );
}
