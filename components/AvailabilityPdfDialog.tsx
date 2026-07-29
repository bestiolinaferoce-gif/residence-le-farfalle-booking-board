"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { addDays, endOfMonth, format, startOfMonth } from "date-fns";
import { Download, X } from "lucide-react";
import { useMemo, useState } from "react";
import { availabilityPdfFilename, buildAvailabilityPdf } from "@/lib/availabilityPdf";
import {
  isTouristTaxConfigured,
  type TouristTaxSettings,
} from "@/lib/touristTax";
import type { Booking } from "@/lib/types";

type Period = "month" | "next7" | "next15" | "custom";

type AvailabilityPdfDialogProps = {
  open: boolean;
  onClose: () => void;
  bookings: Booking[];
  monthDate: Date;
  taxSettings: TouristTaxSettings;
  onSaveTaxSettings: (settings: TouristTaxSettings) => void;
};

const iso = (d: Date) => format(d, "yyyy-MM-dd");

export function AvailabilityPdfDialog({
  open,
  onClose,
  bookings,
  monthDate,
  taxSettings,
  onSaveTaxSettings,
}: AvailabilityPdfDialogProps) {
  const [period, setPeriod] = useState<Period>("month");
  const [customFrom, setCustomFrom] = useState(iso(new Date()));
  const [customTo, setCustomTo] = useState(iso(addDays(new Date(), 14)));
  const [tax, setTax] = useState<TouristTaxSettings>(taxSettings);

  const range = useMemo(() => {
    const today = new Date();
    switch (period) {
      case "month":
        return { from: iso(startOfMonth(monthDate)), to: iso(endOfMonth(monthDate)) };
      case "next7":
        return { from: iso(today), to: iso(addDays(today, 6)) };
      case "next15":
        return { from: iso(today), to: iso(addDays(today, 14)) };
      case "custom":
        return { from: customFrom, to: customTo };
    }
  }, [period, monthDate, customFrom, customTo]);

  const rangeValid = range.from <= range.to;
  const configured = isTouristTaxConfigured(tax);

  function num(value: string): number | null {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }

  function download() {
    if (!rangeValid) return;
    onSaveTaxSettings(tax);
    const doc = buildAvailabilityPdf({ bookings, from: range.from, to: range.to, taxSettings: tax });
    doc.save(availabilityPdfFilename(range.from, range.to));
    onClose();
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content pdf-dialog">
          <div className="dialog-header">
            <Dialog.Title>Scarica PDF disponibilità</Dialog.Title>
            <Dialog.Close className="dialog-close" aria-label="Chiudi">
              <X size={18} />
            </Dialog.Close>
          </div>

          <div className="pdf-dialog-body">
            <fieldset className="pdf-fieldset">
              <legend>Periodo</legend>
              <div className="pdf-period-options">
                {([
                  ["month", `Mese visualizzato (${format(monthDate, "MMMM yyyy")})`],
                  ["next7", "Prossimi 7 giorni"],
                  ["next15", "Prossimi 15 giorni"],
                  ["custom", "Intervallo personalizzato"],
                ] as Array<[Period, string]>).map(([value, label]) => (
                  <label key={value} className="pdf-radio">
                    <input
                      type="radio"
                      name="pdf-period"
                      checked={period === value}
                      onChange={() => setPeriod(value)}
                    />
                    {label}
                  </label>
                ))}
              </div>

              {period === "custom" && (
                <div className="pdf-custom-range">
                  <label>
                    Dal
                    <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
                  </label>
                  <label>
                    Al
                    <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
                  </label>
                </div>
              )}

              {!rangeValid && (
                <p className="pdf-error">La data finale deve essere successiva a quella iniziale.</p>
              )}
            </fieldset>

            <fieldset className="pdf-fieldset">
              <legend>Imposta di soggiorno</legend>
              <p className="pdf-hint">
                Valori del regolamento del Comune di Isola di Capo Rizzuto. Finché mancano, il PDF
                riporta <strong>DA VERIFICARE</strong> invece di un importo stimato.
              </p>

              <div className="pdf-tax-grid">
                <label>
                  € per persona a notte
                  <input
                    type="number" min={0} step="0.01" placeholder="non impostato"
                    value={tax.amountPerPersonPerNight ?? ""}
                    onChange={(e) => setTax({ ...tax, amountPerPersonPerNight: num(e.target.value) })}
                  />
                </label>
                <label>
                  Notti massime tassabili
                  <input
                    type="number" min={0} step="1" placeholder="non impostato"
                    value={tax.maxTaxableNights ?? ""}
                    onChange={(e) => setTax({ ...tax, maxTaxableNights: num(e.target.value) })}
                  />
                </label>
                <label>
                  Esenti sotto i (anni)
                  <input
                    type="number" min={0} step="1" placeholder="nessuna esenzione"
                    value={tax.exemptUnderAge ?? ""}
                    onChange={(e) => setTax({ ...tax, exemptUnderAge: num(e.target.value) })}
                  />
                </label>
                <label>
                  Periodo di applicazione
                  <span className="pdf-season">
                    <input
                      type="text" placeholder="MM-GG" maxLength={5}
                      value={tax.seasonStart ?? ""}
                      onChange={(e) => setTax({ ...tax, seasonStart: e.target.value.trim() || null })}
                    />
                    <input
                      type="text" placeholder="MM-GG" maxLength={5}
                      value={tax.seasonEnd ?? ""}
                      onChange={(e) => setTax({ ...tax, seasonEnd: e.target.value.trim() || null })}
                    />
                  </span>
                </label>
              </div>

              <label className="pdf-full">
                Altre esenzioni (riportate in fondo al PDF)
                <input
                  type="text" placeholder="es. disabili e accompagnatori"
                  value={tax.exemptionNotes}
                  onChange={(e) => setTax({ ...tax, exemptionNotes: e.target.value })}
                />
              </label>

              {!configured && (
                <p className="pdf-warning">
                  Parametri incompleti: servono almeno importo e notti massime perché il PDF
                  calcoli la tassa.
                </p>
              )}
            </fieldset>
          </div>

          <div className="dialog-footer">
            <button type="button" className="ghost-btn" onClick={onClose}>
              Annulla
            </button>
            <button type="button" className="primary-btn" onClick={download} disabled={!rangeValid}>
              <Download size={15} /> Scarica PDF
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
