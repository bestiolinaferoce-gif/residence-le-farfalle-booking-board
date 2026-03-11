# VILLA OLIMPIA — CURSOR MASTER TASK
**Data**: 2026-02-27 | **Priorità**: ALTA | **Regola assoluta**: non rompere nulla che funziona già

---

## ⚠️ REGOLE OBBLIGATORIE
- **Non toccare** `lib/store.ts` validazione (`validateBookingPayload`, `ensureNoOverlap`)
- **Non toccare** la logica di sync (`syncToServer`, `persist`)
- **Testare** ogni task prima di passare al successivo
- **TypeScript strict** — zero `any` impliciti
- Per ogni nuovo campo in `Booking` usare **optional** (`field?: type`) per retrocompatibilità

---

## 🔴 TASK 1 — Fix lodge names nella colonna sinistra del Gantt

**Sintomo**: nella colonna lodge del GanttBoard, il testo del nome lodge non è visibile o viene troncato, si vede solo il pallino colorato.

**Causa**: il CSS `.gantt-lodge-name` ha `display:none` o viene nascosto da `overflow:hidden` su `.gantt-lodge-label` quando la viewport è stretta, oppure il `font-size` è troppo piccolo.

**Fix in `app/globals.css`**:
```css
.gantt-lodge-label {
  min-width: 150px;
  max-width: 180px;
  width: 180px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  overflow: hidden;
}

.gantt-lodge-dot {
  flex-shrink: 0;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: block;
}

.gantt-lodge-name {
  display: block !important;
  font-size: 13px;
  font-weight: 600;
  color: #e2e8f0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}
```

**Fix in `app/globals.css`** — assicurarsi che la griglia del Gantt usi 180px per la prima colonna:
```css
.gantt-wrap { --lodge-col: 180px; }
.gantt-header,
.gantt-row { grid-template-columns: var(--lodge-col) repeat(auto-fill, minmax(34px, 1fr)); }
```

**Verifica**: Aprire il Gantt — ogni riga deve mostrare pallino + nome lodge leggibile.

---

## 🔴 TASK 2 — Indicatore "Nuova prenotazione" lampeggiante

Quando viene creata una nuova prenotazione (entro le ultime **48 ore**), deve apparire un indicatore visivo ben evidente affinché Carlo il contabile se ne accorga aprendo l'app.

### 2.1 — Aggiungere campo `isNew` al tipo `Booking` in `lib/types.ts`

```typescript
export type Booking = {
  // ...campi esistenti invariati...
  isNew?: boolean; // true se creata nelle ultime 48h, non obbligatorio (retrocompatibilità)
};
```

### 2.2 — Impostare `isNew: true` alla creazione in `lib/store.ts`

Nella funzione `addBooking`, aggiungere `isNew: true` all'oggetto booking:
```typescript
const booking: Booking = {
  id: uuidv4(),
  ...payload,
  isNew: true,  // ← aggiungere questa riga
  guestName: payload.guestName.trim(),
  // ...resto invariato
};
```

### 2.3 — Badge "NUOVO" pulsante nel Gantt bar in `components/GanttBoard.tsx`

Nel render del Gantt bar, aggiungere dopo `.gantt-bar-inner`:
```tsx
{booking.isNew && (
  <span className="gantt-bar-new-badge">NUOVO</span>
)}
```

### 2.4 — Badge nel KPI panel — mostrare contatore nuove prenotazioni

In `components/KPIPanel.tsx`, aggiungere prop `newBookingsCount: number`.
Se `newBookingsCount > 0`, mostrare sotto la KPI card "Prenotazioni":
```tsx
<span className="kpi-new-badge">
  +{newBookingsCount} nuove
</span>
```

In `app/page.tsx`, calcolare:
```typescript
const newBookingsCount = useMemo(
  () => bookings.filter((b) => b.isNew).length,
  [bookings]
);
```

### 2.5 — CSS per i badge in `app/globals.css`

```css
@keyframes badgePulse {
  0%, 100% { opacity: 1; transform: scale(1); box-shadow: 0 0 0 0 rgba(16,185,129,0.7); }
  50%       { opacity: 0.85; transform: scale(1.06); box-shadow: 0 0 0 6px rgba(16,185,129,0); }
}

.gantt-bar-new-badge {
  position: absolute;
  top: -8px;
  right: 4px;
  background: #10b981;
  color: #fff;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.05em;
  padding: 2px 5px;
  border-radius: 4px;
  animation: badgePulse 1.4s ease-in-out infinite;
  pointer-events: none;
  z-index: 10;
}

.kpi-new-badge {
  display: inline-block;
  margin-top: 4px;
  background: rgba(16,185,129,0.15);
  color: #10b981;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 99px;
  border: 1px solid rgba(16,185,129,0.3);
  animation: badgePulse 1.4s ease-in-out infinite;
}
```

### 2.6 — Pulsante "Segna come visto" per rimuovere il badge

Quando il contabile apre la prenotazione dal dialog, rimuovere `isNew`.
In `components/BookingDialog.tsx`, quando il dialog si apre in modalità **edit** su una booking con `isNew: true`, chiamare automaticamente un update per rimuovere il flag:
```typescript
// Nell'useEffect di BookingDialog, quando booking?.isNew è true:
useEffect(() => {
  if (booking?.isNew && mode === 'edit') {
    // Rimuovere il badge dopo 2 secondi di visualizzazione
    const timer = setTimeout(() => {
      onUpdate(booking.id, { ...booking, isNew: false });
    }, 2000);
    return () => clearTimeout(timer);
  }
}, [booking?.id, booking?.isNew, mode]);
```

---

## 🔴 TASK 3 — Anagrafica completa + Portale Alloggiati

### 3.1 — Aggiungere campi anagrafica a `lib/types.ts`

Aggiungere **dopo** i campi esistenti di `Booking` (tutti opzionali):
```typescript
export type GuestProfile = {
  surname?: string;         // Cognome
  firstName?: string;       // Nome (separato per Alloggiati)
  birthDate?: string;       // yyyy-mm-dd
  birthPlace?: string;      // Comune di nascita
  birthProvince?: string;   // Sigla provincia (es. MI)
  birthCountry?: string;    // Stato di nascita (es. Italia)
  nationality?: string;     // Cittadinanza (es. Italiana)
  gender?: "M" | "F" | "";
  fiscalCode?: string;      // Codice fiscale
  residence?: string;       // Indirizzo residenza completo
  documentType?: "CARTA_IDENTITA" | "PASSAPORTO" | "PATENTE" | "PERMESSO_SOGGIORNO" | "";
  documentNumber?: string;
  documentIssuePlace?: string;
  documentIssueDate?: string; // yyyy-mm-dd
};

export type Booking = {
  // ...tutti i campi esistenti INVARIATI...
  guestProfile?: GuestProfile; // ← aggiungere solo questa riga
};
```

**IMPORTANTE**: `BookingInput` deve includere `guestProfile?`:
```typescript
export type BookingInput = Omit<Booking, "id" | "createdAt" | "updatedAt">;
// BookingInput eredita guestProfile? automaticamente
```

### 3.2 — Nuova sezione "Anagrafica Ospite" in `components/BookingDialog.tsx`

Aggiungere una nuova sezione collassabile dopo la sezione "Note".
Lo stato iniziale è **chiuso** (collapsed) per non appesantire il form.
Si apre cliccando "▶ Anagrafica & Documenti".

```tsx
// Aggiungere stato:
const [showProfile, setShowProfile] = useState(false);

// Aggiungere helper per aggiornare guestProfile:
function changeProfile<K extends keyof GuestProfile>(key: K, value: GuestProfile[K]) {
  setForm((prev) => ({
    ...prev,
    guestProfile: { ...(prev.guestProfile ?? {}), [key]: value },
  }));
}

// Aggiungere nel render, DOPO la sezione Note:
<div className="form-section">
  <button
    type="button"
    className="section-toggle"
    onClick={() => setShowProfile((v) => !v)}
  >
    {showProfile ? "▼" : "▶"} Anagrafica &amp; Documenti
    {booking?.guestProfile?.fiscalCode && (
      <span className="profile-complete-badge">✓ completa</span>
    )}
  </button>

  {showProfile && (
    <div className="form-grid profile-grid">
      {/* Riga 1: Cognome / Nome / Sesso */}
      <label>
        Cognome
        <input value={form.guestProfile?.surname ?? ""} onChange={(e) => changeProfile("surname", e.target.value)} />
      </label>
      <label>
        Nome
        <input value={form.guestProfile?.firstName ?? ""} onChange={(e) => changeProfile("firstName", e.target.value)} />
      </label>
      <label>
        Sesso
        <select value={form.guestProfile?.gender ?? ""} onChange={(e) => changeProfile("gender", e.target.value as "M" | "F" | "")}>
          <option value="">—</option>
          <option value="M">M</option>
          <option value="F">F</option>
        </select>
      </label>

      {/* Riga 2: Data nascita / Luogo nascita / Provincia */}
      <label>
        Data di nascita
        <input type="date" value={form.guestProfile?.birthDate ?? ""} onChange={(e) => changeProfile("birthDate", e.target.value)} />
      </label>
      <label>
        Comune di nascita
        <input value={form.guestProfile?.birthPlace ?? ""} onChange={(e) => changeProfile("birthPlace", e.target.value)} />
      </label>
      <label>
        Provincia (sigla)
        <input maxLength={2} placeholder="MI" value={form.guestProfile?.birthProvince ?? ""} onChange={(e) => changeProfile("birthProvince", e.target.value.toUpperCase())} />
      </label>

      {/* Riga 3: Stato nascita / Cittadinanza / CF */}
      <label>
        Stato di nascita
        <input placeholder="Italia" value={form.guestProfile?.birthCountry ?? ""} onChange={(e) => changeProfile("birthCountry", e.target.value)} />
      </label>
      <label>
        Cittadinanza
        <input placeholder="Italiana" value={form.guestProfile?.nationality ?? ""} onChange={(e) => changeProfile("nationality", e.target.value)} />
      </label>
      <label>
        Codice Fiscale
        <input
          maxLength={16}
          placeholder="RSSMRA80A01H501Z"
          value={form.guestProfile?.fiscalCode ?? ""}
          onChange={(e) => changeProfile("fiscalCode", e.target.value.toUpperCase())}
          style={{ fontFamily: "monospace", letterSpacing: "0.08em" }}
        />
      </label>

      {/* Riga 4: Residenza (full width) */}
      <label className="full-width">
        Residenza (via, n°, città, CAP)
        <input placeholder="Via Roma 1, 20100 Milano" value={form.guestProfile?.residence ?? ""} onChange={(e) => changeProfile("residence", e.target.value)} />
      </label>

      {/* Riga 5: Tipo documento / Numero / Luogo rilascio / Data rilascio */}
      <label>
        Tipo documento
        <select value={form.guestProfile?.documentType ?? ""} onChange={(e) => changeProfile("documentType", e.target.value as GuestProfile["documentType"])}>
          <option value="">— Seleziona —</option>
          <option value="CARTA_IDENTITA">Carta d'identità</option>
          <option value="PASSAPORTO">Passaporto</option>
          <option value="PATENTE">Patente</option>
          <option value="PERMESSO_SOGGIORNO">Permesso di soggiorno</option>
        </select>
      </label>
      <label>
        Numero documento
        <input
          placeholder="AB1234567"
          value={form.guestProfile?.documentNumber ?? ""}
          onChange={(e) => changeProfile("documentNumber", e.target.value.toUpperCase())}
          style={{ fontFamily: "monospace" }}
        />
      </label>
      <label>
        Luogo rilascio
        <input placeholder="Comune di Milano" value={form.guestProfile?.documentIssuePlace ?? ""} onChange={(e) => changeProfile("documentIssuePlace", e.target.value)} />
      </label>
      <label>
        Data rilascio
        <input type="date" value={form.guestProfile?.documentIssueDate ?? ""} onChange={(e) => changeProfile("documentIssueDate", e.target.value)} />
      </label>
    </div>
  )}
</div>
```

### 3.3 — Aggiungere import `GuestProfile` nel BookingDialog

```typescript
import { ..., type GuestProfile } from "@/lib/types";
```

### 3.4 — Pulsante "Esporta Alloggiati" dentro il dialog (solo in modalità edit)

Aggiungere ACCANTO al pulsante Elimina, nella `dialog-actions`:
```tsx
{mode === "edit" && booking?.guestProfile?.surname && (
  <button
    type="button"
    className="alloggiati-btn"
    onClick={() => exportAlloggiati(booking)}
    title="Prepara file per Portale Alloggiati Web"
  >
    📋 Alloggiati
  </button>
)}
```

### 3.5 — Funzione `exportAlloggiati` in `components/BookingDialog.tsx`

```typescript
function exportAlloggiati(b: Booking) {
  const p = b.guestProfile ?? {};

  // Mappa tipo documento → codice Alloggiati
  const docTypeMap: Record<string, string> = {
    CARTA_IDENTITA: "IDENT",
    PASSAPORTO: "PASOR",
    PATENTE: "PATEG",
    PERMESSO_SOGGIORNO: "PERMS",
  };

  // Formatta data: yyyy-mm-dd → dd/mm/yyyy
  const fmtDate = (d?: string) => {
    if (!d) return "          "; // 10 spazi
    const [y, m, g] = d.split("-");
    return `${g}/${m}/${y}`;
  };

  // Pad a lunghezza fissa (right-padded con spazi, left-padded con zero per numeri)
  const pad = (s: string, len: number) =>
    s.substring(0, len).padEnd(len, " ");
  const padNum = (n: number, len: number) =>
    String(n).padStart(len, "0");

  const checkIn = parseISO(b.checkIn);
  const checkOut = parseISO(b.checkOut);
  const nights = differenceInDays(checkOut, checkIn);
  const gender = p.gender === "M" ? "1" : p.gender === "F" ? "2" : "9";
  const docType = docTypeMap[p.documentType ?? ""] ?? "IDENT";

  // Formato fisso Alloggiati Web
  const row = [
    "16",                                    // tipo alloggiato (capofamiglia)
    fmtDate(b.checkIn),                       // data arrivo
    padNum(nights, 4),                        // permanenza
    pad(p.surname ?? b.guestName, 50),        // cognome
    pad(p.firstName ?? "", 30),              // nome
    gender,                                  // sesso
    fmtDate(p.birthDate),                    // data nascita
    pad(p.birthPlace ?? "", 9),              // comune nascita (o codice Belfiore)
    pad(p.birthProvince ?? "  ", 2),          // provincia nascita
    pad(p.birthCountry ?? "Z000", 9),         // stato nascita
    pad(p.nationality ?? "Z000", 9),          // cittadinanza
    pad(docType, 5),                          // tipo documento
    pad(p.documentNumber ?? "", 20),          // numero documento
    pad(p.documentIssuePlace ?? "", 9),       // luogo rilascio
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
```

Aggiungere imports necessari in BookingDialog: `{ differenceInDays, parseISO } from "date-fns"`

### 3.6 — CSS per la sezione anagrafica in `app/globals.css`

```css
.section-toggle {
  width: 100%;
  text-align: left;
  background: none;
  border: none;
  border-top: 1px solid rgba(255,255,255,0.08);
  padding: 10px 0;
  font-size: 13px;
  font-weight: 600;
  color: #94a3b8;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: color 0.15s;
}
.section-toggle:hover { color: #e2e8f0; }

.profile-complete-badge {
  margin-left: auto;
  font-size: 11px;
  background: rgba(16,185,129,0.12);
  color: #10b981;
  padding: 2px 8px;
  border-radius: 99px;
  border: 1px solid rgba(16,185,129,0.25);
}

.profile-grid {
  padding-top: 12px;
  grid-template-columns: repeat(3, 1fr);
}

.alloggiati-btn {
  padding: 8px 14px;
  background: rgba(99,102,241,0.12);
  color: #818cf8;
  border: 1px solid rgba(99,102,241,0.3);
  border-radius: var(--r-md);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}
.alloggiati-btn:hover {
  background: rgba(99,102,241,0.22);
  border-color: rgba(99,102,241,0.5);
}
```

---

## 🟡 TASK 4 — UI polish finale

### 4.1 — MonthSummary: aggiungere pallino colore lodge accanto al nome

In `components/MonthSummary.tsx`, nella colonna Lodge della tabella:
```tsx
// Importare LODGE_COLORS da una costante condivisa
// Creare in lib/utils.ts la mappa:
export const LODGE_COLORS_MAP: Record<string, string> = {
  Frangipane: "#8b5cf6",
  Fiordaliso: "#3b82f6",
  Giglio:     "#10b981",
  Tulipano:   "#f43f5e",
  Orchidea:   "#ec4899",
  Lavanda:    "#a78bfa",
  Geranio:    "#f97316",
  Gardenia:   "#14b8a6",
  Azalea:     "#e11d48",
};

// In MonthSummary.tsx sostituire <td>{s.lodge}</td> con:
<td>
  <span style={{
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
  }}>
    <span style={{
      width: 8,
      height: 8,
      borderRadius: "50%",
      background: LODGE_COLORS_MAP[s.lodge] ?? "#888",
      display: "inline-block",
      flexShrink: 0,
    }} />
    {s.lodge}
  </span>
</td>
```

### 4.2 — Gantt bars: altezza righe più generosa

```css
.gantt-row { min-height: 52px; }
.gantt-bar { height: 36px; top: 8px; border-radius: 8px; }
```

### 4.3 — Toolbar: sincronizzazione status ben visibile

Assicurarsi che `.sync-dot` sia visibile con i colori corretti:
```css
.sync-dot[data-status="synced"]  { background: #10b981; box-shadow: 0 0 6px #10b981; }
.sync-dot[data-status="syncing"] { background: #f59e0b; animation: badgePulse 1s infinite; }
.sync-dot[data-status="error"]   { background: #ef4444; animation: badgePulse 0.6s infinite; }
.sync-dot[data-status="idle"]    { background: #64748b; }
```

### 4.4 — Header lodge nel Gantt: sticky su scroll orizzontale

```css
.gantt-lodge-label {
  position: sticky;
  left: 0;
  z-index: 2;
  background: inherit;
}
```

---

## ✅ CHECKLIST DI VERIFICA FINALE

Prima di considerare il lavoro completato, verificare:

- [ ] Gantt mostra nome lodge (testo) + pallino colorato in ogni riga
- [ ] Bar verde "NUOVO" lampeggia sulle prenotazioni create nelle ultime 48h
- [ ] KPI card mostra counter prenotazioni nuove (se presenti)
- [ ] Cliccando una prenotazione "nuova", il badge scompare dopo 2 secondi
- [ ] Dialog ha sezione "Anagrafica & Documenti" collassabile (chiusa di default)
- [ ] Tutti i campi anagrafica si salvano correttamente (controllare console, nessun errore TypeScript)
- [ ] Bottone "📋 Alloggiati" appare nel dialog edit solo se cognome compilato
- [ ] Clic su "📋 Alloggiati" scarica file `.txt` con formato corretto
- [ ] MonthSummary mostra pallino + nome lodge
- [ ] Nessun errore TypeScript (`npm run build` senza errori)
- [ ] `npm run dev` funziona senza crash

---

## ❌ NON TOCCARE QUESTI FILE
- `lib/store.ts` — eccetto la riga `isNew: true` in `addBooking`
- `lib/utils.ts` — eccetto aggiunta `LODGE_COLORS_MAP`
- `app/api/bookings/route.ts` — già aggiornato, non modificare
- `scripts/setup-db.mjs` — già aggiornato, non modificare
