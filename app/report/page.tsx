"use client";

import { useEffect, useMemo, useState } from "react";
import { addMonths, endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import { it } from "date-fns/locale";
import { ChevronLeft, ChevronRight, FileDown } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { AppHeader } from "@/components/AppHeader";
import { useBookingStore } from "@/lib/store";
import { useSettingsStore } from "@/lib/settingsStore";
import { buildMonthlyReport, buildMonthlyReportPdf } from "@/lib/monthlyReport";
import { formatMoney } from "@/lib/utils";

const CHANNEL_LABELS: Record<string, string> = {
  direct: "Diretta",
  booking: "Booking.com",
  airbnb: "Airbnb",
  expedia: "Expedia",
  other: "Altro",
};

export default function ReportPage() {
  const { bookings, load } = useBookingStore(useShallow((s) => ({ bookings: s.bookings, load: s.load })));
  const settings = useSettingsStore((s) => s.settings);
  const loadSettings = useSettingsStore((s) => s.load);
  const [month, setMonth] = useState(() => startOfMonth(new Date()));

  useEffect(() => {
    load();
    void loadSettings();
  }, [load, loadSettings]);

  const rooms = useMemo(
    () => settings.rooms.filter((room) => room.active).map((room) => ({ id: room.id, name: room.name })),
    [settings.rooms]
  );

  const report = useMemo(
    () =>
      buildMonthlyReport({
        bookings,
        monthStart: startOfMonth(month),
        monthEnd: endOfMonth(month),
        monthLabel: format(month, "MMMM yyyy", { locale: it }),
        rooms,
        taxSettings: settings.touristTax,
      }),
    [bookings, month, rooms, settings.touristTax]
  );

  /** Confronto con lo stesso mese dell'anno prima: è la domanda che si fa ogni host. */
  const lastYear = useMemo(
    () =>
      buildMonthlyReport({
        bookings,
        monthStart: startOfMonth(subMonths(month, 12)),
        monthEnd: endOfMonth(subMonths(month, 12)),
        monthLabel: "",
        rooms,
        taxSettings: settings.touristTax,
      }),
    [bookings, month, rooms, settings.touristTax]
  );

  function delta(current: number, previous: number): string | null {
    if (previous <= 0) return null;
    const pct = ((current - previous) / previous) * 100;
    return `${pct >= 0 ? "+" : ""}${pct.toFixed(0)}% vs ${format(subMonths(month, 12), "yyyy")}`;
  }

  function downloadPdf() {
    const doc = buildMonthlyReportPdf(report, settings.property.name, settings.property.cin);
    doc.save(`Le-Farfalle_Report_${format(month, "yyyy-MM")}.pdf`);
  }

  return (
    <main className="page-root">
      <AppHeader />

      <section className="section">
        <div className="toolbar-month-row">
          <button type="button" className="icon-btn" onClick={() => setMonth((m) => subMonths(m, 1))} aria-label="Mese precedente">
            <ChevronLeft size={16} />
          </button>
          <span className="toolbar-month">{format(month, "MMMM yyyy", { locale: it })}</span>
          <button type="button" className="icon-btn" onClick={() => setMonth((m) => addMonths(m, 1))} aria-label="Mese successivo">
            <ChevronRight size={16} />
          </button>
          <button type="button" className="primary-btn" style={{ marginLeft: "auto" }} onClick={downloadPdf}>
            <FileDown size={15} /> Scarica PDF
          </button>
        </div>

        <div className="kpi-panel">
          <article className="kpi-card">
            <span className="kpi-label">Occupazione</span>
            <span className="kpi-value">{report.occupancyPct.toFixed(1)}%</span>
            <span className="kpi-sub">
              {report.nightsOccupied} notti su {report.nightsAvailable}
              {delta(report.occupancyPct, lastYear.occupancyPct) ? ` · ${delta(report.occupancyPct, lastYear.occupancyPct)}` : ""}
            </span>
          </article>
          <article className="kpi-card">
            <span className="kpi-label">Ricavi</span>
            <span className="kpi-value">{formatMoney(report.revenue)}</span>
            <span className="kpi-sub">{delta(report.revenue, lastYear.revenue) ?? "ripartiti per notte"}</span>
          </article>
          <article className="kpi-card">
            <span className="kpi-label">ADR</span>
            <span className="kpi-value">{formatMoney(report.adr)}</span>
            <span className="kpi-sub">
              su {report.nightsSold} notti con importo
              {report.nightsWithoutRevenue > 0 ? ` · ${report.nightsWithoutRevenue} senza importo escluse` : ""}
            </span>
          </article>
          <article className="kpi-card">
            <span className="kpi-label">RevPAR</span>
            <span className="kpi-value">{formatMoney(report.revpar)}</span>
            <span className="kpi-sub">ricavo per camera disponibile</span>
          </article>
          <article className="kpi-card">
            <span className="kpi-label">Da incassare</span>
            <span className="kpi-value">{formatMoney(report.depositsOutstanding)}</span>
            <span className="kpi-sub">saldi non ancora ricevuti</span>
          </article>
          <article className="kpi-card">
            <span className="kpi-label">Imposta di soggiorno</span>
            <span className="kpi-value">{formatMoney(report.touristTax.total)}</span>
            <span className="kpi-sub">
              {report.touristTax.unverifiable > 0
                ? `${report.touristTax.unverifiable} da verificare`
                : "pronta per il rendiconto"}
            </span>
          </article>
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">Per camera</h2>
        <div className="table-scroll">
          <table className="booking-table">
            <thead>
              <tr>
                <th>Camera</th>
                <th>Notti</th>
                <th>Occupazione</th>
                <th>Ricavi</th>
              </tr>
            </thead>
            <tbody>
              {report.byRoom.map((room) => (
                <tr key={room.id}>
                  <td>{room.name}</td>
                  <td>{room.nights}</td>
                  <td>
                    <span>{room.occupancyPct.toFixed(0)}%</span>
                    <div className="occ-bar">
                      <div className="occ-bar-fill" style={{ width: `${Math.min(room.occupancyPct, 100)}%` }} />
                    </div>
                  </td>
                  <td>{formatMoney(room.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">Per canale</h2>
        {report.byChannel.length === 0 ? (
          <p className="today-empty">Nessuna notte venduta in questo mese.</p>
        ) : (
          <div className="table-scroll">
            <table className="booking-table">
              <thead>
                <tr>
                  <th>Canale</th>
                  <th>Notti</th>
                  <th>Ricavi</th>
                  <th>Quota</th>
                </tr>
              </thead>
              <tbody>
                {report.byChannel.map((row) => (
                  <tr key={row.channel}>
                    <td>{CHANNEL_LABELS[row.channel] ?? row.channel}</td>
                    <td>{row.nights}</td>
                    <td>{formatMoney(row.revenue)}</td>
                    <td>{report.revenue > 0 ? `${((row.revenue / report.revenue) * 100).toFixed(0)}%` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
