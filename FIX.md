Next.js 14/TS/Zustand/Radix/Lucide/date-fns. No new packages. Edit only: app/globals.css, lib/store.ts, lib/emailParser.ts, components/BookingDialog.tsx, components/BookingBoard.tsx, components/EmailImportDialog.tsx, components/Toolbar.tsx. Create only: start-villa-olimpia.command. Run `npm run build` at end.

---

## FIX 1 — lib/store.ts: persist() data loss

Replace entire persist() function:
```ts
function persist(bookings: Booking[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(bookings));
  const writeBackup = () => {
    const raw = window.localStorage.getItem(BACKUP_KEY);
    const current: BackupSnapshot[] = raw ? JSON.parse(raw) : [];
    const merged = [{ createdAt: new Date().toISOString(), bookings }, ...current].slice(0, 10);
    window.localStorage.setItem(BACKUP_KEY, JSON.stringify(merged));
  };
  if (typeof requestIdleCallback !== "undefined") requestIdleCallback(writeBackup);
  else writeBackup();
}
```
(Remove outer setTimeout debounce — sync write is safe and instant)

---

## FIX 2 — lib/emailParser.ts: broken amounts + missing patterns

Replace parseAmount:
```ts
function parseAmount(s: string): number {
  let n = s.trim();
  if (/\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(n)) n = n.replace(/\./g,'').replace(',','.');
  else if (/\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(n)) n = n.replace(/,/g,'');
  else n = n.replace(',','.');
  return Math.max(0, parseFloat(n) || 0);
}
```

Replace extractAmounts:
```ts
function extractAmounts(text: string): { total: number; deposit: number } {
  const DEP = /caparra|acconto|deposit[oa]?|anticipo|saldo|residuo|balance\s*due|rata/i;
  const TOT = /total[ei]?|importo|prezzo|costo|guadagni?\s*totali?|compenso|il\s*tuo\s*guadagno|payout|earnings|importo\s*del\s*pagamento/i;
  let total = 0, deposit = 0;
  const untagged: number[] = [];
  const re = /(\d+(?:[.,]\d{0,3})*(?:[.,]\d{2})?)\s*€|€\s*(\d+(?:[.,]\d{0,3})*(?:[.,]\d{2})?)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const v = parseAmount(m[1] || m[2] || '0');
    if (v <= 0) continue;
    const ctx = text.slice(Math.max(0, m.index - 100), m.index + 40);
    if (DEP.test(ctx))      { if (!deposit) deposit = v; }
    else if (TOT.test(ctx)) { if (!total) total = v; }
    else                    { untagged.push(v); }
  }
  if (!total && untagged.length) total = untagged.sort((a,b)=>b-a)[0];
  if (!deposit && untagged.length > 1) deposit = untagged.find(v=>v!==total) ?? 0;
  return { total, deposit };
}
```

Add to namePatterns array (before last pattern):
```ts
/(?:nome\s+dell['']ospite|guest\s*name)\s*[:\-]?\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s]{1,48})/i,
/(?:prenotato\s+da|booked\s+by)\s*[:\-]?\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s]{1,48})/i,
```

Replace GUESTS_REGEX:
```ts
const GUESTS_REGEX = /\b(\d+)\s*(?:ospiti?|persone?|pax|guests?|adulti|bambini|p\.?)\b/i;
```

---

## FIX 3 — components/EmailImportDialog.tsx: show riepilogo economico completo

In the `{parsed && ...}` preview block, after existing `<dl>` rows add:
```tsx
{parsed.totalAmount && parsed.depositAmount && parsed.totalAmount > parsed.depositAmount && (
  <><dt>Residuo</dt><dd>€ {(parsed.totalAmount - parsed.depositAmount).toFixed(2)}</dd></>
)}
```
Format existing totalAmount/depositAmount with `.toFixed(2)`:
```tsx
<dd>€ {parsed.totalAmount.toFixed(2)}</dd>
<dd>€ {parsed.depositAmount.toFixed(2)}</dd>
```

---

## FIX 4 — components/BookingDialog.tsx: form sections + residuo

Wrap form-grid fields into 4 `.form-section` divs (replace single `<div className="form-grid">`):

```tsx
<div style={{display:'grid',gap:'12px'}}>
  {/* Sezione 1 */}
  <div className="form-section">
    <p className="form-section-title">Ospite &amp; Alloggio</p>
    <div className="form-grid">
      {/* guestName, lodge, guestsCount, channel */}
    </div>
  </div>
  {/* Sezione 2 */}
  <div className="form-section">
    <p className="form-section-title">Date &amp; Stato</p>
    <div className="form-grid">
      {/* checkIn, checkOut, status */}
    </div>
  </div>
  {/* Sezione 3 */}
  <div className="form-section">
    <p className="form-section-title">Riepilogo Economico</p>
    <div className="form-grid">
      {/* totalAmount, depositAmount, depositReceived */}
      <label>
        Residuo da incassare
        <input readOnly value={`€ ${Math.max(0, form.totalAmount - form.depositAmount).toFixed(2)}`}
          style={{background:'var(--bg)',color:'var(--muted)',cursor:'default'}} />
      </label>
    </div>
  </div>
  {/* Sezione 4 */}
  <div className="form-section">
    <p className="form-section-title">Note</p>
    <label className="full-width">
      <textarea value={form.notes} onChange={(e)=>change('notes',e.target.value)} rows={3}/>
    </label>
  </div>
</div>
```

---

## FIX 5 — app/globals.css: UI polish (targeted additions)

Add these blocks (do NOT remove existing rules, only add/override):

```css
:root {
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.08),0 1px 2px rgba(0,0,0,0.04);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.10),0 2px 6px rgba(0,0,0,0.06);
  --shadow-lg: 0 8px 24px rgba(0,0,0,0.12),0 4px 10px rgba(0,0,0,0.06);
  --radius-md: 12px;
  --radius-lg: 16px;
}

/* Buttons lift */
.primary-btn,.ghost-btn,.danger-btn,.icon-btn {
  font-weight:600;
  box-shadow:var(--shadow-sm);
  transition:all 0.15s ease;
}
.primary-btn { background:linear-gradient(135deg,var(--accent) 0%,color-mix(in srgb,var(--accent) 78%,#000) 100%); }
.primary-btn:hover,.ghost-btn:hover { transform:translateY(-1px); box-shadow:var(--shadow-md); }

/* Empty cell — visible dashed button */
.cell-btn {
  width:100%; min-height:52px; justify-content:center;
  border:2px dashed color-mix(in srgb,var(--line) 100%,transparent);
  border-radius:var(--radius-md);
  color:var(--muted); background:transparent; font-size:1.2rem; font-weight:300;
}
.cell-btn:hover {
  border:2px solid var(--accent); color:var(--accent);
  background:var(--accent-faint); box-shadow:var(--shadow-sm); transform:none;
}

/* Chip stronger borders */
.booking-chip {
  border:1.5px solid var(--line); border-left-width:5px;
  border-radius:var(--radius-md); min-height:72px;
  box-shadow:var(--shadow-sm);
}
.booking-chip:hover { box-shadow:var(--shadow-md); transform:translateY(-2px); }

/* Table borders */
.booking-table th,.booking-table td { border:1.5px solid var(--line); }
.board-wrap { border:1.5px solid var(--line); border-radius:var(--radius-lg); box-shadow:var(--shadow-lg); }

/* Summary pills */
.summary-card {
  border-radius:999px; padding:5px 16px; font-weight:600;
  font-size:0.88rem; box-shadow:var(--shadow-sm);
}

/* Form sections */
.form-section {
  border:1.5px solid var(--line); border-radius:var(--radius-md);
  padding:14px; background:#fff;
}
.form-section-title {
  margin:0 0 10px; font-size:0.72rem; font-weight:700;
  letter-spacing:0.09em; text-transform:uppercase; color:var(--muted);
  padding-bottom:8px; border-bottom:1px solid var(--line);
}
```

---

## FIX 6 — Create start-villa-olimpia.command (macOS desktop launcher)

```bash
#!/bin/bash
DIR="$(cd "$(dirname "$0")" && pwd)"
PORT=3030
lsof -ti:$PORT | xargs kill -9 2>/dev/null || true
cd "$DIR"
[ -d ".next/static" ] && npm run start -- -p $PORT & || npm run dev -- -p $PORT &
sleep 5 && open "http://localhost:$PORT"
echo "Villa Olimpia su http://localhost:$PORT — chiudi per fermare."
wait
```
Run: `chmod +x start-villa-olimpia.command`

---

## VERIFY
`npm run build` — must show 0 errors. If type errors on form-section restructure, keep original JSX structure and only add wrapper divs without moving fields.
