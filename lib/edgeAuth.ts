/**
 * Verifica della sessione nel middleware (runtime Edge): `node:crypto` non è
 * disponibile lì, quindi la stessa firma HMAC si ricalcola con Web Crypto.
 * Deve restare allineata a `lib/serverAuth.ts`.
 */

export const SESSION_COOKIE = "lfb_session";
const SESSION_PREFIX = "lfb-session";

async function signEdge(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Confronto a tempo costante: evita di far trapelare la firma un byte alla volta. */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifySessionEdge(token: string | undefined, secret: string): Promise<boolean> {
  if (!token || !secret) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [expStr, role, sig] = parts;
  if (role !== "owner" && role !== "staff") return false;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  const expected = await signEdge(secret, `${SESSION_PREFIX}.${expStr}.${role}`);
  return constantTimeEqual(sig, expected);
}
