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
import { useMemo } from "react";
import type { Booking, BookingFilters, BookingLodge, Lodge } from "@/lib/types";
import { LODGES, UNASSIGNED_LODGE } from "@/lib/types";

// Colori celle basati su canale (Task spec)
const CHANNEL_BAR_COLORS: Record<string, { bg: string; text: string }> = {
  airbnb: { bg: "#fda4af", text: "#9f1239" },
  direct: { bg: "#6ee7b7", text: "#065f46" },
  booking: { bg: "#93c5fd", text: "#1e3a8a" },
  expedia: { bg: "#fcd34d", text: "#78350f" },
  other: { bg: "#d1d5db", text: "#374151" },
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

const LODGE_COLORS: Record<BookingLodge, { dot: string }> = {
  [UNASSIGNED_LODGE]: { dot: "#f59e0b" },
  Limone:  { dot: "#7c3aed" },
  Macaone: { dot: "#a855f7" },
  Vanessa: { dot: "#c084fc" },
  Aurora:  { dot: "#6d28d9" },
};

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
};

function renderLodgeCells(
  lodge: BookingLodge,
  cellMap: Map<number, CellInfo>,
  monthDays: Date[],
  today: Date,
  onCreate: (lodge: Lodge, day: Date) => void,
  onEdit: (booking: Booking) => void
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

      cells.push(
        <div
          key={i}
          className={`gantt-cell gantt-cell-booked ${isToday ? "gantt-cell-today" : ""} ${isWeekend ? "gantt-cell-weekend" : ""}`}
          style={{
            gridColumn: `span ${span}`,
            background: bc.bg,
            color: bc.text,
            borderLeft: `3px solid ${bc.text}`,
          }}
          onClick={() => onEdit(booking)}
          title={`${booking.guestName}\n${booking.checkIn} → ${booking.checkOut}\n${booking.totalAmount}€`}
        >
          <span className="gantt-cell-name">{truncName}</span>
          {span > 2 && <span className="gantt-cell-nights">{nights}n</span>}
          {span > 4 && (
            <span className="gantt-cell-amount">{booking.totalAmount}€</span>
          )}
          {booking.isNew && <span className="gantt-new-dot" />}
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
}: GanttBoardProps) {
  const today = useMemo(() => startOfDay(new Date()), []);

  const visibleBookings = useMemo(
    () =>
      bookings.filter((b) => {
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

  const daysCount = monthDays.length;
  const gridCols = `180px repeat(${daysCount}, minmax(32px, 1fr))`;

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
    <div className="gantt-wrap" style={{ overflowX: "auto" }}>
      <div
        className="gantt-header"
        style={{
          display: "grid",
          gridTemplateColumns: gridCols,
          minWidth: 0,
          borderBottom: "1px solid var(--border-strong, #e5e7eb)",
        }}
      >
        <div className="gantt-label-col">Lodge</div>
        {monthDays.map((day, i) => {
          const isToday = isSameDay(day, today);
          const isWeekend = getDay(day) === 0 || getDay(day) === 6;
          return (
            <div
              key={i}
              className={`gantt-day-header ${isToday ? "gantt-today-header" : ""} ${isWeekend ? "gantt-weekend-header" : ""}`}
            >
              <span className="gantt-day-num">{format(day, "d")}</span>
              <span className="gantt-day-name">{format(day, "EEE")}</span>
            </div>
          );
        })}
      </div>

      {LODGES.map((lodge) => {
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
              <span
                className="gantt-dot"
                style={{ background: LODGE_COLORS[lodge].dot }}
              />
              {lodge}
            </div>
            {renderLodgeCells(
              lodge,
              cellMap,
              monthDays,
              today,
              onCreate,
              onEdit
            )}
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
            <span className="gantt-dot" style={{ background: LODGE_COLORS[UNASSIGNED_LODGE].dot }} />
            {trackIndex === 0 ? UNASSIGNED_LODGE : ""}
          </div>
          {renderLodgeCells(
            UNASSIGNED_LODGE,
            buildCellMap(UNASSIGNED_LODGE, track, monthDays),
            monthDays,
            today,
            onCreate,
            onEdit
          )}
        </div>
      ))}
    </div>
  );
}
