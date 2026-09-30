"use client";

import {
  addDays,
  differenceInDays,
  format,
  getDay,
  isSameDay,
  parseISO,
  startOfDay,
} from "date-fns";
import { it } from "date-fns/locale";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Booking, BookingFilters, BookingLodge, Lodge } from "@/lib/types";
import { UNASSIGNED_LODGE } from "@/lib/types";
import { useActiveRoomIds, useRoomColor, useRoomLabel } from "@/lib/settingsStore";
import { detectOverbookings } from "@/lib/validation";
import { useBookingDrag, type DragState, type DropResult } from "@/lib/useBookingDrag";

// Colori celle basati su canale (Task spec)
/** Barre: un colore per canale, leggibile su fondo scuro come su carta. */
const CHANNEL_BAR_COLORS: Record<string, { bg: string; text: string }> = {
  direct: { bg: "linear-gradient(135deg, #ffb199, #e2725b)", text: "#3a1108" },
  booking: { bg: "linear-gradient(135deg, #7fc7d9, #2a7d8c)", text: "#06222a" },
  airbnb: { bg: "linear-gradient(135deg, #ff9aa8, #d1495b)", text: "#3d0912" },
  expedia: { bg: "linear-gradient(135deg, #f2d492, #e9c46a)", text: "#3d2f06" },
  other: { bg: "linear-gradient(135deg, #b9c6c9, #8ea3a8)", text: "#1d2b2f" },
};

const STATUS_BAR_OVERRIDES: Partial<Record<string, { bg: string; text: string }>> = {
  option: { bg: "#fcd34d", text: "#78350f" },
  blocked: { bg: "#e5e7eb", text: "#6b7280" },
  cancelled: { bg: "#e5e7eb", text: "#9ca3af" },
};

function barColors(channel: string, status: string): { bg: string; text: string } {
  return (
    STATUS_BAR_OVERRIDES[status] ??
    CHANNEL_BAR_COLORS[channel] ??
    CHANNEL_BAR_COLORS.other
  );
}

/** La corsia "Da assegnare" non è una camera: colore fisso, non configurabile. */
const UNASSIGNED_DOT = "#e9c46a";

type CellInfo = { booking: Booking; isFirst: boolean; span: number };

function buildCellMap(
  lodge: BookingLodge,
  bookings: Booking[],
  monthDays: Date[]
): Map<number, CellInfo> {
  const firstDay = startOfDay(monthDays[0]);
  const lastDay = startOfDay(monthDays[monthDays.length - 1]);
  const map = new Map<number, CellInfo>();

  const lodgeBookings = bookings.filter(
    (b) => b.lodge === lodge && b.status !== "cancelled"
  );

  for (const booking of lodgeBookings) {
    const checkIn = startOfDay(parseISO(booking.checkIn));
    const checkOut = startOfDay(parseISO(booking.checkOut));

    const barStart = checkIn < firstDay ? firstDay : checkIn;
    const barEnd =
      checkOut > addDays(lastDay, 1) ? addDays(lastDay, 1) : checkOut;

    const startIdx = differenceInDays(barStart, firstDay);
    const span = differenceInDays(barEnd, barStart);

    for (let i = startIdx; i < startIdx + span && i < monthDays.length; i++) {
      if (i >= 0) {
        map.set(i, {
          booking,
          isFirst: i === startIdx,
          span: i === startIdx ? span : 0,
        });
      }
    }
  }
  return map;
}

type GanttBoardProps = {
  monthDays: Date[];
  bookings: Booking[];
  filters: BookingFilters;
  onCreate: (lodge: Lodge, day: Date) => void;
  onEdit: (booking: Booking) => void;
  /** Spostamento o ridimensionamento di una barra col trascinamento. */
  onMove: (result: DropResult) => void;
};

/** Handler e stato del trascinamento, passati alle celle. */
type DragApi = {
  drag: DragState | null;
  cellWidth: number;
  rowHeight: number;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>, booking: Booking) => void;
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerCancel: () => void;
};

function renderLodgeCells(
  lodge: BookingLodge,
  cellMap: Map<number, CellInfo>,
  monthDays: Date[],
  today: Date,
  onCreate: (lodge: Lodge, day: Date) => void,
  conflictIds: Set<string>,
  dragApi: DragApi
) {
  // Nella corsia "Da assegnare" non esiste un'unità su cui creare: celle non cliccabili.
  const canCreate = lodge !== UNASSIGNED_LODGE;
  const cells: React.ReactNode[] = [];
  let i = 0;
  while (i < monthDays.length) {
    const info = cellMap.get(i);
    if (!info) {
      const isToday = isSameDay(monthDays[i], today);
      const isWeekend = getDay(monthDays[i]) === 0 || getDay(monthDays[i]) === 6;
      cells.push(
        <div
          key={i}
          className={`gantt-cell gantt-cell-empty${isToday ? " gantt-cell-today" : ""}${isWeekend ? " gantt-cell-weekend" : ""}`}
          onClick={canCreate ? () => onCreate(lodge as Lodge, monthDays[i]) : undefined}
        >
          {canCreate && <span className="gantt-add">+</span>}
        </div>
      );
      i++;
    } else if (info.isFirst) {
      const { booking, span } = info;
      const bc = barColors(booking.channel, booking.status);
      const nights = differenceInDays(
        parseISO(booking.checkOut),
        parseISO(booking.checkIn)
      );
      const truncName =
        booking.guestName.length > 14
          ? booking.guestName.slice(0, 14) + "…"
          : booking.guestName;
      const isToday = isSameDay(monthDays[i], today);
      const isWeekend =
        getDay(monthDays[i]) === 0 || getDay(monthDays[i]) === 6;

      const { drag, cellWidth, rowHeight } = dragApi;
      const dragging = drag?.bookingId === booking.id && drag.active;
      const moving = dragging && drag.mode === "move";
      const resizing = dragging && drag.mode === "resize";

      cells.push(
        <div
          key={i}
          className={`gantt-cell gantt-cell-booked booking-chip ${isToday ? "gantt-cell-today" : ""} ${isWeekend ? "gantt-cell-weekend" : ""} ${conflictIds.has(booking.id) ? "chip-overbooking" : ""} ${dragging ? "chip-dragging" : ""}`}
          style={{
            gridColumn: `span ${span}`,
            background: bc.bg,
            color: bc.text,
            borderLeft: `3px solid ${bc.text}`,
            // L'anteprima segue la griglia: si vede subito su quale giorno e
            // quale camera finirà la prenotazione se si lascia adesso.
            transform: moving
              ? `translate(${drag.dayDelta * cellWidth}px, ${drag.rowDelta * rowHeight}px)`
              : undefined,
            width: resizing ? `calc(100% + ${drag.dayDelta * cellWidth}px)` : undefined,
          }}
          onPointerDown={(e) => dragApi.onPointerDown(e, booking)}
          onPointerMove={dragApi.onPointerMove}
          onPointerUp={dragApi.onPointerUp}
          onPointerCancel={dragApi.onPointerCancel}
          title={`${booking.guestName}\n${booking.checkIn} → ${booking.checkOut}\n${booking.totalAmount}€\nTrascina per spostare, bordo destro per allungare`}
        >
          <span className="gantt-cell-name">{truncName}</span>
          {span > 2 && <span className="gantt-cell-nights">{nights}n</span>}
          {span > 4 && (
            <span className="gantt-cell-amount">{booking.totalAmount}€</span>
          )}
          {booking.isNew && <span className="gantt-new-dot" />}
          <span className="chip-resize-handle" aria-hidden />
        </div>
      );
      i += span;
    } else {
      i++;
    }
  }
  return cells;
}

export function GanttBoard({
  monthDays,
  bookings,
  filters,
  onCreate,
  onEdit,
  onMove,
}: GanttBoardProps) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [metrics, setMetrics] = useState({ cellWidth: 0, rowHeight: 0 });

  /**
   * Le colonne sono in `1fr`: la loro larghezza reale dipende dallo schermo e
   * cambia a ogni rotazione del telefono. Va misurata, non calcolata.
   */
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    function measure() {
      const cell = wrap?.querySelector(".gantt-day-header");
      const row = wrap?.querySelector(".gantt-row");
      setMetrics({
        cellWidth: cell?.getBoundingClientRect().width ?? 0,
        rowHeight: row?.getBoundingClientRect().height ?? 0,
      });
    }

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, []);
  const roomIds = useActiveRoomIds();
  const roomLabel = useRoomLabel();
  const roomColor = useRoomColor();

  /**
   * Le sovrapposizioni si calcolano su TUTTE le prenotazioni, non su quelle
   * filtrate: un conflitto nascosto da un filtro resterebbe invisibile proprio
   * mentre serve vederlo.
   */
  const conflictIds = useMemo(() => {
    const ids = new Set<string>();
    for (const { a, b } of detectOverbookings(bookings)) {
      ids.add(a.id);
      ids.add(b.id);
    }
    return ids;
  }, [bookings]);

  const visibleBookings = useMemo(
    () =>
      bookings.filter((b) => {
        if (b.deletedAt) return false;
        if (filters.search.trim()) {
          if (
            !b.guestName.toLowerCase().includes(filters.search.trim().toLowerCase())
          )
            return false;
        }
        if (filters.status !== "all" && b.status !== filters.status) return false;
        if (filters.channel !== "all" && b.channel !== filters.channel)
          return false;
        if (!filters.showCancelled && b.status === "cancelled") return false;
        return true;
      }),
    [bookings, filters]
  );

  const dragApiBase = useBookingDrag({
    cellWidth: metrics.cellWidth,
    rowHeight: metrics.rowHeight,
    roomIds,
    onDrop: onMove,
    onClick: onEdit,
  });

  const dragApi: DragApi = {
    ...dragApiBase,
    cellWidth: metrics.cellWidth,
    rowHeight: metrics.rowHeight,
  };

  const daysCount = monthDays.length;
  // Colonna nomi più stretta su telefono: lascia respiro ai giorni.
  const gridCols = `clamp(112px, 26vw, 180px) repeat(${daysCount}, minmax(34px, 1fr))`;

  /**
   * Le prenotazioni non assegnate si sovrappongono spesso sulle stesse date: in una
   * riga sola l'ultima coprirebbe le precedenti. Le distribuisce su tracce disgiunte
   * così restano tutte visibili. Vuoto = nessuna corsia, board a 4 righe come sempre.
   */
  const unassignedTracks = useMemo(() => {
    const pending = visibleBookings
      .filter((b) => b.lodge === UNASSIGNED_LODGE && b.status !== "cancelled")
      .sort((a, b) => a.checkIn.localeCompare(b.checkIn));

    const tracks: Booking[][] = [];
    for (const booking of pending) {
      const track = tracks.find(
        (rows) => !rows.some((r) => r.checkIn < booking.checkOut && booking.checkIn < r.checkOut)
      );
      if (track) track.push(booking);
      else tracks.push([booking]);
    }
    return tracks;
  }, [visibleBookings]);

  return (
    <div className="gantt-wrap" ref={wrapRef} style={{ overflowX: "auto" }}>
      <div
        className="gantt-header"
        style={{
          display: "grid",
          gridTemplateColumns: gridCols,
          minWidth: 0,
          borderBottom: "1px solid var(--border-strong, #e5e7eb)",
        }}
      >
        <div className="gantt-label-col">Camera</div>
        {monthDays.map((day, i) => {
          const isToday = isSameDay(day, today);
          const isWeekend = getDay(day) === 0 || getDay(day) === 6;
          return (
            <div
              key={i}
              className={`gantt-day-header ${isToday ? "gantt-today-header" : ""} ${isWeekend ? "gantt-weekend-header" : ""}`}
            >
              <span className="gantt-day-num">{format(day, "d")}</span>
              <span className="gantt-day-name">{format(day, "EEE", { locale: it })}</span>
            </div>
          );
        })}
      </div>

      {roomIds.map((lodge) => {
        const cellMap = buildCellMap(lodge, visibleBookings, monthDays);
        return (
          <div
            key={lodge}
            className="gantt-row"
            style={{
              display: "grid",
              gridTemplateColumns: gridCols,
              minWidth: 0,
              borderBottom: "1px solid var(--border-strong, #e5e7eb)",
            }}
          >
            <div className="gantt-lodge-label">
              <span className="gantt-dot" style={{ background: roomColor(lodge) }} />
              {roomLabel(lodge)}
            </div>
            {renderLodgeCells(lodge, cellMap, monthDays, today, onCreate, conflictIds, dragApi)}
          </div>
        );
      })}

      {/* Corsia dei feed di struttura: nessun lodge assegnato, in attesa dell'host. */}
      {unassignedTracks.map((track, trackIndex) => (
        <div
          key={`unassigned-${trackIndex}`}
          className="gantt-row gantt-row-unassigned"
          style={{
            display: "grid",
            gridTemplateColumns: gridCols,
            minWidth: 0,
            borderTop: trackIndex === 0 ? "2px solid #f59e0b" : undefined,
            borderBottom: "1px solid var(--border-strong, #e5e7eb)",
          }}
        >
          <div className="gantt-lodge-label">
            <span className="gantt-dot" style={{ background: UNASSIGNED_DOT }} />
            {trackIndex === 0 ? UNASSIGNED_LODGE : ""}
          </div>
          {renderLodgeCells(
            UNASSIGNED_LODGE,
            buildCellMap(UNASSIGNED_LODGE, track, monthDays),
            monthDays,
            today,
            onCreate,
            conflictIds,
            dragApi
          )}
        </div>
      ))}
    </div>
  );
}
