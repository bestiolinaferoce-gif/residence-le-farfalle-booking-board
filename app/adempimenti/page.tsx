"use client";

import { useEffect, useMemo, useState } from "react";
import { differenceInHours, format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { ExternalLink } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { AppHeader } from "@/components/AppHeader";
import { Toast } from "@/components/Toast";
import { useBookingStore } from "@/lib/store";
import { useRoomLabel, useSettingsStore } from "@/lib/settingsStore";
import { ALLOGGIATI_WEB_URL } from "@/lib/property";
import { computeTouristTax, formatTouristTax } from "@/lib/touristTax";
import { formatMoney } from "@/lib/utils";
import type { Booking } from "@/lib/types";

type Filter = "pending" | "done" | "all";

export default function AdempimentiPage() {
  const { bookings, load, startPolling, updateBooking, showToast } = useBookingStore(
    useShallow((s) => ({
      bookings: s.bookings,
      load: s.load,
      startPolling: s.startPolling,
      updateBooking: s.updateBooking,
      showToast: s.showToast,
    }))
  );
  const settings = useSettingsStore((s) => s.settings);
  const loadSettings = useSettingsStore((s) => s.load);
  const roomLabel = useRoomLabel();
  const [filter, setFilter] = useState<Filter>("pending");

  useEffect(() => {
    load();
    void loadSettings();
  }, [load, loadSettings]);

  useEffect(() => startPolling(), [startPolling]);

  const today = format(new Date(), "yyyy-MM-dd");

  const relevant = useMemo(
    () =>
      bookings
        .filter((b) => !b.deletedAt && b.status !== "cancelled" && b.status !== "blocked")
        .sort((a, b) => b.checkIn.localeCompare(a.checkIn)),
    [bookings]
  );

  const rows = useMemo(() => {
    const started = relevant.filter((b) => b.checkIn.slice(0, 10) <= today);
    const done = (b: Booking) => b.reporting?.alloggiatiSent && b.reporting?.ross1000Sent;
    if (filter === "pending") return started.filter((b) => !done(b));
    if (filter === "done") return started.filter(done);
    return relevant;
  }, [relevant, filter, today]);

  const counts = useMemo(() => {
    const started = relevant.filter((b) => b.checkIn.slice(0, 10) <= today);
    return {
      alloggiati: started.filter((b) => !b.reporting?.alloggiatiSent).length,
      ross: started.filter((b) => !b.reporting?.ross1000Sent).length,
      started: started.length,
    };
  }, [relevant, today]);

  /**
   * Ritardo sulla schedina: 24h dall'arrivo, 6h per i soggiorni sotto le 24h.
   * È la scadenza che fa scattare la sanzione, quindi è la cosa da vedere per prima.
   */
  function alloggiatiDeadline(booking: Booking): { hoursLeft: number; short: boolean } | null {
    if (booking.reporting?.alloggiatiSent) return null;
    const checkIn = parseISO(booking.checkIn);
    const checkOut = parseISO(booking.checkOut);
    const short = differenceInHours(checkOut, checkIn) < 24;
    const limit = new Date(checkIn.getTime() + (short ? 6 : 24) * 3_600_000);
    return { hoursLeft: differenceInHours(limit, new Date()), short };
  }

  function toggle(booking: Booking, field: "alloggiatiSent" | "ross1000Sent", value: boolean) {
    const { id, createdAt, updatedAt, ...rest } = booking;
    void createdAt;
    void updatedAt;
    const stamp = field === "alloggiatiSent" ? "alloggiatiSentAt" : "ross1000SentAt";
    try {
      updateBooking(id, {
        ...rest,
        reporting: {
          ...(booking.reporting ?? {}),
          [field]: value,
          [stamp]: value ? new Date().toISOString() : undefined,
        },
      });
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Aggiornamento non riuscito.", "error");
    }
  }

  const taxTotal = useMemo(() => {
    let total = 0;
    let unverifiable = 0;
    for (const booking of relevant) {
      const result = computeTouristTax(booking, settings.touristTax);
      if (result.status === "ok") total += result.amount;
      else if (result.status === "unverifiable") unverifiable += 1;
    }
    return { total, unverifiable };
  }, [relevant, settings.touristTax]);

  return (
    <main className="page-root">
      <AppHeader pendingReports={counts.alloggiati + counts.ross} />

      <section className="section">
        <h1 className="section-title">Adempimenti</h1>
        <p className="section-hint">
          Schedine alloggiati entro 24 ore dall&apos;arrivo — entro 6 ore per i soggiorni di durata
          inferiore a 24 ore. I flussi statistici seguono le scadenze della tua Regione.
        </p>

        <div className="group">
          <a className="primary-btn" href={ALLOGGIATI_WEB_URL} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={15} /> Portale Alloggiati
          </a>
          <a className="ghost-btn" href={settings.ross1000Url} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={15} /> ROSS1000
          </a>
        </div>

        <div className="kpi-panel">
          <article className="kpi-card">
            <span className="kpi-label">Schedine mancanti</span>
            <span className="kpi-value">{counts.alloggiati}</span>
            <span className="kpi-sub">su {counts.started} soggiorni iniziati</span>
          </article>
          <article className="kpi-card">
            <span className="kpi-label">Flussi ROSS1000 mancanti</span>
            <span className="kpi-value">{counts.ross}</span>
            <span className="kpi-sub">su {counts.started} soggiorni iniziati</span>
          </article>
          <article className="kpi-card">
            <span className="kpi-label">Imposta di soggiorno</span>
            <span className="kpi-value">{formatMoney(taxTotal.total)}</span>
            <span className="kpi-sub">
              {taxTotal.unverifiable > 0
                ? `${taxTotal.unverifiable} da verificare — parametri non configurati`
                : "totale calcolato sul periodo caricato"}
            </span>
          </article>
        </div>
      </section>

      <section className="section">
        <div className="group">
          {(["pending", "done", "all"] as Filter[]).map((value) => (
            <button
              key={value}
              type="button"
              className={filter === value ? "primary-btn" : "ghost-btn"}
              onClick={() => setFilter(value)}
            >
              {value === "pending" ? "Da fare" : value === "done" ? "Completati" : "Tutti"}
            </button>
          ))}
        </div>

        {rows.length === 0 ? (
          <p className="today-empty">Nulla in sospeso. </p>
        ) : (
          <div className="table-scroll">
            <table className="booking-table">
              <thead>
                <tr>
                  <th>Ospite</th>
                  <th>Camera</th>
                  <th>Soggiorno</th>
                  <th>Scadenza schedina</th>
                  <th>Alloggiati</th>
                  <th>ROSS1000</th>
                  <th>Imposta</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((booking) => {
                  const deadline = alloggiatiDeadline(booking);
                  return (
                    <tr key={booking.id}>
                      <td>
                        <strong>{booking.guestName}</strong>
                        <div style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
                          {booking.guestsCount} adulti
                        </div>
                      </td>
                      <td>{roomLabel(booking.lodge)}</td>
                      <td>
                        {format(parseISO(booking.checkIn), "d MMM", { locale: it })} →{" "}
                        {format(parseISO(booking.checkOut), "d MMM yyyy", { locale: it })}
                      </td>
                      <td>
                        {deadline === null ? (
                          <span className="pill pill-ok">inviata</span>
                        ) : deadline.hoursLeft < 0 ? (
                          <span className="pill pill-danger">scaduta da {Math.abs(deadline.hoursLeft)}h</span>
                        ) : (
                          <span className="pill pill-warn">
                            entro {deadline.hoursLeft}h{deadline.short ? " (soggiorno breve)" : ""}
                          </span>
                        )}
                      </td>
                      <td>
                        <label className="checkbox-line">
                          <input
                            type="checkbox"
                            checked={booking.reporting?.alloggiatiSent ?? false}
                            onChange={(e) => toggle(booking, "alloggiatiSent", e.target.checked)}
                          />
                          {booking.reporting?.alloggiatiSentAt
                            ? format(parseISO(booking.reporting.alloggiatiSentAt), "d/MM HH:mm")
                            : "—"}
                        </label>
                      </td>
                      <td>
                        <label className="checkbox-line">
                          <input
                            type="checkbox"
                            checked={booking.reporting?.ross1000Sent ?? false}
                            onChange={(e) => toggle(booking, "ross1000Sent", e.target.checked)}
                          />
                          {booking.reporting?.ross1000SentAt
                            ? format(parseISO(booking.reporting.ross1000SentAt), "d/MM HH:mm")
                            : "—"}
                        </label>
                      </td>
                      <td>{formatTouristTax(computeTouristTax(booking, settings.touristTax))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Toast />
    </main>
  );
}
