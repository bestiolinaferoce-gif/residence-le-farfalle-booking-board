export const LODGES = [
  "Limone",
  "Macaone",
  "Vanessa",
  "Aurora",
] as const;

export const BOOKING_STATUSES = ["confirmed", "option", "blocked", "cancelled"] as const;
export const BOOKING_CHANNELS = ["direct", "airbnb", "booking", "expedia", "other"] as const;

/**
 * I feed iCal di Booking.com e Airbnb vendono l'inventario complessivo, non la singola
 * unità: le prenotazioni importate arrivano senza lodge. Restano in questa corsia finché
 * l'host non conferma l'assegnazione. Non è un'unità fisica: esclusa da occupancy,
 * controllo sovrapposizioni ed export iCal.
 */
export const UNASSIGNED_LODGE = "Da assegnare";

export type Lodge = (typeof LODGES)[number];
/** Il lodge di una prenotazione può essere ancora da assegnare. */
export type BookingLodge = Lodge | typeof UNASSIGNED_LODGE;

export function isAssignedLodge(lodge: BookingLodge): lodge is Lodge {
  return lodge !== UNASSIGNED_LODGE;
}
export type BookingStatus = (typeof BOOKING_STATUSES)[number];
export type BookingChannel = (typeof BOOKING_CHANNELS)[number];

/** Origine record (audit / n8n / merge). Opzionale per retrocompatibilità. */
export type BookingDataOrigin = "manual" | "import_json" | "import_email" | "sync" | "n8n";

export const BOOKING_DATA_ORIGINS: readonly BookingDataOrigin[] = [
  "manual",
  "import_json",
  "import_email",
  "sync",
  "n8n",
] as const;

export type GuestProfile = {
  surname?: string;
  firstName?: string;
  email?: string;
  phone?: string;
  birthDate?: string;
  birthPlace?: string;
  birthProvince?: string;
  birthCountry?: string;
  nationality?: string;
  gender?: "M" | "F" | "";
  fiscalCode?: string;
  residence?: string;
  residenceCity?: string;
  residenceProvince?: string;
  residencePostalCode?: string;
  documentType?: "CARTA_IDENTITA" | "PASSAPORTO" | "PATENTE" | "PERMESSO_SOGGIORNO" | "";
  documentNumber?: string;
  documentIssuePlace?: string;
  documentIssueDate?: string;
};

export type Booking = {
  id: string;
  guestName: string;
  lodge: BookingLodge;
  checkIn: string;
  checkOut: string;
  status: BookingStatus;
  channel: BookingChannel;
  notes: string;
  guestsCount: number;
  totalAmount: number;
  depositAmount: number;
  depositReceived: boolean;
  extrasAmount?: number;
  cleaningFee?: number;
  touristTax?: number;
  childrenCount?: number;
  economicNotes?: string;
  checkInTime?: string;
  checkOutTime?: string;
  breakfastIncluded?: boolean;
  createdAt: string;
  updatedAt: string;
  isNew?: boolean;
  guestProfile?: GuestProfile;
  dataOrigin?: BookingDataOrigin;
  /** Numero prenotazione del canale (Booking.com/Airbnb). Chiave di deduplica in import e sync. */
  bookingRef?: string;
  /**
   * Lodge libero proposto dal sync per una prenotazione in "Da assegnare".
   * È solo un suggerimento: l'assegnazione la conferma l'host.
   */
  proposedLodge?: Lodge;
  /** Nessun lodge libero per quelle date: overbooking da risolvere a mano. */
  overbooking?: boolean;
  /** Id di prenotazioni che potrebbero essere la stessa: segnalate, mai cancellate d'ufficio. */
  possibleDuplicateOf?: string[];
  externalSyncKey?: string;
  externalCalendarName?: string;
  externalLastSeenAt?: string;
};

export type BookingInput = Omit<Booking, "id" | "createdAt" | "updatedAt">;

/**
 * Valori precompilati del form "Nuova prenotazione". Il lodge è ristretto alle unità
 * fisiche: "Da assegnare" nasce solo dai feed dei canali, mai da una creazione manuale.
 */
export type BookingPrefill = Omit<Partial<BookingInput>, "lodge"> & {
  lodge?: Lodge;
  day?: string;
};

export type BookingFilters = {
  search: string;
  status: BookingStatus | "all";
  channel: BookingChannel | "all";
  showCancelled: boolean;
};

export type BackupSnapshot = {
  createdAt: string;
  bookings: Booking[];
};
