import { createHash } from "node:crypto";
import { LODGES, UNASSIGNED_LODGE, type Booking, type BookingChannel, type BookingLodge, type Lodge } from "@/lib/types";

// Riesportate per compatibilità con chi importa già da questo modulo.
export {
  detectPossibleDuplicates,
  findFirstFreeLodge,
  guestNameSimilarity,
  type DuplicateFlag,
} from "@/lib/lodgeAvailability";

type SyncChannel = Extract<BookingChannel, "airbnb" | "booking">;

export type IcalSyncConfig = {
  channel: SyncChannel;
  /**
   * Unità coperta dal feed. Omettere per i feed di struttura: Booking.com e Airbnb
   * vendono l'inventario complessivo e non dicono quale unità è stata venduta, quindi
   * le prenotazioni entrano in "Da assegnare" e l'host conferma il lodge.
   */
  lodge?: Lodge;
  url: string;
  label?: string;
};

export type IcalEvent = {
  uid: string;
  summary: string;
  checkIn: string;
  checkOut: string;
  status: "confirmed" | "cancelled";
  /** Numero prenotazione del canale, quando il feed lo espone. */
  bookingRef?: string;
};

export type SyncedBookingCandidate = {
  syncKey: string;
  channel: SyncChannel;
  /** UNASSIGNED_LODGE per i feed di struttura. */
  lodge: BookingLodge;
  guestName: string;
  checkIn: string;
  checkOut: string;
  status: "confirmed" | "cancelled";
  notes: string;
  externalCalendarName: string;
  bookingRef?: string;
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

/**
 * Booking.com marca le disdette come `cancelled_by_guest` / `cancelled_by_hotel`
 * anziché con lo STATUS:CANCELLED standard.
 */
function isCancelledStatus(raw: string | undefined): boolean {
  const status = (raw ?? "").trim().toUpperCase();
  return status === "CANCELLED" || status.startsWith("CANCELLED_BY_");
}

/** I feed espongono il numero prenotazione in campi diversi, o dentro l'UID. */
function extractBookingRef(fields: Record<string, string>): string | undefined {
  for (const key of ["X-BOOKING-REF", "X-BOOKING-RESERVATION-ID", "X-RESERVATION-ID"]) {
    const value = fields[key]?.trim();
    if (value) return value;
  }
  const fromDescription = fields.DESCRIPTION?.match(/\b(?:booking|reservation|prenotazione)\D{0,12}(\d{6,})/i);
  if (fromDescription) return fromDescription[1];
  const fromUid = fields.UID?.match(/^(\d{6,})/);
  if (fromUid) return fromUid[1];
  return undefined;
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
          status: isCancelledStatus(current.STATUS) ? "cancelled" : "confirmed",
          bookingRef: extractBookingRef(current),
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

/**
 * Identità stabile dell'evento remoto: solo canale + UID.
 * Date e lodge sono mutabili — se entrassero nella chiave, spostare una prenotazione
 * o assegnarle un'unità genererebbe un doppione invece di aggiornare quella esistente.
 */
function buildSyncKey(config: IcalSyncConfig, event: IcalEvent): string {
  return createHash("sha1").update(`${config.channel}|${event.uid}`).digest("hex");
}

function normalizeGuestName(summary: string, channel: SyncChannel, lodge: BookingLodge): string {
  const cleaned = summary.replace(/\s+/g, " ").trim();
  const lower = cleaned.toLowerCase();
  const generic = !cleaned || GENERIC_SUMMARIES.some((token) => lower.includes(token));
  if (generic) {
    const suffix = lodge === UNASSIGNED_LODGE ? "da assegnare" : lodge;
    return channel === "booking" ? `Booking.com · ${suffix}` : `Airbnb · ${suffix}`;
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
    // lodge assente = feed di struttura: le prenotazioni entrano in "Da assegnare".
    const hasLodge = lodge !== undefined && lodge !== null && lodge !== "";
    if (hasLodge && !LODGES.includes(lodge as Lodge)) {
      throw new Error(
        `ICAL_SYNC_CONFIG[${index}].lodge non valido: atteso uno tra ${LODGES.join(", ")}, oppure omesso per un feed di struttura.`
      );
    }
    if (typeof url !== "string" || !url.trim()) {
      throw new Error(`ICAL_SYNC_CONFIG[${index}].url mancante.`);
    }

    const scope = hasLodge ? (lodge as Lodge) : "struttura";
    const dedupeKey = `${channel}::${scope}::${url.trim()}`;
    if (seen.has(dedupeKey)) {
      throw new Error(`ICAL_SYNC_CONFIG contiene una sorgente duplicata per ${channel} ${scope}.`);
    }
    seen.add(dedupeKey);

    return {
      channel,
      ...(hasLodge ? { lodge: lodge as Lodge } : {}),
      url: url.trim(),
      label: typeof label === "string" && label.trim() ? label.trim() : `${channel}:${scope}`,
    };
  });
}

export function eventToSyncedBookingCandidate(
  config: IcalSyncConfig,
  event: IcalEvent
): SyncedBookingCandidate {
  const syncDate = new Date().toISOString();
  const scope = config.lodge ?? "struttura";
  const externalCalendarName = config.label?.trim() || `${config.channel}:${scope}`;
  const channelLabel = config.channel === "booking" ? "Booking.com" : "Airbnb";
  const lodge: BookingLodge = config.lodge ?? UNASSIGNED_LODGE;

  const notes = event.status === "cancelled"
    ? `Disdetta rilevata dal feed iCal di ${channelLabel} (${externalCalendarName}) il ${syncDate}. Record conservato per storico.`
    : `Sincronizzata automaticamente da ${channelLabel} tramite feed iCal (${externalCalendarName}) il ${syncDate}.`;

  return {
    syncKey: buildSyncKey(config, event),
    channel: config.channel,
    lodge,
    guestName: normalizeGuestName(event.summary, config.channel, lodge),
    checkIn: event.checkIn,
    checkOut: event.checkOut,
    status: event.status,
    notes,
    externalCalendarName,
    bookingRef: event.bookingRef,
  };
}

/**
 * Stessa permanenza già presente a board. Il lodge non entra nel confronto quando il
 * candidato arriva da un feed di struttura: l'unità la sceglie l'host, non il feed.
 */
export function sameStay(a: Booking, b: SyncedBookingCandidate): boolean {
  if (a.status === "cancelled") return false;
  if (a.channel !== b.channel) return false;
  if (a.checkIn !== b.checkIn || a.checkOut !== b.checkOut) return false;
  if (b.lodge === UNASSIGNED_LODGE) return true;
  return a.lodge === b.lodge;
}
