/**
 * Imposta di soggiorno — Comune di Isola di Capo Rizzuto.
 *
 * I parametri NON sono nel codice: variano per delibera comunale e vanno inseriti
 * dall'host nel pannello impostazioni. Finché mancano, il calcolo non produce mai
 * una stima: restituisce "DA VERIFICARE", perché un importo inventato verrebbe
 * chiesto a un ospite reale.
 */
import type { Booking } from "@/lib/types";

export type TouristTaxSettings = {
  /** Importo per persona per notte, in euro. */
  amountPerPersonPerNight: number | null;
  /** Numero massimo di notti tassabili per soggiorno. */
  maxTaxableNights: number | null;
  /** Età sotto la quale non si paga. null = nessuna esenzione per età. */
  exemptUnderAge: number | null;
  /** Primo e ultimo giorno dell'anno in cui si applica, formato MM-GG. */
  seasonStart: string | null;
  seasonEnd: string | null;
  /** Altre esenzioni, come testo libero da riportare in fondo al PDF. */
  exemptionNotes: string;
};

export const EMPTY_TOURIST_TAX_SETTINGS: TouristTaxSettings = {
  amountPerPersonPerNight: null,
  maxTaxableNights: null,
  exemptUnderAge: null,
  seasonStart: null,
  seasonEnd: null,
  exemptionNotes: "",
};

export function isTouristTaxConfigured(settings: TouristTaxSettings): boolean {
  return (
    typeof settings.amountPerPersonPerNight === "number" &&
    settings.amountPerPersonPerNight >= 0 &&
    typeof settings.maxTaxableNights === "number" &&
    settings.maxTaxableNights >= 0
  );
}

export type TouristTaxResult =
  | { status: "ok"; amount: number; taxableNights: number; payingPeople: number }
  | { status: "unverifiable"; reason: string }
  | { status: "out-of-season" };

function nights(checkIn: string, checkOut: string): number {
  const ms = Date.parse(checkOut) - Date.parse(checkIn);
  if (!Number.isFinite(ms)) return 0;
  return Math.max(0, Math.round(ms / 86_400_000));
}

/** Confronto su MM-GG, con supporto alle stagioni che scavalcano il capodanno. */
function inSeason(checkIn: string, start: string | null, end: string | null): boolean {
  if (!start || !end) return true;
  const day = checkIn.slice(5, 10);
  return start <= end ? day >= start && day <= end : day >= start || day <= end;
}

/**
 * Formula: persone_non_esenti × notti_tassabili × importo.
 *
 * I bambini sono esenti solo se l'host ha configurato un'età di esenzione: il
 * campo `childrenCount` dice quanti sono, non quanti anni hanno, quindi con una
 * soglia impostata si assume che chi è contato come bambino vi rientri.
 */
export function computeTouristTax(booking: Booking, settings: TouristTaxSettings): TouristTaxResult {
  if (!isTouristTaxConfigured(settings)) {
    return { status: "unverifiable", reason: "Parametri imposta di soggiorno non configurati" };
  }
  if (booking.status === "cancelled") {
    return { status: "ok", amount: 0, taxableNights: 0, payingPeople: 0 };
  }
  if (!inSeason(booking.checkIn, settings.seasonStart, settings.seasonEnd)) {
    return { status: "out-of-season" };
  }

  const adults = booking.guestsCount;
  if (typeof adults !== "number" || adults < 1) {
    return { status: "unverifiable", reason: "Numero persone non valorizzato" };
  }

  const children = booking.childrenCount ?? 0;
  // Senza soglia di esenzione configurata, i bambini pagano come gli adulti.
  const payingPeople = settings.exemptUnderAge === null ? adults + children : adults;

  const taxableNights = Math.min(
    nights(booking.checkIn, booking.checkOut),
    settings.maxTaxableNights as number
  );

  return {
    status: "ok",
    amount: payingPeople * taxableNights * (settings.amountPerPersonPerNight as number),
    taxableNights,
    payingPeople,
  };
}

/** Etichetta per il PDF: mai un importo stimato quando i dati non bastano. */
export function formatTouristTax(result: TouristTaxResult): string {
  switch (result.status) {
    case "ok":
      return `${result.amount.toFixed(2)} €`;
    case "out-of-season":
      return "Fuori periodo";
    case "unverifiable":
      return "DA VERIFICARE";
  }
}
