"use client";

import { Calendar, CloudUpload, Download, FileText, Mail, Plus, Printer, Upload } from "lucide-react";
import { format } from "date-fns";
import { FilterBar } from "@/components/FilterBar";
import { MonthNavigation } from "@/components/MonthNavigation";
import { SummaryBar } from "@/components/SummaryBar";
import { LiveClock } from "@/components/LiveClock";
import { WeatherWidget } from "@/components/WeatherWidget";
import type { BookingFilters } from "@/lib/types";

const ACCENT_PRESETS = [
  "#7c3aed", // viola (default)
  "#2563eb", // blu
  "#0d9488", // teal
  "#16a34a", // verde
  "#d97706", // ambra
  "#dc2626", // rosso
  "#db2777", // rosa
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
  onForceSync: () => void;
  onLogout?: () => Promise<unknown> | void;
  onSyncLocal?: () => void;
  syncError: boolean;
  hasNewBookings?: boolean;
  onClearNotification?: () => void;
  newBookingsCount?: number;
  visibleCount: number;
  visibleTotal: number;
  visibleDeposits: number;
  darkMode: boolean;
  onToggleDarkMode: () => void;
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
  onForceSync,
  onLogout,
  onSyncLocal,
  syncError,
  hasNewBookings = false,
  onClearNotification,
  visibleCount,
  visibleTotal,
  visibleDeposits,
  newBookingsCount = 0,
  darkMode,
  onToggleDarkMode,
  accentColor,
  onSetAccentColor,
}: ToolbarProps) {
  async function handleLogout() {
    try {
      await onLogout?.();
    } finally {
      sessionStorage.removeItem("le-farfalle:auth");
      window.location.reload();
    }
  }

  return (
    <section className="toolbar no-print">
      {/* Top row: brand + meta */}
      <div className="header-top">
        <div className="header-brand">
          <span className="header-icon">🦋</span>
          <h1>Residence Le Farfalle — Booking Board</h1>
        </div>
        <div className="header-right">
          <WeatherWidget />
          <LiveClock />
          <div className="accent-picker" title="Colore accento">
            {ACCENT_PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                className={`accent-swatch${accentColor === c ? " active" : ""}`}
                style={{ background: c }}
                title={c}
                onClick={() => onSetAccentColor(c)}
              />
            ))}
          </div>
          <button
            type="button"
            className="dark-toggle-btn"
            title={darkMode ? "Passa a tema chiaro" : "Passa a tema scuro"}
            onClick={onToggleDarkMode}
          >
            {darkMode ? "☀️" : "🌙"}
          </button>
          <a
            href="https://www.residencelefarfalle.com"
            target="_blank"
            rel="noopener noreferrer"
            className="header-site-link"
          >
            → residencelefarfalle.com
          </a>
          <button type="button" className="header-logout-btn" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </div>

      {/* Month display badge */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{
          color: "var(--muted)",
          textTransform: "capitalize",
          background: "var(--accent-faint)",
          border: "1px solid var(--line)",
          borderRadius: 8,
          padding: "3px 10px",
          fontSize: "0.9rem",
          fontWeight: 500,
        }}>
          {format(monthDate, "MMMM yyyy")}
        </span>
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
            Export JSON
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
