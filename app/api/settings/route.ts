import { NextRequest, NextResponse } from "next/server";
import { kvConfigured, kvGet, kvSet, SETTINGS_KEY_KV } from "@/lib/kv";
import { defaultSettings, normalizeSettings, type BoardSettings } from "@/lib/settings";
import { SESSION_COOKIE, getServerWriteSecret, isServiceToken, verifySessionToken } from "@/lib/serverAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

/**
 * Le impostazioni contengono coordinate bancarie e dati fiscali: le legge solo
 * chi ha una sessione valida, e le scrive solo il proprietario (il ruolo
 * "staff" non tocca la configurazione della struttura).
 */
function sessionRole(req: NextRequest): "owner" | "staff" | null {
  const secret = getServerWriteSecret();
  if (!secret) return "owner"; // sviluppo locale senza secret

  /*
   * Il token di servizio vale quanto una sessione da proprietario, come già
   * accade su /api/bookings. Averlo accettato lì e non qui rendeva le
   * impostazioni irraggiungibili da script e automazioni senza motivo.
   */
  const token = (req.headers.get("x-internal-token") ?? "").trim();
  if (token && isServiceToken(token)) return "owner";

  const verified = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value, secret);
  return verified.valid ? verified.role : null;
}

export async function GET(req: NextRequest) {
  const role = sessionRole(req);
  if (!role) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401, headers: NO_STORE });

  if (!kvConfigured()) {
    return NextResponse.json(
      { ok: true, settings: defaultSettings(), persisted: false, warning: "KV non configurato: impostazioni non salvate sul server." },
      { headers: NO_STORE }
    );
  }

  const stored = await kvGet<BoardSettings>(SETTINGS_KEY_KV);
  const settings = stored ? normalizeSettings(stored) : defaultSettings();

  // Il collaboratore non vede le coordinate bancarie.
  if (role === "staff") {
    settings.property = { ...settings.property, bank: { holder: "", iban: "", bic: "", bank: "" } };
  }

  return NextResponse.json({ ok: true, settings, persisted: true, role }, { headers: NO_STORE });
}

export async function POST(req: NextRequest) {
  const role = sessionRole(req);
  if (!role) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401, headers: NO_STORE });
  if (role === "staff") {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403, headers: NO_STORE });
  }
  if (!kvConfigured()) {
    return NextResponse.json({ ok: false, error: "KV non configurato" }, { status: 503, headers: NO_STORE });
  }

  let incoming: unknown;
  try {
    const body = (await req.json()) as { settings?: unknown };
    incoming = body.settings;
  } catch {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400, headers: NO_STORE });
  }

  const settings = normalizeSettings(incoming);
  settings.updatedAt = new Date().toISOString();

  const written = await kvSet(SETTINGS_KEY_KV, settings);
  if (!written) {
    return NextResponse.json({ ok: false, error: "write_failed" }, { status: 502, headers: NO_STORE });
  }

  return NextResponse.json({ ok: true, settings }, { headers: NO_STORE });
}
