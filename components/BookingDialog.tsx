"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { differenceInDays, parseISO } from "date-fns";
import { X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { BOOKING_CHANNELS, BOOKING_STATUSES, LODGES, type Booking, type BookingInput, type BookingStatus, type GuestProfile, type Lodge } from "@/lib/types";

type BookingDialogProps = {
  open: boolean;
  booking: Booking | null;
  initialLodge?: Lodge;
  initialDate?: string;
  initialPrefill?: Partial<BookingInput>;
  onClose: () => void;
  onCreate: (payload: BookingInput) => void;
  onUpdate: (id: string, payload: BookingInput) => void;
  onDelete: (id: string) => void;
};

type FormState = BookingInput;

function buildDefault(lodge?: Lodge, day?: string): FormState {
  const checkIn = day || new Date().toISOString().slice(0, 10);
  return {
    guestName: "",
    lodge: lodge || LODGES[0],
    checkIn,
    checkOut: new Date(new Date(checkIn).setDate(new Date(checkIn).getDate() + 1)).toISOString().slice(0, 10),
    status: "confirmed",
    channel: "direct",
    notes: "",
    guestsCount: 2,
    childrenCount: 0,
    totalAmount: 0,
    depositAmount: 0,
    depositReceived: false,
    checkInTime: "14:00",
    checkOutTime: "10:00",
    breakfastIncluded: true,
  };
}

export function BookingDialog({
  open,
  booking,
  initialLodge,
  initialDate,
  initialPrefill,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
}: BookingDialogProps) {
  const mode = booking ? "edit" : "create";
  const [form, setForm] = useState<FormState>(buildDefault(initialLodge, initialDate));
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [showProfile, setShowProfile] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const formRef = useRef(form);
  formRef.current = form;

  const title = useMemo(() => (mode === "edit" ? "Modifica prenotazione" : "Nuova prenotazione"), [mode]);

  useEffect(() => {
    if (booking?.isNew && mode === "edit" && open) {
      const timer = setTimeout(() => {
        onUpdate(booking.id, { ...formRef.current, isNew: false });
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [booking?.id, booking?.isNew, mode, open, onUpdate]);

  useEffect(() => {
    if (booking) {
      setForm({
        guestName: booking.guestName,
        lodge: booking.lodge,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        status: booking.status,
        channel: booking.channel,
        notes: booking.notes,
        guestsCount: booking.guestsCount,
        childrenCount: booking.childrenCount ?? 0,
        totalAmount: booking.totalAmount,
        depositAmount: booking.depositAmount,
        depositReceived: booking.depositReceived,
        guestProfile: booking.guestProfile,
        checkInTime: booking.checkInTime ?? "14:00",
        checkOutTime: booking.checkOutTime ?? "10:00",
        breakfastIncluded: booking.breakfastIncluded ?? true,
      });
      setError("");
      setFieldErrors({});
      return;
    }
    const base = buildDefault(initialLodge, initialDate);
    const merged = initialPrefill
      ? {
          ...base,
          ...initialPrefill,
          lodge: initialPrefill.lodge ?? base.lodge,
          checkIn: initialPrefill.checkIn ?? base.checkIn,
          checkOut: initialPrefill.checkOut ?? base.checkOut,
          guestName: initialPrefill.guestName ?? base.guestName,
          guestsCount: (initialPrefill.guestsCount && initialPrefill.guestsCount >= 1) ? initialPrefill.guestsCount : base.guestsCount,
          totalAmount: initialPrefill.totalAmount ?? base.totalAmount,
          depositAmount: initialPrefill.depositAmount ?? (initialPrefill.totalAmount && initialPrefill.totalAmount > 0 ? Math.round(initialPrefill.totalAmount * 0.3 * 100) / 100 : base.depositAmount),
        }
      : base;
    setForm(merged);
    setError("");
    setFieldErrors({});
  }, [booking, open, initialLodge, initialDate, initialPrefill]);

  function changeProfile<K extends keyof GuestProfile>(key: K, value: GuestProfile[K]) {
    setForm((prev) => ({
      ...prev,
      guestProfile: { ...(prev.guestProfile ?? {}), [key]: value },
    }));
  }

  function exportAlloggiati(b: Booking) {
    const p = b.guestProfile ?? {};
    const docTypeMap: Record<string, string> = {
      CARTA_IDENTITA: "IDENT",
      PASSAPORTO: "PASOR",
      PATENTE: "PATEG",
      PERMESSO_SOGGIORNO: "PERMS",
    };
    const fmtDate = (d?: string) => {
      if (!d) return "          ";
      const [y, m, g] = d.split("-");
      return `${g}/${m}/${y}`;
    };
    const pad = (s: string, len: number) => s.substring(0, len).padEnd(len, " ");
    const padNum = (n: number, len: number) => String(n).padStart(len, "0");
    const nights = differenceInDays(parseISO(b.checkOut), parseISO(b.checkIn));
    const gender = p.gender === "M" ? "1" : p.gender === "F" ? "2" : "9";
    const docType = docTypeMap[p.documentType ?? ""] ?? "IDENT";
    const row = [
      "16",
      fmtDate(b.checkIn),
      padNum(nights, 4),
      pad(p.surname ?? b.guestName, 50),
      pad(p.firstName ?? "", 30),
      gender,
      fmtDate(p.birthDate),
      pad(p.birthPlace ?? "", 9),
      pad(p.birthProvince ?? "  ", 2),
      pad(p.birthCountry ?? "Z000", 9),
      pad(p.nationality ?? "Z000", 9),
      pad(docType, 5),
      pad(p.documentNumber ?? "", 20),
      pad(p.documentIssuePlace ?? "", 9),
    ].join("");
    const filename = `alloggiati_${b.guestName.replace(/\s+/g, "_")}_${b.checkIn}.txt`;
    const blob = new Blob([row + "\r\n"], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function mapErrorToField(message: string): keyof FormState | null {
    if (message.includes("nome ospite")) return "guestName";
    if (message.includes("successivo al check-in")) return "checkOut";
    if (message.includes("Check-in") && message.includes("check-out")) return "checkIn";
    if (message.includes("numero ospiti")) return "guestsCount";
    if (message.includes("caparra non può superare") || message.includes("Caparra ricevuta")) return "depositAmount";
    return null;
  }

  function submit() {
    setFieldErrors({});
    setError("");
    try {
      if (mode === "edit" && booking) {
        onUpdate(booking.id, form);
      } else {
        onCreate(form);
      }
      onClose();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Errore durante il salvataggio.";
      const field = mapErrorToField(message);
      if (field) {
        setFieldErrors({ [field]: message });
      } else {
        setError(message);
      }
    }
  }

  function change<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "totalAmount" && typeof value === "number" && value > 0 && prev.depositAmount <= 0) {
        next.depositAmount = Math.round(value * 0.3 * 100) / 100;
      }
      return next;
    });
    if (fieldErrors[key]) {
      setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  }

  return (
    <>
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content">
          <div className="dialog-header">
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" className="icon-btn" aria-label="Chiudi">
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          <div style={{ display: "grid", gap: "12px" }}>
            <div className="form-section">
              <p className="form-section-title">Ospite &amp; Alloggio</p>
              <div className="form-grid">
                <label>
                  Ospite
                  <input value={form.guestName} onChange={(e) => change("guestName", e.target.value)} placeholder="Nome e cognome" />
                  {fieldErrors.guestName && <span className="field-error">{fieldErrors.guestName}</span>}
                </label>
                <label>Lodge
                  <select value={form.lodge} onChange={(e) => change("lodge", e.target.value as Lodge)}>
                    {LODGES.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </label>
                <label>
                  N. adulti
                  <input type="number" min={1} value={form.guestsCount} onChange={(e) => change("guestsCount", Math.max(1, parseInt(e.target.value || "1", 10)))} />
                  {fieldErrors.guestsCount && <span className="field-error">{fieldErrors.guestsCount}</span>}
                </label>
                <label>
                  N. bambini
                  <input type="number" min={0} value={form.childrenCount ?? 0} onChange={(e) => change("childrenCount", Math.max(0, parseInt(e.target.value || "0", 10)))} />
                </label>
                <label>Canale
                  <select value={form.channel} onChange={(e) => change("channel", e.target.value as BookingInput["channel"])}>
                    {BOOKING_CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
                <label className="checkbox-line">
                  <input type="checkbox" checked={form.breakfastIncluded ?? true} onChange={(e) => change("breakfastIncluded", e.target.checked)} />
                  Colazione inclusa
                </label>
              </div>
            </div>
            <div className="form-section">
              <p className="form-section-title">Date &amp; Stato</p>
              <div className="form-grid">
                <label>Check-in
                  <input type="date" value={form.checkIn} onChange={(e) => change("checkIn", e.target.value)} />
                  {fieldErrors.checkIn && <span className="field-error">{fieldErrors.checkIn}</span>}
                </label>
                <label>Check-out
                  <input type="date" value={form.checkOut} onChange={(e) => change("checkOut", e.target.value)} />
                  {fieldErrors.checkOut && <span className="field-error">{fieldErrors.checkOut}</span>}
                </label>
                <label>Stato
                  <select value={form.status} onChange={(e) => change("status", e.target.value as BookingStatus)}>
                    {BOOKING_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
                <label>Orario check-in
                  <input type="time" value={form.checkInTime ?? "14:00"} onChange={(e) => change("checkInTime", e.target.value)} />
                </label>
                <label>Orario check-out
                  <input type="time" value={form.checkOutTime ?? "10:00"} onChange={(e) => change("checkOutTime", e.target.value)} />
                </label>
              </div>
            </div>
            <div className="form-section">
              <p className="form-section-title">Riepilogo Economico</p>
              <div className="form-grid">
                <label>Totale
                  <input type="number" min={0} value={form.totalAmount} onChange={(e) => change("totalAmount", Number(e.target.value || 0))} />
                </label>
                <label>Caparra
                  <input type="number" min={0} value={form.depositAmount} onChange={(e) => change("depositAmount", Number(e.target.value || 0))} />
                  {fieldErrors.depositAmount && <span className="field-error">{fieldErrors.depositAmount}</span>}
                </label>
                <label className="checkbox-line">
                  <input type="checkbox" checked={form.depositReceived} onChange={(e) => change("depositReceived", e.target.checked)} />
                  Caparra ricevuta
                </label>
                <label>
                  Residuo da incassare
                  <input readOnly value={`€ ${Math.max(0, form.totalAmount - form.depositAmount).toFixed(2)}`} style={{ background: "var(--bg)", color: "var(--muted)", cursor: "default" }} />
                </label>
              </div>
            </div>
            <div className="form-section">
              <p className="form-section-title">Note</p>
              <label className="full-width">
                <textarea value={form.notes} onChange={(e) => change("notes", e.target.value)} rows={3} />
              </label>
            </div>
            <div className="form-section">
              <button type="button" className="section-toggle" onClick={() => setShowProfile((v) => !v)}>
                {showProfile ? "▼" : "▶"} Anagrafica &amp; Documenti
                {form.guestProfile?.fiscalCode && <span className="profile-complete-badge">✓ completa</span>}
              </button>
              {showProfile && (
                <div className="form-grid profile-grid">
                  <label>Cognome <input value={form.guestProfile?.surname ?? ""} onChange={(e) => changeProfile("surname", e.target.value)} /></label>
                  <label>Nome <input value={form.guestProfile?.firstName ?? ""} onChange={(e) => changeProfile("firstName", e.target.value)} /></label>
                  <label>Sesso
                    <select value={form.guestProfile?.gender ?? ""} onChange={(e) => changeProfile("gender", e.target.value as "M" | "F" | "")}>
                      <option value="">—</option><option value="M">M</option><option value="F">F</option>
                    </select>
                  </label>
                  <label>Data di nascita <input type="date" value={form.guestProfile?.birthDate ?? ""} onChange={(e) => changeProfile("birthDate", e.target.value)} /></label>
                  <label>Comune di nascita <input value={form.guestProfile?.birthPlace ?? ""} onChange={(e) => changeProfile("birthPlace", e.target.value)} /></label>
                  <label>Provincia (sigla) <input maxLength={2} placeholder="MI" value={form.guestProfile?.birthProvince ?? ""} onChange={(e) => changeProfile("birthProvince", e.target.value.toUpperCase())} /></label>
                  <label>Stato di nascita <input placeholder="Italia" value={form.guestProfile?.birthCountry ?? ""} onChange={(e) => changeProfile("birthCountry", e.target.value)} /></label>
                  <label>Cittadinanza <input placeholder="Italiana" value={form.guestProfile?.nationality ?? ""} onChange={(e) => changeProfile("nationality", e.target.value)} /></label>
                  <label>Codice Fiscale <input maxLength={16} placeholder="RSSMRA80A01H501Z" value={form.guestProfile?.fiscalCode ?? ""} onChange={(e) => changeProfile("fiscalCode", e.target.value.toUpperCase())} style={{ fontFamily: "monospace", letterSpacing: "0.08em" }} /></label>
                  <label className="full-width">Residenza (via, n°, città, CAP) <input placeholder="Via Roma 1, 20100 Milano" value={form.guestProfile?.residence ?? ""} onChange={(e) => changeProfile("residence", e.target.value)} /></label>
                  <label>Tipo documento
                    <select value={form.guestProfile?.documentType ?? ""} onChange={(e) => changeProfile("documentType", e.target.value as GuestProfile["documentType"])}>
                      <option value="">— Seleziona —</option>
                      <option value="CARTA_IDENTITA">Carta d&apos;identità</option>
                      <option value="PASSAPORTO">Passaporto</option>
                      <option value="PATENTE">Patente</option>
                      <option value="PERMESSO_SOGGIORNO">Permesso di soggiorno</option>
                    </select>
                  </label>
                  <label>Numero documento <input placeholder="AB1234567" value={form.guestProfile?.documentNumber ?? ""} onChange={(e) => changeProfile("documentNumber", e.target.value.toUpperCase())} style={{ fontFamily: "monospace" }} /></label>
                  <label>Luogo rilascio <input placeholder="Comune di Milano" value={form.guestProfile?.documentIssuePlace ?? ""} onChange={(e) => changeProfile("documentIssuePlace", e.target.value)} /></label>
                  <label>Data rilascio <input type="date" value={form.guestProfile?.documentIssueDate ?? ""} onChange={(e) => changeProfile("documentIssueDate", e.target.value)} /></label>
                </div>
              )}
            </div>
          </div>

          {error ? <p className="error-box">{error}</p> : null}

          <div className="dialog-actions">
            <div className="left-actions">
              {mode === "edit" && booking ? (
                <>
                  <button type="button" className="danger-btn" onClick={() => setDeleteConfirm(true)}>
                    Elimina
                  </button>
                  {booking?.guestProfile?.surname && (
                    <button type="button" className="alloggiati-btn" onClick={() => exportAlloggiati(booking)} title="Prepara file per Portale Alloggiati Web">
                      📋 Alloggiati
                    </button>
                  )}
                </>
              ) : (
                <span />
              )}
            </div>
            <div className="right-actions" style={{ marginLeft: "auto" }}>
              <button type="button" className="ghost-btn" onClick={onClose}>
                Annulla
              </button>
              <button type="button" className="primary-btn" onClick={submit}>
                Salva
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>

    <ConfirmDialog
      open={deleteConfirm}
      title="Elimina prenotazione"
      message={booking ? `Vuoi eliminare la prenotazione di ${booking.guestName}? L'azione è irreversibile.` : ""}
      confirmLabel="Elimina"
      onConfirm={() => {
        if (booking) {
          onDelete(booking.id);
          onClose();
        }
        setDeleteConfirm(false);
      }}
      onClose={() => setDeleteConfirm(false)}
    />
    </>
  );
}
