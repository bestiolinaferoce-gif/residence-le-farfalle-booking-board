# Attivazione sincronizzazione canali e PDF

Guida operativa per completare la configurazione. Il codice è già in produzione: mancano
solo i valori, che vanno inseriti su Vercel perché contengono segreti e URL privati.

---

## 1. Variabili d'ambiente su Vercel

Vai su **Vercel → progetto `residence-le-farfalle-booking-board` → Settings → Environment
Variables** e aggiungi le tre voci qui sotto per l'ambiente **Production**.

### `ICAL_SYNC_CONFIG`

Array JSON delle sorgenti. **Ometti `lodge`** per i feed di struttura: sia Booking.com sia
Airbnb vendono l'inventario complessivo senza dire quale unità è stata occupata, quindi le
prenotazioni entrano nella corsia "Da assegnare" e l'unità la confermi tu.

```json
[
  { "channel": "booking", "url": "INCOLLA_QUI_URL_ICAL_BOOKING", "label": "Booking.com struttura" },
  { "channel": "airbnb",  "url": "INCOLLA_QUI_URL_ICAL_AIRBNB",  "label": "Airbnb struttura" }
]
```

Dove trovare i due URL:

| Canale | Percorso |
|---|---|
| Booking.com | Extranet → Tariffe e disponibilità → Sincronizzazione calendari → Esporta calendario |
| Airbnb | Calendario → Impostazioni disponibilità → Sincronizza calendari → Esporta calendario |

Se in futuro un annuncio corrisponde a una singola unità, aggiungi `"lodge": "Limone"` a
quella voce: quelle prenotazioni salteranno la corsia e andranno dritte sull'unità. Non
serve toccare il codice.

### `CRON_SECRET`

Protegge l'endpoint del cron. Genera un valore casuale:

```bash
openssl rand -hex 32
```

Senza questa variabile il cron risponde `503` e resta spento: meglio fermo che aperto a
scritture pubbliche.

### `ICAL_FEED_TOKEN`

Rende il feed in uscita non indovinabile. Genera anche questo:

```bash
openssl rand -hex 32
```

Finché non lo imposti, `/api/calendar` resta pubblico come prima — nessuna regressione, ma
neanche protezione.

Dopo aver salvato le variabili serve un **redeploy** perché vengano lette.

---

## 2. Cadenza del cron

Configurata in [`vercel.json`](vercel.json) a **una volta al giorno alle 04:00 UTC**
(06:00 ora italiana in estate): prima che inizino i check-in, dopo le prenotazioni notturne.

**Questa non è la cadenza ideale, è quella consentita dal piano.** Il progetto è su piano
Hobby, che limita i cron a un'esecuzione giornaliera: con `0 */3 * * *` il deploy viene
rifiutato con l'errore

> Hobby accounts are limited to daily cron jobs.

La cadenza giusta sarebbe **ogni 3 ore**. Il motivo: la finestra di overbooking coincide
col tempo che passa tra una vendita su un canale e il momento in cui la board la vede. Con
una sola esecuzione al giorno quella finestra resta larga fino a 24 ore — in alta stagione
è tempo sufficiente perché la stessa camera venga venduta due volte, che è esattamente
quanto è successo ad agosto 2026.

Due modi per stringerla:

1. **Piano Pro su Vercel.** Poi in `vercel.json` porta `schedule` a `"0 */3 * * *"`.
2. **Scheduler esterno gratuito** (per esempio cron-job.org), puntato su
   `https://residence-le-farfalle-booking-board.vercel.app/api/cron/channel-sync` con
   header `Authorization: Bearer <CRON_SECRET>`. L'endpoint è lo stesso e verifica il
   token, quindi funziona identicamente.

Nel frattempo il pulsante **Sync canali** nell'app esegue una sincronizzazione manuale
immediata: usalo quando ricevi una notifica di prenotazione da un canale e vuoi allineare
la board senza aspettare il cron.

---

## 3. Feed in uscita: dove incollarlo

Premi **iCal** nella toolbar dell'app: copia l'URL già completo di token. Contiene tutte le
prenotazioni attive, **incluse le dirette** — sono proprio quelle che gli altri canali non
vedono e che causavano gli overbooking. Le cancellate e le "da assegnare" restano escluse.

### Booking.com

1. Extranet → **Tariffe e disponibilità** → **Sincronizzazione calendari**
2. **Importa calendario** → **Aggiungi calendario connesso**
3. Incolla l'URL, dai un nome riconoscibile (es. `Booking Board`), salva

### Airbnb

1. **Calendario** → **Impostazioni disponibilità**
2. **Sincronizza calendari** → **Collega un altro sito web**
3. Incolla l'URL, assegna un nome, salva

Entrambe le piattaforme rileggono il feed periodicamente da sole, in genere ogni poche ore.

---

## 4. Imposta di soggiorno

I parametri **non sono nel codice** e non hanno valori predefiniti: variano per delibera
comunale e inventarli significherebbe chiedere un importo sbagliato a un ospite reale.

Si inseriscono dall'app: **Scarica PDF** → riquadro *Imposta di soggiorno*. Servono i
valori del regolamento del **Comune di Isola di Capo Rizzuto**:

- importo per persona a notte
- numero massimo di notti tassabili
- età di esenzione dei minori
- periodo di applicazione nell'anno (formato `MM-GG`)
- altre esenzioni, come nota libera

Finché importo e notti massime mancano, il PDF stampa **DA VERIFICARE** su ogni riga e un
avviso nel riepilogo, invece di un importo stimato.

---

## 5. Verifica dopo la configurazione

```bash
curl -s "https://residence-le-farfalle-booking-board.vercel.app/api/channel-sync" | jq
```

Deve elencare le sorgenti configurate con `"scope": "property"`. Poi premi **Sync canali**
nell'app: le prenotazioni importate compaiono nella corsia arancione "Da assegnare" e nel
pannello in cima alla board, con la proposta dell'unità libera da confermare.
