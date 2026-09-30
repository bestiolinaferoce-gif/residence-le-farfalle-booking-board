import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, constantTimeEqual, verifySessionEdge } from "@/lib/edgeAuth";

/**
 * Nessuna pagina della board è pubblica. Fanno eccezione il login e il feed
 * iCal, che deve restare raggiungibile dai crawler di Booking e Airbnb (è
 * protetto da un token nell'URL, non dalla sessione).
 */
const PUBLIC_PATHS = ["/login", "/api/login", "/api/logout", "/api/calendar", "/api/ical", "/api/cron"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const secret = (process.env.API_WRITE_SECRET ?? process.env.CRON_SECRET ?? "").trim();
  // Sviluppo locale senza secret: board aperta, come le altre board del gruppo.
  if (!secret) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (await verifySessionEdge(token, secret)) return NextResponse.next();

  /*
   * Chiamanti non umani (n8n, script di import, monitoraggi) non hanno un
   * cookie di sessione: si autenticano col token di servizio. Senza questo
   * controllo il middleware li respingerebbe prima ancora della rotta, che
   * pure saprebbe riconoscerli.
   */
  const serviceToken = req.headers.get("x-internal-token")?.trim();
  const serviceSecrets = [process.env.API_WRITE_SECRET, process.env.CRON_SECRET]
    .map((value) => (value ?? "").trim())
    .filter(Boolean);
  if (serviceToken && serviceSecrets.some((value) => constantTimeEqual(serviceToken, value))) {
    return NextResponse.next();
  }

  // Le API rispondono 401: il client mostra l'errore invece di ricevere l'HTML del login.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icons|sw.js|workbox-).*)"],
};
