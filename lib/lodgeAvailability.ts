/**
 * Funzioni pure su disponibilità e somiglianza fra nomi.
 *
 * Separate da channelSync.ts perché quel modulo importa `node:crypto`:
 * tenerle qui permette ai componenti client di usarle senza trascinare
 * un modulo Node dentro il bundle del browser.
 */
import { LODGES, type Booking, type Lodge } from "@/lib/types";

/** Confronto tollerante a maiuscole, accenti, punteggiatura e ordine di nome/cognome. */
function nameTokens(raw: string): string[] {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2)
    .sort();
}

/**
 * Somiglianza fra nomi ospite in [0,1] sull'indice di Jaccard dei token.
 * "Alec Sebastiani" e "Alex Sebastiani" condividono il cognome → 0.33.
 */
export function guestNameSimilarity(a: string, b: string): number {
  const left = new Set(nameTokens(a));
  const right = new Set(nameTokens(b));
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const token of left) if (right.has(token)) shared += 1;
  return shared / (left.size + right.size - shared);
}

export type DuplicateFlag = {
  bookingId: string;
  otherId: string;
  guestName: string;
  otherGuestName: string;
  reason: string;
};

/**
 * Segnala possibili doppioni inseriti a mano: date coincidenti e nomi simili su unità
 * diverse. Solo segnalazione — la scelta di cosa cancellare resta all'host.
 */
export function detectPossibleDuplicates(bookings: Booking[], threshold = 0.3): DuplicateFlag[] {
  const active = bookings.filter((b) => b.status !== "cancelled");
  const flags: DuplicateFlag[] = [];

  for (let i = 0; i < active.length; i += 1) {
    for (let j = i + 1; j < active.length; j += 1) {
      const a = active[i];
      const b = active[j];
      if (a.bookingRef && b.bookingRef && a.bookingRef === b.bookingRef) {
        flags.push({
          bookingId: a.id,
          otherId: b.id,
          guestName: a.guestName,
          otherGuestName: b.guestName,
          reason: `Stesso numero prenotazione ${a.bookingRef}`,
        });
        continue;
      }
      const overlaps = a.checkIn < b.checkOut && b.checkIn < a.checkOut;
      if (!overlaps) continue;
      const similarity = guestNameSimilarity(a.guestName, b.guestName);
      if (similarity < threshold) continue;
      flags.push({
        bookingId: a.id,
        otherId: b.id,
        guestName: a.guestName,
        otherGuestName: b.guestName,
        reason: `Date sovrapposte e nomi simili (${Math.round(similarity * 100)}%)`,
      });
    }
  }

  return flags;
}

/**
 * Primo lodge senza sovrapposizioni per quelle date, nell'ordine di LODGES.
 * null = struttura piena, quindi overbooking.
 */
export function findFirstFreeLodge(
  bookings: Booking[],
  checkIn: string,
  checkOut: string,
  excludeId?: string
): Lodge | null {
  for (const lodge of LODGES) {
    const busy = bookings.some((booking) => {
      if (booking.id === excludeId) return false;
      if (booking.lodge !== lodge) return false;
      if (booking.status === "cancelled") return false;
      return booking.checkIn < checkOut && checkIn < booking.checkOut;
    });
    if (!busy) return lodge;
  }
  return null;
}
