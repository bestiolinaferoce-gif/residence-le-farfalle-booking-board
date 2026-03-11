export const LODGES = [
  "Camera 1",
  "Camera 2",
  "Camera 3",
  "Camera 4",
  "Camera 5",
] as const;

export const BOOKING_STATUSES = ["confirmed", "option", "blocked", "cancelled"] as const;
export const BOOKING_CHANNELS = ["direct", "airbnb", "booking", "expedia", "other"] as const;

export type Lodge = (typeof LODGES)[number];
export type BookingStatus = (typeof BOOKING_STATUSES)[number];
export type BookingChannel = (typeof BOOKING_CHANNELS)[number];

export type GuestProfile = {
  surname?: string;
  firstName?: string;
  birthDate?: string;
  birthPlace?: string;
  birthProvince?: string;
  birthCountry?: string;
  nationality?: string;
  gender?: "M" | "F" | "";
  fiscalCode?: string;
  residence?: string;
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
  createdAt: string;
  updatedAt: string;
  isNew?: boolean;
  guestProfile?: GuestProfile;
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
