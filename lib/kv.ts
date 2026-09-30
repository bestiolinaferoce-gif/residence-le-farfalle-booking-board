/**
 * Accesso a Upstash Redis via REST (lo stesso provider usato dalle altre board).
 * Chiavi con prefisso `lfb_` = Residence Le Farfalle: un database condiviso per
 * errore non mescolerebbe comunque i dati di due strutture.
 */

const BASE = process.env.KV_REST_API_URL ?? "";
const TOKEN = process.env.KV_REST_API_TOKEN ?? "";

export const BOOKINGS_KEY = "lfb_bookings";
export const SETTINGS_KEY_KV = "lfb_settings";
export const SYNC_LOG_KEY = "lfb_sync_log";

export function kvConfigured(): boolean {
  return Boolean(BASE && TOKEN);
}

export async function kvGet<T>(key: string): Promise<T | null> {
  if (!kvConfigured()) return null;
  const res = await fetch(`${BASE}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { result: string | null };
  if (!json.result) return null;
  try {
    return JSON.parse(json.result) as T;
  } catch {
    return null;
  }
}

export async function kvSet<T>(key: string, value: T): Promise<boolean> {
  if (!kvConfigured()) return false;
  const res = await fetch(`${BASE}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify([["SET", key, JSON.stringify(value)]]),
  });
  return res.ok;
}
