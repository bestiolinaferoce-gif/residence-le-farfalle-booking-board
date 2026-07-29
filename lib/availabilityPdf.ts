/**
 * PDF disponibilità da inviare a chi esegue i check-in in struttura.
 * Vettoriale (jsPDF), non uno screenshot: resta nitido sullo zoom del telefono.
 */
import { jsPDF } from "jspdf";
import { PROPERTY_NAME } from "@/lib/config";
import {
  computeTouristTax,
  formatTouristTax,
  isTouristTaxConfigured,
  type TouristTaxSettings,
} from "@/lib/touristTax";
import { LODGES, UNASSIGNED_LODGE, type Booking } from "@/lib/types";

const MARGIN = 12;
const LINE = 4.6;

function nightsBetween(checkIn: string, checkOut: string): number {
  const ms = Date.parse(checkOut) - Date.parse(checkIn);
  return Number.isFinite(ms) ? Math.max(0, Math.round(ms / 86_400_000)) : 0;
}

function eachDay(from: string, to: string): string[] {
  const days: string[] = [];
  const cursor = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (cursor <= end) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

function dayLabel(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

/** Occupa la notte del giorno: il check-out non conta come notte. */
function occupiesNight(booking: Booking, day: string): boolean {
  return booking.checkIn <= day && day < booking.checkOut;
}

export type AvailabilityPdfInput = {
  bookings: Booking[];
  from: string;
  to: string;
  taxSettings: TouristTaxSettings;
};

export function availabilityPdfFilename(from: string, to: string): string {
  return `Le-Farfalle_Disponibilita_${from}_${to}.pdf`;
}

export function buildAvailabilityPdf({ bookings, from, to, taxSettings }: AvailabilityPdfInput): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = MARGIN;

  const inRange = bookings
    .filter((b) => b.status !== "cancelled")
    .filter((b) => b.checkIn <= to && b.checkOut > from)
    .sort((a, b) => a.checkIn.localeCompare(b.checkIn) || a.guestName.localeCompare(b.guestName));

  function ensureSpace(needed: number) {
    if (y + needed <= pageHeight - MARGIN) return;
    doc.addPage();
    y = MARGIN;
  }

  function sectionTitle(text: string) {
    ensureSpace(12);
    doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(30);
    doc.text(text, MARGIN, y);
    y += 2;
    doc.setDrawColor(180).setLineWidth(0.3).line(MARGIN, y, pageWidth - MARGIN, y);
    y += 5;
  }

  // ── Intestazione ────────────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold").setFontSize(16).setTextColor(20);
  doc.text(`${PROPERTY_NAME} — Disponibilità`, MARGIN, y);
  y += 6;
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(90);
  doc.text(`Periodo ${dayLabel(from)} → ${dayLabel(to)}   ·   generato il ${new Date().toLocaleString("it-IT")}`, MARGIN, y);
  y += 8;

  // ── Sezione 1 — Arrivi e partenze ───────────────────────────────────────────
  sectionTitle("1. Arrivi e partenze");

  if (inRange.length === 0) {
    doc.setFont("helvetica", "italic").setFontSize(10).setTextColor(120);
    doc.text("Nessuna prenotazione nel periodo.", MARGIN, y);
    y += LINE * 2;
  }

  for (const booking of inRange) {
    const tax = computeTouristTax(booking, taxSettings);
    const nights = nightsBetween(booking.checkIn, booking.checkOut);
    const residual = Math.max(0, booking.totalAmount - (booking.depositReceived ? booking.depositAmount : 0));
    const children = booking.childrenCount ?? 0;
    const unassigned = booking.lodge === UNASSIGNED_LODGE;

    ensureSpace(LINE * 5 + 4);

    doc.setDrawColor(225).setLineWidth(0.2).line(MARGIN, y - 3, pageWidth - MARGIN, y - 3);

    doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(20);
    doc.text(booking.guestName, MARGIN, y);
    doc.setFont("helvetica", "bold").setTextColor(unassigned ? 200 : 60);
    doc.text(unassigned ? "DA ASSEGNARE" : booking.lodge, pageWidth - MARGIN, y, { align: "right" });
    y += LINE;

    doc.setFont("helvetica", "normal").setFontSize(9.5).setTextColor(60);
    const checkInLabel = `${dayLabel(booking.checkIn)}${booking.checkInTime ? ` ore ${booking.checkInTime}` : ""}`;
    const checkOutLabel = `${dayLabel(booking.checkOut)}${booking.checkOutTime ? ` ore ${booking.checkOutTime}` : ""}`;
    doc.text(`IN ${checkInLabel}   OUT ${checkOutLabel}   ${nights} notti   ${booking.channel}`, MARGIN, y);
    y += LINE;

    const peopleLabel = booking.guestsCount >= 1
      ? `${booking.guestsCount} ad.${children > 0 ? ` + ${children} bamb.` : ""}`
      : "DA VERIFICARE";
    doc.text(
      `Persone ${peopleLabel}   ·   Totale ${booking.totalAmount.toFixed(2)} €   ·   Caparra ${
        booking.depositReceived ? booking.depositAmount.toFixed(2) : "0.00"
      } €   ·   Residuo ${residual.toFixed(2)} €`,
      MARGIN,
      y
    );
    y += LINE;

    const taxLabel = formatTouristTax(tax);
    if (taxLabel === "DA VERIFICARE") doc.setTextColor(190, 30, 30).setFont("helvetica", "bold");
    doc.text(`Tassa di soggiorno ${taxLabel}   ·   Colazione inclusa`, MARGIN, y);
    doc.setFont("helvetica", "normal").setTextColor(60);
    y += LINE;

    if (booking.notes.trim()) {
      const noteLines = doc.splitTextToSize(`Note: ${booking.notes.trim()}`, pageWidth - MARGIN * 2);
      ensureSpace(LINE * noteLines.length);
      doc.setFontSize(9).setTextColor(110);
      doc.text(noteLines, MARGIN, y);
      y += LINE * noteLines.length;
    }
    y += 2;
  }

  // ── Sezione 2 — Griglia disponibilità ───────────────────────────────────────
  y += 4;
  sectionTitle("2. Calendario disponibilità");

  const days = eachDay(from, to);
  const labelWidth = 26;
  // Righe da ~24 giorni per restare leggibili su schermo di telefono.
  const chunkSize = 24;

  for (let offset = 0; offset < days.length; offset += chunkSize) {
    const chunk = days.slice(offset, offset + chunkSize);
    const cellWidth = (pageWidth - MARGIN * 2 - labelWidth) / chunk.length;
    const rowHeight = 6;

    ensureSpace(rowHeight * (LODGES.length + 1) + 6);

    doc.setFont("helvetica", "bold").setFontSize(7).setTextColor(80);
    chunk.forEach((day, i) => {
      doc.text(dayLabel(day), MARGIN + labelWidth + cellWidth * i + cellWidth / 2, y, { align: "center" });
    });
    y += 2;

    for (const lodge of LODGES) {
      doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(40);
      doc.text(lodge, MARGIN, y + rowHeight / 2 + 1);

      chunk.forEach((day, i) => {
        const x = MARGIN + labelWidth + cellWidth * i;
        const occupant = inRange.find((b) => b.lodge === lodge && occupiesNight(b, day));

        if (occupant) {
          doc.setFillColor(120, 130, 180);
          doc.rect(x, y, cellWidth, rowHeight, "F");
          doc.setTextColor(255).setFontSize(5.5).setFont("helvetica", "bold");
          const initials = occupant.guestName.trim().slice(0, 3).toUpperCase();
          doc.text(initials, x + cellWidth / 2, y + rowHeight / 2 + 1.4, { align: "center" });
        } else {
          // Libero: bianco con bordo leggero, distinguibile a colpo d'occhio.
          doc.setFillColor(255, 255, 255).setDrawColor(205, 205, 205).setLineWidth(0.15);
          doc.rect(x, y, cellWidth, rowHeight, "FD");
        }
      });
      y += rowHeight;
    }
    y += 5;
  }

  doc.setFont("helvetica", "italic").setFontSize(7.5).setTextColor(120);
  doc.text("Celle piene = occupato (iniziali ospite) · Celle bianche = libero", MARGIN, y);
  y += 6;

  // ── Sezione 3 — Riepilogo economico ─────────────────────────────────────────
  sectionTitle("3. Riepilogo economico");

  const totalAmount = inRange.reduce((acc, b) => acc + b.totalAmount, 0);
  const totalDeposits = inRange.reduce((acc, b) => acc + (b.depositReceived ? b.depositAmount : 0), 0);
  const taxResults = inRange.map((b) => computeTouristTax(b, taxSettings));
  const taxTotal = taxResults.reduce((acc, r) => acc + (r.status === "ok" ? r.amount : 0), 0);
  const taxUnverifiable = taxResults.filter((r) => r.status === "unverifiable").length;

  // Occupancy sulle sole unità fisiche: le "da assegnare" non occupano una camera.
  const totalNightSlots = days.length * LODGES.length;
  const occupiedSlots = days.reduce(
    (acc, day) => acc + LODGES.filter((l) => inRange.some((b) => b.lodge === l && occupiesNight(b, day))).length,
    0
  );
  const occupancy = totalNightSlots > 0 ? (occupiedSlots / totalNightSlots) * 100 : 0;

  const rows: Array<[string, string]> = [
    ["Totale tariffe", `${totalAmount.toFixed(2)} €`],
    ["Caparre incassate", `${totalDeposits.toFixed(2)} €`],
    ["Residuo da incassare", `${(totalAmount - totalDeposits).toFixed(2)} €`],
    [
      "Tassa di soggiorno da riscuotere",
      taxUnverifiable > 0
        ? `${taxTotal.toFixed(2)} € + ${taxUnverifiable} DA VERIFICARE`
        : `${taxTotal.toFixed(2)} €`,
    ],
    ["Occupancy periodo", `${occupancy.toFixed(1)} %`],
  ];

  doc.setFontSize(10);
  for (const [label, value] of rows) {
    ensureSpace(LINE + 1);
    doc.setFont("helvetica", "normal").setTextColor(60);
    doc.text(label, MARGIN, y);
    doc.setFont("helvetica", "bold").setTextColor(20);
    doc.text(value, pageWidth - MARGIN, y, { align: "right" });
    y += LINE + 1;
  }

  if (!isTouristTaxConfigured(taxSettings)) {
    y += 3;
    ensureSpace(LINE * 2);
    doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(190, 30, 30);
    const warn = doc.splitTextToSize(
      "Imposta di soggiorno non configurata: importi non calcolati. Inserisci i parametri comunali nelle impostazioni dell'app.",
      pageWidth - MARGIN * 2
    );
    doc.text(warn, MARGIN, y);
    y += LINE * warn.length;
  } else if (taxSettings.exemptionNotes.trim()) {
    y += 3;
    doc.setFont("helvetica", "italic").setFontSize(8).setTextColor(110);
    const notes = doc.splitTextToSize(`Esenzioni: ${taxSettings.exemptionNotes.trim()}`, pageWidth - MARGIN * 2);
    ensureSpace(LINE * notes.length);
    doc.text(notes, MARGIN, y);
  }

  // Numerazione pagine, utile quando il PDF gira su WhatsApp.
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(150);
    doc.text(`${PROPERTY_NAME} · pagina ${page} di ${pageCount}`, pageWidth / 2, pageHeight - 6, { align: "center" });
  }

  return doc;
}
