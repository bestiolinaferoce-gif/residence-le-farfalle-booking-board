# CURSOR MULTI-AGENT FIX — Villa Olimpia Booking Board
**Progetto:** `/Users/francesconigro/Projects/villa-olimpia-booking-board`
**Stack:** Next.js 14 App Router · TypeScript · Tailwind · Zustand · Vercel KV (Upstash Redis)
**URL prod:** https://villa-olimpia-booking-board.vercel.app

---

## TEAM DI AGENTI — RUOLI E RESPONSABILITÀ

```
ARCHITECT   → Coordina, definisce contratti e impedisce regressioni
FRONTEND    → Responsabile GanttBoard, UI/UX, CSS
BACKEND     → API routes, KV store, iCal, data integrity
DEVOPS      → Build, env vars, deploy Vercel
QA          → Verifica finale build + comportamento runtime
```

Ogni task qui sotto identifica il **responsabile principale** e le **dipendenze** dagli altri agenti.

---

## PROBLEMA ROOT CAUSE (non modificare nulla prima di averlo letto)

### 1. GanttBoard — celle NON colorate (bug visivo principale)
**File:** `components/GanttBoard.tsx`

Il componente renderizza barre prenotazione come elementi `position:absolute` in percentuale (`left: Xpct%, width: Ypct%`) sovrapposti a una griglia CSS. Le **celle sottostanti rimangono vuote** e mostrano ancora il `+`. L'utente vede barre flottanti su sfondo bianco anziché celle colorate.

**Soluzione richiesta:** La prenotazione deve COLORARE le singole celle del giorno, non essere una barra flottante. Ogni cella deve avere `background-color` del canale/stato. La barra del nome ospite (inline, non absolute) appare solo sulla prima cella della prenotazione, espandendosi con `grid-column: span N` usando CSS Grid. Vedi sezione TASK-01 per spec complete.

### 2. 22 prenotazioni — ne appaiono solo 14
**File:** `lib/store.ts`, `app/api/bookings/route.ts`

L'app usa `localStorage` come cache locale + KV come storage condiviso. Al primo caricamento, se KV è vuoto, `load()` migra da localStorage. Il KV attuale ha 14 prenotazioni (migrate da un browser). Le restanti 8 sono in `localStorage` di un altro browser dell'utente.

**Soluzione richiesta:** Aggiungere route `POST /api/bookings/merge-local` + pulsante nel Toolbar "Sincronizza locali" che invia le prenotazioni localStorage al KV facendo merge deduplicato per `id`. Vedi TASK-03.

### 3. Bottoni mancanti nella toolbar
**File:** `components/Toolbar.tsx`

Mancano visivamente: pulsante iCal (funzione `onCopyIcal` già implementata in `page.tsx`), pulsante notifiche (prop `hasNewBookings` già passata), indicatore sincronizzazione. Verificare che siano renderizzati e visibili. Vedi TASK-04.

### 4. iCal endpoint esistente ma non esposto
**File:** `app/api/calendar/route.ts`

L'endpoint esiste. Va verificato che generi correttamente il feed `.ics` con tutte le prenotazioni (non solo quelle del mese). Vedi TASK-05.

---

## TASK-01 — FRONTEND: Rewrite GanttBoard (PRIORITÀ MASSIMA)
**Responsabile:** FRONTEND
**Dipendenze:** Nessuna — lavora su `components/GanttBoard.tsx` e `app/globals.css`

### Specifiche tecniche esatte

**Approccio: Cell-based coloring con span**

```tsx
// Per ogni lodge row, costruisci una mappa:
// dayIndex → { booking, isFirst, isLast, span }
// dove isFirst = il giorno coincide con checkIn
//       span = quante celle occupa nel mese corrente (fino a fine mese)

// Renderizza il tbody con CSS Grid a N colonne (N = giorni del mese)
// Per ogni lodge, itera giorno per giorno:
// - Se la cella è la PRIMA di una prenotazione → renderizza una cella
//   con gridColumn: `span ${span}`, background = colore canale/stato,
//   contenente nome ospite, notti, importo (se span > 3)
// - Se la cella è OCCUPATA ma non la prima → SKIP (il span la copre già)
// - Se la cella è LIBERA → renderizza cella vuota con "+" cliccabile
```

**Colori celle (invariati dai CHANNEL_BAR_COLORS attuali):**
```
airbnb  → bg:#fda4af text:#9f1239  (rose)
direct  → bg:#6ee7b7 text:#065f46  (emerald)
booking → bg:#93c5fd text:#1e3a8a  (blue)
expedia → bg:#fcd34d text:#78350f  (amber)
other   → bg:#d1d5db text:#374151  (gray)
option  → bg:#fcd34d text:#78350f  (amber, override)
blocked → bg:#e5e7eb text:#6b7280  (gray scuro)
cancelled → nascosta (o strikethrough + opacity 0.4)
```

**Struttura JSX da produrre:**
```tsx
<div className="gantt-wrap" style={{ overflowX: 'auto' }}>
  {/* Header giorni */}
  <div className="gantt-header" style={{ display:'grid', gridTemplateColumns: `180px repeat(${daysCount}, minmax(32px, 1fr))` }}>
    <div className="gantt-label-col">Lodge</div>
    {monthDays.map((day, i) => (
      <div key={i} className={cn("gantt-day-header", isToday(day) && "gantt-today-header", isWeekend(day) && "gantt-weekend-header")}>
        <span className="gantt-day-num">{format(day, 'd')}</span>
        <span className="gantt-day-name">{format(day, 'EEE')}</span>
      </div>
    ))}
  </div>

  {/* Righe lodge */}
  {LODGES.map(lodge => {
    // buildCellMap(lodge, visibleBookings, monthDays) → Map<dayIndex, CellInfo>
    return (
      <div key={lodge} className="gantt-row" style={{ display:'grid', gridTemplateColumns: `180px repeat(${daysCount}, minmax(32px, 1fr))` }}>
        <div className="gantt-lodge-label">
          <span className="gantt-dot" style={{ background: LODGE_COLORS[lodge].dot }} />
          {lodge}
        </div>
        {renderLodgeCells(lodge, cellMap, monthDays, onCreate, onEdit)}
      </div>
    );
  })}
</div>
```

**Funzione `buildCellMap`:**
```ts
function buildCellMap(
  lodge: Lodge,
  bookings: Booking[],
  monthDays: Date[]
): Map<number, { booking: Booking; isFirst: boolean; span: number }> {
  const firstDay = startOfDay(monthDays[0]);
  const lastDay = startOfDay(monthDays[monthDays.length - 1]);
  const map = new Map();

  const lodgeBookings = bookings.filter(b => b.lodge === lodge && b.status !== 'cancelled');

  for (const booking of lodgeBookings) {
    const checkIn = startOfDay(parseISO(booking.checkIn));
    const checkOut = startOfDay(parseISO(booking.checkOut));

    const barStart = checkIn < firstDay ? firstDay : checkIn;
    const barEnd = checkOut > addDays(lastDay, 1) ? addDays(lastDay, 1) : checkOut;

    const startIdx = differenceInDays(barStart, firstDay);
    const span = differenceInDays(barEnd, barStart); // numero celle da occupare

    for (let i = startIdx; i < startIdx + span; i++) {
      map.set(i, {
        booking,
        isFirst: i === startIdx,
        span: i === startIdx ? span : 0, // span solo sulla prima cella
      });
    }
  }
  return map;
}
```

**Funzione `renderLodgeCells`:**
```tsx
function renderLodgeCells(lodge, cellMap, monthDays, onCreate, onEdit) {
  const cells = [];
  let i = 0;
  while (i < monthDays.length) {
    const info = cellMap.get(i);
    if (!info) {
      // cella libera
      cells.push(
        <div key={i} className="gantt-cell gantt-cell-empty" onClick={() => onCreate(lodge, monthDays[i])}>
          <span className="gantt-add">+</span>
        </div>
      );
      i++;
    } else if (info.isFirst) {
      const { booking, span } = info;
      const bc = barColors(booking.channel, booking.status);
      const nights = differenceInDays(parseISO(booking.checkOut), parseISO(booking.checkIn));
      const truncName = booking.guestName.length > 14 ? booking.guestName.slice(0,14)+'…' : booking.guestName;
      cells.push(
        <div
          key={i}
          className="gantt-cell gantt-cell-booked"
          style={{
            gridColumn: `span ${span}`,
            background: bc.bg,
            color: bc.text,
            borderLeft: `3px solid ${bc.text}`,
          }}
          onClick={() => onEdit(booking)}
          title={`${booking.guestName}\n${booking.checkIn} → ${booking.checkOut}\n${booking.totalAmount}€`}
        >
          <span className="gantt-cell-name">{truncName}</span>
          {span > 2 && <span className="gantt-cell-nights">{nights}n</span>}
          {span > 4 && <span className="gantt-cell-amount">{booking.totalAmount}€</span>}
          {booking.isNew && <span className="gantt-new-dot" />}
        </div>
      );
      i += span; // SKIP le celle interne già coperte da span
    } else {
      // cella interna — NON dovrebbe mai essere raggiunta grazie al salto con span
      // ma come safety net:
      i++;
    }
  }
  return cells;
}
```

**CSS da aggiungere in `globals.css`:**
```css
.gantt-wrap { overflow-x: auto; }

.gantt-header,
.gantt-row {
  display: grid;
  min-width: 0;
  border-bottom: 1px solid #e5e7eb;
}

.gantt-label-col {
  padding: 0 12px;
  font-weight: 600;
  font-size: 0.75rem;
  color: #6b7280;
  display: flex;
  align-items: center;
  background: #f9fafb;
  border-right: 2px solid #e5e7eb;
  position: sticky;
  left: 0;
  z-index: 10;
}

.gantt-day-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 4px 2px;
  font-size: 0.65rem;
  border-right: 1px solid #f3f4f6;
}
.gantt-today-header { background: rgba(59,130,246,0.08); font-weight: 700; }
.gantt-weekend-header { background: #fafafa; color: #9ca3af; }

.gantt-lodge-label {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  font-size: 0.8rem;
  font-weight: 600;
  background: #f9fafb;
  border-right: 2px solid #e5e7eb;
  min-height: 40px;
  position: sticky;
  left: 0;
  z-index: 10;
}
.gantt-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.gantt-cell {
  min-height: 40px;
  border-right: 1px solid #f3f4f6;
  display: flex;
  align-items: center;
  overflow: hidden;
}

.gantt-cell-empty {
  cursor: pointer;
  justify-content: center;
  color: #d1d5db;
  font-size: 1rem;
  transition: background 0.15s;
}
.gantt-cell-empty:hover {
  background: #f3f4f6;
  color: #6b7280;
}

.gantt-cell-booked {
  cursor: pointer;
  padding: 2px 6px;
  gap: 4px;
  border-radius: 3px;
  font-size: 0.72rem;
  font-weight: 600;
  white-space: nowrap;
  position: relative;
  z-index: 1;
  box-shadow: inset 0 0 0 1px rgba(0,0,0,0.06);
  transition: filter 0.1s;
}
.gantt-cell-booked:hover { filter: brightness(0.93); }

.gantt-cell-name { flex-shrink: 0; }
.gantt-cell-nights { font-size: 0.65rem; opacity: 0.8; margin-left: 4px; }
.gantt-cell-amount { font-size: 0.65rem; opacity: 0.8; margin-left: 4px; }

.gantt-new-dot {
  width: 6px; height: 6px;
  background: #22c55e;
  border-radius: 50%;
  position: absolute;
  top: 3px; right: 3px;
  animation: pulse 1.5s infinite;
}
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }

.gantt-add { font-size: 1.1rem; line-height: 1; pointer-events: none; }
```

**Rimuovere** dalla vecchia implementazione:
- Tutto il codice con `position: absolute`, `leftPct`, `widthPct`
- La classe `.gantt-bar`, `.gantt-bar-inner`, `.gantt-today-line` (non più necessarie)
- Non usare più `.gantt-cells-area` con `position:relative`

---

## TASK-02 — FRONTEND: UI della toolbar — bottoni mancanti
**Responsabile:** FRONTEND
**File:** `components/Toolbar.tsx`

Verifica che nella toolbar siano VISIBILI e funzionanti questi elementi (le funzioni in `page.tsx` esistono già, potrebbero mancare nella resa JSX):

### Pulsante NOTIFICHE (animate-pulse)
```tsx
{hasNewBookings && (
  <button
    onClick={() => { onClearNotification(); }}
    className="btn-notify"
    title={`${newBookingsCount} nuova/e prenotazione/i`}
  >
    <span className="notify-dot" />
    🔔 {newBookingsCount > 0 ? `+${newBookingsCount}` : ''} Nuova
  </button>
)}
```

CSS:
```css
.btn-notify {
  background: #22c55e;
  color: white;
  border: none;
  border-radius: 6px;
  padding: 6px 12px;
  font-weight: 700;
  cursor: pointer;
  animation: pulse-green 1.5s infinite;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8rem;
}
@keyframes pulse-green {
  0%,100% { box-shadow: 0 0 0 0 rgba(34,197,94,0.5); }
  50% { box-shadow: 0 0 0 8px rgba(34,197,94,0); }
}
```

### Pulsante iCal
```tsx
<button onClick={onCopyIcal} className="btn-action" title="Copia URL iCal">
  📅 iCal
</button>
```

### Pulsante Sync Locale → KV
```tsx
<button onClick={onSyncLocal} className="btn-action" title="Sincronizza prenotazioni locali al cloud">
  ☁️ Sync locale
</button>
```
(prop `onSyncLocal` da aggiungere — vedi TASK-03)

### Indicatore errore sync
```tsx
{syncError && (
  <span className="sync-error" title="Sincronizzazione fallita — dati mostrati potrebbero non essere aggiornati">
    ⚠ Offline
  </span>
)}
```

---

## TASK-03 — BACKEND: Merge locale → KV (22 prenotazioni)
**Responsabile:** BACKEND
**File:** `app/api/bookings/merge-local/route.ts` (nuovo), `lib/store.ts`

### Nuova API route POST /api/bookings/merge-local

```ts
// app/api/bookings/merge-local/route.ts
import { kv } from '@vercel/kv';
import { NextRequest, NextResponse } from 'next/server';
import type { Booking } from '@/lib/types';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  try {
    const { bookings: incoming }: { bookings: Booking[] } = await req.json();
    if (!Array.isArray(incoming)) {
      return NextResponse.json({ error: 'invalid payload' }, { status: 400 });
    }

    const current: Booking[] = (await kv.get<Booking[]>('bookings')) ?? [];
    const existingIds = new Set(current.map(b => b.id));

    const toAdd = incoming.filter(b => !existingIds.has(b.id));
    const merged = [...current, ...toAdd];

    await kv.set('bookings', merged);
    await kv.incr('bookings:version');

    return NextResponse.json({ merged: toAdd.length, total: merged.length });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
```

### Aggiunta in `lib/store.ts`

Aggiungere alla `BookingState`:
```ts
syncLocalToCloud: () => Promise<{ merged: number; total: number }>;
```

Implementazione nell'oggetto `create(...)`:
```ts
syncLocalToCloud: async () => {
  // Leggi le prenotazioni salvate in localStorage (chiave STORAGE_KEY)
  let local: Booking[] = [];
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (raw) local = JSON.parse(raw) as Booking[];
  } catch { local = []; }

  if (local.length === 0) {
    get().showToast('Nessuna prenotazione locale da sincronizzare.', 'error');
    return { merged: 0, total: 0 };
  }

  const res = await fetch('/api/bookings/merge-local', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ bookings: local }),
  });
  const data = await res.json();

  if (res.ok) {
    get().showToast(`Sync completata: ${data.merged} nuove prenotazioni aggiunte (totale: ${data.total}).`);
    await get().load(); // ricarica dal KV
  } else {
    get().showToast('Errore durante la sincronizzazione: ' + data.error, 'error');
  }
  return data;
},
```

In `page.tsx`, passare al Toolbar:
```tsx
onSyncLocal={() => syncLocalToCloud()}
```

---

## TASK-04 — BACKEND: iCal feed completo
**Responsabile:** BACKEND
**File:** `app/api/calendar/route.ts`

Verificare e correggere che il feed iCal:

1. Legga TUTTE le prenotazioni da KV (non filtrate per mese)
2. Generi un evento `VEVENT` per ogni prenotazione con:
   - `DTSTART;VALUE=DATE:YYYYMMDD` (formato data senza orario per eventi multi-giorno)
   - `DTEND;VALUE=DATE:YYYYMMDD` (checkOut)
   - `SUMMARY:${guestName} — ${lodge}`
   - `DESCRIPTION:${channel} | ${status} | ${guestsCount}p | ${totalAmount}€`
   - `UID:${booking.id}@villa-olimpia`
   - `STATUS:CONFIRMED` / `STATUS:CANCELLED`
3. Response header: `Content-Type: text/calendar; charset=utf-8`
4. Response header: `Content-Disposition: attachment; filename="villa-olimpia.ics"`

```ts
// Implementazione di riferimento:
export const runtime = 'edge';

export async function GET() {
  const { kv } = await import('@vercel/kv');
  const bookings: Booking[] = (await kv.get('bookings')) ?? [];

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Villa Olimpia//Booking Board//IT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Villa Olimpia Prenotazioni',
    'X-WR-TIMEZONE:Europe/Rome',
  ];

  for (const b of bookings) {
    const dtStart = b.checkIn.replace(/-/g, '');
    const dtEnd = b.checkOut.replace(/-/g, '');
    const status = b.status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED';
    lines.push(
      'BEGIN:VEVENT',
      `UID:${b.id}@villa-olimpia`,
      `DTSTART;VALUE=DATE:${dtStart}`,
      `DTEND;VALUE=DATE:${dtEnd}`,
      `SUMMARY:${b.guestName} — ${b.lodge}`,
      `DESCRIPTION:${b.channel} | ${b.status} | ${b.guestsCount}p | ${b.totalAmount}€`,
      `STATUS:${status}`,
      `LAST-MODIFIED:${b.updatedAt.replace(/[-:]/g, '').replace(/\.\d+/, '').replace('T', 'T')}Z`,
      'END:VEVENT'
    );
  }

  lines.push('END:VCALENDAR');

  return new Response(lines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="villa-olimpia.ics"',
      'Cache-Control': 'no-store',
    },
  });
}
```

---

## TASK-05 — DEVOPS: Build, env e deploy
**Responsabile:** DEVOPS

### Step 1 — Verifica .env.local
Il file `.env.local` contiene già tutte le variabili necessarie. Non modificarlo.

### Step 2 — Esegui build e fix TypeScript
```bash
cd /Users/francesconigro/Projects/villa-olimpia-booking-board
npm run build
```

Tutti gli errori TypeScript devono essere risolti. In particolare:
- `GanttBoard.tsx`: tipi delle props invariati (`GanttBoardProps`)
- `store.ts`: aggiungere `syncLocalToCloud` alla `BookingState` type
- `Toolbar.tsx`: aggiungere `onSyncLocal: () => void` alle props

### Step 3 — Commit e push
```bash
git add -A
git commit -m "fix: Gantt cell-based coloring, sync local→KV, iCal feed, notify button"
git push origin main
```
Vercel farà deploy automatico dal push su `main`.

---

## TASK-06 — QA: Checklist verifica finale
**Responsabile:** QA

Dopo il deploy, verificare su https://villa-olimpia-booking-board.vercel.app:

- [ ] Login con password `caccapanna73` → accesso alla board
- [ ] Gantt mostra celle **colorate** per tutte le prenotazioni nel mese
- [ ] Le celle libere mostrano `+` cliccabile → apre dialog prenotazione
- [ ] Celle occupate al click → apre dialog di editing
- [ ] Cambio mese → visualizzazione corretta del mese selezionato
- [ ] KPI Panel mostra prenotazioni del mese e fatturato
- [ ] Pulsante iCal → copia URL negli appunti + toast di conferma
- [ ] Pulsante "Sync locale" → chiamata POST /api/bookings/merge-local
- [ ] Su browser con prenotazioni locali → Sync porta le 22 prenotazioni totali
- [ ] Pulsante notifica lampeggiante verde quando arriva una nuova prenotazione da altro browser
- [ ] GET /api/calendar → restituisce un file .ics valido importabile in Google Calendar
- [ ] `npm run build` → 0 errori TypeScript

---

## NOTE PER GLI AGENTI CURSOR

1. **Non toccare** `lib/types.ts`, `components/BookingDialog.tsx`, `components/PasswordGate.tsx` — funzionano correttamente
2. **Non toccare** `app/api/bookings/route.ts`, `app/api/bookings/[id]/route.ts` — API CRUD già corrette
3. **Non toccare** `.env.local` — credenziali KV già presenti
4. **Non rimuovere** il `MigrationHelper` da `page.tsx` — serve per la migrazione iniziale localStorage→KV
5. **Il `BookingBoard.tsx`** (vista tabella per righe di giorno) non va modificato — è usato come vista alternativa ma non è montato nella home (la home usa `GanttBoard`)
6. **Il KV store è già collegato e funzionante** — non creare nuovi store né modificare le API esistenti, solo aggiungere `/api/bookings/merge-local`
7. **Non aggiungere dipendenze npm** — tutto è già installato (`date-fns`, `@vercel/kv`, `uuid`, `zustand`)
8. **CSS:** usare solo classi custom in `globals.css` — NON usare `@apply` con Tailwind nei componenti server/edge

---

## SCHEMA ARCHITETTURA CORRENTE

```
page.tsx
  └─ PasswordGate (auth)
  └─ MigrationHelper (one-time localStorage→KV)
  └─ Toolbar (navigazione mese, filtri, pulsanti azione)
  └─ KPIPanel (4 metriche mese corrente)
  └─ GanttBoard ← DA RISCRIVERE (visualizzazione calendar)
  └─ MonthSummary (tabella lodge × fatturato mese)
  └─ BookingDialog (modal inserimento/editing)
  └─ Toast (notifiche)

lib/store.ts (Zustand)
  ├─ load() → GET /api/bookings → popola bookings[]
  ├─ startPolling() → ogni 30s controlla /api/bookings/version
  ├─ addBooking() → POST /api/bookings
  ├─ updateBooking() → PUT /api/bookings/:id
  ├─ deleteBooking() → DELETE /api/bookings/:id
  └─ syncLocalToCloud() → POST /api/bookings/merge-local ← DA AGGIUNGERE

app/api/bookings/
  ├─ route.ts → GET (lista) + POST (crea)
  ├─ [id]/route.ts → PUT (aggiorna) + DELETE (elimina)
  ├─ version/route.ts → GET versione per polling
  ├─ migrate/route.ts → POST migrazione localStorage→KV
  └─ merge-local/route.ts ← DA CREARE

app/api/calendar/route.ts → iCal feed ← DA VERIFICARE/CORREGGERE
```

---

*Prompt generato il 2026-03-03 per il team Cursor AI — Villa Olimpia Booking Board*
