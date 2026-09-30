"use client";

import { useMemo } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { ArrowDownLeft, ArrowUpRight, BedDouble, TriangleAlert } from "lucide-react";
import type { Booking } from "@/lib/types";
import { useRoomLabel } from "@/lib/settingsStore";
import { detectOverbookings } from "@/lib/validation";
import { formatMoney } from "@/lib/utils";

/**
 * La prima cosa che serve al mattino: chi arriva, chi parte, chi è in casa e
 * cosa è ancora da incassare. Sostituisce la scansione a occhio del calendario.
 */
export function TodayStrip({
  bookings,
  onOpen,
}: {
  bookings: Booking[];
  onOpen: (booking: Booking) => void;
}) {
  const roomLabel = useRoomLabel();
  const today = format(new Date(), "yyyy-MM-dd");

  const { arrivals, departures, inHouse, conflicts, toCollect } = useMemo(() => {
    const live = bookings.filter((b) => !b.deletedAt && b.status !== "cancelled");
    return {
      arrivals: live.filter((b) => b.checkIn.slice(0, 10) === today),
      departures: live.filter((b) => b.checkOut.slice(0, 10) === today),
      inHouse: live.filter((b) => b.checkIn.slice(0, 10) <= today && b.checkOut.slice(0, 10) > today),
      conflicts: detectOverbookings(bookings),
      toCollect: live
        .filter((b) => b.checkOut.slice(0, 10) >= today && !b.balancePaid)
        .reduce((acc, b) => acc + Math.max(0, b.totalAmount - (b.depositReceived ? b.depositAmount : 0)), 0),
    };
  }, [bookings, today]);

  function row(booking: Booking, meta: string) {
    return (
      <button key={booking.id} type="button" className="today-row" onClick={() => onOpen(booking)}>
        <strong style={{ flex: 1, textAlign: "left" }}>{booking.guestName}</strong>
        <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>{meta}</span>
      </button>
    );
  }

  return (
    <section className="today-strip">
      <article className="today-card">
        <h3>
          <ArrowDownLeft size={13} style={{ verticalAlign: "-2px" }} /> Arrivi di oggi ({arrivals.length})
        </h3>
        {arrivals.length === 0 ? (
          <p className="today-empty">Nessun arrivo oggi.</p>
        ) : (
          arrivals.map((b) => row(b, `${roomLabel(b.lodge)} · ${b.guestsCount} p · ${b.checkInTime ?? "14:00"}`))
        )}
      </article>

      <article className="today-card">
        <h3>
          <ArrowUpRight size={13} style={{ verticalAlign: "-2px" }} /> Partenze di oggi ({departures.length})
        </h3>
        {departures.length === 0 ? (
          <p className="today-empty">Nessuna partenza oggi.</p>
        ) : (
          departures.map((b) =>
            row(
              b,
              b.balancePaid
                ? `${roomLabel(b.lodge)} · saldato`
                : `${roomLabel(b.lodge)} · da saldare ${formatMoney(Math.max(0, b.totalAmount - (b.depositReceived ? b.depositAmount : 0)))}`
            )
          )
        )}
      </article>

      <article className="today-card">
        <h3>
          <BedDouble size={13} style={{ verticalAlign: "-2px" }} /> In casa ({inHouse.length})
        </h3>
        {inHouse.length === 0 ? (
          <p className="today-empty">Nessun ospite in struttura.</p>
        ) : (
          inHouse.map((b) => row(b, `${roomLabel(b.lodge)} · fino al ${format(new Date(b.checkOut), "d MMM", { locale: it })}`))
        )}
        <p className="today-empty" style={{ marginTop: 4 }}>
          Da incassare nei soggiorni aperti: <strong style={{ color: "var(--text)" }}>{formatMoney(toCollect)}</strong>
        </p>
      </article>

      {conflicts.length > 0 && (
        <article className="today-card" style={{ borderColor: "rgba(255,82,82,0.45)" }}>
          <h3 style={{ color: "#ff9b9b" }}>
            <TriangleAlert size={13} style={{ verticalAlign: "-2px" }} /> Sovrapposizioni ({conflicts.length})
          </h3>
          {conflicts.slice(0, 5).map(({ a, b }) => (
            <button key={`${a.id}-${b.id}`} type="button" className="today-row" onClick={() => onOpen(a)}>
              <span style={{ flex: 1, textAlign: "left" }}>
                {roomLabel(a.lodge)}: {a.guestName} ↔ {b.guestName}
              </span>
              <span style={{ color: "var(--muted)", fontSize: "0.78rem" }}>risolvi</span>
            </button>
          ))}
        </article>
      )}
    </section>
  );
}
