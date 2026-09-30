/**
 * Impostazioni della board: unica fonte di verità per tutto ciò che il cliente
 * può cambiare da solo (dati struttura, camere, listino, imposta di soggiorno,
 * feed OTA, coordinate bancarie).
 *
 * Vivono su KV insieme alle prenotazioni, con copia locale per l'avvio a
 * freddo. Nessun valore di questo file è inventato: i campi che il titolare non
 * ha ancora fornito nascono vuoti e l'interfaccia li marca "da compilare".
 */

import { DEFAULT_PROPERTY, POSTAL_CODE_PLACEHOLDER, ROSS1000_DEFAULT_URL, type PropertyProfile } from "@/lib/property";
import { defaultRooms, normalizeRooms, type RoomConfig } from "@/lib/rooms";
import { EMPTY_TOURIST_TAX_SETTINGS, type TouristTaxSettings } from "@/lib/touristTax";
import type { Lodge } from "@/lib/types";

export type Season = {
  id: string;
  label: string;
  /** Periodo in formato MM-GG. Vuoto = stagione non ancora definita dal cliente. */
  from: string;
  to: string;
  /** Prezzo a notte proposto nel form prenotazione. null = da compilare. */
  price: number | null;
  /** Nota informativa (es. range di riferimento osservato sui portali). */
  note: string;
};

export type IcalFeed = {
  id: string;
  /** Camera coperta dal feed. Vuoto = feed di struttura (Booking/Airbnb multi-unità). */
  lodge: Lodge | "";
  channel: "booking" | "airbnb" | "expedia" | "other";
  url: string;
  label: string;
};

export type BoardSettings = {
  version: number;
  property: PropertyProfile;
  postalCode: string;
  rooms: RoomConfig[];
  seasons: Season[];
  touristTax: TouristTaxSettings;
  icalFeeds: IcalFeed[];
  ross1000Url: string;
  /** Wizard iniziale completato: finché è false la board mostra l'onboarding. */
  onboardingDone: boolean;
  updatedAt: string;
};

/**
 * Listino iniziale di Le Farfalle, dalle tariffe decise dal gestore:
 * € 93 a camera nel periodo natalizio 20/12–06/01 e € 85 a camera
 * (2 persone, colazione inclusa) dal 10/09 al 31/03. Il periodo natalizio è
 * elencato per primo perché ricade dentro quello base e deve prevalere.
 * Per il resto dell'anno nessun prezzo è preimpostato: si compila dalle
 * Impostazioni invece di proporre cifre non decise.
 */
export function defaultSeasons(): Season[] {
  return [
    { id: "natale", label: "Periodo natalizio", from: "12-20", to: "01-06", price: 93, note: "Tariffa a camera per notte" },
    { id: "bassa", label: "Bassa stagione", from: "09-10", to: "03-31", price: 85, note: "Tariffa a camera per notte, 2 persone con colazione" },
    { id: "alta", label: "Stagione estiva", from: "", to: "", price: null, note: "Da compilare" },
  ];
}

export function defaultSettings(): BoardSettings {
  return {
    version: 1,
    property: { ...DEFAULT_PROPERTY, bank: { ...DEFAULT_PROPERTY.bank }, services: [...DEFAULT_PROPERTY.services] },
    postalCode: POSTAL_CODE_PLACEHOLDER,
    rooms: defaultRooms(),
    seasons: defaultSeasons(),
    touristTax: { ...EMPTY_TOURIST_TAX_SETTINGS },
    icalFeeds: [],
    ross1000Url: ROSS1000_DEFAULT_URL,
    // Board già operativa: niente wizard iniziale, i dati mancanti restano
    // segnalati "da compilare" nelle Impostazioni.
    onboardingDone: true,
    updatedAt: new Date().toISOString(),
  };
}

/** Merge difensivo: una versione parziale su KV non deve svuotare la board. */
export function normalizeSettings(input: unknown): BoardSettings {
  const base = defaultSettings();
  if (!input || typeof input !== "object") return base;
  const raw = input as Partial<BoardSettings>;

  return {
    version: typeof raw.version === "number" ? raw.version : base.version,
    property: { ...base.property, ...(raw.property ?? {}), bank: { ...base.property.bank, ...(raw.property?.bank ?? {}) } },
    postalCode: typeof raw.postalCode === "string" ? raw.postalCode : base.postalCode,
    rooms: normalizeRooms(raw.rooms),
    seasons: Array.isArray(raw.seasons) && raw.seasons.length > 0 ? raw.seasons : base.seasons,
    touristTax: { ...base.touristTax, ...(raw.touristTax ?? {}) },
    icalFeeds: Array.isArray(raw.icalFeeds) ? raw.icalFeeds : base.icalFeeds,
    ross1000Url: typeof raw.ross1000Url === "string" && raw.ross1000Url ? raw.ross1000Url : base.ross1000Url,
    onboardingDone: raw.onboardingDone === false ? false : true,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : base.updatedAt,
  };
}

/** Stagione applicabile a una data di check-in (confronto su MM-GG). */
export function seasonForDate(seasons: Season[], isoDate: string): Season | null {
  const day = isoDate.slice(5, 10);
  if (!day) return null;
  for (const season of seasons) {
    if (!season.from || !season.to) continue;
    const inside =
      season.from <= season.to
        ? day >= season.from && day <= season.to
        : day >= season.from || day <= season.to;
    if (inside) return season;
  }
  return null;
}

/**
 * Prezzo proposto per un soggiorno. Restituisce null quando il listino non è
 * ancora configurato: il form lascia l'importo vuoto invece di suggerire una
 * cifra che finirebbe in un preventivo reale.
 */
export function suggestedTotal(seasons: Season[], checkIn: string, nights: number): number | null {
  const season = seasonForDate(seasons, checkIn);
  if (!season || season.price === null || nights <= 0) return null;
  return season.price * nights;
}

/** Campi indispensabili prima di poter usare la board in produzione. */
export function missingRequiredFields(settings: BoardSettings): string[] {
  const missing: string[] = [];
  if (!settings.property.name.trim()) missing.push("Nome struttura");
  if (!settings.property.cin.trim()) missing.push("CIN");
  if (!settings.rooms.some((room) => room.active)) missing.push("Almeno una camera attiva");
  if (settings.seasons.every((season) => !season.from || !season.to)) missing.push("Periodi del listino");
  if (settings.touristTax.amountPerPersonPerNight === null) missing.push("Imposta di soggiorno");
  if (settings.icalFeeds.length === 0) missing.push("Feed iCal dei portali");
  return missing;
}
