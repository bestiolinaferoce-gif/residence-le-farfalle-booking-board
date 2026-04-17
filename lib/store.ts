import { create } from "zustand";
import { addMonths, format, parseISO, startOfMonth } from "date-fns";
import { v4 as uuidv4 } from "uuid";
import {
  BOOKING_CHANNELS,
  BOOKING_DATA_ORIGINS,
  BOOKING_STATUSES,
  LODGES,
  type BackupSnapshot,
  type Booking,
  type BookingDataOrigin,
  type BookingFilters,
  type BookingInput,
  type Lodge,
} from "@/lib/types";
import { BACKUP_KEY, DELETED_KEY, overlaps, SETTINGS_KEY, STORAGE_KEY } from "@/lib/utils";
import { reconcileBookings } from "@/lib/reconciliation";

export type ImportMergeSkipDetail = {
  id: string;
  guestName: string;
  reason: string;
};

type BookingState = {
  bookings: Booking[];
  currentMonth: string;
  filters: BookingFilters;
  monthTheme: boolean;
  darkMode: boolean;
  accentColor: string;
  serverVersion: number;
  syncError: boolean;
  hasNewBookings: boolean;
  deletedIds: Set<string>;
  toggleDarkMode: () => void;
  setAccentColor: (color: string) => void;
  load: () => void;
  startPolling: () => () => void;
  stopPolling: () => void;
  clearNewBookingsNotification: () => void;
  setMonthTheme: (value: boolean) => void;
  setMonth: (month: Date) => void;
  prevMonth: () => void;
  nextMonth: () => void;
  setSearch: (value: string) => void;
  setStatusFilter: (value: BookingFilters["status"]) => void;
  setChannelFilter: (value: BookingFilters["channel"]) => void;
  setShowCancelled: (value: boolean) => void;
  addBooking: (payload: BookingInput) => Booking;
  updateBooking: (id: string, payload: BookingInput) => Booking;
  deleteBooking: (id: string) => void;
  importBookingsMerge: (incoming: Booking[]) => {
    merged: number;
    skipped: number;
    skipDetails: ImportMergeSkipDetail[];
  };
  exportBookings: () => Booking[];
  forceSyncToCloud: () => Promise<void>;
  syncLocalToCloud: () => Promise<{ merged: number; updated: number; total: number }>;
  toast: { message: string; type: "success" | "error"; durationMs?: number } | null;
  showToast: (message: string, type?: "success" | "error", durationMs?: number) => void;
  clearToast: () => void;
};

function isBookingDataOrigin(v: unknown): v is BookingDataOrigin {
  return typeof v === "string" && (BOOKING_DATA_ORIGINS as readonly string[]).includes(v);
}

function channelAndStatusFromImport(item: Partial<Booking> & { source?: string }): {
  channel: Booking["channel"];
  status: Booking["status"];
} {
  let channel: Booking["channel"] = "direct";
  if (item.channel && (BOOKING_CHANNELS as readonly string[]).includes(item.channel)) {
    channel = item.channel;
  } else {
    const s = String(item.source ?? "").toLowerCase();
    if (s.includes("airbnb")) channel = "airbnb";
    else if (s.includes("booking")) channel = "booking";
    else if (s.includes("expedia")) channel = "expedia";
    else if (s.includes("other")) channel = "other";
  }
  let status: Booking["status"] = "confirmed";
  if (item.status && (BOOKING_STATUSES as readonly string[]).includes(item.status)) {
    status = item.status;
  }
  return { channel, status };
}

function validateBookingPayload(payload: BookingInput): void {
  if (!payload.guestName.trim()) {
    throw new Error("Il nome ospite è obbligatorio.");
  }
  if (!payload.checkIn || !payload.checkOut) {
    throw new Error("Check-in e check-out sono obbligatori.");
  }
  const checkIn = parseISO(payload.checkIn);
  const checkOut = parseISO(payload.checkOut);
  if (!(checkIn < checkOut)) {
    throw new Error("Il check-out deve essere successivo al check-in.");
  }
  if (payload.guestsCount < 1 || !Number.isInteger(payload.guestsCount)) {
    throw new Error("Il numero ospiti deve essere almeno 1.");
  }
  if (payload.totalAmount < 0 || payload.depositAmount < 0) {
    throw new Error("Gli importi non possono essere negativi.");
  }
  if (payload.depositAmount > payload.totalAmount) {
    throw new Error("La caparra non può superare il totale.");
  }
  if (payload.depositReceived && payload.depositAmount <= 0) {
    throw new Error("Caparra ricevuta richiede un importo caparra maggiore di zero.");
  }
  const optNonNeg = (v: number | undefined, label: string) => {
    if (v === undefined) return;
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0) {
      throw new Error(`${label} non valido.`);
    }
  };
  optNonNeg(payload.extrasAmount, "Extra");
  optNonNeg(payload.cleaningFee, "Pulizie");
  optNonNeg(payload.touristTax, "Tassa soggiorno");
  if (payload.childrenCount !== undefined) {
    if (!Number.isInteger(payload.childrenCount) || payload.childrenCount < 0) {
      throw new Error("Numero bambini non valido.");
    }
  }
}

function ensureNoOverlap(bookings: Booking[], payload: BookingInput, excludeId?: string): void {
  const colliding = bookings.find((booking) => {
    if (excludeId && booking.id === excludeId) {
      return false;
    }
    if (
      booking.dataOrigin === "sync" &&
      payload.dataOrigin === "sync" &&
      booking.lodge === payload.lodge &&
      booking.checkIn === payload.checkIn &&
      booking.checkOut === payload.checkOut
    ) {
      return false;
    }
    if (booking.lodge !== payload.lodge) {
      return false;
    }
    if (booking.status === "cancelled") {
      return false;
    }
    if (payload.status === "cancelled") {
      return false;
    }
    return overlaps(booking, payload);
  });
  if (colliding) {
    throw new Error(`Sovrapposizione su ${payload.lodge} con prenotazione ${colliding.guestName} (${colliding.checkIn} → ${colliding.checkOut}).`);
  }
}

function migrateBookings(arr: Array<Booking & { guestsCount?: number }>): Booking[] {
  return arr.map((item) => ({
    ...item,
    guestsCount: typeof item.guestsCount === "number" && item.guestsCount >= 1 ? item.guestsCount : 2,
  })) as Booking[];
}

function internalPostBookingsHeaders(): HeadersInit {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = process.env.NEXT_PUBLIC_API_WRITE_SECRET;
  if (typeof token === "string" && token.length > 0) {
    headers["X-Internal-Token"] = token;
  }
  return headers;
}

function readBackupSnapshotsFromLocal(): BackupSnapshot[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(BACKUP_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as BackupSnapshot[];
  } catch (backupErr) {
    console.warn("[store/persist] Backup non leggibile, verrà sovrascritto:", backupErr);
    return [];
  }
}

function bookingUpdatedMs(b: Booking): number {
  const t = Date.parse(b.updatedAt);
  return Number.isFinite(t) ? t : 0;
}

function mergeKvWithLocal(serverRows: Booking[], localRows: Booking[], deletedIds?: Set<string>): Booking[] {
  const map = new Map<string, Booking>();
  const rows = deletedIds && deletedIds.size > 0 ? serverRows.filter((b) => !deletedIds.has(b.id)) : serverRows;
  for (const b of rows) {
    map.set(b.id, b);
  }
  for (const b of localRows) {
    const s = map.get(b.id);
    if (!s) {
      map.set(b.id, b);
      continue;
    }
    if (bookingUpdatedMs(b) > bookingUpdatedMs(s)) {
      map.set(b.id, b);
    }
  }
  return Array.from(map.values()).sort((a, c) => a.checkIn.localeCompare(c.checkIn));
}

function readDeletedIdsFromLocal(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(DELETED_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function persistDeletedIds(ids: Set<string>): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DELETED_KEY, JSON.stringify(Array.from(ids)));
}

function mergeEnrichedLocal(merged: Booking[], serverRows: Booking[]): boolean {
  if (merged.length !== serverRows.length) return true;
  const byId = new Map(serverRows.map((b) => [b.id, b]));
  for (const m of merged) {
    const s = byId.get(m.id);
    if (!s) return true;
    if (bookingUpdatedMs(m) > bookingUpdatedMs(s)) return true;
  }
  return false;
}

function normalizePayload(payload: { v?: number; data?: Booking[] } | Booking[] | null): { version: number; data: Booking[] } {
  if (!payload) return { version: 0, data: [] };
  if (Array.isArray(payload)) return { version: 0, data: payload };
  return { version: payload.v ?? 0, data: payload.data ?? [] };
}

async function fetchCloudPayload(): Promise<{ version: number; data: Booking[] }> {
  const response = await fetch("/api/bookings", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("cloud fetch failed");
  }
  const payload = (await response.json()) as { v?: number; data?: Booking[] } | Booking[];
  return normalizePayload(payload);
}

function persistSettings(patch: Partial<{ monthTheme: boolean; serverVersion: number; darkMode: boolean; accentColor: string }>): void {
  if (typeof window === "undefined") return;
  let base: { monthTheme?: boolean; serverVersion?: number } = {};
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (raw) base = JSON.parse(raw) as typeof base;
  } catch { /* ignore */ }
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...base, ...patch }));
}

export const useBookingStore = create<BookingState>((set, get) => {
  let persistTimer: ReturnType<typeof setTimeout> | null = null;

  function pushBackupSnapshot(bookings: Booking[]): void {
    if (typeof window === "undefined") return;
    try {
      const current = readBackupSnapshotsFromLocal();
      const merged = [{ createdAt: new Date().toISOString(), bookings: [...bookings] }, ...current].slice(0, 10);
      window.localStorage.setItem(BACKUP_KEY, JSON.stringify(merged));
    } catch { /* ignore */ }
  }

  function persist(bookings: Booking[]): void {
    if (typeof window === "undefined") return;
    // Write localStorage immediately — guarantees data is safe before any async op
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(bookings));
    const currentBackups = readBackupSnapshotsFromLocal();
    window.localStorage.setItem(
      BACKUP_KEY,
      JSON.stringify([{ createdAt: new Date().toISOString(), bookings }, ...currentBackups].slice(0, 10))
    );
    // Debounce KV sync — non-blocking, syncError only reflects cloud state
    if (persistTimer !== null) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      persistTimer = null;
      fetch("/api/bookings", {
        method: "POST",
        headers: internalPostBookingsHeaders(),
        body: JSON.stringify({ bookings }),
      })
        .then(async (r) => {
          if (!r.ok) {
            set({ syncError: true });
            return;
          }
          try {
            const res = (await r.json()) as { ok?: boolean; v?: number };
            if (res.ok === false) {
              set({ syncError: true });
              return;
            }
            if (typeof res.v === "number") {
              set({ syncError: false, serverVersion: res.v });
              persistSettings({ serverVersion: res.v });
            } else {
              set({ syncError: false });
            }
          } catch {
            set({ syncError: true });
          }
        })
        .catch(() => set({ syncError: true }));
    }, 250);
  }

  return {
    bookings: [],
    currentMonth: format(startOfMonth(new Date()), "yyyy-MM-01"),
    filters: {
      search: "",
      status: "all",
      channel: "all",
      showCancelled: false,
    },
    monthTheme: true,
    darkMode: true,
    accentColor: "#7c3aed",
    toast: null,
    serverVersion: 0,
    syncError: false,
    hasNewBookings: false,
    deletedIds: new Set<string>(),
    load: () => {
      if (typeof window === "undefined") return;
      const rawSettings = window.localStorage.getItem(SETTINGS_KEY);
      if (rawSettings) {
        try {
          const s = JSON.parse(rawSettings) as { monthTheme?: boolean; serverVersion?: number; darkMode?: boolean; accentColor?: string };
          if (typeof s.monthTheme === "boolean") set({ monthTheme: s.monthTheme });
          if (typeof s.serverVersion === "number") set({ serverVersion: s.serverVersion });
          if (typeof s.darkMode === "boolean") set({ darkMode: s.darkMode });
          if (typeof s.accentColor === "string" && s.accentColor) set({ accentColor: s.accentColor });
        } catch { /* ignore */ }
      }
      const storedDeletedIds = readDeletedIdsFromLocal();
      if (storedDeletedIds.size > 0) set({ deletedIds: storedDeletedIds });
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        try {
          const cached = JSON.parse(raw) as Array<Booking & { guestsCount?: number }>;
          const migrated = migrateBookings(cached);
          const cleaned = storedDeletedIds.size > 0 ? migrated.filter((b) => !storedDeletedIds.has(b.id)) : migrated;
          set({ bookings: cleaned });
        } catch { /* ignore */ }
      }
      fetch("/api/bookings", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((payload: { v: number; ts: string; data: Booking[] } | null) => {
          if (!payload) return;
          const data = Array.isArray(payload) ? payload : (payload.data ?? []);
          if (data.length > 0) {
            const incomingV =
              typeof payload === "object" && payload !== null && !Array.isArray(payload)
                ? ((payload as { v?: number }).v ?? 0)
                : 0;
            if (incomingV < get().serverVersion) {
              return;
            }
            const migrated = migrateBookings(data as Array<Booking & { guestsCount?: number }>);
            const localRows = get().bookings;
            const combined = mergeKvWithLocal(migrated, localRows, get().deletedIds);
            const nextVersion = (payload as { v?: number }).v ?? 0;
            set({ bookings: combined, serverVersion: nextVersion, syncError: false });
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(combined));
            persistSettings({ serverVersion: nextVersion });
            if (mergeEnrichedLocal(combined, migrated)) {
              persist(combined);
            }
          } else {
            const cur = get().bookings;
            if (cur.length > 0) {
              fetch("/api/bookings", {
                method: "POST",
                headers: internalPostBookingsHeaders(),
                body: JSON.stringify({ bookings: cur }),
              })
                .then(async (postRes) => {
                  if (!postRes.ok) {
                    set({ syncError: true });
                    return;
                  }
                  try {
                    const body = (await postRes.json()) as { ok?: boolean; v?: number };
                    if (body.ok === false) {
                      set({ syncError: true });
                      return;
                    }
                    if (typeof body.v === "number") {
                      set({ syncError: false, serverVersion: body.v });
                      persistSettings({ serverVersion: body.v });
                    } else {
                      set({ syncError: false });
                    }
                  } catch {
                    set({ syncError: true });
                  }
                })
                .catch(() => set({ syncError: true }));
            }
          }
        })
        .catch(() => set({ syncError: true }));
    },
    startPolling: () => {
      const INTERVAL = 30_000;
      let active = true;
      const poll = async () => {
        if (!active || typeof window === "undefined") return;
        try {
          const res = await fetch("/api/bookings/version", { cache: "no-store" });
          if (!res.ok) throw new Error("poll failed");
          const { v } = (await res.json()) as { v: number };
          const currentVersion = get().serverVersion;
          if (v > currentVersion) {
            const full = await fetch("/api/bookings", { cache: "no-store" });
            if (!full.ok) throw new Error("full fetch failed");
            const payload = (await full.json()) as { v?: number; data?: Booking[] } | Booking[];
            const newV = Array.isArray(payload) ? v : (payload.v ?? v);
            if (newV < get().serverVersion) {
              return;
            }
            const data = Array.isArray(payload) ? payload : (payload.data ?? []);
            const migrated = migrateBookings(data as Array<Booking & { guestsCount?: number }>);
            const localRows = get().bookings;
            const combined = mergeKvWithLocal(migrated, localRows, get().deletedIds);
            set({ bookings: combined, serverVersion: newV, syncError: false, hasNewBookings: true });
            if (typeof window !== "undefined") {
              window.localStorage.setItem(STORAGE_KEY, JSON.stringify(combined));
              persistSettings({ serverVersion: newV });
            }
            if (mergeEnrichedLocal(combined, migrated)) {
              persist(combined);
            }
          }
        } catch {
          set({ syncError: true });
        }
        if (active) setTimeout(poll, INTERVAL);
      };
      const firstTimer = setTimeout(poll, 5_000);
      return () => {
        active = false;
        clearTimeout(firstTimer);
      };
    },
    stopPolling: () => { /* gestito dall'active flag nel cleanup di startPolling */ },
    toggleDarkMode: () => {
      const next = !get().darkMode;
      set({ darkMode: next });
      persistSettings({ darkMode: next });
    },
    setAccentColor: (color: string) => {
      set({ accentColor: color });
      persistSettings({ accentColor: color });
    },
    setMonth: (month) => set({ currentMonth: format(startOfMonth(month), "yyyy-MM-01") }),
    prevMonth: () => {
      const month = parseISO(get().currentMonth);
      set({ currentMonth: format(addMonths(month, -1), "yyyy-MM-01") });
    },
    nextMonth: () => {
      const month = parseISO(get().currentMonth);
      set({ currentMonth: format(addMonths(month, 1), "yyyy-MM-01") });
    },
    setSearch: (value) => set((state) => ({ filters: { ...state.filters, search: value } })),
    setStatusFilter: (value) => set((state) => ({ filters: { ...state.filters, status: value } })),
    setChannelFilter: (value) => set((state) => ({ filters: { ...state.filters, channel: value } })),
    setShowCancelled: (value) => set((state) => ({ filters: { ...state.filters, showCancelled: value } })),
    setMonthTheme: (value) => {
      set({ monthTheme: value });
      persistSettings({ monthTheme: value });
    },
    clearNewBookingsNotification: () => set({ hasNewBookings: false }),
    showToast: (message, type = "success", durationMs) =>
      set({ toast: { message, type, ...(durationMs !== undefined ? { durationMs } : {}) } }),
    clearToast: () => set({ toast: null }),
    addBooking: (payload) => {
      validateBookingPayload(payload);
      const deletedIds = get().deletedIds;
      const bookings = deletedIds.size > 0
        ? get().bookings.filter((b) => !deletedIds.has(b.id))
        : get().bookings;
      ensureNoOverlap(bookings, payload);
      const now = new Date().toISOString();
      const booking: Booking = {
        id: uuidv4(),
        ...payload,
        isNew: true,
        guestName: payload.guestName.trim(),
        notes: payload.notes.trim(),
        economicNotes: payload.economicNotes?.trim() || undefined,
        guestsCount: payload.guestsCount,
        dataOrigin: isBookingDataOrigin(payload.dataOrigin) ? payload.dataOrigin : "manual",
        createdAt: now,
        updatedAt: now,
      };
      const next = [...bookings, booking].sort((a, b) => a.checkIn.localeCompare(b.checkIn));
      set({ bookings: next });
      persist(next);
      return booking;
    },
    updateBooking: (id, payload) => {
      validateBookingPayload(payload);
      const bookings = get().bookings;
      const current = bookings.find((booking) => booking.id === id);
      if (!current) {
        throw new Error("Prenotazione non trovata.");
      }
      const { bookings: canonical } = reconcileBookings(bookings);
      ensureNoOverlap(canonical, payload, id);
      const updated: Booking = {
        ...current,
        ...payload,
        isNew: payload.isNew ?? false,
        guestName: payload.guestName.trim(),
        notes: payload.notes.trim(),
        economicNotes: payload.economicNotes?.trim() || undefined,
        updatedAt: new Date().toISOString(),
        guestProfile: payload.guestProfile ?? current.guestProfile,
        dataOrigin: isBookingDataOrigin(payload.dataOrigin) ? payload.dataOrigin : current.dataOrigin,
      };
      const next = bookings.map((booking) => (booking.id === id ? updated : booking)).sort((a, b) => a.checkIn.localeCompare(b.checkIn));
      set({ bookings: next });
      persist(next);
      return updated;
    },
    deleteBooking: (id) => {
      const next = get().bookings.filter((booking) => booking.id !== id);
      const newDeletedIds = new Set([...get().deletedIds, id]);
      set({ bookings: next, deletedIds: newDeletedIds });
      persistDeletedIds(newDeletedIds);
      persist(next);
    },
    importBookingsMerge: (incoming) => {
      pushBackupSnapshot(get().bookings);

      const skipDetails: ImportMergeSkipDetail[] = [];
      const pushSkip = (id: string, guestName: string, reason: string) => {
        skipDetails.push({
          id: id.length > 48 ? `${id.slice(0, 45)}…` : id,
          guestName: guestName.length > 40 ? `${guestName.slice(0, 37)}…` : guestName,
          reason,
        });
      };

      const normalized: Booking[] = [];
      for (let i = 0; i < incoming.length; i++) {
        const raw = incoming[i] as unknown;
        const rowLabel = `riga ${i + 1}`;
        if (!raw || typeof raw !== "object") {
          pushSkip("—", "—", `Record non valido (${rowLabel}).`);
          continue;
        }
        const item = raw as Partial<Booking> & { source?: string; grossEarnings?: number; room?: string; deposit?: number; adults?: number };
        const idRaw = item.id != null ? String(item.id).trim() : "";
        if (!idRaw) {
          pushSkip("—", String(item.guestName ?? "").trim() || "—", `Manca id (${rowLabel}).`);
          continue;
        }
        const guestRaw = item.guestName != null ? String(item.guestName).trim() : "";
        if (!guestRaw) {
          pushSkip(idRaw, "—", `Manca nome ospite (${rowLabel}).`);
          continue;
        }

        // Field aliases: support alternate field names from external exports
        const lodgeRaw = item.lodge ?? item.room;
        const guestsCount =
          typeof item.guestsCount === "number" && item.guestsCount >= 1 ? item.guestsCount :
          typeof item.adults === "number" && item.adults >= 1 ? item.adults : 2;
        const { channel, status } = channelAndStatusFromImport(item);
        const updatedAt =
          typeof item.updatedAt === "string" && item.updatedAt.trim()
            ? item.updatedAt.trim()
            : new Date().toISOString();
        const dataOrigin: BookingDataOrigin = isBookingDataOrigin(item.dataOrigin)
          ? item.dataOrigin
          : "import_json";
        normalized.push({
          ...item,
          id: idRaw,
          lodge: lodgeRaw as Lodge,
          channel,
          status,
          guestName: guestRaw,
          notes: String(item.notes ?? ""),
          guestsCount,
          totalAmount: Number(item.totalAmount ?? item.grossEarnings ?? 0),
          depositAmount: Number(item.depositAmount ?? item.deposit ?? 0),
          depositReceived: Boolean(item.depositReceived),
          createdAt: item.createdAt || new Date().toISOString(),
          updatedAt,
          dataOrigin,
        } as Booking);
      }

      const map = new Map<string, Booking>();
      get().bookings.forEach((booking) => map.set(booking.id, booking));

      let merged = 0;

      normalized.forEach((candidate) => {
        const guestLabel = candidate.guestName.trim() || "—";
        try {
          const existing = map.get(candidate.id);
          if (
            existing?.dataOrigin === "manual" &&
            bookingUpdatedMs(candidate) <= bookingUpdatedMs(existing)
          ) {
            pushSkip(
              candidate.id,
              guestLabel,
              "Board: prenotazione manuale con data aggiornamento uguale o più recente; import non applicato."
            );
            return;
          }
          if (!(LODGES as readonly string[]).includes(String(candidate.lodge))) {
            pushSkip(
              candidate.id,
              guestLabel,
              `Lodge non valida: "${String(candidate.lodge)}". Valori ammessi: ${LODGES.join(", ")}.`
            );
            return;
          }
          const guestsCount = typeof candidate.guestsCount === "number" && candidate.guestsCount >= 1 ? candidate.guestsCount : 2;
          const payload: BookingInput = {
            guestName: candidate.guestName,
            lodge: candidate.lodge as Lodge,
            checkIn: candidate.checkIn,
            checkOut: candidate.checkOut,
            status: candidate.status,
            channel: candidate.channel,
            notes: candidate.notes,
            guestsCount,
            totalAmount: candidate.totalAmount,
            depositAmount: candidate.depositAmount,
            depositReceived: candidate.depositReceived,
            guestProfile: candidate.guestProfile,
            extrasAmount: candidate.extrasAmount,
            cleaningFee: candidate.cleaningFee,
            touristTax: candidate.touristTax,
            childrenCount: candidate.childrenCount,
            economicNotes: candidate.economicNotes,
            dataOrigin: candidate.dataOrigin,
          };
          validateBookingPayload(payload);
          ensureNoOverlap(Array.from(map.values()), payload, candidate.id);
          map.set(candidate.id, candidate);
          merged += 1;
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Errore sconosciuto.";
          const reason = msg.includes("Sovrapposizione") ? msg : `Validazione / dati: ${msg}`;
          pushSkip(candidate.id, guestLabel, reason);
        }
      });

      const next = Array.from(map.values()).sort((a, b) => a.checkIn.localeCompare(b.checkIn));
      set({ bookings: next });
      persist(next);
      const skipped = skipDetails.length;
      return { merged, skipped, skipDetails };
    },
    exportBookings: () => get().bookings,
    forceSyncToCloud: async () => {
      if (typeof window === "undefined") return;
      const cur = get().bookings;
      if (cur.length === 0) {
        get().showToast("Nessuna prenotazione da caricare.", "error");
        return;
      }
      try {
        const mergeRes = await fetch("/api/bookings/merge-local", {
          method: "POST",
          headers: internalPostBookingsHeaders(),
          body: JSON.stringify({ bookings: cur }),
        });
        if (!mergeRes.ok) {
          get().showToast("Errore durante il caricamento sul cloud.", "error");
          return;
        }

        const cloud = await fetchCloudPayload();
        const merged = mergeKvWithLocal(migrateBookings(cloud.data as Array<Booking & { guestsCount?: number }>), cur);
        set({ bookings: merged, serverVersion: cloud.version, syncError: false });
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        persistSettings({ serverVersion: cloud.version });
        get().showToast(`✓ Sync completata. Cloud aggiornato e board riallineata (v${cloud.version || "?"}).`);
      } catch {
        set({ syncError: true });
        get().showToast("Errore di rete durante il sync.", "error");
      }
    },
    syncLocalToCloud: async () => {
      pushBackupSnapshot(get().bookings);
      const local = get().bookings;

      if (local.length === 0) {
        get().showToast("Nessuna prenotazione locale da sincronizzare.", "error");
        return { merged: 0, updated: 0, total: 0 };
      }

      try {
        const res = await fetch("/api/bookings/merge-local", {
          method: "POST",
          headers: internalPostBookingsHeaders(),
          body: JSON.stringify({ bookings: local }),
        });
        const data = (await res.json()) as {
          merged?: number;
          updated?: number;
          total?: number;
          error?: string;
          v?: number;
        };

        if (res.ok) {
          const cloud = await fetchCloudPayload();
          const mergedRows = mergeKvWithLocal(migrateBookings(cloud.data as Array<Booking & { guestsCount?: number }>), local);
          set({ bookings: mergedRows, serverVersion: cloud.version, syncError: false });
          if (typeof window !== "undefined") {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(mergedRows));
            persistSettings({ serverVersion: cloud.version });
          }
          get().showToast(
            `Aggiornamento completato: +${data.merged ?? 0} nuove, ${data.updated ?? 0} aggiornate (totale cloud: ${data.total ?? 0}).`
          );
          return { merged: data.merged ?? 0, updated: data.updated ?? 0, total: data.total ?? 0 };
        } else {
          get().showToast(
            "Errore durante la sincronizzazione: " + (data.error ?? "unknown"),
            "error"
          );
          return { merged: 0, updated: 0, total: 0 };
        }
      } catch {
        get().showToast("Errore di rete durante la sincronizzazione.", "error");
        return { merged: 0, updated: 0, total: 0 };
      }
    },
  };
});
