"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Booking, Lodge } from "@/lib/types";

/**
 * Spostamento delle prenotazioni sulla board con trascinamento.
 *
 * Scritto con i Pointer Events invece che con una libreria di drag and drop:
 * la board si usa soprattutto dal telefono, e serviva un comportamento diverso
 * per dito e mouse. Col mouse il trascinamento parte subito; col dito parte
 * solo dopo una pressione lunga, altrimenti scorrere la pagina toccando una
 * barra sposterebbe la prenotazione per sbaglio.
 *
 * Due modalità:
 * - `move`   → cambia date e/o camera (orizzontale = giorni, verticale = camera)
 * - `resize` → afferrando il bordo destro, allunga o accorcia il soggiorno
 */

/** Millisecondi di pressione prima che il dito inizi a trascinare. */
const TOUCH_HOLD_MS = 320;
/** Pixel di movimento oltre i quali è un trascinamento e non un tocco. */
const DRAG_THRESHOLD_PX = 4;
/** Larghezza della zona di presa sul bordo destro della barra. */
const RESIZE_HANDLE_PX = 16;

export type DragMode = "move" | "resize";

export type DragState = {
  bookingId: string;
  mode: DragMode;
  /** Giorni di spostamento, già arrotondati alla colonna. */
  dayDelta: number;
  /** Righe di spostamento (solo in `move`). */
  rowDelta: number;
  /** Il trascinamento ha superato la soglia: la barra si è mossa davvero. */
  active: boolean;
};

export type DropResult = {
  booking: Booking;
  checkIn: string;
  checkOut: string;
  lodge: Lodge;
};

function shiftIsoDate(iso: string, days: number): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function nightsBetween(checkIn: string, checkOut: string): number {
  const ms = Date.parse(checkOut) - Date.parse(checkIn);
  return Number.isFinite(ms) ? Math.round(ms / 86_400_000) : 0;
}

export function useBookingDrag({
  cellWidth,
  rowHeight,
  roomIds,
  onDrop,
  onClick,
}: {
  cellWidth: number;
  rowHeight: number;
  roomIds: Lodge[];
  onDrop: (result: DropResult) => void;
  onClick: (booking: Booking) => void;
}) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const session = useRef<{
    booking: Booking;
    mode: DragMode;
    startX: number;
    startY: number;
    pointerId: number;
    holdTimer: number | null;
    armed: boolean;
    moved: boolean;
  } | null>(null);

  const finish = useCallback(
    (commit: boolean) => {
      const current = session.current;
      session.current = null;

      setDrag((state) => {
        if (current && commit && state?.active) {
          const { booking, mode } = current;
          const nights = nightsBetween(booking.checkIn, booking.checkOut);

          if (mode === "move") {
            const rowIndex = roomIds.indexOf(booking.lodge as Lodge);
            const nextRow =
              rowIndex === -1
                ? rowIndex
                : Math.min(Math.max(rowIndex + state.rowDelta, 0), roomIds.length - 1);
            onDrop({
              booking,
              checkIn: shiftIsoDate(booking.checkIn, state.dayDelta),
              checkOut: shiftIsoDate(booking.checkOut, state.dayDelta),
              lodge: nextRow === -1 ? (booking.lodge as Lodge) : roomIds[nextRow],
            });
          } else {
            // Il soggiorno non può scendere sotto una notte.
            const delta = Math.max(state.dayDelta, -(nights - 1));
            onDrop({
              booking,
              checkIn: booking.checkIn.slice(0, 10),
              checkOut: shiftIsoDate(booking.checkOut, delta),
              lodge: booking.lodge as Lodge,
            });
          }
        } else if (current && commit && !current.moved) {
          // Nessuno spostamento: era un tocco, apre la scheda.
          onClick(current.booking);
        }
        return null;
      });
    },
    [onDrop, onClick, roomIds]
  );

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>, booking: Booking) => {
      // Il tasto destro apre il menu del browser: non è un trascinamento.
      if (event.button !== 0 && event.pointerType === "mouse") return;

      const rect = event.currentTarget.getBoundingClientRect();
      const mode: DragMode = rect.right - event.clientX <= RESIZE_HANDLE_PX ? "resize" : "move";
      const isTouch = event.pointerType === "touch";

      event.currentTarget.setPointerCapture?.(event.pointerId);

      session.current = {
        booking,
        mode,
        startX: event.clientX,
        startY: event.clientY,
        pointerId: event.pointerId,
        armed: !isTouch,
        moved: false,
        holdTimer: isTouch
          ? window.setTimeout(() => {
              if (!session.current) return;
              session.current.armed = true;
              // Vibrazione breve: conferma che la barra è "in mano".
              navigator.vibrate?.(12);
              setDrag({ bookingId: booking.id, mode, dayDelta: 0, rowDelta: 0, active: false });
            }, TOUCH_HOLD_MS)
          : null,
      };

      setDrag({ bookingId: booking.id, mode, dayDelta: 0, rowDelta: 0, active: false });
    },
    []
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const current = session.current;
      if (!current || current.pointerId !== event.pointerId) return;

      const dx = event.clientX - current.startX;
      const dy = event.clientY - current.startY;

      if (!current.armed) {
        // Dito non ancora "armato": se si muove, sta scorrendo la pagina.
        if (Math.abs(dx) > DRAG_THRESHOLD_PX || Math.abs(dy) > DRAG_THRESHOLD_PX) {
          if (current.holdTimer) window.clearTimeout(current.holdTimer);
          session.current = null;
          setDrag(null);
        }
        return;
      }

      const passed = Math.abs(dx) > DRAG_THRESHOLD_PX || Math.abs(dy) > DRAG_THRESHOLD_PX;
      if (passed) current.moved = true;

      const dayDelta = cellWidth > 0 ? Math.round(dx / cellWidth) : 0;
      const rowDelta = current.mode === "move" && rowHeight > 0 ? Math.round(dy / rowHeight) : 0;

      setDrag({
        bookingId: current.booking.id,
        mode: current.mode,
        dayDelta,
        rowDelta,
        active: passed,
      });
    },
    [cellWidth, rowHeight]
  );

  const onPointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const current = session.current;
      if (!current || current.pointerId !== event.pointerId) return;
      if (current.holdTimer) window.clearTimeout(current.holdTimer);
      finish(true);
    },
    [finish]
  );

  const onPointerCancel = useCallback(() => {
    const current = session.current;
    if (current?.holdTimer) window.clearTimeout(current.holdTimer);
    finish(false);
  }, [finish]);

  // Esc annulla il trascinamento in corso, come in qualsiasi editor.
  useEffect(() => {
    if (!drag) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onPointerCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drag, onPointerCancel]);

  return { drag, onPointerDown, onPointerMove, onPointerUp, onPointerCancel };
}

export { shiftIsoDate, nightsBetween };
