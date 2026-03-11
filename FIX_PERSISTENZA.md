# 🔴 DIAGNOSI COMPLETA — Problema Persistenza Dati

## Cosa succede esattamente

### Situazione attuale (ROTTA):

```
Utente sul browser A (Vercel) → aggiunge prenotazione
  ├─ localStorage del browser A ← salva ✓ (solo visibile a browser A)
  └─ POST /api/bookings → scrive su /tmp/bookings.json (Vercel instance #X)

Contabile apre lo stesso URL Vercel:
  ├─ browser contabile: localStorage VUOTO (non ha mai visitato il sito)
  └─ GET /api/bookings → Vercel instance #Y → /tmp/bookings.json NON ESISTE
     → ritorna [] → lo store carica SEED_BOOKINGS → vede solo i dati di test
```

### Perché `/tmp` su Vercel non funziona come database:
- Vercel è serverless: ogni richiesta può andare su una istanza diversa
- Ogni istanza ha la propria `/tmp` isolata e vuota al cold start
- NON è uno storage condiviso tra istanze o tra deploy
- È come salvare un file su un computer che si spegne ogni 5 minuti

### Perché l'utente principale vede i dati:
- Il suo browser ha i dati in localStorage (salvati lì prima della chiamata server)
- Quando GET /api/bookings ritorna [], lo store fa fallback a localStorage → dati visibili
- L'utente pensa che funzioni, ma funziona solo per lui sul suo browser

---

## Soluzione: JSONBin.io come database condiviso

**Perché JSONBin.io:**
- Completamente gratuito (10.000 richieste/giorno)
- Nessun account complesso, zero setup infrastrutturale
- Un semplice file JSON in cloud condiviso da tutti
- Funziona identicamente in locale e su Vercel
- Zero dipendenze npm aggiuntive (usa fetch nativo)

---

## ISTRUZIONI SETUP (fare UNA VOLTA manualmente)

### Step 1 — Crea account JSONBin
1. Vai su https://jsonbin.io
2. Registrati (email + password, gratuito)
3. Accedi alla dashboard

### Step 2 — Crea il Bin con i dati attuali
1. Clicca **"Create Bin"**
2. Incolla nel campo JSON il contenuto attuale di `data/bookings.json`
3. Clicca "Create Bin"
4. Copia il **Bin ID** (visibile nell'URL, es: `6650a1b2ad19ca34f8a1b2c3`)

### Step 3 — Crea la API Key
1. Vai su **"API Keys"** nella dashboard JSONBin
2. Clicca **"Create Access Key"**
3. Copia la chiave generata

### Step 4 — Aggiungi le variabili d'ambiente

**Nel file `.env.local`** (locale):
```
NEXT_PUBLIC_APP_PASSWORD=caccapanna73
JSONBIN_BIN_ID=INCOLLA_QUI_IL_BIN_ID
JSONBIN_API_KEY=INCOLLA_QUI_LA_API_KEY
```

**Su Vercel** (per la versione online):
1. Vai nel progetto Vercel → Settings → Environment Variables
2. Aggiungi `JSONBIN_BIN_ID` con il valore del Bin ID
3. Aggiungi `JSONBIN_API_KEY` con il valore della API Key
4. Clicca **Save** e poi **Redeploy**

---

## CODICE DA IMPLEMENTARE — Sostituire route.ts

**File: `app/api/bookings/route.ts`**

Sostituire l'intero contenuto con:

```typescript
import { NextResponse } from "next/server";
import type { Booking } from "@/lib/types";

const BIN_ID = process.env.JSONBIN_BIN_ID;
const API_KEY = process.env.JSONBIN_API_KEY;
const JSONBIN_URL = `https://api.jsonbin.io/v3/b/${BIN_ID}`;

function missingConfig(): boolean {
  return !BIN_ID || !API_KEY;
}

export async function GET() {
  if (missingConfig()) {
    return NextResponse.json(
      { bookings: [], error: "JSONBIN_BIN_ID o JSONBIN_API_KEY mancanti nel .env" },
      { status: 500 }
    );
  }
  try {
    const res = await fetch(`${JSONBIN_URL}/latest`, {
      headers: {
        "X-Master-Key": API_KEY!,
        "X-Bin-Meta": "false",
      },
      // Non cachare mai: vogliamo sempre i dati freschi
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`JSONBin GET failed: ${res.status}`);
    }
    const data = await res.json();
    // JSONBin ritorna direttamente l'array o { bookings: [] }
    const bookings: Booking[] = Array.isArray(data)
      ? data
      : Array.isArray(data?.bookings)
      ? data.bookings
      : [];
    return NextResponse.json({ bookings }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json(
      { bookings: [], error: String(e) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  if (missingConfig()) {
    return NextResponse.json(
      { error: "JSONBIN_BIN_ID o JSONBIN_API_KEY mancanti nel .env" },
      { status: 500 }
    );
  }
  try {
    const body = await request.json();
    const bookings: Booking[] = Array.isArray(body.bookings)
      ? body.bookings
      : Array.isArray(body)
      ? body
      : [];

    const res = await fetch(JSONBIN_URL, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Master-Key": API_KEY!,
      },
      body: JSON.stringify(bookings),
    });
    if (!res.ok) {
      throw new Error(`JSONBin PUT failed: ${res.status}`);
    }
    return NextResponse.json({ bookings });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
```

---

## MODIFICA store.ts — Rendere il sync AWAIT (non fire-and-forget)

**Problema attuale**: `syncToServer` è fire-and-forget. Se l'utente chiude il browser prima che la richiesta finisca, i dati non vengono salvati su JSONBin.

**In `lib/store.ts`**, modificare la funzione `syncToServer` per gestire meglio il caso di errore, e rendere `persist` più robusto:

Trovare questa sezione (riga ~99-108):
```typescript
function syncToServer(bookings: Booking[], setSync: (s: SyncStatus) => void): void {
  setSync("syncing");
  fetch("/api/bookings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bookings }),
  })
    .then((r) => (r.ok ? setSync("synced") : setSync("error")))
    .catch(() => setSync("error"));
}
```

Sostituirla con:
```typescript
function syncToServer(bookings: Booking[], setSync: (s: SyncStatus) => void): void {
  setSync("syncing");
  fetch("/api/bookings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bookings }),
  })
    .then((r) => {
      if (r.ok) {
        setSync("synced");
      } else {
        console.warn("[Store] syncToServer failed:", r.status);
        setSync("error");
      }
    })
    .catch((err) => {
      console.warn("[Store] syncToServer error:", err);
      setSync("error");
    });
}
```

---

## TEST DI VERIFICA

Dopo l'implementazione, verificare:

1. **Test locale**: `npm run dev` → apri http://localhost:3000 → aggiungi una prenotazione → apri in un altro browser (Firefox) → i dati devono essere visibili
2. **Test Vercel**: Aggiungi prenotazione online → invia il link al contabile → deve vedere i dati
3. **Test API**: Apri http://localhost:3000/api/bookings → deve ritornare l'array JSON delle prenotazioni
4. **Test sync status**: L'indicatore di sync in toolbar deve diventare verde dopo ogni modifica

---

## NOTA IMPORTANTE — Migrare i dati esistenti

Dopo aver creato il Bin su JSONBin con il contenuto di `data/bookings.json`:
- Il file locale `data/bookings.json` non viene più usato
- Aggiungere `data/bookings.json` a `.gitignore` (opzionale ma consigliato)
- Tutti i dati risiedono ora su JSONBin, accessibili da qualsiasi dispositivo

---

## PIANO B — Se JSONBin non va bene

Alternativa con Vercel KV (Redis, più robusto ma richiede piano Vercel a pagamento):
- `npm install @vercel/kv`
- Creare KV database dalla Vercel dashboard
- Sostituire fetch con `kv.get('bookings')` e `kv.set('bookings', data)`

Alternativa con Supabase (Postgres gratuito, più complesso):
- Richiede creazione tabella e migrazione schema
- Consigliato solo se i dati crescono oltre 1000 prenotazioni
