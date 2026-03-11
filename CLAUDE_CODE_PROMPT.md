# Villa Olimpia Booking Board — Claude Code Task

**Stack:** Next.js 14, TypeScript, Zustand (localStorage), Radix UI, Lucide React, date-fns
**Project root:** current directory

---

## TASK 1 — FIX: Data persistence (CRITICAL)

**Problem:** `lib/store.ts` → `persist()` uses `requestIdleCallback` inside a 250ms debounce. If the tab closes before the callback fires, manually added bookings are lost.

**Fix in `lib/store.ts`:**
```
function persist(bookings: Booking[]): void {
  if (typeof window === "undefined") return;
  // Synchronous write first (prevents data loss on tab close)
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(bookings));
  // Async backup snapshots (10 rolling)
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
Remove the outer `setTimeout` debounce wrapper entirely — synchronous writes are instant and safe.

---

## TASK 2 — FIX: Email parser — extract full economic summary

**File:** `lib/emailParser.ts`

**Problems:**
1. `parseAmount` does NOT handle thousands separators: `"1.200,50"` → parses as `1.20` instead of `1200.50`
2. Missing Airbnb/Booking.com economic keywords: `"guadagni"`, `"compenso"`, `"payout"`, `"il tuo guadagno"`, `"earnings"`, `"nightly rate"`, `"cleaning fee"`, `"service fee"`, `"tassa di soggiorno"`, `"totale guadagni"`, `"importo del pagamento"`
3. Deposit detection misses: `"saldo"`, `"balance due"`, `"residuo"`, `"rata"` patterns
4. Guest name misses Airbnb format: `"Nome dell'ospite: Mario Rossi"` / `"Guest name: John Smith"`
5. N. guests misses: `"(\d+)\s*(?:adulti|bambini|persone)"` patterns

**Replace `extractAmounts` with:**
```typescript
function parseAmount(s: string): number {
  // Handle both IT format (1.200,50) and EN format (1,200.50)
  let n = s.trim();
  if (/\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(n)) {
    n = n.replace(/\./g, '').replace(',', '.');      // IT: 1.200,50 → 1200.50
  } else if (/\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(n)) {
    n = n.replace(/,/g, '');                          // EN: 1,200.50 → 1200.50
  } else {
    n = n.replace(',', '.');
  }
  return Math.max(0, parseFloat(n) || 0);
}

function extractAmounts(text: string): { total: number; deposit: number } {
  const DEPOSIT_KW = /caparra|acconto|deposit[oa]?|anticipo|saldo|residuo|balance\s*due|rata/i;
  const TOTAL_KW   = /total[ei]?|importo|prezzo|costo|guadagni?\s*totali?|compenso|il\s*tuo\s*guadagno|payout|earnings|importo\s*del\s*pagamento|nightly\s*rate|subtotal[ei]?/i;
  let total = 0, deposit = 0;
  const untagged: number[] = [];
  const eurRegex = /(\d+(?:[.,]\d{0,3})*(?:[.,]\d{2})?)\s*€|€\s*(\d+(?:[.,]\d{0,3})*(?:[.,]\d{2})?)/gi;
  let am: RegExpExecArray | null;
  while ((am = eurRegex.exec(text))) {
    const v = parseAmount(am[1] || am[2] || '0');
    if (v <= 0) continue;
    const ctx = text.slice(Math.max(0, am.index - 100), am.index + 40);
    if (DEPOSIT_KW.test(ctx))      { if (deposit === 0) deposit = v; }
    else if (TOTAL_KW.test(ctx))   { if (total === 0) total = v; }
    else                            { untagged.push(v); }
  }
  if (total === 0 && untagged.length > 0) total = untagged.sort((a,b) => b-a)[0]; // largest = total
  if (deposit === 0 && untagged.length > 1) deposit = untagged.filter(v => v !== total)[0];
  return { total, deposit };
}
```

**Add to `namePatterns` array (insert before last pattern):**
```typescript
/(?:nome\s+dell['']ospite|guest\s*name)\s*[:\-]?\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s]{1,48})/i,
/(?:prenotato\s+da|booked\s+by|reserved\s+by)\s*[:\-]?\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s]{1,48})/i,
```

**Fix `GUESTS_REGEX`:**
```typescript
const GUESTS_REGEX = /\b(\d+)\s*(?:ospiti?|persone?|pax|guests?|adulti|bambini|p\.?)\b/i;
```

**In `EmailImportDialog.tsx` — improve preview to show riepilogo economico:**
Add to `parsed` display section after existing fields:
```tsx
{parsed.totalAmount !== undefined && parsed.totalAmount > 0 && (
  <>
    <dt>Totale</dt>
    <dd>€ {parsed.totalAmount.toFixed(2)}</dd>
  </>
)}
{parsed.depositAmount !== undefined && parsed.depositAmount > 0 && (
  <>
    <dt>Caparra / Saldo</dt>
    <dd>€ {parsed.depositAmount.toFixed(2)}</dd>
  </>
)}
{parsed.totalAmount && parsed.depositAmount && parsed.totalAmount > parsed.depositAmount && (
  <>
    <dt>Residuo</dt>
    <dd>€ {(parsed.totalAmount - parsed.depositAmount).toFixed(2)}</dd>
  </>
)}
```

---

## TASK 3 — GRAPHIC OVERHAUL (All files)

### 3a. `app/globals.css` — UI polish

**Replace ALL existing CSS with this complete, production-ready stylesheet:**

Key design tokens to add/update:
```css
:root {
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.06);
  --shadow-lg: 0 8px 24px rgba(0,0,0,0.12), 0 4px 10px rgba(0,0,0,0.06);
}
```

**Specific UI upgrades required:**

**Buttons** — all `.primary-btn`, `.ghost-btn`, `.danger-btn` must have:
- `box-shadow: var(--shadow-sm)` at rest
- `box-shadow: var(--shadow-md)` on hover
- `transform: translateY(-1px)` on hover
- `font-weight: 600`
- `letter-spacing: 0.01em`
- `.primary-btn`: gradient background `linear-gradient(135deg, var(--accent) 0%, color-mix(in srgb, var(--accent) 80%, #000) 100%)`

**Empty cell button** (`.cell-btn`) must look like a real dashed-border button:
```css
.cell-btn {
  width: 100%;
  min-height: 48px;
  justify-content: center;
  border: 2px dashed var(--line);
  border-radius: var(--radius-md);
  color: var(--muted);
  background: transparent;
  font-size: 1.1rem;
  font-weight: 300;
  transition: all 0.15s ease;
}
.cell-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-faint);
  border-style: solid;
  box-shadow: var(--shadow-sm);
}
```

**Booking chip** (`.booking-chip`) — more polished card:
```css
.booking-chip {
  border-radius: var(--radius-md);
  border: 1.5px solid var(--line);
  border-left-width: 5px;
  padding: 10px 12px;
  min-height: 70px;
  display: grid;
  gap: 5px;
  cursor: pointer;
  background: #fff;
  box-shadow: var(--shadow-sm);
  transition: box-shadow 0.15s ease, transform 0.1s ease, border-color 0.15s ease;
}
.booking-chip:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
  border-color: rgba(0,0,0,0.15);
}
```

**Table cells** — stronger borders:
```css
.booking-table th, .booking-table td {
  border: 1.5px solid var(--line);
  padding: 9px 11px;
  vertical-align: top;
}
```

**BoardWrap** — more depth:
```css
.board-wrap {
  border: 1.5px solid var(--line);
  border-radius: var(--radius-lg);
  overflow: auto;
  background: var(--panel);
  box-shadow: var(--shadow-lg);
}
```

### 3b. `components/BookingDialog.tsx` — Form sections with visual grid

Wrap the `form-grid` fields into **3 labelled sections** with `.form-section` wrapper:

```
SECTION 1 — "Ospite & Alloggio":  guestName, lodge, guestsCount, channel
SECTION 2 — "Date":               checkIn, checkOut, status
SECTION 3 — "Riepilogo Economico": totalAmount, depositAmount, depositReceived, [computed: residuo]
SECTION 4 — "Note":               notes (full-width)
```

Add CSS for sections in globals.css:
```css
.form-section {
  border: 1.5px solid var(--line);
  border-radius: var(--radius-md);
  padding: 14px;
  display: grid;
  gap: 10px;
  background: #fff;
}
.form-section-title {
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
  margin: 0 0 4px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--line);
  grid-column: 1 / -1;
}
```

**Add "Residuo da incassare" computed field** in Section 3 (read-only, shows `totalAmount - depositAmount`):
```tsx
<label>
  Residuo da incassare
  <input
    readOnly
    value={`€ ${Math.max(0, form.totalAmount - form.depositAmount).toFixed(2)}`}
    style={{ background: 'var(--bg)', color: 'var(--muted)', cursor: 'default' }}
  />
</label>
```

### 3c. `components/Toolbar.tsx` — summary cards polish

`.summary-card` must render as proper pill-badges:
```css
.summary-card {
  border: 1.5px solid var(--line);
  border-radius: 999px;
  padding: 6px 14px;
  background: linear-gradient(135deg, #fff 0%, var(--accent-faint) 100%);
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 0.9rem;
  box-shadow: var(--shadow-sm);
}
```

---

## TASK 4 — Desktop Launcher (macOS)

Create file: `start-villa-olimpia.command`

```bash
#!/bin/bash
# Villa Olimpia Booking Board — Quick Launcher
DIR="$(cd "$(dirname "$0")" && pwd)"
PORT=3030

# Kill any previous instance on same port
lsof -ti:$PORT | xargs kill -9 2>/dev/null || true

echo "🏡 Avvio Villa Olimpia Booking Board..."
cd "$DIR"

# Check if built production exists
if [ -d ".next/static" ]; then
  npm run start -- -p $PORT &
else
  npm run dev -- -p $PORT &
fi

SERVER_PID=$!
echo "PID server: $SERVER_PID"

# Wait for server ready
sleep 4

# Open in default browser
open "http://localhost:$PORT"

echo "✅ App aperta su http://localhost:$PORT"
echo "   Chiudi questo terminale per fermare il server."
wait $SERVER_PID
```

After creating the file, make it executable:
```bash
chmod +x start-villa-olimpia.command
```

Also create `start-villa-olimpia.sh` (same content, for cross-platform):
```bash
chmod +x start-villa-olimpia.sh
```

**Instructions for user** (add to a `LAUNCHER_README.txt`):
```
Per il bottone sul Desktop:
1. Copia il file "start-villa-olimpia.command" sul Desktop
2. Clic destro → Apri (prima volta per autorizzare macOS)
3. Doppio clic per le volte successive
4. Si aprirà il terminale, avvierà il server e aprirà il browser automaticamente
5. Per fermare il server, chiudi la finestra del terminale

Porta usata: 3030 (cambia PORT nel file se occupata)
```

---

## TASK 5 — Verification checklist (run after all changes)

1. `npm run build` — must complete with 0 errors
2. `npm run dev` → open localhost:3000 → add a booking → reload page → booking must still be there
3. Test email import with this Airbnb sample text:
   ```
   Nome dell'ospite: Marco Ferrari
   Lavanda · Check-in: 15 agosto 2026 · Check-out: 22 agosto 2026
   2 ospiti
   Tariffa notturna × 7: € 1.050,00
   Tassa di pulizia: € 80,00
   Totale guadagni: € 1.130,00
   Caparra ricevuta: € 339,00
   ```
   Expected extraction: guestName="Marco Ferrari", lodge="Lavanda", checkIn="2026-08-15", checkOut="2026-08-22", guestsCount=2, totalAmount=1130.00, depositAmount=339.00

4. Visually verify: all buttons have visible borders and hover effects, form sections are separated by bordered cards, booking chips have stronger borders.

---

**Priority order:** Task 1 (data loss) → Task 2 (email) → Task 3 (UI) → Task 4 (launcher) → Task 5 (verify)
**Do NOT change** file structure, Next.js config, Zustand store shape, or TypeScript types — only fix logic and CSS.
