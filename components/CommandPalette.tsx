"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import type { Booking } from "@/lib/types";
import { useRoomLabel } from "@/lib/settingsStore";

/**
 * Ricerca globale: ospiti, telefoni, email, numeri di prenotazione.
 *
 * Su desktop si apre con ⌘K / Ctrl+K, su telefono dalla lente della barra
 * pollice. È la risposta alla domanda più frequente al banco — "abbiamo una
 * prenotazione a nome…?" — senza dover scorrere il calendario.
 */
export function CommandPalette({
  open,
  bookings,
  onClose,
  onSelect,
}: {
  open: boolean;
  bookings: Booking[];
  onClose: () => void;
  onSelect: (booking: Booking) => void;
}) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const roomLabel = useRoomLabel();

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      // Il focus deve arrivare dopo il paint, altrimenti iOS non apre la tastiera.
      const timer = window.setTimeout(() => inputRef.current?.focus(), 40);
      return () => window.clearTimeout(timer);
    }
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = bookings.filter((b) => !b.deletedAt);
    const scored = q
      ? pool.filter((b) => {
          const haystack = [
            b.guestName,
            b.guestProfile?.phone,
            b.guestProfile?.email,
            b.bookingRef,
            b.notes,
            roomLabel(b.lodge),
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return haystack.includes(q);
        })
      : // Senza query: i prossimi arrivi, che è ciò che serve nel 90% dei casi.
        [...pool]
          .filter((b) => b.status !== "cancelled" && b.checkIn >= format(new Date(), "yyyy-MM-dd"))
          .sort((a, b) => a.checkIn.localeCompare(b.checkIn));
    return scored.slice(0, 30);
  }, [bookings, query, roomLabel]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, results.length - 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      }
      if (e.key === "Enter" && results[activeIndex]) {
        e.preventDefault();
        onSelect(results[activeIndex]);
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, results, activeIndex, onClose, onSelect]);

  if (!open) return null;

  return (
    <div className="palette-overlay no-print" role="dialog" aria-modal="true" aria-label="Ricerca prenotazioni" onClick={onClose}>
      <div className="palette" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(0);
          }}
          placeholder="Cerca ospite, telefono, email, n° prenotazione…"
          aria-label="Cerca"
        />
        <div className="palette-list">
          {results.length === 0 ? (
            <p className="palette-empty">
              {query ? "Nessuna prenotazione trovata." : "Nessun arrivo in programma."}
            </p>
          ) : (
            results.map((booking, index) => (
              <button
                key={booking.id}
                type="button"
                className="palette-item"
                data-active={index === activeIndex}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => {
                  onSelect(booking);
                  onClose();
                }}
              >
                <strong>{booking.guestName}</strong>
                <span style={{ color: "var(--muted)", fontSize: "0.82rem" }}>
                  {roomLabel(booking.lodge)} · {format(parseISO(booking.checkIn), "d MMM", { locale: it })} →{" "}
                  {format(parseISO(booking.checkOut), "d MMM", { locale: it })}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
