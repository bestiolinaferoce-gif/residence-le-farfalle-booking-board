import { createHmac, timingSafeEqual } from "crypto";

/**
 * Autenticazione server-side della board.
 *
 * Il segreto non è mai referenziato da codice client: niente prefisso
 * NEXT_PUBLIC_, altrimenti finirebbe nel bundle JS scaricabile da chiunque.
 * La sessione è un token firmato HMAC, senza storage: `<scadenzaMs>.<firma>`.
 */

export const SESSION_COOKIE = "lfb_session";
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 giorni
const SESSION_PREFIX = "lfb-session";

export function getServerWriteSecret(): string {
  return (process.env.API_WRITE_SECRET ?? process.env.CRON_SECRET ?? "").trim();
}

/**
 * Token di servizio accettati nell'header X-Internal-Token (cron, script,
 * automazioni). NEXT_PUBLIC_API_WRITE_SECRET non vale più: finiva nel bundle
 * JavaScript pubblico della vecchia board, quindi non è un segreto.
 */
export function getServiceTokens(): string[] {
  return [process.env.API_WRITE_SECRET, process.env.CRON_SECRET]
    .map((value) => (value ?? "").trim())
    .filter((value) => value.length > 0);
}

export function isServiceToken(token: string): boolean {
  if (!token) return false;
  return getServiceTokens().some((secret) => safeEqual(token, secret));
}

/**
 * Password di accesso alla board. Le Farfalle la teneva in
 * NEXT_PUBLIC_APP_PASSWORD: resta valida, ora verificata solo lato server.
 * In assenza di entrambe vale il token API: un deploy non resta mai aperto.
 */
export function getLoginPassword(): string {
  return (process.env.APP_PASSWORD ?? process.env.NEXT_PUBLIC_APP_PASSWORD ?? getServerWriteSecret()).trim();
}



/** Password del collaboratore: accesso senza Impostazioni né dati bancari. */
export function getStaffPassword(): string {
  return (process.env.STAFF_PASSWORD ?? "").trim();
}

export type SessionRole = "owner" | "staff";

function sign(secret: string, message: string): string {
  return createHmac("sha256", secret).update(message).digest("hex");
}

export function createSessionToken(
  secret: string,
  role: SessionRole = "owner",
  ttlMs: number = SESSION_TTL_MS
): string {
  const exp = Date.now() + ttlMs;
  return `${exp}.${role}.${sign(secret, `${SESSION_PREFIX}.${exp}.${role}`)}`;
}

export type VerifiedSession = { valid: true; role: SessionRole } | { valid: false; role: null };

export function verifySessionToken(token: string | undefined | null, secret: string): VerifiedSession {
  const invalid: VerifiedSession = { valid: false, role: null };
  if (!token || !secret) return invalid;

  const parts = token.split(".");
  if (parts.length !== 3) return invalid;
  const [expStr, role, sig] = parts;
  if (role !== "owner" && role !== "staff") return invalid;

  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Date.now()) return invalid;

  const expected = sign(secret, `${SESSION_PREFIX}.${expStr}.${role}`);
  if (sig.length !== expected.length) return invalid;
  try {
    const ok = timingSafeEqual(Buffer.from(sig, "utf8"), Buffer.from(expected, "utf8"));
    return ok ? { valid: true, role } : invalid;
  } catch {
    return invalid;
  }
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  try {
    return timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}
