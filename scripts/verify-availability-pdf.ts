/**
 * Genera il PDF disponibilità sui dati reali di produzione, in due varianti:
 * con e senza parametri dell'imposta di soggiorno.
 *   npx tsx scripts/verify-availability-pdf.ts
 */
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildAvailabilityPdf, availabilityPdfFilename } from "@/lib/availabilityPdf";
import { computeTouristTax, formatTouristTax, EMPTY_TOURIST_TAX_SETTINGS, type TouristTaxSettings } from "@/lib/touristTax";
import type { Booking } from "@/lib/types";

const OUT = tmpdir();

async function main() {
const res = await fetch("https://residence-le-farfalle-booking-board.vercel.app/api/bookings");
const { data } = (await res.json()) as { data: Booking[] };
console.log(`Prenotazioni da produzione: ${data.length}`);
console.log(`PDF scritti in ${OUT}`);

const from = "2026-08-01";
const to = "2026-08-31";

// Variante 1 — parametri assenti: nessun importo deve comparire.
const senza = buildAvailabilityPdf({ bookings: data, from, to, taxSettings: EMPTY_TOURIST_TAX_SETTINGS });
writeFileSync(join(OUT, "pdf-senza-tassa.pdf"), Buffer.from(senza.output("arraybuffer")));

// Variante 2 — parametri di esempio SOLO per il test, mai scritti nell'app.
const finti: TouristTaxSettings = {
  amountPerPersonPerNight: 2,
  maxTaxableNights: 5,
  exemptUnderAge: 12,
  seasonStart: "04-01",
  seasonEnd: "10-31",
  exemptionNotes: "Disabili e accompagnatori",
};
const con = buildAvailabilityPdf({ bookings: data, from, to, taxSettings: finti });
writeFileSync(join(OUT, "pdf-con-tassa.pdf"), Buffer.from(con.output("arraybuffer")));

console.log(`Nome file generato: ${availabilityPdfFilename(from, to)}`);

// Controllo che senza parametri non esca mai un numero al posto di DA VERIFICARE.
const agosto = data.filter((b) => b.status !== "cancelled" && b.checkIn <= to && b.checkOut > from);
let stimeIndebite = 0;
for (const b of agosto) {
  const vuoto = formatTouristTax(computeTouristTax(b, EMPTY_TOURIST_TAX_SETTINGS));
  if (vuoto !== "DA VERIFICARE") {
    stimeIndebite += 1;
    console.log(`  ATTESO "DA VERIFICARE" per ${b.guestName}, ottenuto "${vuoto}"`);
  }
}
console.log(`Prenotazioni agosto: ${agosto.length}`);
console.log(`Importi inventati senza configurazione: ${stimeIndebite}`);

// Con i parametri, la formula deve tornare a mano.
const esempio = agosto[0];
if (esempio) {
  const r = computeTouristTax(esempio, finti);
  if (r.status === "ok") {
    const notti = Math.round((Date.parse(esempio.checkOut) - Date.parse(esempio.checkIn)) / 86400000);
    console.log(
      `Verifica formula su ${esempio.guestName}: ${r.payingPeople} pers × ${r.taxableNights} notti (di ${notti}) × 2 € = ${r.amount} €`
    );
    const atteso = r.payingPeople * Math.min(notti, 5) * 2;
    console.log(atteso === r.amount ? "Formula coerente." : `INCOERENTE: atteso ${atteso}`);
  }
}
process.exit(stimeIndebite === 0 ? 0 : 1);
}

void main();
