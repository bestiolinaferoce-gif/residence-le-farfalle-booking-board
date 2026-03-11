"use client";

import { Calendar, CloudUpload, Download, Mail, Plus, Printer, Upload } from "lucide-react";
import { format } from "date-fns";
import { FilterBar } from "@/components/FilterBar";
import { MonthNavigation } from "@/components/MonthNavigation";
import { SummaryBar } from "@/components/SummaryBar";
import type { BookingFilters } from "@/lib/types";

type ToolbarProps = {
  // title row
  monthDate: Date;
  // month navigation
  yearOptions: number[];
  onPrev: () => void;
  onNext: () => void;
  onSetMonth: (month: Date) => void;
  onToday: () => void;
  // filter bar
  filters: BookingFilters;
  monthTheme: boolean;
  onSearch: (v: string) => void;
  onStatusFilter: (v: BookingFilters["status"]) => void;
  onChannelFilter: (v: BookingFilters["channel"]) => void;
  onShowCancelled: (v: boolean) => void;
  onMonthTheme: (v: boolean) => void;
  // action buttons
  onNewBooking: () => void;
  onEmailImport: () => void;
  onImportClick: () => void;
  onExport: () => void;
  onCopyIcal: () => void;
  onForceSync: () => void;
  onSyncLocal?: () => void;
  syncError: boolean;
  hasNewBookings?: boolean;
  onClearNotification?: () => void;
  newBookingsCount?: number;
  // summary bar
  visibleCount: number;
  visibleTotal: number;
  visibleDeposits: number;
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
  onSyncLocal,
  syncError,
  hasNewBookings = false,
  onClearNotification,
  visibleCount,
  visibleTotal,
  visibleDeposits,
  newBookingsCount = 0,
}: ToolbarProps) {
  return (
    <section className="toolbar no-print">
      <div className="title-row">
        <div className="header-brand">
          <span className="header-icon">🦋</span>
          <h1>Residence Le Farfalle — Booking Board</h1>
        </div>
        <span>{format(monthDate, "MMMM yyyy")}</span>
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
          <button type="button" className="ghost-btn" onClick={onNewBooking}>
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
            className={syncError ? "ghost-btn danger-btn" : "ghost-btn"}
            title={syncError ? "Sync offline — clicca per ritentare il caricamento" : "Forza caricamento dati sul cloud"}
            onClick={onForceSync}
          >
            <CloudUpload size={15} />
            {syncError ? "Sync ⚠" : "Sync"}
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
              className="sync-error"
              title="Sincronizzazione fallita — dati mostrati potrebbero non essere aggiornati"
            >
              ⚠ Offline
            </span>
          )}
          <button type="button" className="ghost-btn" onClick={() => window.print()}>
            <Printer size={15} />
            Stampa
          </button>
        </div>
      </div>

      <SummaryBar count={visibleCount} total={visibleTotal} deposits={visibleDeposits} newBookingsCount={newBookingsCount} />
    </section>
  );
}
