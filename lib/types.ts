export const LODGES = [
  "Limone",
  "Macaone",
  "Vanessa",
  "Aurora",
] as const;

export const BOOKING_STATUSES = ["confirmed", "option", "blocked", "cancelled"] as const;
export const BOOKING_CHANNELS = ["direct", "airbnb", "booking", "expedia", "other"] as const;

export type Lodge = (typeof LODGES)[number];
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
  lodge: Lodge;
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
};

export type BookingInput = Omit<Booking, "id" | "createdAt" | "updatedAt">;

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
