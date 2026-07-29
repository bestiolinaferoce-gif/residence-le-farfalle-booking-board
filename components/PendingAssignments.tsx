"use client";

import { useMemo } from "react";
import { AlertTriangle, Check, PencilLine } from "lucide-react";
import { findFirstFreeLodge } from "@/lib/lodgeAvailability";
import { UNASSIGNED_LODGE, type Booking, type Lodge } from "@/lib/types";

type PendingAssignmentsProps = {
  bookings: Booking[];
  onAssign: (booking: Booking, lodge: Lodge) => void;
  onOpen: (booking: Booking) => void;
};

/**
 * Prenotazioni arrivate dai feed di struttura, in attesa di un'unità.
 * La proposta è ricalcolata sui dati correnti e non viene mai applicata da sola:
 * assegnare resta un gesto esplicito dell'host.
 */
export function PendingAssignments({ bookings, onAssign, onOpen }: PendingAssignmentsProps) {
  const pending = useMemo(() => {
    const unassigned = bookings
      .filter((b) => b.lodge === UNASSIGNED_LODGE && b.status !== "cancelled")
      .sort((a, b) => a.checkIn.localeCompare(b.checkIn));

    // Le proposte si calcolano in sequenza: un'unità già proposta a una prenotazione
    // non può essere proposta anche alla successiva sulle stesse date.
    const claimed: Booking[] = [];

    return unassigned.map((booking) => {
      const proposal = findFirstFreeLodge(
        [...bookings, ...claimed],
        booking.checkIn,
        booking.checkOut,
        booking.id
      );
      if (proposal) {
        claimed.push({ ...booking, id: `${booking.id}::proposta`, lodge: proposal });
      }
      return { booking, proposal };
    });
  }, [bookings]);

  if (pending.length === 0) return null;

  const overbookingCount = pending.filter((item) => item.proposal === null).length;

  return (
    <section className="pending-assignments" aria-label="Prenotazioni da assegnare">
      <header className="pending-assignments-head">
        <AlertTriangle size={16} aria-hidden />
        <strong>
          {pending.length} {pending.length === 1 ? "prenotazione da assegnare" : "prenotazioni da assegnare"}
        </strong>
        {overbookingCount > 0 && (
          <span className="pending-badge pending-badge-danger">
            {overbookingCount} in overbooking
          </span>
        )}
      </header>

      <ul className="pending-assignments-list">
        {pending.map(({ booking, proposal }) => (
          <li key={booking.id} className={proposal ? "pending-item" : "pending-item pending-item-danger"}>
            <div className="pending-item-info">
              <span className="pending-guest">{booking.guestName}</span>
              <span className="pending-dates">
                {booking.checkIn} → {booking.checkOut}
              </span>
              <span className="pending-channel">
                {booking.channel === "booking" ? "Booking.com" : booking.channel === "airbnb" ? "Airbnb" : booking.channel}
              </span>
            </div>

            <div className="pending-item-actions">
              {proposal ? (
                <button
                  type="button"
                  className="primary-btn pending-btn"
                  onClick={() => onAssign(booking, proposal)}
                  title={`Assegna ${booking.guestName} a ${proposal}`}
                >
                  <Check size={14} aria-hidden /> Assegna a {proposal}
                </button>
              ) : (
                <span className="pending-overbooking">
                  Nessuna unità libera per queste date
                </span>
              )}
              <button
                type="button"
                className="ghost-btn pending-btn"
                onClick={() => onOpen(booking)}
                title="Scegli un'altra unità"
              >
                <PencilLine size={14} aria-hidden /> Scegli
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
