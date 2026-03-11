# CURSOR TASK — REAL-TIME MULTI-USER SYNC (VERSIONE DEFINITIVA)

## CONTESTO E PROBLEMA REALE

L'app usa **Vercel KV (Redis)** come database condiviso e **localStorage** come cache locale.
Il flusso attuale funziona così:

```
load() al mount → GET /api/bookings → aggiorna stato locale
persist() su ogni mutazione → POST /api/bookings → salva su KV
```

**BUG CRITICO:** `load()` viene chiamato UNA SOLA VOLTA all'apertura della pagina.
Se l'utente A salva una prenotazione, l'utente B non la vede MAI finché non ricarica manualmente.

---

## OBIETTIVO

Implementare **sincronizzazione automatica multi-utente** senza WebSocket né infrastruttura aggiuntiva.
Strategia: **polling basato su version token** — economico, zero latenza extra sulla scrittura.

---

## IMPLEMENTAZIONE — STEP BY STEP

### STEP 1 — Modifica `app/api/bookings/route.ts`

Cambia il formato di storage su KV da `Booking[]` a `{ v: number; ts: string; data: Booking[] }`.

Il campo `v` (version) è un intero che si incrementa a ogni scrittura.
Il campo `ts` è l'ISO timestamp dell'ultima scrittura.

```typescript
// app/api/bookings/route.ts
import { NextRequest, NextResponse } from 'next/server';

const BASE = process.env.KV_REST_API_URL ?? '';
const TOKEN = process.env.KV_REST_API_TOKEN ?? '';
const KEY = 'vob_bookings';
const VER_KEY = 'vob_version';

type KVPayload = {
  v: number;
  ts: string;
  data: Booking[]; // import type Booking from your types
};

// GET /api/bookings — restituisce l'intero payload { v, ts, data }
export async function GET() {
  if (!BASE || !TOKEN) return NextResponse.json({ v: 0, ts: new Date().toISOString(), data: [] });
  try {
    const res = await fetch(`${BASE}/get/${KEY}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
      cache: 'no-store',
    });
    const json = (await res.json()) as { result: string | null };
    if (!json.result) return NextResponse.json({ v: 0, ts: new Date().toISOString(), data: [] });
    const parsed = JSON.parse(json.result) as KVPayload | unknown[];
    // backward compat: se il valore salvato è ancora il vecchio array grezzo
    if (Array.isArray(parsed)) {
      return NextResponse.json({ v: 1, ts: new Date().toISOString(), data: parsed });
    }
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({ v: 0, ts: new Date().toISOString(), data: [] });
  }
}

// GET /api/bookings/version — endpoint LEGGERO per il polling (solo v + ts, no data)
// NOTA: crea questo come file separato: app/api/bookings/version/route.ts

// POST /api/bookings — scrive { v++, ts, data } su KV
export async function POST(req: NextRequest) {
  if (!BASE || !TOKEN) return NextResponse.json({ ok: false });
  try {
    const body = await req.json() as { bookings: Booking[]; clientVersion: number };
    const bookings: Booking[] = Array.isArray(body) ? body : body.bookings;

    // Leggi versione corrente
    const curr = await fetch(`${BASE}/get/${KEY}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
      cache: 'no-store',
    });
    const currJson = (await curr.json()) as { result: string | null };
    let currentVersion = 0;
    if (currJson.result) {
      try {
        const parsed = JSON.parse(currJson.result) as KVPayload | unknown[];
        currentVersion = Array.isArray(parsed) ? 0 : (parsed as KVPayload).v ?? 0;
      } catch { /* */ }
    }

    const newPayload: KVPayload = {
      v: currentVersion + 1,
      ts: new Date().toISOString(),
      data: bookings,
    };

    await fetch(`${BASE}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([['SET', KEY, JSON.stringify(newPayload)]]),
    });

    return NextResponse.json({ ok: true, v: newPayload.v, ts: newPayload.ts });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
```

---

### STEP 2 — Crea `app/api/bookings/version/route.ts`

Questo è l'endpoint di polling: risponde con solo `{ v, ts }` — pochi byte, nessun trasferimento dati.

```typescript
// app/api/bookings/version/route.ts
import { NextResponse } from 'next/server';

const BASE = process.env.KV_REST_API_URL ?? '';
const TOKEN = process.env.KV_REST_API_TOKEN ?? '';
const KEY = 'vob_bookings';

export async function GET() {
  if (!BASE || !TOKEN) return NextResponse.json({ v: 0, ts: '' });
  try {
    const res = await fetch(`${BASE}/get/${KEY}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
      cache: 'no-store',
    });
    const json = (await res.json()) as { result: string | null };
    if (!json.result) return NextResponse.json({ v: 0, ts: '' });
    const parsed = JSON.parse(json.result) as { v?: number; ts?: string };
    if (Array.isArray(parsed)) return NextResponse.json({ v: 1, ts: '' });
    return NextResponse.json({ v: parsed.v ?? 0, ts: parsed.ts ?? '' });
  } catch {
    return NextResponse.json({ v: 0, ts: '' });
  }
}
```

---

### STEP 3 — Modifica `lib/store.ts`

**Aggiungi al tipo `BookingState`:**
```typescript
serverVersion: number;           // versione corrente del server che il client conosce
syncError: boolean;              // true se l'ultimo polling ha fallito
startPolling: () => () => void;  // avvia polling, ritorna cleanup function
stopPolling: () => void;
```

**Modifica `load()`:**
```typescript
load: async () => {
  if (typeof window === 'undefined') return;
  // ... (settings load invariato) ...

  // Prima mostra subito i dati da localStorage (UI non blocca)
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const cached = JSON.parse(raw) as Booking[];
      set({ bookings: cached });
    } catch { /* */ }
  }

  // Poi sincronizza con KV (autoritativo)
  try {
    const res = await fetch('/api/bookings', { cache: 'no-store' });
    if (!res.ok) throw new Error('fetch failed');
    const payload = await res.json() as { v: number; ts: string; data: Booking[] };
    const data = Array.isArray(payload) ? payload : payload.data ?? [];
    const version = Array.isArray(payload) ? 0 : payload.v ?? 0;

    if (data.length > 0) {
      const migrated = data.map((b) => ({
        ...b,
        guestsCount: typeof b.guestsCount === 'number' && b.guestsCount >= 1 ? b.guestsCount : 2,
      }));
      set({ bookings: migrated, serverVersion: version, syncError: false });
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    } else {
      // KV vuoto → carica da localStorage e sincronizza
      const cur = get().bookings;
      if (cur.length > 0) {
        await fetch('/api/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bookings: cur }),
        }).catch(() => {});
      }
    }
  } catch {
    set({ syncError: true });
  }
},
```

**Aggiungi `startPolling`:**
```typescript
startPolling: () => {
  const POLL_INTERVAL_MS = 30_000; // 30 secondi
  let active = true;

  const poll = async () => {
    if (!active) return;
    try {
      const res = await fetch('/api/bookings/version', { cache: 'no-store' });
      if (!res.ok) throw new Error('poll failed');
      const { v } = await res.json() as { v: number };
      const currentVersion = get().serverVersion;

      if (v > currentVersion) {
        // Il server ha dati più nuovi: scarica
        const full = await fetch('/api/bookings', { cache: 'no-store' });
        if (!full.ok) throw new Error('full fetch failed');
        const payload = await full.json() as { v: number; ts: string; data: Booking[] };
        const data = Array.isArray(payload) ? payload : payload.data ?? [];
        const migrated = data.map((b) => ({
          ...b,
          guestsCount: typeof b.guestsCount === 'number' && b.guestsCount >= 1 ? b.guestsCount : 2,
        }));
        set({ bookings: migrated, serverVersion: payload.v ?? v, syncError: false });
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      }
    } catch {
      // Non aggiornare syncError da polling — evita UI noise per interruzioni momentanee
    }

    if (active) {
      setTimeout(poll, POLL_INTERVAL_MS);
    }
  };

  // Prima poll dopo 5s (lascia al mount il tempo di caricarsi)
  const firstTimer = setTimeout(poll, 5_000);

  return () => {
    active = false;
    clearTimeout(firstTimer);
  };
},
stopPolling: () => { /* gestito dall'active flag */ },
```

**Modifica `persist()`** per inviare il version number corrente (usato dal server per il check):
```typescript
// Nella chiamata fetch POST all'interno di persist():
fetch('/api/bookings', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ bookings, clientVersion: get().serverVersion }),
})
  .then(async (r) => {
    if (r.ok) {
      const { v } = await r.json() as { ok: boolean; v?: number };
      if (typeof v === 'number') set({ serverVersion: v, syncError: false });
    } else {
      set({ syncError: true });
    }
  })
  .catch(() => set({ syncError: true }));
```

---

### STEP 4 — Modifica `app/page.tsx`

Aggiungi `startPolling` allo shallow selector e avvia il polling con cleanup:

```typescript
const { startPolling } = useBookingStore(
  useShallow((s) => ({ startPolling: s.startPolling }))
);

// Avvia polling dopo il mount (dopo load())
useEffect(() => {
  const cleanup = startPolling();
  return cleanup; // ferma il polling al dismount
}, [startPolling]);
```

---

### STEP 5 — Indicatore di sync nell'UI (opzionale ma raccomandato)

Aggiungi nell'angolo in basso a destra un indicatore discreto:

```typescript
const syncError = useBookingStore((s) => s.syncError);

// Nel JSX, sopra <Toast />:
{syncError && (
  <div className="sync-error-badge">
    ⚠ Sync offline
  </div>
)}
```

CSS da aggiungere a `globals.css`:
```css
.sync-error-badge {
  position: fixed;
  bottom: 12px;
  right: 16px;
  background: #fef3c7;
  border: 1px solid #d97706;
  color: #92400e;
  font-size: 12px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 8px;
  z-index: 9999;
}
```

---

## REGOLE FERREE — NON TOCCARE

1. **NON modificare** `BookingDialog.tsx`, `GanttBoard.tsx`, `KPIPanel.tsx`, `MonthSummary.tsx`
2. **NON toccare** `globals.css` al di fuori dell'aggiunta del `.sync-error-badge`
3. **NON modificare** il tipo `Booking` in `lib/types.ts`
4. **NON toccare** la logica di `addBooking`, `updateBooking`, `deleteBooking` — solo `persist()` e `load()`
5. **NON modificare** `PasswordGate.tsx`
6. **Backward compat obbligatoria**: `GET /api/bookings` deve continuare a funzionare se il valore in KV è ancora il vecchio `Booking[]` grezzo (Array.isArray check)

---

## COMPORTAMENTO ATTESO DOPO LA FIX

| Scenario | Risultato |
|----------|-----------|
| Francesco aggiunge prenotazione | Salva su KV con `v: N+1` |
| Carlo ha la pagina aperta da 35 secondi | Il polling rileva `v > currentVersion`, scarica i nuovi dati, UI si aggiorna silenziosamente |
| Connessione internet assente | Continua a funzionare in locale, badge "Sync offline" appare |
| Entrambi modificano contemporaneamente | Last-write-wins (accettabile per questo use case) |
| Prima apertura (KV vuoto) | Carica da localStorage e sincronizza su KV |

---

## VERIFICA FINALE OBBLIGATORIA

Prima di considerare il task completato:

1. `npx tsc --noEmit` → zero errori
2. `npm run build` → build success su Vercel (non nel VM locale)
3. Test manuale: apri l'app su due tab diverse → aggiungi prenotazione su tab A → entro 35s la tab B mostra la nuova prenotazione senza ricaricare
4. Controlla che `GET /api/bookings` risponda con `{ v, ts, data }` e che vecchi payload `Booking[]` siano gestiti correttamente
