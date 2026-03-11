# 🚀 CURSOR AGENT — PROMPT DEFINITIVO
## Villa Olimpia Booking Board · Redesign Totale UI 2026

> **OBIETTIVO**: Trasformare questo progetto da un foglio Excel colorato a un'applicazione SaaS premium, visivamente spettacolare, vendibile come prodotto commerciale. Ogni singola sezione deve stupire. Niente mezze misure.

> **REGOLA AUREA**: Non toccare mai la logica di business (store.ts, types.ts, utils.ts). Non rompere nessuna funzionalità esistente. Esegui `npm run build` dopo ogni blocco di modifiche e risolvi tutti gli errori TypeScript prima di procedere. Zero errori = prerequisito per ogni deploy.

---

## PROBLEMA CRITICO DA RISOLVERE PRIMA DI TUTTO

### BUG: I dati non appaiono al primo caricamento locale

**Causa**: La funzione `load()` in `lib/store.ts` funziona correttamente, ma l'app non ha un meccanismo di "primo avvio garantito". Se il localStorage è vuoto o corrotto, l'utente vede la griglia vuota senza nessun messaggio.

**Fix da implementare in `lib/store.ts`**:
1. Verificare che `SEED_BOOKINGS` venga sempre caricato se localStorage è vuoto (già fatto, verificare che funzioni).
2. Aggiungere nel `load()` un log di debug temporaneo: `console.log('[Store] Loaded', migrated.length, 'bookings')` per diagnostica.
3. In `app/page.tsx`, aggiungere uno stato `isLoaded` che diventa `true` dopo il primo `useEffect([load])`. Finché `isLoaded === false`, mostrare uno skeleton loader animato invece della griglia vuota.

**Skeleton loader** (aggiungere in `page.tsx`):
```tsx
const [isLoaded, setIsLoaded] = useState(false);
useEffect(() => { load(); setIsLoaded(true); }, [load]);
// ...
{!isLoaded ? <LoadingSkeleton /> : <BookingBoard ... />}
```

**Componente `LoadingSkeleton`** (nuovo file `components/LoadingSkeleton.tsx`):
```tsx
export function LoadingSkeleton() {
  return (
    <div className="skeleton-wrap">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="skeleton-row" style={{ animationDelay: `${i * 0.06}s` }} />
      ))}
    </div>
  );
}
```
CSS per skeleton:
```css
.skeleton-wrap { display: grid; gap: 8px; padding: 16px; }
.skeleton-row { height: 52px; border-radius: 12px; background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%); background-size: 200% 100%; animation: shimmer 1.4s infinite; }
@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
```

---

## REDESIGN COMPLETO — ARCHITETTURA VISIVA

### PRINCIPI DEL NUOVO DESIGN

Il progetto attuale ha la griglia **date in righe × lodge in colonne**. Questo produce un foglio Excel. Un vero sistema di booking professionale (Airbnb Host Calendar, Booking.com Extranet, Lodgify, Guesty) usa la vista **Gantt orizzontale: lodge in righe × date in colonne con barre colorate che si estendono su più giorni**.

Questa è la trasformazione principale. Non è opzionale. È ciò che fa sembrare l'app un prodotto reale.

---

## TRASFORMAZIONE 1 — IL SISTEMA DI COLORI (implementare subito in `globals.css`)

Sostituire il sistema a variabile singola `--accent` con un sistema di design tokens ricco:

```css
:root {
  color-scheme: light;

  /* === PALETTE PRIMARIA === */
  --brand-50:  #eef2ff;
  --brand-100: #e0e7ff;
  --brand-500: #6366f1;   /* Indigo vibrante */
  --brand-600: #4f46e5;
  --brand-700: #4338ca;
  --brand-900: #1e1b4b;

  /* === SUPERFICI === */
  --bg:        #f8f7ff;
  --bg-2:      #f1f0fa;
  --panel:     #ffffff;
  --panel-2:   rgba(255,255,255,0.7);
  --glass:     rgba(255,255,255,0.55);
  --glass-border: rgba(255,255,255,0.8);

  /* === TESTO === */
  --text:      #0f172a;
  --text-2:    #334155;
  --muted:     #94a3b8;
  --line:      #e2e8f0;

  /* === ACCENTO (usato per tema mese) === */
  --accent:       var(--brand-600);
  --accent-light: var(--brand-50);
  --accent-faint: rgba(99,102,241,0.07);

  /* === STATI BOOKING === */
  --status-confirmed:  #059669;
  --status-option:     #d97706;
  --status-blocked:    #64748b;
  --status-cancelled:  #dc2626;

  /* === LODGE COLORS (una per lodge, coerente) === */
  --lodge-frangipane: #8b5cf6;
  --lodge-fiordaliso:  #3b82f6;
  --lodge-giglio:      #10b981;
  --lodge-tulipano:    #f43f5e;
  --lodge-orchidea:    #ec4899;
  --lodge-lavanda:     #a78bfa;
  --lodge-geranio:     #f97316;
  --lodge-gardenia:    #14b8a6;
  --lodge-azalea:      #e11d48;

  /* === SHADOWS (elevazione a più livelli) === */
  --shadow-xs:  0 1px 2px rgba(0,0,0,0.05);
  --shadow-sm:  0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06);
  --shadow-md:  0 4px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.06);
  --shadow-lg:  0 10px 25px rgba(0,0,0,0.1), 0 4px 10px rgba(0,0,0,0.05);
  --shadow-xl:  0 20px 50px rgba(0,0,0,0.12), 0 8px 20px rgba(0,0,0,0.06);
  --shadow-glow: 0 0 0 3px rgba(99,102,241,0.2);

  /* === RADIUS === */
  --r-sm: 8px;
  --r-md: 12px;
  --r-lg: 16px;
  --r-xl: 20px;
  --r-2xl: 24px;

  /* === TRANSITIONS === */
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

Aggiornare in `utils.ts` i colori di `statusColors` per usare i nuovi valori:
```typescript
export const statusColors: Record<Booking["status"], string> = {
  confirmed: "#059669",
  option:    "#d97706",
  blocked:   "#64748b",
  cancelled: "#dc2626",
};
```

---

## TRASFORMAZIONE 2 — SFONDO E LAYOUT PAGINA (`globals.css`)

```css
html, body {
  margin: 0; padding: 0; min-height: 100vh;
  background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 40%, #312e81 70%, #4c1d95 100%);
  background-attachment: fixed;
  color: var(--text);
  font-family: "Inter", "Avenir Next", -apple-system, sans-serif;
}

/* Aggiungere in <head> via layout.tsx: <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" /> */

.page-root {
  padding: 20px;
  display: grid;
  gap: 16px;
  max-width: 1800px;
  margin: 0 auto;
}
```

---

## TRASFORMAZIONE 3 — IL PANNELLO HEADER (GLASSMORPHISM)

**File**: `app/globals.css` — sezione `.toolbar`

```css
.toolbar {
  background: var(--glass);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid var(--glass-border);
  border-radius: var(--r-xl);
  padding: 16px 20px;
  display: grid;
  gap: 14px;
  box-shadow: var(--shadow-lg), inset 0 1px 0 rgba(255,255,255,0.6);
  position: relative;
  overflow: hidden;
}

/* Effetto shimmer sottile sull'header */
.toolbar::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.8), transparent);
}

.title-row h1 {
  margin: 0;
  font-size: 1.35rem;
  font-weight: 800;
  letter-spacing: -0.03em;
  background: linear-gradient(135deg, var(--brand-700) 0%, var(--brand-500) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
```

---

## TRASFORMAZIONE 4 — KPI CARDS PREMIUM (sostituire `SummaryBar.tsx`)

**Distruggere** il vecchio `SummaryBar` e rimpiazzarlo con un sistema di KPI cards visivamente impattante.

**Nuovo file**: `components/KPIPanel.tsx`

```tsx
"use client";
import { motion } from "framer-motion"; // aggiungere: npm install framer-motion
import { TrendingUp, BedDouble, Euro, Wallet, BarChart3 } from "lucide-react";
import { formatMoney } from "@/lib/utils";

type KPIPanelProps = {
  visibleCount: number;
  monthTotal: number;
  monthDeposits: number;
  monthOccupancy: number;
  monthDate: Date;
};

export function KPIPanel({ visibleCount, monthTotal, monthDeposits, monthOccupancy, monthDate }: KPIPanelProps) {
  const cards = [
    { icon: BedDouble, label: "Prenotazioni", value: String(visibleCount), sub: "visibili", color: "var(--brand-600)", bg: "var(--brand-50)" },
    { icon: Euro, label: "Fatturato mese", value: formatMoney(monthTotal), sub: "totale confermato", color: "#059669", bg: "#f0fdf4" },
    { icon: Wallet, label: "Caparre ricevute", value: formatMoney(monthDeposits), sub: "incassate", color: "#d97706", bg: "#fffbeb" },
    { icon: BarChart3, label: "Occupancy", value: `${monthOccupancy}%`, sub: "del mese", color: monthOccupancy < 40 ? "#059669" : monthOccupancy < 70 ? "#d97706" : "#dc2626", bg: "#f8fafc" },
  ];

  return (
    <div className="kpi-panel">
      {cards.map((card, i) => (
        <div key={card.label} className="kpi-card" style={{ animationDelay: `${i * 0.07}s` }}>
          <div className="kpi-icon-wrap" style={{ background: card.bg, color: card.color }}>
            <card.icon size={20} strokeWidth={2} />
          </div>
          <div className="kpi-body">
            <div className="kpi-label">{card.label}</div>
            <div className="kpi-value" style={{ color: card.color }}>{card.value}</div>
            <div className="kpi-sub">{card.sub}</div>
          </div>
          {card.label === "Occupancy" && (
            <div className="kpi-ring-wrap">
              <svg width="48" height="48" viewBox="0 0 48 48">
                <circle cx="24" cy="24" r="20" fill="none" stroke={card.bg} strokeWidth="4" />
                <circle cx="24" cy="24" r="20" fill="none" stroke={card.color} strokeWidth="4"
                  strokeDasharray={`${monthOccupancy * 1.257} 125.7`}
                  strokeLinecap="round"
                  transform="rotate(-90 24 24)"
                  style={{ transition: 'stroke-dasharray 0.8s var(--ease-out)' }}
                />
              </svg>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
```

**CSS per KPI Panel** (in `globals.css`):
```css
.kpi-panel {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}
@media (max-width: 900px) { .kpi-panel { grid-template-columns: repeat(2,1fr); } }
@media (max-width: 500px) { .kpi-panel { grid-template-columns: 1fr; } }

.kpi-card {
  background: var(--glass);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  border-radius: var(--r-lg);
  padding: 16px;
  display: flex;
  align-items: flex-start;
  gap: 14px;
  box-shadow: var(--shadow-md), inset 0 1px 0 rgba(255,255,255,0.5);
  animation: fadeSlideUp 0.4s var(--ease-out) both;
  position: relative;
  overflow: hidden;
  transition: transform 0.2s var(--ease-spring), box-shadow 0.2s ease;
}
.kpi-card:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow-lg), inset 0 1px 0 rgba(255,255,255,0.7);
}
.kpi-icon-wrap {
  width: 44px; height: 44px; border-radius: var(--r-md);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  box-shadow: var(--shadow-sm);
}
.kpi-body { flex: 1; }
.kpi-label { font-size: 0.72rem; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); margin-bottom: 4px; }
.kpi-value { font-size: 1.4rem; font-weight: 800; letter-spacing: -0.03em; line-height: 1; margin-bottom: 2px; }
.kpi-sub { font-size: 0.72rem; color: var(--muted); }
.kpi-ring-wrap { position: absolute; bottom: 10px; right: 10px; opacity: 0.4; }

@keyframes fadeSlideUp {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

**Aggiornare `Toolbar.tsx`**: rimuovere `<SummaryBar>` e sostituire con `<KPIPanel>`. Passare i props necessari. Spostare `KPIPanel` FUORI dal toolbar, renderizzarlo come sezione separata in `page.tsx` tra toolbar e griglia.

---

## TRASFORMAZIONE 5 — LA GRIGLIA GANTT (il cambiamento più importante)

### Questo è il cuore del redesign. La tabella attuale va sostituita.

**Nuovo approccio**: Lodge in righe, Giorni in colonne. Le prenotazioni sono **barre colorate** che si estendono su più celle usando CSS Grid con `grid-column: span N`.

**Nuovo file**: `components/GanttBoard.tsx` (sostituisce `BookingBoard.tsx`)

La struttura visiva:
- Header fisso in cima: logo lodge | giorno 1 | giorno 2 | ... | giorno N
- Ogni riga = un lodge con sfondo colorato leggero
- Le prenotazioni sono pill/barre colorate posizionate in modo preciso
- Le celle vuote mostrano un bottone `+` sottile
- Il giorno odierno ha una linea verticale blu animata
- Weekend hanno sfondo leggermente diverso

**Implementazione dettagliata**:

```tsx
"use client";
import { addDays, differenceInDays, format, getDay, isSameDay, parseISO, startOfDay } from "date-fns";
import { useMemo, useRef } from "react";
import type { Booking, BookingFilters, Lodge } from "@/lib/types";
import { LODGES } from "@/lib/types";
import { bookingTooltip, channelBadge, formatMoney, matchesFilters, statusColors } from "@/lib/utils";

// Colori per lodge (deve corrispondere con globals.css)
const LODGE_COLORS: Record<Lodge, { bg: string; text: string; dot: string }> = {
  Frangipane: { bg: "#f5f3ff", text: "#5b21b6", dot: "#8b5cf6" },
  Fiordaliso:  { bg: "#eff6ff", text: "#1d4ed8", dot: "#3b82f6" },
  Giglio:      { bg: "#f0fdf4", text: "#065f46", dot: "#10b981" },
  Tulipano:    { bg: "#fff1f2", text: "#9f1239", dot: "#f43f5e" },
  Orchidea:    { bg: "#fdf2f8", text: "#9d174d", dot: "#ec4899" },
  Lavanda:     { bg: "#f5f3ff", text: "#4c1d95", dot: "#a78bfa" },
  Geranio:     { bg: "#fff7ed", text: "#9a3412", dot: "#f97316" },
  Gardenia:    { bg: "#f0fdfa", text: "#134e4a", dot: "#14b8a6" },
  Azalea:      { bg: "#fff1f2", text: "#881337", dot: "#e11d48" },
};

type GanttBoardProps = {
  monthDays: Date[];
  bookings: Booking[];
  filters: BookingFilters;
  onCreate: (lodge: Lodge, day: Date) => void;
  onEdit: (booking: Booking) => void;
};

export function GanttBoard({ monthDays, bookings, filters, onCreate, onEdit }: GanttBoardProps) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const todayIndex = useMemo(() => monthDays.findIndex(d => isSameDay(d, today)), [monthDays, today]);

  const visibleBookings = useMemo(
    () => bookings.filter(b => matchesFilters(b, filters)),
    [bookings, filters]
  );

  // Per ogni lodge: lista di {booking, startCol (0-based), spanCols}
  const lodgeRows = useMemo(() => {
    return LODGES.map(lodge => {
      const lodgeBookings = visibleBookings.filter(b => b.lodge === lodge && b.status !== "cancelled");
      const bars = lodgeBookings.map(booking => {
        const checkIn = startOfDay(parseISO(booking.checkIn));
        const checkOut = startOfDay(parseISO(booking.checkOut));
        const firstDay = startOfDay(monthDays[0]);
        const lastDay = startOfDay(monthDays[monthDays.length - 1]);

        // Clip al mese visualizzato
        const barStart = checkIn < firstDay ? firstDay : checkIn;
        const barEnd = checkOut > addDays(lastDay, 1) ? addDays(lastDay, 1) : checkOut;

        const startCol = differenceInDays(barStart, firstDay);
        const spanCols = differenceInDays(barEnd, barStart);
        const totalNights = differenceInDays(checkOut, checkIn);

        return { booking, startCol, spanCols, totalNights };
      }).filter(b => b.spanCols > 0);

      return { lodge, bars };
    });
  }, [visibleBookings, monthDays]);

  // Stile della griglia: N+1 colonne (1 per label lodge + N giorni)
  const gridCols = `180px repeat(${monthDays.length}, minmax(36px, 1fr))`;

  return (
    <div className="gantt-wrap">
      {/* HEADER GIORNI */}
      <div className="gantt-header" style={{ display: "grid", gridTemplateColumns: gridCols }}>
        <div className="gantt-header-label">Lodge</div>
        {monthDays.map((day, i) => {
          const isToday = isSameDay(day, today);
          const isWeekend = getDay(day) === 0 || getDay(day) === 6;
          return (
            <div key={i} className={[
              "gantt-day-header",
              isToday && "gantt-day-today",
              isWeekend && "gantt-day-weekend",
            ].filter(Boolean).join(" ")}>
              <span className="gantt-day-num">{format(day, "d")}</span>
              <span className="gantt-day-name">{format(day, "EEE")}</span>
            </div>
          );
        })}
      </div>

      {/* RIGHE LODGE */}
      <div className="gantt-body">
        {lodgeRows.map(({ lodge, bars }) => {
          const lc = LODGE_COLORS[lodge];
          return (
            <div key={lodge} className="gantt-row" style={{ gridTemplateColumns: gridCols }}>
              {/* Label lodge */}
              <div className="gantt-lodge-label" style={{ background: lc.bg, color: lc.text }}>
                <span className="gantt-lodge-dot" style={{ background: lc.dot }} />
                <span className="gantt-lodge-name">{lodge}</span>
              </div>

              {/* Celle giorno + barre booking */}
              <div className="gantt-cells-area" style={{ gridColumn: `2 / span ${monthDays.length}`, display: "grid", gridTemplateColumns: `repeat(${monthDays.length}, minmax(36px, 1fr))`, position: "relative" }}>
                {/* Sfondo celle */}
                {monthDays.map((day, i) => {
                  const isToday = isSameDay(day, today);
                  const isWeekend = getDay(day) === 0 || getDay(day) === 6;
                  const hasBooking = bars.some(b => i >= b.startCol && i < b.startCol + b.spanCols);
                  return (
                    <div key={i} className={["gantt-cell", isToday && "gantt-cell-today", isWeekend && "gantt-cell-weekend"].filter(Boolean).join(" ")}
                      onClick={!hasBooking ? () => onCreate(lodge, day) : undefined}
                    >
                      {!hasBooking && <span className="gantt-add-btn">+</span>}
                    </div>
                  );
                })}

                {/* Barre booking */}
                {bars.map(({ booking, startCol, spanCols, totalNights }) => {
                  const statusColor = statusColors[booking.status];
                  const cBadge = channelBadge[booking.channel];
                  const residue = Math.max(0, booking.totalAmount - booking.depositAmount);
                  return (
                    <div
                      key={booking.id}
                      className="gantt-bar"
                      title={bookingTooltip(booking)}
                      onClick={() => onEdit(booking)}
                      style={{
                        gridColumn: `${startCol + 1} / span ${spanCols}`,
                        background: `linear-gradient(135deg, ${statusColor}22 0%, ${statusColor}15 100%)`,
                        borderLeft: `3px solid ${statusColor}`,
                        borderTop: `1px solid ${statusColor}44`,
                        borderRight: `1px solid ${statusColor}22`,
                        borderBottom: `1px solid ${statusColor}22`,
                      }}
                    >
                      <div className="gantt-bar-inner">
                        <span className="gantt-bar-name">{booking.guestName}</span>
                        {spanCols > 3 && (
                          <span className="gantt-bar-meta">
                            {totalNights}n · {formatMoney(booking.totalAmount)}
                            {booking.depositReceived ? " ✓" : booking.depositAmount > 0 ? " ⚠" : ""}
                          </span>
                        )}
                        {spanCols > 5 && (
                          <span className="gantt-bar-channel" style={{ background: cBadge.bg, color: cBadge.text }}>
                            {booking.channel}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Linea TODAY */}
                {todayIndex >= 0 && (
                  <div className="gantt-today-line" style={{ gridColumn: todayIndex + 1 }} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

**CSS GANTT** (aggiungere in `globals.css`, sostituire `.board-wrap` e `.booking-table`):

```css
/* === GANTT BOARD === */
.gantt-wrap {
  background: var(--glass);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  border-radius: var(--r-xl);
  overflow: hidden;
  box-shadow: var(--shadow-xl), inset 0 1px 0 rgba(255,255,255,0.6);
}

.gantt-header {
  background: rgba(15, 23, 42, 0.85);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(255,255,255,0.1);
  position: sticky;
  top: 0;
  z-index: 20;
}

.gantt-header-label {
  padding: 10px 16px;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.5);
  border-right: 1px solid rgba(255,255,255,0.1);
  display: flex;
  align-items: center;
}

.gantt-day-header {
  padding: 8px 4px;
  text-align: center;
  border-right: 1px solid rgba(255,255,255,0.07);
  transition: background 0.15s;
  cursor: default;
}
.gantt-day-header:last-child { border-right: none; }

.gantt-day-num {
  display: block;
  font-size: 0.9rem;
  font-weight: 700;
  color: rgba(255,255,255,0.9);
  line-height: 1;
}

.gantt-day-name {
  display: block;
  font-size: 0.62rem;
  font-weight: 500;
  color: rgba(255,255,255,0.4);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-top: 2px;
}

.gantt-day-weekend .gantt-day-num { color: #a78bfa; }
.gantt-day-weekend .gantt-day-name { color: #7c3aed44; }
.gantt-day-today { background: rgba(99,102,241,0.25) !important; border-radius: 6px; }
.gantt-day-today .gantt-day-num { color: #a5b4fc; }

.gantt-body {
  overflow-x: auto;
  overflow-y: visible;
}

.gantt-row {
  display: grid;
  border-bottom: 1px solid var(--line);
  min-height: 72px;
  transition: background 0.15s;
  position: relative;
}
.gantt-row:last-child { border-bottom: none; }
.gantt-row:hover { background: rgba(99,102,241,0.025); }

.gantt-lodge-label {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 16px;
  border-right: 1px solid var(--line);
  position: sticky;
  left: 0;
  z-index: 10;
  backdrop-filter: blur(8px);
  min-width: 180px;
}

.gantt-lodge-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 0 0 3px currentColor;
  box-shadow: 0 0 8px 1px currentColor;
  opacity: 0.7;
}

.gantt-lodge-name {
  font-weight: 700;
  font-size: 0.85rem;
  letter-spacing: -0.01em;
}

.gantt-cells-area {
  position: relative;
  min-height: 72px;
}

.gantt-cell {
  min-height: 72px;
  border-right: 1px solid var(--line);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.12s;
  position: relative;
}
.gantt-cell:last-child { border-right: none; }
.gantt-cell:hover { background: var(--accent-light); }
.gantt-cell-today { background: rgba(99,102,241,0.06) !important; }
.gantt-cell-weekend { background: rgba(167,139,250,0.04); }

.gantt-add-btn {
  font-size: 1.1rem;
  font-weight: 300;
  color: var(--muted);
  opacity: 0;
  transition: opacity 0.15s;
  user-select: none;
}
.gantt-cell:hover .gantt-add-btn { opacity: 1; }

/* BARRA BOOKING */
.gantt-bar {
  position: absolute;
  top: 8px;
  bottom: 8px;
  border-radius: 10px;
  cursor: pointer;
  z-index: 5;
  transition: transform 0.15s var(--ease-spring), box-shadow 0.15s ease, filter 0.15s;
  box-shadow: var(--shadow-sm);
  overflow: hidden;
  min-width: 0;
}
.gantt-bar:hover {
  transform: translateY(-2px) scaleY(1.03);
  box-shadow: var(--shadow-lg);
  filter: brightness(1.05);
  z-index: 15;
}

.gantt-bar-inner {
  padding: 6px 10px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  height: 100%;
  justify-content: center;
}

.gantt-bar-name {
  font-size: 0.8rem;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--text);
}

.gantt-bar-meta {
  font-size: 0.68rem;
  color: var(--text-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.gantt-bar-channel {
  display: inline-block;
  font-size: 0.6rem;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 4px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  width: fit-content;
}

.gantt-today-line {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: linear-gradient(180deg, #6366f1 0%, #8b5cf6 100%);
  box-shadow: 0 0 8px rgba(99,102,241,0.6);
  z-index: 20;
  pointer-events: none;
  animation: todayPulse 2s ease-in-out infinite;
}
@keyframes todayPulse {
  0%, 100% { opacity: 1; box-shadow: 0 0 8px rgba(99,102,241,0.6); }
  50% { opacity: 0.7; box-shadow: 0 0 16px rgba(99,102,241,0.9); }
}
```

**In `page.tsx`**: sostituire `<BookingBoard>` con `<GanttBoard>`. Assicurarsi che props siano identici (stessa firma). Il vecchio `BookingBoard.tsx` può essere mantenuto come fallback ma non renderizzato.

---

## TRASFORMAZIONE 6 — RIEPILOGO MENSILE PREMIUM (`MonthSummary.tsx`)

Il riepilogo attuale è una tabella HTML basica. Sostituirla con un pannello premium con barre animate.

```tsx
// MonthSummary.tsx — sezione visiva
// Aggiungere animazioni CSS alla barra di occupancy
// Usare progress bar con gradiente invece di barra piatta
// Aggiungere icona lodge colorata (dot colorato per lodge)
// Aggiungere mini sparkline (svg) se possibile
```

**CSS aggiornato per MonthSummary**:
```css
.month-summary {
  background: var(--glass);
  backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  border-radius: var(--r-xl);
  padding: 20px;
  box-shadow: var(--shadow-lg), inset 0 1px 0 rgba(255,255,255,0.5);
  animation: fadeSlideUp 0.5s var(--ease-out) 0.2s both;
}

.month-summary-title {
  font-size: 0.95rem; font-weight: 800; margin: 0 0 16px;
  letter-spacing: -0.02em;
  color: var(--text);
  display: flex; align-items: center; gap: 8px;
}

.summary-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
.summary-table th {
  text-align: left; font-size: 0.65rem; font-weight: 700;
  letter-spacing: 0.09em; text-transform: uppercase; color: var(--muted);
  padding: 0 10px 10px; border-bottom: 1.5px solid var(--line);
}
.summary-table td { padding: 9px 10px; border-bottom: 1px solid rgba(0,0,0,0.04); vertical-align: middle; }
.summary-table tr:hover td { background: var(--accent-light); }
.summary-table tr:last-child td { border-bottom: none; background: var(--accent-light); border-radius: var(--r-sm); }

.occ-bar { height: 8px; border-radius: 999px; background: var(--line); overflow: hidden; min-width: 80px; }
.occ-bar-fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent) 70%, #fff));
  transition: width 0.8s var(--ease-out);
  animation: barGrow 0.8s var(--ease-out) both;
}
@keyframes barGrow { from { width: 0 !important; } }
```

---

## TRASFORMAZIONE 7 — TOOLBAR E NAVIGAZIONE

**File**: `components/MonthNavigation.tsx`

Sostituire i `<select>` HTML nativi con un design più premium — bottoni freccia con animazione, badge mese con gradiente:

```css
/* Navigazione mese */
.month-nav-btn {
  width: 36px; height: 36px;
  border-radius: 10px;
  background: rgba(255,255,255,0.15);
  border: 1px solid rgba(255,255,255,0.2);
  color: var(--text);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  transition: all 0.15s var(--ease-spring);
  backdrop-filter: blur(8px);
}
.month-nav-btn:hover { background: rgba(255,255,255,0.3); transform: scale(1.1); }

.month-badge {
  font-size: 1.1rem; font-weight: 800; letter-spacing: -0.03em;
  color: var(--text);
  background: var(--glass);
  padding: 6px 16px;
  border-radius: 10px;
  border: 1px solid var(--glass-border);
  text-transform: capitalize;
}
```

**Bottone "+ Nuova Prenotazione"** — deve essere prominente, colorato, con icona animata:
```css
.primary-btn {
  background: linear-gradient(135deg, var(--brand-600), var(--brand-500));
  border: none;
  color: #fff;
  font-weight: 700;
  font-size: 0.9rem;
  padding: 10px 18px;
  border-radius: var(--r-md);
  box-shadow: 0 4px 14px rgba(99,102,241,0.4);
  transition: all 0.2s var(--ease-spring);
  display: inline-flex; align-items: center; gap: 8px;
}
.primary-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(99,102,241,0.5);
  background: linear-gradient(135deg, var(--brand-700), var(--brand-600));
}
.primary-btn:active { transform: translateY(0); }
```

---

## TRASFORMAZIONE 8 — DIALOG DI PRENOTAZIONE (`BookingDialog.tsx`)

Il dialog attuale è funzionale ma visivamente neutro. Renderlo premium:

```css
.dialog-content {
  background: rgba(255,255,255,0.97);
  backdrop-filter: blur(30px);
  border: 1px solid rgba(255,255,255,0.9);
  border-radius: var(--r-2xl);
  box-shadow: var(--shadow-xl), 0 0 0 1px rgba(99,102,241,0.08);
  animation: dialogIn 0.25s var(--ease-spring);
}
@keyframes dialogIn {
  from { opacity: 0; transform: translate(-50%,-52%) scale(0.96); }
  to   { opacity: 1; transform: translate(-50%,-50%) scale(1); }
}

.dialog-overlay {
  background: rgba(15,23,42,0.6);
  backdrop-filter: blur(4px);
  animation: overlayIn 0.2s ease;
}
@keyframes overlayIn { from { opacity: 0; } to { opacity: 1; } }

.dialog-header {
  padding-bottom: 14px;
  border-bottom: 1px solid var(--line);
  margin-bottom: 4px;
}
.dialog-header [data-radix-dialog-title] {
  font-size: 1.2rem; font-weight: 800; letter-spacing: -0.02em;
  background: linear-gradient(135deg, var(--brand-700), var(--brand-500));
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
}

.form-section {
  border: 1.5px solid var(--line);
  border-radius: var(--r-md);
  padding: 14px 16px;
  background: #fafbff;
  transition: border-color 0.15s;
}
.form-section:focus-within { border-color: var(--brand-400); box-shadow: var(--shadow-glow); }

input:focus, select:focus, textarea:focus {
  outline: none;
  border-color: var(--brand-500);
  box-shadow: 0 0 0 3px rgba(99,102,241,0.15);
}
```

---

## TRASFORMAZIONE 9 — TOAST E MICRO-ANIMAZIONI

**File**: `components/Toast.tsx` — verificare e aggiornare CSS:

```css
.toast {
  position: fixed; bottom: 24px; right: 24px; z-index: 999;
  background: rgba(15,23,42,0.92);
  backdrop-filter: blur(16px);
  color: #fff;
  border-radius: var(--r-lg);
  padding: 14px 20px;
  font-size: 0.9rem; font-weight: 500;
  box-shadow: var(--shadow-xl);
  border: 1px solid rgba(255,255,255,0.1);
  animation: toastIn 0.3s var(--ease-spring);
  display: flex; align-items: center; gap: 10px;
  max-width: 360px;
}
@keyframes toastIn {
  from { opacity: 0; transform: translateY(20px) scale(0.9); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
.toast.success { border-left: 3px solid #059669; }
.toast.error { border-left: 3px solid #dc2626; }
```

---

## TRASFORMAZIONE 10 — INSTALLAZIONE DIPENDENZE

Eseguire nell'ordine:
```bash
npm install framer-motion
npm install @fontsource/inter
```

In `app/layout.tsx`, aggiungere nel `<head>`:
```tsx
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
```

---

## ORDINE PRECISO DI IMPLEMENTAZIONE

> Ogni step si conclude con `npm run build` → zero errori → poi si procede

**STEP 1** — Fix data loading (skeleton + log debug)
→ `npm run build` ✅

**STEP 2** — Nuovo sistema di variabili CSS in `globals.css` (sezione `:root`)
→ Verificare che l'app non si rompa visivamente

**STEP 3** — Nuovi stili sfondo, toolbar glassmorphism, bottoni premium
→ `npm run build` ✅

**STEP 4** — Implementare `KPIPanel.tsx`, aggiornare `Toolbar.tsx` e `page.tsx`
→ Rimuovere `SummaryBar` dai componenti renderizzati (mantenere il file per sicurezza)
→ `npm run build` ✅

**STEP 5** — Implementare `GanttBoard.tsx` completo
→ Aggiungere tutti i CSS Gantt in `globals.css`
→ In `page.tsx` sostituire `<BookingBoard>` con `<GanttBoard>` (stessa firma props)
→ `npm run build` ✅
→ Test visivo: tutte le prenotazioni appaiono come barre colorate?

**STEP 6** — Aggiornare `MonthSummary.tsx` con stile premium e animazioni
→ `npm run build` ✅

**STEP 7** — Aggiornare dialog, toast, micro-animazioni
→ `npm run build` ✅

**STEP 8** — Font Inter, verifica su viewport mobile
→ Test finale: `npm run build` ✅ → apertura browser → navigazione mesi → apertura dialog → creazione prenotazione → verifica che appaia nel Gantt

---

## CHECKLIST FINALE PRE-DEPLOY

- [ ] `npm run build` senza errori TypeScript
- [ ] La griglia Gantt mostra le prenotazioni come barre che si estendono su più giorni
- [ ] Le KPI card mostrano i dati del mese corrente (non globali)
- [ ] La linea "oggi" è visibile e animata nella griglia Gantt
- [ ] Il dialog di prenotazione si apre con animazione fluida
- [ ] Creazione prenotazione: la barra appare nella Gantt
- [ ] Eliminazione prenotazione: richiede conferma
- [ ] Filtri funzionano: le barre scompaiono/appaiono correttamente
- [ ] Navigazione tra mesi: animazione fluida, dati corretti
- [ ] Mobile (< 768px): toolbar non si rompe, Gantt è scrollabile orizzontalmente
- [ ] Print: la sezione `.no-print` è nascosta, la Gantt è visibile in B&W

---

*Prompt generato per Cursor Agents — Villa Olimpia Booking Board · Redesign 2026*
