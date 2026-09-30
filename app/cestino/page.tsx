"use client";

import { useEffect, useMemo, useState } from "react";
import { differenceInDays, format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { RotateCcw, Trash2 } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { AppHeader } from "@/components/AppHeader";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Toast } from "@/components/Toast";
import { useBookingStore } from "@/lib/store";
import { useRoomLabel } from "@/lib/settingsStore";
import { TRASH_RETENTION_DAYS, type Booking } from "@/lib/types";
import { formatMoney } from "@/lib/utils";

export default function CestinoPage() {
  const { bookings, load, restoreBooking, purgeBooking, showToast } = useBookingStore(
    useShallow((s) => ({
      bookings: s.bookings,
      load: s.load,
      restoreBooking: s.restoreBooking,
      purgeBooking: s.purgeBooking,
      showToast: s.showToast,
    }))
  );
  const roomLabel = useRoomLabel();
  const [toPurge, setToPurge] = useState<Booking | null>(null);

  useEffect(() => {
    load();
  }, [load]);

  const trashed = useMemo(
    () =>
      bookings
        .filter((b) => b.deletedAt)
        .sort((a, b) => (b.deletedAt ?? "").localeCompare(a.deletedAt ?? "")),
    [bookings]
  );

  return (
    <main className="page-root">
      <AppHeader trashCount={trashed.length} />

      <section className="section">
        <h1 className="section-title">Cestino</h1>
        <p className="section-hint">
          Le prenotazioni eliminate restano qui {TRASH_RETENTION_DAYS} giorni e non occupano più la
          camera. Dopo quel termine il server le cancella davvero, alla prima scrittura utile.
        </p>

        {trashed.length === 0 ? (
          <p className="today-empty">Il cestino è vuoto.</p>
        ) : (
          <div className="table-scroll">
            <table className="booking-table">
              <thead>
                <tr>
                  <th>Ospite</th>
                  <th>Camera</th>
                  <th>Soggiorno</th>
                  <th>Importo</th>
                  <th>Eliminata</th>
                  <th>Scade tra</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {trashed.map((booking) => {
                  const deletedAt = booking.deletedAt ? parseISO(booking.deletedAt) : null;
                  const daysLeft = deletedAt
                    ? TRASH_RETENTION_DAYS - differenceInDays(new Date(), deletedAt)
                    : TRASH_RETENTION_DAYS;
                  return (
                    <tr key={booking.id}>
                      <td>
                        <strong>{booking.guestName}</strong>
                      </td>
                      <td>{roomLabel(booking.lodge)}</td>
                      <td>
                        {format(parseISO(booking.checkIn), "d MMM", { locale: it })} →{" "}
                        {format(parseISO(booking.checkOut), "d MMM yyyy", { locale: it })}
                      </td>
                      <td>{formatMoney(booking.totalAmount)}</td>
                      <td>{deletedAt ? format(deletedAt, "d MMM HH:mm", { locale: it }) : "—"}</td>
                      <td>
                        <span className={daysLeft <= 3 ? "pill pill-danger" : "pill"}>{Math.max(0, daysLeft)} giorni</span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                          <button
                            type="button"
                            className="ghost-btn"
                            onClick={() => {
                              restoreBooking(booking.id);
                              showToast(`${booking.guestName} ripristinata.`, "success");
                            }}
                          >
                            <RotateCcw size={14} /> Ripristina
                          </button>
                          <button type="button" className="danger-btn" onClick={() => setToPurge(booking)}>
                            <Trash2 size={14} /> Elimina
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={toPurge !== null}
        title="Eliminazione definitiva"
        message={
          toPurge
            ? `La prenotazione di ${toPurge.guestName} sarà eliminata per sempre: non sarà più recuperabile.`
            : ""
        }
        confirmLabel="Elimina per sempre"
        onConfirm={() => {
          if (toPurge) {
            purgeBooking(toPurge.id);
            showToast("Prenotazione eliminata definitivamente.", "success");
          }
          setToPurge(null);
        }}
        onClose={() => setToPurge(null)}
      />

      <Toast />
    </main>
  );
}
