/**
 * Validazione delle prenotazioni, condivisa fra client e server.
 *
 * Il form controlla per dare un errore immediato; l'API ricontrolla perché il
 * form non è una barriera: chiunque abbia la sessione può chiamare l'endpoint
 * a mano, e una data incoerente o un doppio impegno della stessa camera
 * arriverebbero comunque nei dati.
 */

import { LODGES, UNASSIGNED_LODGE, type Booking } from "@/lib/types";
import { overlaps } from "@/lib/utils";

export type ValidationIssue = { field: string; message: string };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && ISO_DATE.test(value.slice(0, 10)) && !Number.isNaN(Date.parse(value));
}

function isNonNegative(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

/** Controlli sul singolo record, indipendenti dalle altre prenotazioni. */
export function validateBookingShape(booking: Partial<Booking>, options?: { capacity?: number | null }): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!booking.guestName || !String(booking.guestName).trim()) {
    issues.push({ field: "guestName", message: "Il nome dell'ospite è obbligatorio." });
  }

  const lodge = String(booking.lodge ?? "");
  if (lodge !== UNASSIGNED_LODGE && !(LODGES as readonly string[]).includes(lodge)) {
    issues.push({ field: "lodge", message: `Camera non valida: "${lodge}".` });
  }

  if (!isIsoDate(booking.checkIn)) {
    issues.push({ field: "checkIn", message: "Data di check-in non valida." });
  }
  if (!isIsoDate(booking.checkOut)) {
    issues.push({ field: "checkOut", message: "Data di check-out non valida." });
  }
  if (isIsoDate(booking.checkIn) && isIsoDate(booking.checkOut)) {
    if (booking.checkOut.slice(0, 10) <= booking.checkIn.slice(0, 10)) {
      issues.push({ field: "checkOut", message: "Il check-out deve essere successivo al check-in." });
    }
  }

  const guests = booking.guestsCount;
  if (typeof guests !== "number" || !Number.isInteger(guests) || guests < 1) {
    issues.push({ field: "guestsCount", message: "Indica almeno 1 adulto." });
  } else if (options?.capacity != null && guests > options.capacity) {
    issues.push({
      field: "guestsCount",
      message: `La camera ospita al massimo ${options.capacity} persone.`,
    });
  }

  if (!isNonNegative(booking.totalAmount)) {
    issues.push({ field: "totalAmount", message: "Il totale non può essere negativo." });
  }
  if (!isNonNegative(booking.depositAmount)) {
    issues.push({ field: "depositAmount", message: "L'acconto non può essere negativo." });
  }
  if (
    isNonNegative(booking.totalAmount) &&
    isNonNegative(booking.depositAmount) &&
    (booking.depositAmount as number) > (booking.totalAmount as number)
  ) {
    issues.push({ field: "depositAmount", message: "L'acconto supera il totale." });
  }

  return issues;
}

/** Prenotazioni che occupano davvero inventario: le altre non creano conflitto. */
function occupiesInventory(booking: Booking): boolean {
  return !booking.deletedAt && booking.status !== "cancelled" && booking.lodge !== UNASSIGNED_LODGE;
}

/** Sovrapposizioni sulla stessa camera, escluso il record che si sta salvando. */
export function findOverlaps(candidate: Booking, all: Booking[]): Booking[] {
  if (!occupiesInventory(candidate)) return [];
  return all.filter(
    (other) =>
      other.id !== candidate.id &&
      other.lodge === candidate.lodge &&
      occupiesInventory(other) &&
      overlaps(candidate, other)
  );
}

/** Tutte le coppie in conflitto: alimenta il pannello overbooking. */
export function detectOverbookings(bookings: Booking[]): Array<{ a: Booking; b: Booking }> {
  const conflicts: Array<{ a: Booking; b: Booking }> = [];
  const relevant = bookings.filter(occupiesInventory);
  for (let i = 0; i < relevant.length; i += 1) {
    for (let j = i + 1; j < relevant.length; j += 1) {
      if (relevant[i].lodge === relevant[j].lodge && overlaps(relevant[i], relevant[j])) {
        conflicts.push({ a: relevant[i], b: relevant[j] });
      }
    }
  }
  return conflicts;
}

/**
 * Validazione dell'intero payload in arrivo sull'API. Non blocca le
 * sovrapposizioni — quelle nascono anche legittimamente da un feed OTA e vanno
 * mostrate, non rifiutate — ma le riporta al chiamante.
 */
export function validateBookingsPayload(bookings: Booking[]): {
  errors: Array<{ id: string; issues: ValidationIssue[] }>;
  overbookings: number;
} {
  const errors: Array<{ id: string; issues: ValidationIssue[] }> = [];
  for (const booking of bookings) {
    const issues = validateBookingShape(booking);
    if (issues.length > 0) errors.push({ id: booking.id ?? "(senza id)", issues });
  }
  return { errors, overbookings: detectOverbookings(bookings).length };
}
