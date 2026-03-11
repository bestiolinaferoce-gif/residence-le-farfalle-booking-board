# 🏨 Villa Olimpia Booking Board — Super Prompt per Migliorie UI/UX

> **REGOLA FONDAMENTALE**: Non distruggere mai ciò che funziona. Ogni modifica deve essere verificata. Esegui il build (`npm run build`) dopo ogni gruppo di modifiche e correggi eventuali errori TypeScript prima di procedere.

---

## CONTESTO DEL PROGETTO

Applicazione Next.js + TypeScript + Zustand per la gestione delle prenotazioni di Villa Olimpia (9 lodge). Usa localStorage per la persistenza, `date-fns` per le date, Radix UI per dialog/popover, Lucide React per le icone, CSS plain (no Tailwind).

---

## BUG DA CORREGGERE (priorità alta — NON cambiare logica, solo fix mirati)

### BUG 1 — Eliminazione prenotazione senza conferma
**File**: `components/BookingDialog.tsx`, riga 271–279
**Problema**: Il bottone "Elimina" cancella immediatamente senza chiedere conferma. Il componente `ConfirmDialog` esiste già e NON viene usato qui.
**Fix**: Aggiungere uno stato locale `const [deleteConfirm, setDeleteConfirm] = useState(false)`. Al click su "Elimina" aprire un `ConfirmDialog` inline (o usare `window.confirm` come fallback minimo) con il messaggio `"Vuoi eliminare la prenotazione di {booking.guestName}? L'azione è irreversibile."`. Solo alla conferma eseguire `onDelete(booking.id); onClose()`.

### BUG 2 — Icona errata nelle Summary card
**File**: `components/SummaryBar.tsx`, righe 22 e 26
**Problema**: Le card "Totale" e "Caparre" usano entrambe l'icona `Filter` (che non ha senso semantico).
**Fix**: Importare `Euro` e `Landmark` (o `Wallet`) da `lucide-react` e sostituire le due icone `Filter` con `Euro` per "Totale" e `Landmark` per "Caparre".

### BUG 3 — Legenda stato mostra chiavi raw in inglese
**File**: `components/SummaryBar.tsx`, riga 42
**Problema**: La Legenda mostra "confirmed", "option", "blocked", "cancelled" anziché le etichette italiane.
**Fix**: Importare `statusLabels` da `@/lib/utils` e usare `statusLabels[status]` al posto di `{status}` nel `<li>`.

### BUG 4 — La SummaryBar mostra totali globali, non del mese corrente
**File**: `app/page.tsx`, righe 148–155
**Problema**: `visibleSummary` calcola totali su TUTTE le prenotazioni filtrate per status/canale ma NON per il mese visualizzato. L'utente vede "Totale €X" che comprende prenotazioni di altri mesi.
**Fix**: Nel `useMemo` di `visibleSummary`, aggiungere un filtro per il mese corrente PRIMA di calcolare i totali. Usare `monthDays[0]` e `monthDays[monthDays.length-1]` come range. Il contatore "Prenotazioni visibili" può restare globale (prenotazioni che matchano i filtri), ma aggiungere due valori separati `monthTotal` e `monthDeposits` che mostrano solo le prenotazioni attive nel mese visualizzato (usando `isActiveOnDay` o verificando sovrapposizione con il range del mese). Passarli come props aggiuntivi a `SummaryBar` come `monthTotal` e `monthDeposits`.

### BUG 5 — CSS duplicato per `.booking-chip`
**File**: `app/globals.css`
**Problema**: `.booking-chip` è definito due volte (righe 277–289 e 552–558). La seconda definizione sovrascrive parzialmente la prima in modo implicito.
**Fix**: Unificare le due regole in un'unica definizione coerente. Tenere `border-left-width: 5px`, `border-radius: var(--radius-md)`, `min-height: 72px`, `box-shadow: var(--shadow-sm)` dalla seconda. Rimuovere la prima occorrenza.

### BUG 6 — Sticky column trasparente su scroll orizzontale
**File**: `app/globals.css`, righe 237–239
**Problema**: Le righe pari in `.sticky-col` usano `background: var(--zebra)` che è `rgba(0,0,0,0.025)` (semitrasparente). Quando si scrolla orizzontalmente, i contenuti delle celle adiacenti appaiono "attraverso" la colonna sticky.
**Fix**: Per le righe pari della sticky column usare un colore solido. Calcolare equivalente opaco: `background: #f5f5f4` (beige chiaro che approssima la zebratura su bianco). Aggiungere la regola:
```css
.booking-table tbody tr:nth-child(even) .sticky-col {
  background: #f7f6f3; /* equivalente solido di rgba(0,0,0,0.025) su #fff */
}
```

---

## MIGLIORIE UI/UX (implementare in ordine, verificando il build dopo ciascuna)

---

### MIGLIORIA 1 — Riepilogo Mensile a fondo pagina (PRIORITÀ ALTA)

**Obiettivo**: Aggiungere un pannello `MonthSummary` che mostri, per il mese visualizzato, un riepilogo lodge per lodge e un totale generale.

**Nuovo componente**: `components/MonthSummary.tsx`

**Struttura dati da calcolare in `page.tsx`** (con `useMemo`):
```typescript
type LodgeSummary = {
  lodge: Lodge;
  bookingsCount: number;    // prenotazioni attive nel mese
  nightsBooked: number;     // notti occupate (somma durata delle prenotazioni che cadono nel mese)
  occupancyPct: number;     // nightsBooked / totalDaysInMonth * 100
  revenue: number;          // totalAmount pro-quota sul mese (o totale se tutta la prenotazione è nel mese)
};
```

**Layout del pannello** (aggiungere DOPO `<ErrorBoundary>` in `page.tsx`):
- Intestazione: `"Riepilogo {MMMM yyyy} — {totalNotti} notti occupate / {totalGiorni} giorni"` + occupancy media
- Tabella con colonne: Lodge | Prenotazioni | Notti | Occupancy % | Fatturato (barra progresso colorata)
- Riga totale in grassetto
- Il pannello deve avere classe `no-print` tranne la tabella
- Non mostrare il pannello se non ci sono prenotazioni nel mese

**Stile CSS** (aggiungere in `globals.css`):
```css
.month-summary { background: var(--panel); border: 1.5px solid var(--line); border-radius: var(--radius-lg); padding: 16px; box-shadow: var(--shadow-md); }
.month-summary-title { font-size: 0.95rem; font-weight: 700; margin: 0 0 12px; color: var(--text); display: flex; align-items: center; gap: 8px; }
.summary-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
.summary-table th { text-align: left; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.07em; text-transform: uppercase; color: var(--muted); padding: 0 8px 8px; border-bottom: 1.5px solid var(--line); }
.summary-table td { padding: 7px 8px; border-bottom: 1px solid var(--line); }
.summary-table tr:last-child td { border-bottom: none; font-weight: 700; }
.occ-bar { height: 6px; border-radius: 999px; background: var(--line); overflow: hidden; margin-top: 3px; }
.occ-bar-fill { height: 100%; border-radius: 999px; background: var(--accent); transition: width 0.4s ease; }
```

---

### MIGLIORIA 2 — Booking chip più chiari e informativi (PRIORITÀ ALTA)

**File**: `components/BookingBoard.tsx` e `app/globals.css`

**Problema attuale**: I chip mostrano le stesse informazioni su ogni riga del multi-day booking. Ogni riga ripete nome, badge status, badge canale. Su prenotazioni lunghe (es. 15 giorni) questo è estremamente ridondante e rende la griglia difficile da leggere.

**Soluzione** — Chip differenziati per posizione:

Aggiungere logica per calcolare `isCheckIn`, `isCheckOut` (giorno precedente al checkOut), `isMiddle`:

```typescript
const isCheckIn = isSameDay(parseISO(booking.checkIn), day);
const isLastNight = isSameDay(addDays(parseISO(booking.checkOut), -1), day);
const isMiddle = !isCheckIn && !isLastNight;
```

Usare classi CSS diverse:
- `booking-chip booking-chip--checkin`: mostra nome ospite, badge status, badge canale, pill "↓ Check-in", numero ospiti
- `booking-chip booking-chip--middle`: mostra solo nome ospite (più piccolo, sfondo attenuato), nessun badge (risparmio spazio)
- `booking-chip booking-chip--checkout`: mostra "↑ Checkout" in evidenza, non ripetere tutti i badge

**Aggiungere attributo `data-position`** al chip (`checkin` | `middle` | `checkout`) e gestirlo con CSS:
```css
.booking-chip[data-position="middle"] {
  opacity: 0.75;
  min-height: 48px;
  background: color-mix(in srgb, var(--panel) 85%, var(--accent) 15%);
}
.booking-chip[data-position="middle"] .chip-badges { display: none; }
.booking-chip[data-position="checkout"] { border-left-style: dashed; }
```

**Aggiungere "notti totali" al chip di check-in**:
```typescript
const nights = differenceInDays(parseISO(booking.checkOut), parseISO(booking.checkIn));
// Mostrare: "5 notti · €750"
```

Importare `differenceInDays` da `date-fns`. Mostrare `{nights}n · {formatMoney(booking.totalAmount)}` solo sul chip di check-in (non ripeterlo su ogni riga).

**Aggiungere indicatore caparra** sul chip check-in: se `depositReceived` mostrare un piccolo badge verde `✓ Caparra`, se `depositAmount > 0 && !depositReceived` mostrare badge arancione `⚠ Caparra attesa`.

---

### MIGLIORIA 3 — Navigazione mese con indicatori di occupancy (PRIORITÀ MEDIA)

**File**: `components/MonthNavigation.tsx` o nella toolbar

**Obiettivo**: Mostrare sotto il nome del mese un mini-indicatore visivo dell'occupancy del mese corrente. Es: una mini-barra colorata o un numero `"67% occupato"`.

**Implementazione**: Calcolare in `page.tsx` la percentuale di occupancy media (su tutti i lodge) del mese corrente:
```typescript
const monthOccupancy = useMemo(() => {
  const totalSlots = monthDays.length * LODGES.length;
  const occupiedSlots = /* conta celle occupate da bookingIndex */;
  return Math.round((occupiedSlots / totalSlots) * 100);
}, [monthDays, bookings]);
```
Passarla come prop alla toolbar e mostrarla come pill `"{occupancy}% occupato"` accanto al nome del mese, con colore che varia: verde (<40%), arancione (40-70%), rosso (>70%).

---

### MIGLIORIA 4 — Evidenziazione visiva Weekend nel calendario (PRIORITÀ MEDIA)

**File**: `components/BookingBoard.tsx` e `app/globals.css`

**Obiettivo**: Le righe di sabato e domenica devono essere visivamente distinguibili dalla settimana lavorativa.

**Implementazione**: Importare `getDay` da `date-fns`. Aggiungere classe `weekend-row` alla `<tr>` se `getDay(day) === 0 || getDay(day) === 6`. Nel `.day-cell` di quelle righe, mostrare il giorno con colore diverso.

**CSS**:
```css
.weekend-row .day-cell { color: var(--accent); font-weight: 700; }
.weekend-row td:not(.sticky-col) { background: color-mix(in srgb, var(--accent-faint) 60%, transparent) !important; }
.weekend-row.today-row td { background: var(--today-bg) !important; } /* today ha precedenza */
```

**IMPORTANTE**: La classe `today-row` deve avere precedenza su `weekend-row` — usare `!important` su today o aumentare specificità.

---

### MIGLIORIA 5 — Durata soggiorno nel tooltip e nel chip (PRIORITÀ MEDIA)

**File**: `lib/utils.ts` — funzione `bookingTooltip`

Aggiungere alle informazioni del tooltip:
- Numero di notti: `"${nights} notti"`
- Stato caparra con emoji: `"✓ Caparra ricevuta"` o `"⚠ Caparra da ricevere"`
- Saldo residuo: `"Residuo: €X"`

**Formato tooltip migliorato**:
```
Marco Rossi · 2 persone
25 giu → 30 giu (5 notti)
Totale €750 · Caparra €225 ✓
Residuo: €525
Airbnb · Confermata
```

---

### MIGLIORIA 6 — Ricerca estesa (PRIORITÀ BASSA)

**File**: `lib/utils.ts` — funzione `matchesFilters`

**Problema**: La ricerca testuale controlla solo `guestName`. Non trova prenotazioni per lodge, note, canale.

**Fix**: Estendere il controllo:
```typescript
if (search && !(
  booking.guestName.toLowerCase().includes(search) ||
  booking.lodge.toLowerCase().includes(search) ||
  booking.notes.toLowerCase().includes(search)
)) {
  return false;
}
```

---

### MIGLIORIA 7 — Vista Annuale / Salto rapido al mese (PRIORITÀ BASSA)

**File**: `components/Toolbar.tsx` (o nuovo `components/YearJumper.tsx`)

**Obiettivo**: Aggiungere un selettore rapido che mostri tutti i 12 mesi dell'anno con mini-indicatori di occupancy, per navigare velocemente.

**Implementazione**: Bottone "Vista Anno" nella toolbar che apre un popover con una griglia 3×4 dei mesi. Ogni mese mostra:
- Nome mese
- Numero prenotazioni totali in quel mese
- Mini barra occupancy colorata

Al click su un mese, eseguire `setStoreMonth(startOfMonth(new Date(year, monthIndex)))`.

---

## REQUISITI DI IMPLEMENTAZIONE TRASVERSALI

### Non toccare mai:
- La logica di `store.ts` (addBooking, updateBooking, deleteBooking, importBookingsMerge, overlaps)
- La struttura dei tipi in `types.ts`
- Il sistema di autenticazione `PasswordGate.tsx`
- Il sistema di import/export JSON
- Il sistema di backup localStorage
- La logica `bookingIndex` in `BookingBoard.tsx` (è ottimizzata correttamente)
- Il `ErrorBoundary`
- La gestione keyboard shortcuts in `page.tsx`

### Prima di ogni deploy:
1. `npm run build` — deve completare senza errori TypeScript
2. Verificare visivamente nel browser che: la tabella si scrolli correttamente, i dialog si aprano e chiudano, il salvataggio funzioni, l'export JSON produca un file valido
3. Verificare che i SEED_BOOKINGS (dati iniziali) appaiano correttamente nella griglia del mese giusto
4. Testare su mobile (viewport < 860px): il toolbar non deve rompersi

### Stile da mantenere:
- CSS plain, nessun framework CSS
- Variabili CSS `--accent`, `--bg`, `--panel`, `--text`, `--muted`, `--line` già definite
- Border radius tramite `var(--radius-md)` e `var(--radius-lg)`
- Shadow tramite `var(--shadow-sm)`, `var(--shadow-md)`, `var(--shadow-lg)`
- Font: `"Avenir Next", "Segoe UI", -apple-system, sans-serif`
- Tema colore mensile: NON modificare la logica `MONTH_ACCENTS` in `page.tsx`

---

## ORDINE DI IMPLEMENTAZIONE CONSIGLIATO

1. **BUG 1** (Elimina senza conferma) — 10 minuti
2. **BUG 2 + BUG 3** (Icone e Legenda SummaryBar) — 5 minuti
3. **BUG 5** (CSS duplicato) — 5 minuti
4. **BUG 6** (Sticky column trasparente) — 5 minuti
5. `npm run build` → verifica ✅
6. **MIGLIORIA 2** (Chip differenziati) — 30 minuti
7. **MIGLIORIA 4** (Weekend highlight) — 15 minuti
8. `npm run build` → verifica visiva ✅
9. **BUG 4** (SummaryBar mese corrente) + **MIGLIORIA 1** (Riepilogo mensile) — 45 minuti
10. **MIGLIORIA 5** (Tooltip migliorato) — 10 minuti
11. **MIGLIORIA 3** (Occupancy nella navigazione) — 20 minuti
12. `npm run build` → verifica finale completa ✅
13. **MIGLIORIA 6** (Ricerca estesa) — 5 minuti
14. **MIGLIORIA 7** (Vista annuale, opzionale) — 45 minuti

---

*Generato il 27/02/2026 — Villa Olimpia Booking Board*
