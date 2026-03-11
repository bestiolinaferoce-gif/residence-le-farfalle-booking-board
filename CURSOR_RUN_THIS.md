# ▶️ CURSOR: SEQUENZA ESATTA DA ESEGUIRE

## STEP 1 — Recupera le 22 prenotazioni dall'app online

Apri nel browser la versione online dell'app (su Vercel).
Clicca il pulsante **Esporta** nella toolbar.
Viene scaricato un file JSON (es. `villa-olimpia-booking-board-2026-XX.json`).
Segna dove è stato salvato (di solito nella cartella Downloads).

---

## STEP 2 — Crea il database condiviso con tutte le 22 prenotazioni

Nel terminale del progetto, esegui:

```bash
node scripts/setup-db.mjs /Users/TUO_NOME/Downloads/villa-olimpia-booking-board-2026-XX.json
```

> Sostituisci il percorso con quello reale del file scaricato.
> Se non trovi il file, esegui senza argomenti (carica le 10 locali):
> `node scripts/setup-db.mjs`

Lo script:
- Non richiede account, email, API key
- Crea automaticamente un database su jsonblob.com
- Carica tutte le prenotazioni
- Scrive il JSONBLOB_ID in `.env.local`
- Alla fine stampa il BLOB ID — **copialo**

---

## STEP 3 — Riavvia il server locale

```bash
npm run dev
```

Apri http://localhost:3000 — vedrai tutte le prenotazioni.

---

## STEP 4 — Configura Vercel (versione online)

1. Vai su **vercel.com** → clicca sul progetto
2. **Settings** → **Environment Variables**
3. Aggiungi variabile:
   - Nome: `JSONBLOB_ID`
   - Valore: (il BLOB ID stampato dallo script al passo 2)
4. Clicca **Save**
5. Vai su **Deployments** → clicca i 3 puntini sull'ultimo deploy → **Redeploy**

---

## ✅ RISULTATO FINALE

Da questo momento:
- Locale e online mostrano gli stessi dati
- Il contabile aprendo il link vede tutte le prenotazioni
- Ogni modifica (aggiunta/modifica/cancellazione) è visibile a tutti in tempo reale

---

## File già aggiornati (Cursor NON deve toccarli):
- `app/api/bookings/route.ts` ✓ — usa jsonblob.com
- `lib/store.ts` ✓ — sync funzionante
- `scripts/setup-db.mjs` ✓ — zero account richiesti
