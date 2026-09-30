/**
 * Report mensile: occupazione, ricavi, ADR, RevPAR, canali, imposta di soggiorno.
 *
 * I ricavi sono ripartiti per notte, non attribuiti al mese del check-in: un
 * soggiorno a cavallo di due mesi altrimenti gonfierebbe il primo e svuoterebbe
 * il secondo, e il confronto anno su anno diventerebbe inutile.
 */

import { jsPDF } from "jspdf";
import type { Booking, BookingChannel, Lodge } from "@/lib/types";
import { computeTouristTax, type TouristTaxSettings } from "@/lib/touristTax";

export type MonthlyReport = {
  monthLabel: string;
  /** Notti con ricavo: base dell'ADR. */
  nightsSold: number;
  /** Notti in cui la camera non era vendibile, incluse quelle bloccate. */
  nightsOccupied: number;
  /** Notti occupate da soggiorni senza importo (bloccate o ancora da valorizzare). */
  nightsWithoutRevenue: number;
  nightsAvailable: number;
  occupancyPct: number;
  revenue: number;
  adr: number;
  revpar: number;
  bookings: number;
  cancelled: number;
  byChannel: Array<{ channel: BookingChannel; nights: number; revenue: number }>;
  byRoom: Array<{ id: Lodge; name: string; nights: number; revenue: number; occupancyPct: number }>;
  touristTax: { total: number; unverifiable: number };
  depositsOutstanding: number;
};

function nightsBetween(checkIn: string, checkOut: string): number {
  const ms = Date.parse(checkOut) - Date.parse(checkIn);
  return Number.isFinite(ms) ? Math.max(0, Math.round(ms / 86_400_000)) : 0;
}

function eachDay(from: Date, to: Date): string[] {
  const days: string[] = [];
  const cursor = new Date(Date.UTC(from.getFullYear(), from.getMonth(), from.getDate()));
  const end = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  while (cursor.getTime() <= end) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

function occupiesNight(booking: Booking, day: string): boolean {
  return booking.checkIn.slice(0, 10) <= day && day < booking.checkOut.slice(0, 10);
}

export function buildMonthlyReport(input: {
  bookings: Booking[];
  monthStart: Date;
  monthEnd: Date;
  monthLabel: string;
  rooms: Array<{ id: Lodge; name: string }>;
  taxSettings: TouristTaxSettings;
}): MonthlyReport {
  const { bookings, monthStart, monthEnd, monthLabel, rooms, taxSettings } = input;
  const days = eachDay(monthStart, monthEnd);
  const live = bookings.filter((b) => !b.deletedAt);

  /*
   * Due insiemi distinti, perché rispondono a due domande diverse.
   *
   * `occupied` = la camera non era disponibile quella notte, per qualunque
   * motivo, comprese le date bloccate: è il numero che deve coincidere con
   * l'occupazione mostrata sulla board. Prima il report escludeva le bloccate
   * e finiva per dichiarare 0% su un mese che la board segnava al 15%.
   *
   * `sold` = solo i soggiorni che producono ricavo, e alimentano ADR e canali:
   * mescolarci le notti bloccate a importo zero abbasserebbe l'ADR fingendo
   * sconti mai fatti.
   */
  const occupied = live.filter((b) => b.status !== "cancelled");
  const sold = occupied.filter((b) => b.status !== "blocked");

  const nightsAvailable = days.length * rooms.length;

  let nightsSold = 0;
  let nightsOccupied = 0;
  let revenue = 0;
  const channelMap = new Map<BookingChannel, { nights: number; revenue: number }>();

  const byRoom = rooms.map((room) => {
    let roomOccupied = 0;
    let roomSold = 0;
    let roomRevenue = 0;
    for (const day of days) {
      if (occupied.some((b) => b.lodge === room.id && occupiesNight(b, day))) roomOccupied += 1;

      const occupant = sold.find((b) => b.lodge === room.id && occupiesNight(b, day));
      if (!occupant) continue;
      const total = nightsBetween(occupant.checkIn, occupant.checkOut);
      const perNight = total > 0 ? occupant.totalAmount / total : 0;
      roomSold += 1;
      roomRevenue += perNight;

      const bucket = channelMap.get(occupant.channel) ?? { nights: 0, revenue: 0 };
      bucket.nights += 1;
      bucket.revenue += perNight;
      channelMap.set(occupant.channel, bucket);
    }
    nightsSold += roomSold;
    nightsOccupied += roomOccupied;
    revenue += roomRevenue;
    return {
      id: room.id,
      name: room.name,
      nights: roomOccupied,
      revenue: roomRevenue,
      occupancyPct: days.length > 0 ? (roomOccupied / days.length) * 100 : 0,
    };
  });

  const inMonth = occupied.filter((b) => days.some((day) => occupiesNight(b, day)));

  let taxTotal = 0;
  let taxUnverifiable = 0;
  for (const booking of inMonth) {
    const result = computeTouristTax(booking, taxSettings);
    if (result.status === "ok") taxTotal += result.amount;
    else if (result.status === "unverifiable") taxUnverifiable += 1;
  }

  return {
    monthLabel,
    nightsSold,
    nightsOccupied,
    nightsWithoutRevenue: nightsOccupied - nightsSold,
    nightsAvailable,
    occupancyPct: nightsAvailable > 0 ? (nightsOccupied / nightsAvailable) * 100 : 0,
    revenue,
    adr: nightsSold > 0 ? revenue / nightsSold : 0,
    revpar: nightsAvailable > 0 ? revenue / nightsAvailable : 0,
    bookings: inMonth.length,
    cancelled: live.filter((b) => b.status === "cancelled" && days.some((day) => occupiesNight(b, day))).length,
    byChannel: [...channelMap.entries()]
      .map(([channel, data]) => ({ channel, ...data }))
      .sort((a, b) => b.revenue - a.revenue),
    byRoom,
    touristTax: { total: taxTotal, unverifiable: taxUnverifiable },
    depositsOutstanding: inMonth.reduce(
      (acc, b) => acc + (b.balancePaid ? 0 : Math.max(0, b.totalAmount - (b.depositReceived ? b.depositAmount : 0))),
      0
    ),
  };
}

const CHANNEL_LABELS: Record<string, string> = {
  direct: "Diretta",
  booking: "Booking.com",
  airbnb: "Airbnb",
  expedia: "Expedia",
  other: "Altro",
};

const euro = (value: number) => `${value.toFixed(2).replace(".", ",")} €`;

export function buildMonthlyReportPdf(report: MonthlyReport, propertyName: string, cin: string): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const width = doc.internal.pageSize.getWidth();
  let y = 16;

  doc.setFont("helvetica", "bold").setFontSize(16).setTextColor(20);
  doc.text(`${propertyName}`, 14, y);
  y += 6;
  doc.setFont("helvetica", "normal").setFontSize(11).setTextColor(90);
  doc.text(`Report mensile — ${report.monthLabel}`, 14, y);
  y += 5;
  doc.setFontSize(8);
  doc.text(`CIN ${cin} · generato il ${new Date().toLocaleDateString("it-IT")}`, 14, y);
  y += 8;

  const kpis: Array<[string, string]> = [
    ["Occupazione", `${report.occupancyPct.toFixed(1)} %`],
    ["Notti occupate", `${report.nightsOccupied} / ${report.nightsAvailable}`],
    ["Ricavi", euro(report.revenue)],
    ["ADR", euro(report.adr)],
    ["RevPAR", euro(report.revpar)],
    ["Da incassare", euro(report.depositsOutstanding)],
  ];

  const boxWidth = (width - 28) / 3;
  kpis.forEach(([label, value], index) => {
    const col = index % 3;
    const row = Math.floor(index / 3);
    const x = 14 + col * boxWidth;
    const boxY = y + row * 20;
    doc.setDrawColor(220).setFillColor(248, 248, 248);
    doc.roundedRect(x, boxY, boxWidth - 4, 16, 2, 2, "FD");
    doc.setFontSize(7).setTextColor(120).setFont("helvetica", "normal");
    doc.text(label.toUpperCase(), x + 3, boxY + 5);
    doc.setFontSize(12).setTextColor(20).setFont("helvetica", "bold");
    doc.text(value, x + 3, boxY + 12);
  });
  y += Math.ceil(kpis.length / 3) * 20 + 6;

  if (report.nightsWithoutRevenue > 0) {
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(150, 90, 20);
    doc.text(
      `${report.nightsWithoutRevenue} notti occupate senza importo registrato: escluse da ADR, RevPAR e ricavi.`,
      14,
      y
    );
    y += 6;
  }

  function table(title: string, headers: string[], rows: string[][]) {
    doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(20);
    doc.text(title, 14, y);
    y += 5;
    const colWidth = (width - 28) / headers.length;
    doc.setFontSize(8).setTextColor(110);
    headers.forEach((header, i) => doc.text(header, 14 + i * colWidth, y));
    y += 2;
    doc.setDrawColor(225).line(14, y, width - 14, y);
    y += 4;
    doc.setTextColor(35).setFont("helvetica", "normal");
    for (const row of rows) {
      row.forEach((cell, i) => doc.text(cell, 14 + i * colWidth, y));
      y += 5;
      if (y > doc.internal.pageSize.getHeight() - 20) {
        doc.addPage();
        y = 16;
      }
    }
    y += 5;
  }

  table(
    "Per camera",
    ["Camera", "Notti", "Occupazione", "Ricavi"],
    report.byRoom.map((room) => [room.name, String(room.nights), `${room.occupancyPct.toFixed(0)} %`, euro(room.revenue)])
  );

  table(
    "Per canale",
    ["Canale", "Notti", "Ricavi", "Quota"],
    report.byChannel.map((row) => [
      CHANNEL_LABELS[row.channel] ?? row.channel,
      String(row.nights),
      euro(row.revenue),
      report.revenue > 0 ? `${((row.revenue / report.revenue) * 100).toFixed(0)} %` : "—",
    ])
  );

  doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(20);
  doc.text("Imposta di soggiorno", 14, y);
  y += 6;
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(60);
  doc.text(`Totale calcolato: ${euro(report.touristTax.total)}`, 14, y);
  y += 5;
  if (report.touristTax.unverifiable > 0) {
    doc.setTextColor(180, 60, 30);
    doc.text(
      `${report.touristTax.unverifiable} prenotazioni non calcolabili: parametri comunali non configurati.`,
      14,
      y
    );
  }

  return doc;
}
