/**
 * Verifica della logica di sync iCal su feed sintetici.
 *   npx tsx scripts/verify-channel-sync.ts
 */
import {
  detectPossibleDuplicates,
  eventToSyncedBookingCandidate,
  findFirstFreeLodge,
  guestNameSimilarity,
  loadIcalSyncConfigFromEnv,
  parseIcsEvents,
  sameStay,
} from "@/lib/channelSync";
import { UNASSIGNED_LODGE, type Booking } from "@/lib/types";

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${ok ? "" : `\n       atteso ${JSON.stringify(expected)}\n       ossia  ${JSON.stringify(actual)}`}`);
}

// Feed di struttura Booking.com: nessuna unità indicata, una disdetta con status esteso.
const BOOKING_FEED = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:5730179557@booking.com
DTSTART;VALUE=DATE:20260809
DTEND;VALUE=DATE:20260812
SUMMARY:CLOSED - Not available
STATUS:CONFIRMED
END:VEVENT
BEGIN:VEVENT
UID:6122003495@booking.com
DTSTART;VALUE=DATE:20260813
DTEND;VALUE=DATE:20260818
SUMMARY:Nicolas Casalini
STATUS:CANCELLED_BY_GUEST
END:VEVENT
END:VCALENDAR`;

const events = parseIcsEvents(BOOKING_FEED);
check("due eventi letti", events.length, 2);
check("cancelled_by_guest riconosciuto", events[1].status, "cancelled");
check("evento normale confermato", events[0].status, "confirmed");
check("bookingRef estratto dall'UID", events[0].bookingRef, "5730179557");

// Config senza lodge = feed di struttura.
process.env.ICAL_SYNC_CONFIG = JSON.stringify([
  { channel: "booking", url: "https://example.invalid/booking.ics" },
  { channel: "airbnb", lodge: "Limone", url: "https://example.invalid/airbnb.ics" },
]);
const configs = loadIcalSyncConfigFromEnv();
check("feed di struttura senza lodge", configs[0].lodge, undefined);
check("feed per unità conserva il lodge", configs[1].lodge, "Limone");

const candidate = eventToSyncedBookingCandidate(configs[0], events[0]);
check("candidato va in Da assegnare", candidate.lodge, UNASSIGNED_LODGE);
check("summary generico non diventa nome ospite", candidate.guestName, "Booking.com · da assegnare");

// La chiave di sync non deve dipendere da date o unità.
const moved = eventToSyncedBookingCandidate(configs[0], { ...events[0], checkIn: "2026-08-10", checkOut: "2026-08-13" });
check("syncKey stabile allo spostamento date", moved.syncKey, candidate.syncKey);

// Somiglianza nomi: il caso reale Alec/Alex Sebastiani.
check("Alec vs Alex Sebastiani sopra soglia", guestNameSimilarity("Alec Sebastiani", "Alex Sebastiani") >= 0.3, true);
check("nomi diversi sotto soglia", guestNameSimilarity("Marta Perrulli", "Gabriel Rossini") < 0.3, true);
check("stesso nome invertito", guestNameSimilarity("Mario Rossi", "Rossi Mario"), 1);

const base = (over: Partial<Booking>): Booking => ({
  id: "x", guestName: "T", lodge: "Limone", checkIn: "2026-08-01", checkOut: "2026-08-03",
  status: "confirmed", channel: "direct", notes: "", guestsCount: 2, totalAmount: 0,
  depositAmount: 0, depositReceived: false, createdAt: "", updatedAt: "", ...over,
});

// Primo lodge libero e rilevamento struttura piena.
const full = ["Limone", "Macaone", "Vanessa", "Aurora"].map((lodge, i) =>
  base({ id: `b${i}`, lodge: lodge as Booking["lodge"], checkIn: "2026-08-09", checkOut: "2026-08-12" })
);
check("propone la prima unità libera", findFirstFreeLodge(full.slice(0, 2), "2026-08-09", "2026-08-12"), "Vanessa");
check("struttura piena → null (overbooking)", findFirstFreeLodge(full, "2026-08-09", "2026-08-12"), null);
check("una cancellata libera il posto",
  findFirstFreeLodge([...full.slice(0, 3), base({ id: "b3", lodge: "Aurora", status: "cancelled", checkIn: "2026-08-09", checkOut: "2026-08-12" })], "2026-08-09", "2026-08-12"),
  "Aurora");

// sameStay ignora il lodge quando il candidato arriva da un feed di struttura.
const already = base({ id: "assigned", lodge: "Macaone", channel: "booking", checkIn: "2026-08-09", checkOut: "2026-08-12" });
check("riaggancia una prenotazione già assegnata", sameStay(already, candidate), true);
check("non riaggancia una cancellata", sameStay({ ...already, status: "cancelled" }, candidate), false);

// Duplicati: segnalati, mai rimossi.
const dupes = detectPossibleDuplicates([
  base({ id: "d1", guestName: "Alec Sebastiani", lodge: "Macaone", checkIn: "2026-08-09", checkOut: "2026-08-12" }),
  base({ id: "d2", guestName: "Alex Sebastiani", lodge: "Vanessa", checkIn: "2026-08-09", checkOut: "2026-08-12" }),
  base({ id: "d3", guestName: "Marta Perrulli", lodge: "Aurora", checkIn: "2026-08-14", checkOut: "2026-08-15" }),
]);
check("un solo doppione segnalato", dupes.length, 1);
check("coppia corretta", [dupes[0]?.bookingId, dupes[0]?.otherId], ["d1", "d2"]);

console.log(failures === 0 ? "\nTutti i controlli superati." : `\n${failures} controlli falliti.`);
process.exit(failures === 0 ? 0 : 1);
