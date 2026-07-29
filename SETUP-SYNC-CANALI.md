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

Configurata in [`vercel.json`](vercel.json) a **ogni 3 ore** (8 esecuzioni al giorno).

Il motivo: la finestra di overbooking coincide con il tempo che passa tra una prenotazione
su un canale e il momento in cui la board la vede. Con una sola esecuzione giornaliera
quella finestra dura fino a 24 ore — in alta stagione è il tempo sufficiente perché una
camera venga venduta due volte. Con 3 ore il rischio residuo è ridotto di otto volte, a un
costo trascurabile.

> **Nota sul piano Vercel.** I cron sub-giornalieri richiedono il piano Pro. Su piano Hobby
> il deploy viene rifiutato con un errore sui limiti: in quel caso porta `schedule` a
> `"0 4 * * *"` (una volta al giorno alle 4). Il requisito minimo — almeno una volta al
> giorno — resta comunque soddisfatto.

Il pulsante **Sync canali** nell'app resta disponibile per una sincronizzazione manuale
immediata, indipendente dal cron.

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
