/**
 * Registro modifiche: chi ha cambiato cosa e quando.
 *
 * Serve a rispondere alla domanda che prima o poi arriva ("chi ha spostato
 * questa prenotazione?") senza dover ricostruire a memoria. Vive su KV accanto
 * ai dati, con un tetto di righe: un log che cresce senza limite finirebbe per
 * appesantire ogni lettura delle prenotazioni.
 */

import { kvGet, kvSet } from "@/lib/kv";
import type { Booking } from "@/lib/types";

export const AUDIT_KEY = "lfb_audit";
export const MAX_AUDIT_ENTRIES = 500;

export type AuditAction = "created" | "updated" | "deleted" | "restored" | "purged" | "synced";

export type AuditEntry = {
  ts: string;
  actor: string;
  action: AuditAction;
  bookingId: string;
  guestName: string;
  /** Campi cambiati, con valore prima → dopo. Vuoto per creazioni. */
  changes?: Array<{ field: string; from: string; to: string }>;
};

const TRACKED_FIELDS: Array<keyof Booking> = [
  "guestName",
  "lodge",
  "checkIn",
  "checkOut",
  "status",
  "channel",
  "guestsCount",
  "totalAmount",
  "depositAmount",
  "depositReceived",
  "balancePaid",
  "paymentMethod",
  "notes",
];

function asText(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "boolean") return value ? "sì" : "no";
  return String(value);
}

export function diffBooking(previous: Booking, next: Booking) {
  const changes: Array<{ field: string; from: string; to: string }> = [];
  for (const field of TRACKED_FIELDS) {
    const from = asText(previous[field]);
    const to = asText(next[field]);
    if (from !== to) changes.push({ field: String(field), from, to });
  }
  return changes;
}

/** Confronta due snapshot e produce le righe di log corrispondenti. */
export function buildAuditEntries(previous: Booking[], next: Booking[], actor: string): AuditEntry[] {
  const ts = new Date().toISOString();
  const previousMap = new Map(previous.map((b) => [b.id, b]));
  const nextMap = new Map(next.map((b) => [b.id, b]));
  const entries: AuditEntry[] = [];

  for (const booking of next) {
    const before = previousMap.get(booking.id);
    if (!before) {
      entries.push({ ts, actor, action: "created", bookingId: booking.id, guestName: booking.guestName });
      continue;
    }
    if (!before.deletedAt && booking.deletedAt) {
      entries.push({ ts, actor, action: "deleted", bookingId: booking.id, guestName: booking.guestName });
      continue;
    }
    if (before.deletedAt && !booking.deletedAt) {
      entries.push({ ts, actor, action: "restored", bookingId: booking.id, guestName: booking.guestName });
      continue;
    }
    const changes = diffBooking(before, booking);
    if (changes.length > 0) {
      entries.push({ ts, actor, action: "updated", bookingId: booking.id, guestName: booking.guestName, changes });
    }
  }

  for (const booking of previous) {
    if (!nextMap.has(booking.id)) {
      entries.push({ ts, actor, action: "purged", bookingId: booking.id, guestName: booking.guestName });
    }
  }

  return entries;
}

export async function readAuditLog(): Promise<AuditEntry[]> {
  return (await kvGet<AuditEntry[]>(AUDIT_KEY)) ?? [];
}

export async function appendAuditEntries(entries: AuditEntry[]): Promise<void> {
  if (entries.length === 0) return;
  const current = await readAuditLog();
  await kvSet(AUDIT_KEY, [...entries, ...current].slice(0, MAX_AUDIT_ENTRIES));
}
