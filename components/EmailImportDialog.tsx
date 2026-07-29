"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useState } from "react";
import type { BookingPrefill } from "@/lib/types";
import { parseEmail } from "@/lib/emailParser";

type EmailImportDialogProps = {
  open: boolean;
  onClose: () => void;
  onCreateFromPrefill: (prefill: BookingPrefill) => void;
};

export function EmailImportDialog({ open, onClose, onCreateFromPrefill }: EmailImportDialogProps) {
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<BookingPrefill | null>(null);

  function analyze() {
    const result = parseEmail(text);
    setParsed(Object.keys(result).length > 0 ? result : null);
  }

  function create() {
    if (parsed) {
      onCreateFromPrefill(parsed);
      onClose();
      setText("");
      setParsed(null);
    }
  }

  function handleClose() {
    onClose();
    setText("");
    setParsed(null);
  }

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && handleClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content">
          <div className="dialog-header">
            <Dialog.Title>Importa da Email</Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" className="icon-btn" aria-label="Chiudi">
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>
          <div className="form-grid">
            <label className="full-width">
              Incolla il testo dell&apos;email
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} placeholder="Incolla qui il contenuto dell'email di prenotazione..." />
            </label>
          </div>
          <div className="dialog-actions">
            <button type="button" className="ghost-btn" onClick={analyze}>
              Analizza
            </button>
          </div>
          {parsed && (
            <>
              <div className="preview-box">
                <strong>Campi estratti</strong>
                <dl>
                  {parsed.guestName && <><dt>Ospite</dt><dd>{parsed.guestName}</dd></>}
                  {parsed.checkIn && <><dt>Check-in</dt><dd>{parsed.checkIn}</dd></>}
                  {parsed.checkOut && <><dt>Check-out</dt><dd>{parsed.checkOut}</dd></>}
                  {parsed.lodge && <><dt>Lodge</dt><dd>{parsed.lodge}</dd></>}
                  {parsed.totalAmount !== undefined && parsed.totalAmount > 0 && <><dt>Totale</dt><dd>€{parsed.totalAmount}</dd></>}
                  {parsed.depositAmount !== undefined && parsed.depositAmount > 0 && <><dt>Caparra</dt><dd>€{parsed.depositAmount}</dd></>}
                  {parsed.guestsCount !== undefined && <><dt>Ospiti</dt><dd>{parsed.guestsCount}</dd></>}
                  {parsed.channel && <><dt>Canale</dt><dd>{parsed.channel}</dd></>}
                </dl>
              </div>
              <div className="dialog-actions">
                <span />
                <button type="button" className="primary-btn" onClick={create}>
                  Crea prenotazione
                </button>
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
