# CURSOR PROMPT — Leggibilità Booking Board + Home Color

---

## CONTESTO DEL PROBLEMA

Il calendario delle prenotazioni mostra le celle di booking con testo troncato e illeggibile (es. `"711n"`, `"317n"`, `"811n"`). L'utente deve cliccare casualmente sui pulsanti per capire di quale prenotazione si tratta. Questo è il problema principale da risolvere.

---

## ISTRUZIONI OBBLIGATORIE

> ⚠️ NON modificare la logica applicativa, i dati, le API, il backend, né la struttura dei componenti esistenti.
> Intervieni SOLO su aspetti visivi/UI: tooltip, label, colori, dimensioni testo.
> Se un file non va toccato per risolvere il problema, NON toccarlo.

---

## OBIETTIVO 1 — Rendere leggibili le celle di prenotazione (PRIORITÀ MASSIMA)

Nelle celle del calendario delle prenotazioni (booking board), ogni prenotazione deve mostrare **almeno questi dati direttamente visibili**, senza dover cliccare:

1. **Nome ospite** (o riferimento prenotazione) — non troncato o abbreviato
2. **Numero di notti** in forma leggibile (es. `3 notti`, non `317n`)
3. **Fonte prenotazione** se disponibile (es. Airbnb, Booking.com, diretto)

### Come intervenire:

**a) Tooltip ricco al passaggio del mouse**
Aggiungi un tooltip HTML nativo (`title="..."`) o un tooltip styled (con `position: absolute`, z-index alto, sfondo scuro, testo bianco) che appare al hover sulla cella. Il tooltip deve contenere:
- Nome ospite
- Date check-in / check-out
- Numero notti
- Fonte/canale prenotazione
- Eventuale importo o note se presenti nei dati

**b) Testo visibile nella cella**
Se la cella ha larghezza sufficiente (>80px), mostra il nome ospite troncato con `text-overflow: ellipsis` ma con `font-size` leggibile (minimo 11px). Rimuovi o sostituisci le stringhe codificate tipo `"711n"` con etichette human-readable.

**c) Celle troppo strette**
Se la cella è troppo stretta per mostrare testo, aggiungi almeno un'icona o colore distintivo + tooltip al hover. Non lasciare mai la cella completamente opaca senza informazioni.

---

## OBIETTIVO 2 — Home page con colore alternativo (OPZIONALE)

Aggiungi la possibilità di cambiare il colore di sfondo della **home page / dashboard principale** tra due varianti:

- **Variante A (default attuale)**: mantieni i colori esistenti invariati
- **Variante B (opzionale)**: aggiungi un secondo tema colore (es. sfondo `#1a1a2e` dark blue, o un beige caldo `#fdf6ec`) selezionabile tramite un toggle o un pulsante nella navbar/header

### Come implementare:
- Usa una variabile CSS (`--home-bg`) o una classe CSS sulla root/body (es. `.theme-alternate`)
- Il toggle deve salvare la preferenza in `localStorage` in modo che persista al refresh
- NON toccare i colori delle celle di prenotazione o del calendario — solo la home/dashboard

---

## OBIETTIVO 3 — Verifica finale (DA FARE DOPO LE MODIFICHE)

Prima di considerare il lavoro completato, verifica che:

- [ ] Le celle di prenotazione mostrano info leggibili (nome o tooltip) su tutti i browser principali
- [ ] Il tooltip non viene tagliato dai bordi della viewport
- [ ] Le celle esistenti non hanno cambiato dimensioni o layout che rompono il calendario
- [ ] Il toggle del colore home (se implementato) non interferisce con gli stili del calendario
- [ ] Nessuna funzionalità esistente è stata rotta (prenotazioni, filtri, navigazione date)
- [ ] Il codice compila/avvia senza errori (`npm run dev` o equivalente)

---

## COSA NON FARE

- ❌ NON refactorare componenti esistenti
- ❌ NON cambiare nomi di variabili, funzioni o props
- ❌ NON modificare file di routing, store, API o backend
- ❌ NON aggiungere librerie esterne senza esplicita necessità
- ❌ NON cambiare la struttura del calendario (colonne, righe, date)
- ❌ NON alterare la logica di fetch/caricamento prenotazioni

---

## FORMATO RISPOSTA ATTESO

Per ogni file modificato, mostra:
1. Il nome del file
2. Solo le righe cambiate (diff format o sezione specifica) — NON l'intero file
3. Una spiegazione di una riga sul perché quella modifica risolve il problema

---
