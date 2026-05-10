import { createHash } from "node:crypto";
import type { Booking, BookingChannel, Lodge } from "@/lib/types";

type SyncChannel = Extract<BookingChannel, "airbnb" | "booking">;

export type IcalSyncConfig = {
  channel: SyncChannel;
  lodge: Lodge;
  url: string;
  label?: string;
};

export type IcalEvent = {
  uid: string;
  summary: string;
  checkIn: string;
  checkOut: string;
  status: "confirmed" | "cancelled";
};

export type SyncedBookingCandidate = {
  syncKey: string;
  channel: SyncChannel;
  lodge: Lodge;
  guestName: string;
  checkIn: string;
  checkOut: string;
  status: "confirmed" | "cancelled";
  notes: string;
  externalCalendarName: string;
};

const GENERIC_SUMMARIES = [
  "reserved",
  "reservation",
  "not available",
  "unavailable",
  "blocked",
  "booked",
  "occupato",
  "prenotato",
  "calendar",
];

function toIsoDate(raw: string): string | null {
  const compact = raw.replace(/[^0-9]/g, "").slice(0, 8);
  if (compact.length !== 8) return null;
  return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
}

function unfoldIcsLines(ics: string): string[] {
  const normalized = ics.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rawLines = normalized.split("\n");
  const lines: string[] = [];

  for (const rawLine of rawLines) {
    if ((rawLine.startsWith(" ") || rawLine.startsWith("\t")) && lines.length > 0) {
      lines[lines.length - 1] += rawLine.slice(1);
      continue;
    }
    lines.push(rawLine);
  }

  return lines;
}

function parseIcsField(line: string): { key: string; value: string } | null {
  const idx = line.indexOf(":");
  if (idx <= 0) return null;
  const left = line.slice(0, idx);
  const value = line.slice(idx + 1).trim();
  const key = left.split(";")[0]?.trim().toUpperCase();
  if (!key) return null;
  return { key, value };
}

export function parseIcsEvents(ics: string): IcalEvent[] {
  const lines = unfoldIcsLines(ics);
  const events: IcalEvent[] = [];
  let current: Record<string, string> | null = null;

  for (const line of lines) {
    const upper = line.trim().toUpperCase();
    if (upper === "BEGIN:VEVENT") {
      current = {};
      continue;
    }
    if (upper === "END:VEVENT") {
      if (!current) continue;
      const checkIn = toIsoDate(current.DTSTART ?? "");
      const checkOut = toIsoDate(current.DTEND ?? "");
      const uid = (current.UID ?? "").trim();
      if (uid && checkIn && checkOut && checkIn < checkOut) {
        events.push({
          uid,
          summary: (current.SUMMARY ?? "").trim(),
          checkIn,
          checkOut,
          status: (current.STATUS ?? "").toUpperCase() === "CANCELLED" ? "cancelled" : "confirmed",
        });
      }
      current = null;
      continue;
    }
    if (!current) continue;
    const field = parseIcsField(line);
    if (!field) continue;
    current[field.key] = field.value;
  }

  return events;
}

function buildSyncKey(config: IcalSyncConfig, event: IcalEvent): string {
  const base = `${config.channel}|${config.lodge}|${event.uid}|${event.checkIn}|${event.checkOut}`;
  return createHash("sha1").update(base).digest("hex");
}

function normalizeGuestName(summary: string, channel: SyncChannel, lodge: Lodge): string {
  const cleaned = summary.replace(/\s+/g, " ").trim();
  const lower = cleaned.toLowerCase();
  const generic = !cleaned || GENERIC_SUMMARIES.some((token) => lower.includes(token));
  if (generic) {
    return channel === "booking" ? `Booking.com · ${lodge}` : `Airbnb · ${lodge}`;
  }
  return cleaned.slice(0, 120);
}

export function loadIcalSyncConfigFromEnv(): IcalSyncConfig[] {
  const raw = process.env.ICAL_SYNC_CONFIG?.trim() ?? "";
  if (!raw) return [];
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("ICAL_SYNC_CONFIG deve essere un array JSON.");
  }

  const seen = new Set<string>();

  return parsed.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new Error(`ICAL_SYNC_CONFIG[${index}] non valido.`);
    }
    const entry = item as Record<string, unknown>;
    const channel = entry.channel;
    const lodge = entry.lodge;
    const url = entry.url;
    const label = entry.label;

    if (channel !== "airbnb" && channel !== "booking") {
      throw new Error(`ICAL_SYNC_CONFIG[${index}].channel deve essere "airbnb" o "booking".`);
    }
    if (lodge !== "Limone" && lodge !== "Macaone" && lodge !== "Vanessa" && lodge !== "Aurora") {
      throw new Error(`ICAL_SYNC_CONFIG[${index}].lodge non valido.`);
    }
    if (typeof url !== "string" || !url.trim()) {
      throw new Error(`ICAL_SYNC_CONFIG[${index}].url mancante.`);
    }

    const dedupeKey = `${channel}::${lodge}::${url.trim()}`;
    if (seen.has(dedupeKey)) {
      throw new Error(`ICAL_SYNC_CONFIG contiene una sorgente duplicata per ${channel} ${lodge}.`);
    }
    seen.add(dedupeKey);

    return {
      channel,
      lodge,
      url: url.trim(),
      label: typeof label === "string" && label.trim() ? label.trim() : `${channel}:${lodge}`,
    };
  });
}

export function eventToSyncedBookingCandidate(
  config: IcalSyncConfig,
  event: IcalEvent
): SyncedBookingCandidate {
  const syncDate = new Date().toISOString();
  const externalCalendarName = config.label?.trim() || `${config.channel}:${config.lodge}`;
  const channelLabel = config.channel === "booking" ? "Booking.com" : "Airbnb";

  return {
    syncKey: buildSyncKey(config, event),
    channel: config.channel,
    lodge: config.lodge,
    guestName: normalizeGuestName(event.summary, config.channel, config.lodge),
    checkIn: event.checkIn,
    checkOut: event.checkOut,
    status: event.status,
    notes: `Sincronizzata automaticamente da ${channelLabel} tramite feed iCal (${externalCalendarName}) il ${syncDate}.`,
    externalCalendarName,
  };
}

export function sameStay(a: Booking, b: SyncedBookingCandidate): boolean {
  return (
    a.channel === b.channel &&
    a.lodge === b.lodge &&
    a.checkIn === b.checkIn &&
    a.checkOut === b.checkOut &&
    a.status !== "cancelled"
  );
}
