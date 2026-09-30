"use client";

import { addDays, differenceInDays, endOfMonth, format, parseISO, startOfMonth } from "date-fns";
import { it } from "date-fns/locale";
import type { Booking, Lodge } from "@/lib/types";
import { formatMoney } from "@/lib/utils";
import { useActiveRoomIds, useRoomColor, useRoomLabel } from "@/lib/settingsStore";

export type LodgeSummary = {
  lodge: Lodge;
  bookingsCount: number;
  nightsBooked: number;
  occupancyPct: number;
  revenue: number;
};

function isActiveInMonth(booking: Booking, monthStart: Date, monthEnd: Date): boolean {
  const checkIn = parseISO(booking.checkIn);
  const checkOut = parseISO(booking.checkOut);
  const bStart = checkIn < monthStart ? monthStart : checkIn;
  const bEnd = checkOut > addDays(monthEnd, 1) ? addDays(monthEnd, 1) : checkOut;
  return bStart < bEnd;
}

function nightsInMonth(booking: Booking, monthStart: Date, monthEnd: Date): number {
  const checkIn = parseISO(booking.checkIn);
  const checkOut = parseISO(booking.checkOut);
  const bStart = checkIn < monthStart ? monthStart : checkIn;
  const bEnd = checkOut > addDays(monthEnd, 1) ? addDays(monthEnd, 1) : checkOut;
  if (bStart >= bEnd) return 0;
  return differenceInDays(bEnd, bStart);
}

function revenueInMonth(booking: Booking, monthStart: Date, monthEnd: Date): number {
  const totalNights = differenceInDays(parseISO(booking.checkOut), parseISO(booking.checkIn));
  if (totalNights <= 0) return 0;
  const nights = nightsInMonth(booking, monthStart, monthEnd);
  return (booking.totalAmount / totalNights) * nights;
}

/** `rooms` sono le sole camere attive: le altre non entrano nell'occupazione. */
export function computeLodgeSummaries(
  monthDate: Date,
  bookings: Booking[],
  rooms: readonly Lodge[]
): LodgeSummary[] {
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  const totalDays = differenceInDays(addDays(monthEnd, 1), monthStart);

  return rooms.map((lodge) => {
    const lodgeBookings = bookings.filter(
      (b) => b.lodge === lodge && b.status !== "cancelled" && isActiveInMonth(b, monthStart, monthEnd)
    );
    const nightsBooked = lodgeBookings.reduce((acc, b) => acc + nightsInMonth(b, monthStart, monthEnd), 0);
    const revenue = lodgeBookings.reduce((acc, b) => acc + revenueInMonth(b, monthStart, monthEnd), 0);
    const occupancyPct = totalDays > 0 ? (nightsBooked / totalDays) * 100 : 0;

    return {
      lodge,
      bookingsCount: lodgeBookings.length,
      nightsBooked,
      occupancyPct,
      revenue,
    };
  });
}

type MonthSummaryProps = {
  monthDate: Date;
  lodgeSummaries: LodgeSummary[];
};

export function MonthSummary({ monthDate, lodgeSummaries }: MonthSummaryProps) {
  const roomIds = useActiveRoomIds();
  const roomLabel = useRoomLabel();
  const roomColor = useRoomColor();
  const totalNotti = lodgeSummaries.reduce((acc, s) => acc + s.nightsBooked, 0);
  const totalRevenue = lodgeSummaries.reduce((acc, s) => acc + s.revenue, 0);
  const totalDays = differenceInDays(addDays(endOfMonth(monthDate), 1), startOfMonth(monthDate));
  const avgOccupancy = totalDays > 0 ? (totalNotti / (totalDays * Math.max(roomIds.length, 1))) * 100 : 0;

  if (lodgeSummaries.every((s) => s.bookingsCount === 0)) {
    return null;
  }

  return (
    <section className="month-summary no-print">
      <h3 className="month-summary-title">
        Riepilogo {format(monthDate, "MMMM yyyy", { locale: it })} — {totalNotti} notti occupate / {totalDays} giorni · Occupazione media {avgOccupancy.toFixed(0)}%
      </h3>
      <table className="summary-table">
        <thead>
          <tr>
            <th>Camera</th>
            <th>Prenotazioni</th>
            <th>Notti</th>
            <th>Occupazione %</th>
            <th>Fatturato</th>
          </tr>
        </thead>
        <tbody>
          {lodgeSummaries.map((s) => (
            <tr key={s.lodge}>
              <td>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: roomColor(s.lodge),
                      display: "inline-block",
                      flexShrink: 0,
                    }}
                  />
                  {roomLabel(s.lodge)}
                </span>
              </td>
              <td>{s.bookingsCount}</td>
              <td>{s.nightsBooked}</td>
              <td>
                <span>{s.occupancyPct.toFixed(0)}%</span>
                <div className="occ-bar">
                  <div className="occ-bar-fill" style={{ width: `${Math.min(s.occupancyPct, 100)}%`, background: roomColor(s.lodge) }} />
                </div>
              </td>
              <td>{formatMoney(s.revenue)}</td>
            </tr>
          ))}
          <tr>
            <td><strong>Totale</strong></td>
            <td><strong>{lodgeSummaries.reduce((a, s) => a + s.bookingsCount, 0)}</strong></td>
            <td><strong>{totalNotti}</strong></td>
            <td><strong>{avgOccupancy.toFixed(0)}%</strong></td>
            <td><strong>{formatMoney(totalRevenue)}</strong></td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}
