"use client";

import { Calendar, CloudUpload, Download, FileDown, FileText, Mail, Plus, Printer, Upload } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { FilterBar } from "@/components/FilterBar";
import { MonthNavigation } from "@/components/MonthNavigation";
import { SummaryBar } from "@/components/SummaryBar";
import type { BookingFilters } from "@/lib/types";

/** Palette della board (design system Corallo): corallo, mare, sabbia. */
const ACCENT_PRESETS = [
  "#ff7a5a", // corallo (default)
  "#e2725b", // corallo profondo
  "#2a9d8f", // mare
  "#2a7d8c", // mare profondo
  "#e9c46a", // sabbia
  "#d1495b", // rosso scoglio
];

type ToolbarProps = {
  monthDate: Date;
  yearOptions: number[];
  onPrev: () => void;
  onNext: () => void;
  onSetMonth: (month: Date) => void;
  onToday: () => void;
  filters: BookingFilters;
  monthTheme: boolean;
  onSearch: (v: string) => void;
  onStatusFilter: (v: BookingFilters["status"]) => void;
  onChannelFilter: (v: BookingFilters["channel"]) => void;
  onShowCancelled: (v: boolean) => void;
  onMonthTheme: (v: boolean) => void;
  onNewBooking: () => void;
  onEmailImport: () => void;
  onImportClick: () => void;
  onExport: () => void;
  onCopyIcal: () => void;
  onDownloadPdf: () => void;
  onForceSync: () => void;
  onChannelSync: () => void;
  onSyncLocal?: () => void;
  syncError: boolean;
  hasNewBookings?: boolean;
  onClearNotification?: () => void;
  newBookingsCount?: number;
  visibleCount: number;
  visibleTotal: number;
  visibleDeposits: number;
  accentColor: string;
  onSetAccentColor: (c: string) => void;
};

export function Toolbar({
  monthDate,
  yearOptions,
  onPrev,
  onNext,
  onSetMonth,
  onToday,
  filters,
  monthTheme,
  onSearch,
  onStatusFilter,
  onChannelFilter,
  onShowCancelled,
  onMonthTheme,
  onNewBooking,
  onEmailImport,
  onImportClick,
  onExport,
  onCopyIcal,
  onDownloadPdf,
  onForceSync,
  onChannelSync,
  onSyncLocal,
  syncError,
  hasNewBookings = false,
  onClearNotification,
  visibleCount,
  visibleTotal,
  visibleDeposits,
  newBookingsCount = 0,
  accentColor,
  onSetAccentColor,
}: ToolbarProps) {
  return (
    <section className="toolbar no-print">
      <div className="toolbar-month-row">
        <span className="toolbar-month">{format(monthDate, "MMMM yyyy", { locale: it })}</span>
        <div className="accent-picker" title="Colore accento">
          {ACCENT_PRESETS.map((c) => (
            <button
              key={c}
              type="button"
              className={`accent-swatch${accentColor === c ? " active" : ""}`}
              style={{ background: c }}
              aria-label={`Accento ${c}`}
              onClick={() => onSetAccentColor(c)}
            />
          ))}
        </div>
      </div>

      <div className="controls-row">
        <MonthNavigation
          monthDate={monthDate}
          yearOptions={yearOptions}
          onPrev={onPrev}
          onNext={onNext}
          onSetMonth={onSetMonth}
          onToday={onToday}
        />
        <FilterBar
          filters={filters}
          monthTheme={monthTheme}
          onSearch={onSearch}
          onStatusFilter={onStatusFilter}
          onChannelFilter={onChannelFilter}
          onShowCancelled={onShowCancelled}
          onMonthTheme={onMonthTheme}
        />
        <div className="group">
          <button type="button" className="primary-btn" onClick={onNewBooking}>
            <Plus size={15} />
            Nuova prenotazione
          </button>
          <button type="button" className="ghost-btn" onClick={onEmailImport}>
            <Mail size={15} />
            Importa da Email
          </button>
          <button type="button" className="ghost-btn" onClick={onImportClick}>
            <Upload size={15} />
            Import JSON
          </button>
          <button type="button" className="ghost-btn" onClick={onExport}>
            <Download size={15} />
            Backup
          </button>
          <button
            type="button"
            className="ghost-btn"
            title="Copia URL iCal"
            onClick={onCopyIcal}
          >
            <Calendar size={15} />
            iCal
          </button>
          <button
            type="button"
            className="ghost-btn"
            title={syncError ? "Cloud non raggiungibile — dati salvati in locale, clicca per ritentare" : "Forza caricamento dati sul cloud"}
            onClick={onForceSync}
          >
            <CloudUpload size={15} />
            Sync
          </button>
          <button
            type="button"
            className="ghost-btn"
            title="Importa automaticamente Booking.com e Airbnb dai feed iCal configurati"
            onClick={onChannelSync}
          >
            <Calendar size={15} />
            Sync canali
          </button>
          {onSyncLocal && (
            <button
              type="button"
              className="ghost-btn"
              title="Sincronizza prenotazioni locali al cloud"
              onClick={onSyncLocal}
            >
              ☁️ Sync locale
            </button>
          )}
          {hasNewBookings && (
            <button
              type="button"
              className="btn-notify"
              onClick={onClearNotification}
              title={`${newBookingsCount} nuova/e prenotazione/i`}
            >
              <span className="notify-dot" />
              🔔 {newBookingsCount > 0 ? `+${newBookingsCount}` : ""} Nuova
            </button>
          )}
          {syncError && (
            <span
              className="sync-local-badge"
              title="Cloud non raggiungibile — dati salvati in locale. L'app funziona normalmente."
            >
              💾 Locale
            </span>
          )}
          <button
            type="button"
            className="ghost-btn"
            title="Genera il PDF disponibilità da inviare a chi fa i check-in"
            onClick={onDownloadPdf}
          >
            <FileDown size={15} />
            Scarica PDF
          </button>
          <button type="button" className="ghost-btn" onClick={() => window.print()}>
            <Printer size={15} />
            Stampa
          </button>
          <a href="/preventivi" className="ghost-btn" style={{ display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none" }}>
            <FileText size={15} />
            Preventivi
          </a>
        </div>
      </div>

      <SummaryBar count={visibleCount} total={visibleTotal} deposits={visibleDeposits} newBookingsCount={newBookingsCount} />
    </section>
  );
}
