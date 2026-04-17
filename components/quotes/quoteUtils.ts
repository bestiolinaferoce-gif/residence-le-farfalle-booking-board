import { differenceInCalendarDays, parseISO, isValid } from "date-fns";
import { policies, pricingDefaults } from "./quoteConfig";
import type { QuoteLodgeId } from "./quoteConfig";

export type QuoteFormState = {
  clientName: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  lodgeId: QuoteLodgeId;
  /** Lodge secondaria per tabella confronto qualitativo nel template (opzionale). */
  compareLodgeId: QuoteLodgeId | "";
  /** Tariffa per notte (€); il totale soggiorno = notti × tariffa. */
  dailyRate: number;
  /** 0, 5 o 10 — applicato sul totale soggiorno calcolato. */
  discountPercent: 0 | 5 | 10;
  includeSanitization: boolean;
  includePetDomestic: boolean;
  /** URL foto proprietà/lodge da mostrare nel preventivo (opzionale). */
  photoUrl?: string;
};

export type QuoteComputed = {
  nights: number;
  /** Tariffa per notte inserita (€). */
  dailyRate: number;
  /** Totale soggiorno = notti × dailyRate (prima dello sconto). */
  stayGross: number;
  discountPercent: number;
  discountAmount: number;
  stayAfterDiscount: number;
  sanitization: number;
  petEnvironmentFee: number;
  touristTax: number;
  grandTotal: number;
  deposit: number;
  balance: number;
  depositPercent: number;
};

export function round2(n: number): number {
  return Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
}

export function parseGuests(n: number): number {
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(99, Math.floor(n));
}

export function computeQuote(state: QuoteFormState): QuoteComputed {
  const nights = computeNights(state.checkIn, state.checkOut);
  const guests = parseGuests(state.guests);
  const nightsCount = Math.max(0, nights);
  const dailyRate = round2(Math.max(0, state.dailyRate));
  const stayGross =
    nightsCount > 0 ? round2(nightsCount * dailyRate) : 0;

  const discountPercent = state.discountPercent;
  const discountAmount = round2(stayGross * (discountPercent / 100));
  const stayAfterDiscount = round2(stayGross - discountAmount);

  const sanitization = state.includeSanitization
    ? pricingDefaults.sanitizationExtra
    : 0;
  const petEnvironmentFee = state.includePetDomestic
    ? pricingDefaults.petEnvironmentSanitization
    : 0;
  const touristTax =
    nights > 0
      ? round2(
          nights *
            guests *
            pricingDefaults.touristTaxPerPersonPerNight
        )
      : 0;

  const grandTotal = round2(
    stayAfterDiscount + sanitization + petEnvironmentFee + touristTax
  );
  const depositPercent = policies.depositPercent;
  const deposit = round2((grandTotal * depositPercent) / 100);
  const balance = round2(grandTotal - deposit);

  return {
    nights: nightsCount,
    dailyRate,
    stayGross,
    discountPercent,
    discountAmount,
    stayAfterDiscount,
    sanitization,
    petEnvironmentFee,
    touristTax,
    grandTotal,
    deposit,
    balance,
    depositPercent,
  };
}

export function computeNights(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 0;
  const a = parseISO(checkIn);
  const b = parseISO(checkOut);
  if (!isValid(a) || !isValid(b) || b <= a) return 0;
  return differenceInCalendarDays(b, a);
}

export function formatCurrencyEUR(n: number): string {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
}

export function formatDateIt(iso: string): string {
  if (!iso) return "—";
  const d = parseISO(iso);
  if (!isValid(d)) return iso;
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(d);
}

/** IBAN leggibile con spazi (es. IT30 S034 …) */
export function formatIbanSpaced(iban: string): string {
  const raw = iban.replace(/\s/g, "").toUpperCase();
  return raw.replace(/(.{4})/g, "$1 ").trim();
}
