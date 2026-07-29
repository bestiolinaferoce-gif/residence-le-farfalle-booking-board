import { NextRequest, NextResponse } from "next/server";
import { bookingWriteAuthError } from "@/lib/bookingsApiAuth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Compone l'URL del feed iCal col token corrente, così il token non finisce
 * nel bundle client. Riusa l'auth delle scritture: chi può modificare la board
 * può anche leggere il link da consegnare ai canali.
 */
export async function GET(req: NextRequest) {
  const authErr = bookingWriteAuthError(req);
  if (authErr) return authErr;

  const token = process.env.ICAL_FEED_TOKEN?.trim();
  const origin = req.nextUrl.origin;
  const url = token
    ? `${origin}/api/calendar?token=${encodeURIComponent(token)}`
    : `${origin}/api/calendar`;

  return NextResponse.json(
    {
      ok: true,
      url,
      protected: Boolean(token),
      ...(token
        ? {}
        : { warning: "ICAL_FEED_TOKEN non configurato: il feed è pubblico e indovinabile." }),
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
