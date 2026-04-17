import {
  addDays,
  endOfMonth,
  format,
  isAfter,
  isBefore,
  isEqual,
  isWithinInterval,
  parseISO,
  startOfDay,
  startOfMonth,
} from "date-fns";
import type { Booking, BookingFilters } from "@/lib/types";

export const STORAGE_KEY = "le-farfalle-booking-board:v1";
export const BACKUP_KEY = "le-farfalle-booking-board:backups:v1";
export const SETTINGS_KEY = "le-farfalle-booking-board:settings:v1";
export const DELETED_KEY = "le-farfalle-booking-board:deleted:v1";

export const statusColors: Record<Booking["status"], string> = {
  confirmed: "#16a34a",
  option: "#f59e0b",
  blocked: "#6b7280",
  cancelled: "#dc2626",
};

export const channelLabels: Record<Booking["channel"], string> = {
  direct: "Direct",
  airbnb: "Airbnb",
  booking: "Booking.com",
  expedia: "Expedia",
  other: "Other",
};

export const statusLabels: Record<Booking["status"], string> = {
  confirmed: "Confermata",
  option: "Opzione",
  blocked: "Bloccata",
  cancelled: "Cancellata",
};

type BadgeStyle = { bg: string; text: string; border: string };

export const statusBadge: Record<Booking["status"], BadgeStyle> = {
  confirmed: { bg: "#f0fdf4", text: "#16a34a", border: "#bbf7d0" },
  option:    { bg: "#fffbeb", text: "#d97706", border: "#fde68a" },
  blocked:   { bg: "#f9fafb", text: "#6b7280", border: "#e5e7eb" },
  cancelled: { bg: "#fef2f2", text: "#dc2626", border: "#fecaca" },
};

export const LODGE_COLORS_MAP: Record<string, string> = {
  Limone: "#7c3aed",
  Macaone: "#a855f7",
  Vanessa: "#c084fc",
  Aurora: "#6d28d9",
};

export const channelBadge: Record<Booking["channel"], BadgeStyle> = {
  direct:   { bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe" },
  airbnb:   { bg: "#fff1f2", text: "#e61e4d", border: "#fecdd3" },
  booking:  { bg: "#eff6ff", text: "#003580", border: "#93c5fd" },
  expedia:  { bg: "#fefce8", text: "#a16207", border: "#fde047" },
  other:    { bg: "#f9fafb", text: "#6b7280", border: "#e5e7eb" },
};

export function getMonthDays(baseMonth: Date): Date[] {
  const start = startOfMonth(baseMonth);
  const end = endOfMonth(baseMonth);
  const days: Date[] = [];
  let cursor = start;
  while (!isAfter(cursor, end)) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return days;
}

export function toIsoDate(value: Date): string {
  return format(value, "yyyy-MM-dd");
}

export function isActiveOnDay(booking: Booking, day: Date): boolean {
  const dayStart = startOfDay(day);
  const checkIn = startOfDay(parseISO(booking.checkIn));
  const checkOut = startOfDay(parseISO(booking.checkOut));
  if (isEqual(dayStart, checkOut)) {
    return false;
  }
  return isWithinInterval(dayStart, { start: checkIn, end: addDays(checkOut, -1) });
}

export function overlaps(a: { checkIn: string; checkOut: string }, b: { checkIn: string; checkOut: string }): boolean {
  const aStart = startOfDay(parseISO(a.checkIn));
  const aEnd = startOfDay(parseISO(a.checkOut));
  const bStart = startOfDay(parseISO(b.checkIn));
  const bEnd = startOfDay(parseISO(b.checkOut));
  return isBefore(aStart, bEnd) && isBefore(bStart, aEnd);
}

export function formatMoney(value: number): string {
  if (!Number.isFinite(value)) {
    return "€0";
  }
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
}

export function bookingTooltip(booking: Booking): string {
  const parts = [
    `${booking.guestName} · ${booking.guestsCount}p`,
    `${booking.checkIn} → ${booking.checkOut}`,
    booking.totalAmount > 0 ? `Totale ${formatMoney(booking.totalAmount)}` : null,
    booking.depositAmount > 0 ? `Caparra ${formatMoney(booking.depositAmount)}${booking.depositReceived ? " ✓" : ""}` : null,
  ].filter(Boolean);
  return parts.join("\n");
}

export function matchesFilters(booking: Booking, filters: BookingFilters): boolean {
  const search = filters.search.trim().toLowerCase();
  if (search && !booking.guestName.toLowerCase().includes(search)) {
    return false;
  }
  if (filters.status !== "all" && booking.status !== filters.status) {
    return false;
  }
  if (filters.channel !== "all" && booking.channel !== filters.channel) {
    return false;
  }
  if (!filters.showCancelled && booking.status === "cancelled") {
    return false;
  }
  return true;
}
