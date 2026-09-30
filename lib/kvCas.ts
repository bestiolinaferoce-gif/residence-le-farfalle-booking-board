import { BOOKINGS_KEY, kvConfigured } from "@/lib/kv";
import { TRASH_RETENTION_DAYS, type Booking } from "@/lib/types";

/**
 * Scrittura compare-and-swap sulle prenotazioni.
 *
 * Senza CAS due scritture concorrenti (l'host dal telefono e il cron che
 * importa da Booking) si sovrascrivono a vicenda: l'ultima vince e le
 * modifiche dell'altra spariscono. Qui la scrittura passa solo se la versione
 * sul database è ancora quella letta prima del merge; altrimenti il chiamante
 * rilegge e riprova.
 */

const BASE = process.env.KV_REST_API_URL ?? "";
const TOKEN = process.env.KV_REST_API_TOKEN ?? "";

export type KVBookingsPayload = {
  v: number;
  ts: string;
  data: Booking[];
  deletedIds?: string[];
};

export const MAX_DELETED_IDS = 5000;

export function capDeletedIds(ids: string[]): string[] {
  return ids.length > MAX_DELETED_IDS ? ids.slice(ids.length - MAX_DELETED_IDS) : ids;
}

export { kvConfigured };

export async function readBookingsKV(): Promise<KVBookingsPayload | null> {
  if (!kvConfigured()) return null;
  const res = await fetch(`${BASE}/get/${BOOKINGS_KEY}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { result: string | null };
  if (!json.result) return null;
  const parsed = JSON.parse(json.result) as KVBookingsPayload | Booking[];
  if (Array.isArray(parsed)) {
    return { v: 1, ts: new Date().toISOString(), data: parsed };
  }
  return parsed;
}

/**
 * Scrive solo se `v` sul database coincide con `expectedVersion`.
 * Ritorna 1 se scritto, 0 se qualcun altro ha scritto nel frattempo.
 */
const CAS_SCRIPT = `
local cur = redis.call('GET', KEYS[1])
if cur then
  local ok, decoded = pcall(cjson.decode, cur)
  if ok and type(decoded) == 'table' and decoded.v ~= nil then
    if tonumber(decoded.v) ~= tonumber(ARGV[1]) then
      return 0
    end
  end
end
redis.call('SET', KEYS[1], ARGV[2])
return 1
`.trim();

export async function casWriteBookingsKV(
  expectedVersion: number,
  payload: KVBookingsPayload
): Promise<boolean> {
  if (!kvConfigured()) return false;
  const res = await fetch(BASE, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(["EVAL", CAS_SCRIPT, "1", BOOKINGS_KEY, String(expectedVersion), JSON.stringify(payload)]),
  });
  if (!res.ok) return false;
  const json = (await res.json()) as { result?: number | string; error?: string };
  if (json.error) return false;
  return Number(json.result) === 1;
}

/**
 * Svuota il cestino oltre la finestra di ripristino. Girare qui, alla
 * scrittura, evita un job dedicato: il cestino si pulisce da solo mentre si
 * lavora.
 */
export function purgeExpiredTrash(bookings: Booking[], now: Date = new Date()): {
  kept: Booking[];
  purged: Booking[];
} {
  const cutoff = now.getTime() - TRASH_RETENTION_DAYS * 86_400_000;
  const kept: Booking[] = [];
  const purged: Booking[] = [];
  for (const booking of bookings) {
    const deletedAt = booking.deletedAt ? Date.parse(booking.deletedAt) : NaN;
    if (Number.isFinite(deletedAt) && deletedAt < cutoff) purged.push(booking);
    else kept.push(booking);
  }
  return { kept, purged };
}
