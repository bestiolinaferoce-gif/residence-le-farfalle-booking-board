"use client";

import { addDays, endOfMonth, format, getMonth, getYear, isBefore, parseISO, startOfMonth } from "date-fns";
import { it } from "date-fns/locale";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GanttBoard } from "@/components/GanttBoard";
import { BookingDialog } from "@/components/BookingDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmailImportDialog } from "@/components/EmailImportDialog";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Toast } from "@/components/Toast";
import { Toolbar } from "@/components/Toolbar";
import { KPIPanel } from "@/components/KPIPanel";
import { AppHeader } from "@/components/AppHeader";
import { TodayStrip } from "@/components/TodayStrip";
import { ThumbBar } from "@/components/ThumbBar";
import { CommandPalette } from "@/components/CommandPalette";
import { type Booking, type BookingInput, type BookingPrefill, type Lodge } from "@/lib/types";
import { useBookingStore } from "@/lib/store";
import { useShallow } from "zustand/react/shallow";
import { getMonthDays, isActiveOnDay, matchesFilters, toIsoDate } from "@/lib/utils";
import { MonthSummary, computeLodgeSummaries } from "@/components/MonthSummary";
import { MigrationHelper } from "@/components/MigrationHelper";
import { PendingAssignments } from "@/components/PendingAssignments";
import { AvailabilityPdfDialog } from "@/components/AvailabilityPdfDialog";
import { useActiveRoomIds, useSettingsStore } from "@/lib/settingsStore";
import { formattedAddress } from "@/lib/property";
import type { DropResult } from "@/lib/useBookingDrag";

export default function Home() {
  const router = useRouter();

  const { bookings, filters } = useBookingStore(
    useShallow((s) => ({ bookings: s.bookings, filters: s.filters }))
  );
  const { currentMonth, prevMonth, nextMonth, setMonth: setStoreMonth } = useBookingStore(
    useShallow((s) => ({
      currentMonth: s.currentMonth,
      prevMonth: s.prevMonth,
      nextMonth: s.nextMonth,
      setMonth: s.setMonth,
    }))
  );
  const { monthTheme, setMonthTheme } = useBookingStore(
    useShallow((s) => ({ monthTheme: s.monthTheme, setMonthTheme: s.setMonthTheme }))
  );
  const { setSearch, setStatusFilter, setChannelFilter, setShowCancelled } = useBookingStore(
    useShallow((s) => ({
      setSearch: s.setSearch,
      setStatusFilter: s.setStatusFilter,
      setChannelFilter: s.setChannelFilter,
      setShowCancelled: s.setShowCancelled,
    }))
  );
  const {
    load,
    startPolling,
    syncError,
    hasNewBookings,
    clearNewBookingsNotification,
    addBooking,
    updateBooking,
    deleteBooking,
    importBookingsMerge,
    exportBookings,
    showToast,
    forceSyncToCloud,
    flushSyncToCloud,
    syncLocalToCloud,
    runChannelSync,
  } = useBookingStore(
    useShallow((s) => ({
      load: s.load,
      startPolling: s.startPolling,
      syncError: s.syncError,
      hasNewBookings: s.hasNewBookings,
      clearNewBookingsNotification: s.clearNewBookingsNotification,
      addBooking: s.addBooking,
      updateBooking: s.updateBooking,
      deleteBooking: s.deleteBooking,
      importBookingsMerge: s.importBookingsMerge,
      exportBookings: s.exportBookings,
      showToast: s.showToast,
      forceSyncToCloud: s.forceSyncToCloud,
      flushSyncToCloud: s.flushSyncToCloud,
      syncLocalToCloud: s.syncLocalToCloud,
      runChannelSync: s.runChannelSync,
    }))
  );
  const { darkMode, toggleDarkMode, accentColor, setAccentColor } = useBookingStore(
    useShallow((s) => ({
      darkMode: s.darkMode,
      toggleDarkMode: s.toggleDarkMode,
      accentColor: s.accentColor,
      setAccentColor: s.setAccentColor,
    }))
  );

  const settings = useSettingsStore((s) => s.settings);
  const settingsLoaded = useSettingsStore((s) => s.loaded);
  const loadSettings = useSettingsStore((s) => s.load);
  const roomIds = useActiveRoomIds();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Booking | null>(null);
  const [prefill, setPrefill] = useState<BookingPrefill>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importConfirm, setImportConfirm] = useState<{ incoming: Booking[] } | null>(null);
  const [emailImportOpen, setEmailImportOpen] = useState(false);
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    load();
    void loadSettings();
  }, [load, loadSettings]);

  // Prima configurazione: il wizard precede l'uso della board.
  useEffect(() => {
    if (settingsLoaded && !settings.onboardingDone) {
      router.replace("/impostazioni?wizard=1");
    }
  }, [settingsLoaded, settings.onboardingDone, router]);

  useEffect(() => {
    const stop = startPolling();
    return stop;
  }, [startPolling]);

  useEffect(() => {
    function handlePageHide() {
      void flushSyncToCloud();
    }
    window.addEventListener("pagehide", handlePageHide);
    return () => window.removeEventListener("pagehide", handlePageHide);
  }, [flushSyncToCloud]);

  const monthDate = useMemo(() => parseISO(currentMonth), [currentMonth]);
  const monthDays = useMemo(() => getMonthDays(monthDate), [monthDate]);

  /** Board, KPI ed export ignorano il cestino: là dentro non c'è più nulla di vivo. */
  const liveBookings = useMemo(() => bookings.filter((b) => !b.deletedAt), [bookings]);
  const trashCount = bookings.length - liveBookings.length;

  /** Soggiorni iniziati senza schedina o flusso: è il contatore nell'header. */
  const pendingReports = useMemo(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    return liveBookings.filter(
      (b) =>
        b.status !== "cancelled" &&
        b.checkIn.slice(0, 10) <= today &&
        (!b.reporting?.alloggiatiSent || !b.reporting?.ross1000Sent)
    ).length;
  }, [liveBookings]);

  function openNewBooking(lodge?: Lodge, day?: Date) {
    setEditing(null);
    setPrefill({ lodge, day: day ? toIsoDate(day) : undefined });
    setDialogOpen(true);
  }

  function openNewBookingFromPrefill(prefillData: BookingPrefill) {
    setEditing(null);
    setPrefill(prefillData);
    setDialogOpen(true);
  }

  function openEditBooking(booking: Booking) {
    setEditing(booking);
    setPrefill({});
    setDialogOpen(true);
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // ⌘K / Ctrl+K apre la ricerca anche mentre si scrive in un campo.
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
        return;
      }
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (dialogOpen || paletteOpen) return;
      switch (e.key) {
        case "n":
        case "N":
          e.preventDefault();
          setEditing(null);
          setPrefill({});
          setDialogOpen(true);
          break;
        case "/":
          e.preventDefault();
          setPaletteOpen(true);
          break;
        case "ArrowLeft":
          e.preventDefault();
          prevMonth();
          break;
        case "ArrowRight":
          e.preventDefault();
          nextMonth();
          break;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dialogOpen, paletteOpen, prevMonth, nextMonth]);

  /**
   * Trascinamento sulla board: sposta date e camera, o allunga il soggiorno.
   * Il controllo di sovrapposizione è quello dello store: se la nuova
   * collocazione è occupata, la modifica viene rifiutata e la barra torna dov'era.
   */
  function moveBooking({ booking, checkIn, checkOut, lodge }: DropResult) {
    const { id, createdAt, updatedAt, ...rest } = booking;
    void createdAt;
    void updatedAt;
    if (booking.checkIn === checkIn && booking.checkOut === checkOut && booking.lodge === lodge) {
      return;
    }
    try {
      updateBooking(id, { ...rest, checkIn, checkOut, lodge });
      showToast(
        `${booking.guestName}: ${checkIn.slice(8, 10)}/${checkIn.slice(5, 7)} → ${checkOut.slice(8, 10)}/${checkOut.slice(5, 7)}.`,
        "success"
      );
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Spostamento non riuscito.", "error");
    }
  }

  /** Conferma dell'host sull'unità proposta per una prenotazione importata. */
  function assignLodge(booking: Booking, lodge: Lodge) {
    const { id, createdAt, updatedAt, proposedLodge, overbooking, ...rest } = booking;
    void createdAt;
    void updatedAt;
    void proposedLodge;
    void overbooking;
    try {
      updateBooking(id, { ...rest, lodge });
      showToast(`${booking.guestName} assegnata a ${lodge}.`, "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Assegnazione non riuscita.", "error");
    }
  }

  function onImportClick() {
    fileInputRef.current?.click();
  }

  function onImportFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const incoming: Booking[] = Array.isArray(parsed) ? parsed : parsed.bookings;
        if (!Array.isArray(incoming)) throw new Error("Formato JSON non valido.");
        setImportConfirm({ incoming });
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Errore durante import.", "error");
      }
    };
    reader.readAsText(file);
  }

  function onExport() {
    const payload = {
      property: settings.property.name,
      exportedAt: new Date().toISOString(),
      settings,
      bookings: exportBookings(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `le-farfalle-backup-${format(new Date(), "yyyy-MM-dd")}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Backup scaricato su questo dispositivo.", "success");
  }

  async function onCopyIcal() {
    try {
      const res = await fetch("/api/calendar/link", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { url: string; protected: boolean };
      await navigator.clipboard.writeText(data.url);
      showToast(
        data.protected
          ? "Link iCal copiato. Incollalo nell'extranet Booking e nel pannello Airbnb."
          : "Link iCal copiato, ma il feed è senza token: configura ICAL_FEED_TOKEN su Vercel.",
        data.protected ? "success" : "error"
      );
    } catch {
      showToast("Impossibile recuperare il link iCal.", "error");
    }
  }

  async function handleChannelSync() {
    setSyncing(true);
    try {
      await runChannelSync();
    } finally {
      setSyncing(false);
    }
  }

  const visibleSummary = useMemo(() => {
    const filtered = liveBookings.filter((booking) => matchesFilters(booking, filters));
    return {
      count: filtered.length,
      total: filtered.reduce((acc, item) => acc + item.totalAmount, 0),
      deposits: filtered.reduce((acc, item) => acc + (item.depositReceived ? item.depositAmount : 0), 0),
    };
  }, [liveBookings, filters]);

  const newBookingsCount = useMemo(() => liveBookings.filter((b) => b.isNew).length, [liveBookings]);

  const monthKPIs = useMemo(() => {
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);
    const daysInMonth = monthDays.length;

    const monthBookings = liveBookings.filter((b) => {
      if (b.status === "cancelled") return false;
      const ci = parseISO(b.checkIn);
      return ci >= monthStart && ci <= monthEnd;
    });

    const bookingsCount = monthBookings.length;
    const revenue = monthBookings.reduce((acc, b) => acc + b.totalAmount, 0);
    const depositsReceived = monthBookings.reduce(
      (acc, b) => acc + (b.depositReceived ? b.depositAmount : 0),
      0
    );

    let occupiedLodgeNights = 0;
    for (const lodge of roomIds) {
      const lodgeBookings = liveBookings.filter((b) => b.lodge === lodge && b.status !== "cancelled");
      for (const day of monthDays) {
        if (lodgeBookings.some((b) => isActiveOnDay(b, day))) occupiedLodgeNights += 1;
      }
    }
    const occupancyPct =
      daysInMonth > 0 && roomIds.length > 0
        ? (occupiedLodgeNights / (roomIds.length * daysInMonth)) * 100
        : 0;

    return { bookingsCount, revenue, depositsReceived, occupancyPct, newBookingsCount };
  }, [liveBookings, monthDate, monthDays, newBookingsCount, roomIds]);

  const lodgeSummaries = useMemo(() => {
    const filtered = liveBookings.filter((b) => matchesFilters(b, filters));
    const firstDay = monthDays[0];
    const lastDay = monthDays[monthDays.length - 1];
    const inMonth =
      firstDay && lastDay
        ? filtered.filter((b) => {
            let cursor = new Date(firstDay);
            while (!isBefore(lastDay, cursor)) {
              if (isActiveOnDay(b, cursor)) return true;
              cursor = addDays(cursor, 1);
            }
            return false;
          })
        : [];
    return computeLodgeSummaries(monthDate, inMonth, roomIds);
  }, [liveBookings, filters, monthDate, monthDays, roomIds]);

  /**
   * Le due classi restano complementari: parte del foglio di stile ereditato
   * qualifica le regole con `.dark`, quindi spegnerla e basta lascerebbe la
   * board a metà strada fra i due temi.
   */
  useEffect(() => {
    document.documentElement.classList.toggle("light", !darkMode);
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  useEffect(() => {
    const MONTH_ACCENTS: Record<number, string> = {
      0: "#2a7d8c",
      1: "#2a9d8f",
      2: "#5aa9a0",
      3: "#7fbf9a",
      4: "#e9c46a",
      5: "#f4a261",
      6: "#ff7a5a",
      7: "#e2725b",
      8: "#d1495b",
      9: "#c77b52",
      10: "#8a5a44",
      11: "#3f7d8c",
    };
    const isDefaultCoral = accentColor === "#ff7a5a";
    const accent = monthTheme && isDefaultCoral ? (MONTH_ACCENTS[getMonth(monthDate)] ?? accentColor) : accentColor;
    const r = parseInt(accent.slice(1, 3), 16);
    const g = parseInt(accent.slice(3, 5), 16);
    const b = parseInt(accent.slice(5, 7), 16);
    document.documentElement.style.setProperty("--accent", accent);
    document.documentElement.style.setProperty("--accent-faint", `rgba(${r}, ${g}, ${b}, 0.1)`);
    document.documentElement.style.setProperty("--today-bg", `rgba(${r}, ${g}, ${b}, 0.12)`);
    document.documentElement.style.setProperty("--today-border", `rgba(${r}, ${g}, ${b}, 0.45)`);
  }, [monthDate, monthTheme, accentColor]);

  const yearOptions = useMemo(() => {
    const year = getYear(monthDate);
    return [year - 2, year - 1, year, year + 1, year + 2];
  }, [monthDate]);

  return (
    <>
      <MigrationHelper />
      <main className="page-root">
        <AppHeader
          pendingReports={pendingReports}
          trashCount={trashCount}
          darkMode={darkMode}
          onToggleDarkMode={toggleDarkMode}
        />

        <KPIPanel data={monthKPIs} monthLabel={format(monthDate, "MMMM yyyy", { locale: it })} />

        <TodayStrip bookings={bookings} onOpen={openEditBooking} />

        <Toolbar
          monthDate={monthDate}
          yearOptions={yearOptions}
          onPrev={prevMonth}
          onNext={nextMonth}
          onSetMonth={setStoreMonth}
          onToday={() => setStoreMonth(startOfMonth(new Date()))}
          filters={filters}
          monthTheme={monthTheme}
          onSearch={setSearch}
          onStatusFilter={setStatusFilter}
          onChannelFilter={setChannelFilter}
          onShowCancelled={setShowCancelled}
          onMonthTheme={setMonthTheme}
          onNewBooking={() => openNewBooking()}
          onEmailImport={() => setEmailImportOpen(true)}
          onImportClick={onImportClick}
          onExport={onExport}
          onCopyIcal={onCopyIcal}
          onDownloadPdf={() => setPdfDialogOpen(true)}
          onForceSync={() => forceSyncToCloud()}
          onChannelSync={handleChannelSync}
          onSyncLocal={() => syncLocalToCloud()}
          syncError={syncError}
          hasNewBookings={hasNewBookings}
          onClearNotification={clearNewBookingsNotification}
          visibleCount={visibleSummary.count}
          visibleTotal={visibleSummary.total}
          visibleDeposits={visibleSummary.deposits}
          newBookingsCount={newBookingsCount}
          accentColor={accentColor}
          onSetAccentColor={setAccentColor}
        />

        <section className="print-title">
          <div>
            <h2>{settings.property.name} — Booking Board</h2>
            <p>{format(monthDate, "MMMM yyyy", { locale: it })}</p>
          </div>
        </section>

        <ErrorBoundary>
          <PendingAssignments bookings={liveBookings} onAssign={assignLodge} onOpen={openEditBooking} />
          <GanttBoard
            monthDays={monthDays}
            bookings={liveBookings}
            filters={filters}
            onCreate={openNewBooking}
            onEdit={openEditBooking}
            onMove={moveBooking}
          />
        </ErrorBoundary>

        <MonthSummary monthDate={monthDate} lodgeSummaries={lodgeSummaries} />

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onImportFile(file);
            e.currentTarget.value = "";
          }}
        />

        <BookingDialog
          open={dialogOpen}
          booking={editing}
          initialLodge={prefill.lodge}
          initialDate={prefill.day || addDays(new Date(), 1).toISOString().slice(0, 10)}
          initialPrefill={prefill}
          onClose={() => setDialogOpen(false)}
          onCreate={(payload: BookingInput) => addBooking(payload)}
          onUpdate={(id: string, payload: BookingInput) => updateBooking(id, payload)}
          onDelete={(id: string) => deleteBooking(id)}
        />

        <AvailabilityPdfDialog
          open={pdfDialogOpen}
          onClose={() => setPdfDialogOpen(false)}
          bookings={liveBookings}
          monthDate={monthDate}
          taxSettings={settings.touristTax}
          onSaveTaxSettings={(next) => void useSettingsStore.getState().save({ touristTax: next })}
        />

        <EmailImportDialog
          open={emailImportOpen}
          onClose={() => setEmailImportOpen(false)}
          onCreateFromPrefill={openNewBookingFromPrefill}
        />

        <CommandPalette
          open={paletteOpen}
          bookings={bookings}
          onClose={() => setPaletteOpen(false)}
          onSelect={openEditBooking}
        />

        <ConfirmDialog
          open={importConfirm !== null}
          title="Conferma import"
          message="Stai importando prenotazioni da un file JSON. Confermi il merge?"
          confirmLabel="Importa"
          onConfirm={() => {
            if (!importConfirm) return;
            const result = importBookingsMerge(importConfirm.incoming);
            setImportConfirm(null);
            const sorted = [...importConfirm.incoming].sort((a, b) => a.checkIn.localeCompare(b.checkIn));
            if (sorted.length > 0) setStoreMonth(startOfMonth(parseISO(sorted[0].checkIn)));
            setSearch("");
            setStatusFilter("all");
            setChannelFilter("all");
            showToast(`Import completato: ${result.merged} aggiunte, ${result.skipped} scartate.`);
          }}
          onClose={() => setImportConfirm(null)}
        />

        {syncError && (
          <div className="sync-local-banner" role="status">
            💾 Solo locale — cloud non raggiungibile. Dati salvati sul dispositivo, nessuna perdita.
          </div>
        )}
        <Toast />

        <footer className="app-footer no-print">
          {settings.property.name} · {formattedAddress(settings.property)}
          <br />
          {[
            settings.property.cin ? `CIN ${settings.property.cin}` : "",
            settings.property.cir ? `CIR ${settings.property.cir}` : "",
            settings.property.phone,
          ]
            .filter(Boolean)
            .join(" · ")}
        </footer>
      </main>

      <ThumbBar
        onToday={() => setStoreMonth(startOfMonth(new Date()))}
        onNew={() => openNewBooking()}
        onSearch={() => setPaletteOpen(true)}
        onSync={handleChannelSync}
        syncing={syncing}
      />
    </>
  );
}
