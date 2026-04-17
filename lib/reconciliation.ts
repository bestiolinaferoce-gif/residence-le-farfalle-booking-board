import { differenceInDays, parseISO } from "date-fns"
import type { Booking } from "@/lib/types"

export type BookingConflict = {
  kind: "duplicate" | "overlap"
  lodge: Booking["lodge"]
  keptId: string
  otherId: string
  keptGuest: string
  otherGuest: string
}

export type BookingReconciliation = {
  bookings: Booking[]
  duplicatesCollapsed: number
  overlapsDetected: number
  conflicts: BookingConflict[]
}

function bookingUpdatedMs(booking: Booking): number {
  const ts = Date.parse(booking.updatedAt || booking.createdAt || "")
  return Number.isFinite(ts) ? ts : 0
}

function normalizeGuestName(name: string): string[] {
  return name
    .toUpperCase()
    .replace(/[^A-ZÀ-ÖØ-Ý0-9\s]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3)
}

function shareGuestIdentity(a: Booking, b: Booking): boolean {
  const aTokens = normalizeGuestName(a.guestName)
  const bTokens = normalizeGuestName(b.guestName)
  if (aTokens.length === 0 || bTokens.length === 0) return false
  const bSet = new Set(bTokens)
  const shared = aTokens.filter((token) => bSet.has(token))
  return shared.length >= 1
}

function overlaps(a: Booking, b: Booking): boolean {
  const aStart = parseISO(a.checkIn)
  const aEnd = parseISO(a.checkOut)
  const bStart = parseISO(b.checkIn)
  const bEnd = parseISO(b.checkOut)
  return aStart < bEnd && bStart < aEnd
}

function isLikelyDuplicate(a: Booking, b: Booking): boolean {
  if (a.lodge !== b.lodge) return false
  if (a.status === "cancelled" || b.status === "cancelled") return false
  if (!overlaps(a, b)) return false

  const sameDates = a.checkIn === b.checkIn && a.checkOut === b.checkOut
  const sameCheckIn = a.checkIn === b.checkIn
  const sameAmount = Math.abs((a.totalAmount || 0) - (b.totalAmount || 0)) < 0.01
  const sameDeposit = Math.abs((a.depositAmount || 0) - (b.depositAmount || 0)) < 0.01
  const closeStay =
    Math.abs(differenceInDays(parseISO(a.checkOut), parseISO(b.checkOut))) <= 1 &&
    a.checkIn === b.checkIn

  return (
    sameDates ||
    (sameCheckIn && shareGuestIdentity(a, b)) ||
    (closeStay && sameAmount && shareGuestIdentity(a, b)) ||
    (sameCheckIn && sameAmount && sameDeposit && shareGuestIdentity(a, b))
  )
}

function chooseKeeper(a: Booking, b: Booking): Booking {
  const aUpdated = bookingUpdatedMs(a)
  const bUpdated = bookingUpdatedMs(b)
  if (aUpdated !== bUpdated) return aUpdated > bUpdated ? a : b
  if (a.checkOut !== b.checkOut) return a.checkOut > b.checkOut ? a : b
  if ((a.guestsCount || 0) !== (b.guestsCount || 0)) return a.guestsCount >= b.guestsCount ? a : b
  return a.createdAt >= b.createdAt ? a : b
}

export function reconcileBookings(bookings: Booking[]): BookingReconciliation {
  const sorted = [...bookings].sort((a, b) => {
    const lodgeCompare = a.lodge.localeCompare(b.lodge)
    if (lodgeCompare !== 0) return lodgeCompare
    const checkInCompare = a.checkIn.localeCompare(b.checkIn)
    if (checkInCompare !== 0) return checkInCompare
    return bookingUpdatedMs(b) - bookingUpdatedMs(a)
  })

  const keepers: Booking[] = []
  const conflicts: BookingConflict[] = []
  let duplicatesCollapsed = 0
  let overlapsDetected = 0

  for (const booking of sorted) {
    const sameLodge = keepers.filter((candidate) => candidate.lodge === booking.lodge && candidate.status !== "cancelled")
    const duplicateOf = sameLodge.find((candidate) => isLikelyDuplicate(candidate, booking))

    if (duplicateOf) {
      const keeper = chooseKeeper(duplicateOf, booking)
      const loser = keeper.id === duplicateOf.id ? booking : duplicateOf
      if (keeper.id !== duplicateOf.id) {
        const index = keepers.findIndex((candidate) => candidate.id === duplicateOf.id)
        if (index >= 0) keepers[index] = keeper
      }
      duplicatesCollapsed += 1
      conflicts.push({
        kind: "duplicate",
        lodge: keeper.lodge,
        keptId: keeper.id,
        otherId: loser.id,
        keptGuest: keeper.guestName,
        otherGuest: loser.guestName,
      })
      continue
    }

    const overlapping = sameLodge.find((candidate) => overlaps(candidate, booking))
    if (overlapping) {
      overlapsDetected += 1
      conflicts.push({
        kind: "overlap",
        lodge: booking.lodge,
        keptId: overlapping.id,
        otherId: booking.id,
        keptGuest: overlapping.guestName,
        otherGuest: booking.guestName,
      })
    }

    keepers.push(booking)
  }

  return {
    bookings: keepers.sort((a, b) => a.checkIn.localeCompare(b.checkIn)),
    duplicatesCollapsed,
    overlapsDetected,
    conflicts,
  }
}
