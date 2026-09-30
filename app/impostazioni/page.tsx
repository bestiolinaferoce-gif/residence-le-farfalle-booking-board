"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, Copy, Plus, Trash2 } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { useSettingsStore } from "@/lib/settingsStore";
import { missingRequiredFields, type BoardSettings, type IcalFeed, type Season } from "@/lib/settings";
import type { RoomConfig } from "@/lib/rooms";
import { ALLOGGIATI_WEB_URL } from "@/lib/property";
import type { Lodge } from "@/lib/types";
import { LODGES } from "@/lib/types";

const STEPS = ["Struttura", "Camere", "Listino", "Adempimenti", "Canali OTA"] as const;

function SettingsPage() {
  const router = useRouter();
  const params = useSearchParams();
  const wizard = params.get("wizard") === "1";

  const settings = useSettingsStore((s) => s.settings);
  const loaded = useSettingsStore((s) => s.loaded);
  const saving = useSettingsStore((s) => s.saving);
  const error = useSettingsStore((s) => s.error);
  const load = useSettingsStore((s) => s.load);
  const save = useSettingsStore((s) => s.save);

  const [draft, setDraft] = useState<BoardSettings>(settings);
  const [step, setStep] = useState(0);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, [load]);

  // Il draft segue il server finché l'utente non inizia a modificare.
  useEffect(() => {
    if (loaded) setDraft(settings);
  }, [loaded, settings]);

  const missing = useMemo(() => missingRequiredFields(draft), [draft]);

  function patch(next: Partial<BoardSettings>) {
    setDraft((prev) => ({ ...prev, ...next }));
  }

  function patchProperty(next: Partial<BoardSettings["property"]>) {
    setDraft((prev) => ({ ...prev, property: { ...prev.property, ...next } }));
  }

  function patchRoom(id: Lodge, next: Partial<RoomConfig>) {
    setDraft((prev) => ({
      ...prev,
      rooms: prev.rooms.map((room) => (room.id === id ? { ...room, ...next } : room)),
    }));
  }

  function patchSeason(id: string, next: Partial<Season>) {
    setDraft((prev) => ({
      ...prev,
      seasons: prev.seasons.map((season) => (season.id === id ? { ...season, ...next } : season)),
    }));
  }

  async function persist(extra?: Partial<BoardSettings>) {
    const ok = await save({ ...draft, ...extra });
    if (ok) setSavedAt(new Date().toLocaleTimeString("it-IT"));
    return ok;
  }

  async function finishWizard() {
    const ok = await persist({ onboardingDone: true });
    if (ok) router.replace("/");
  }

  const activeRooms = draft.rooms.filter((room) => room.active);

  return (
    <main className="page-root">
      <AppHeader />

      {wizard && (
        <section className="section">
          <h1 className="section-title">Configurazione iniziale</h1>
          <p className="section-hint">
            Cinque passaggi e la board è tua. I dati della struttura sono già inseriti: controllali e
            correggi ciò che serve. Quello che non sai ancora puoi lasciarlo vuoto e completarlo dopo.
          </p>
          <div className="wizard-steps">
            {STEPS.map((label, index) => (
              <button
                key={label}
                type="button"
                className="wizard-step"
                data-state={index === step ? "current" : index < step ? "done" : "todo"}
                onClick={() => setStep(index)}
              >
                <span className="wizard-dot">{index < step ? <Check size={13} /> : index + 1}</span>
                {label}
              </button>
            ))}
          </div>
        </section>
      )}

      {(!wizard || step === 0) && (
        <section className="section">
          <h2 className="section-title">Dati struttura</h2>
          <p className="section-hint">
            Compaiono in board, preventivi, PDF e feed iCal. Il CIN è esposto in ogni schermata: è un
            obbligo di legge per gli annunci.
          </p>
          <div className="field-grid">
            <div className="field">
              <label>Nome struttura</label>
              <input value={draft.property.name} onChange={(e) => patchProperty({ name: e.target.value })} />
            </div>
            <div className="field">
              <label>Sottotitolo</label>
              <input value={draft.property.tagline} onChange={(e) => patchProperty({ tagline: e.target.value })} />
            </div>
            <div className="field">
              <label>Indirizzo</label>
              <input value={draft.property.address} onChange={(e) => patchProperty({ address: e.target.value })} />
            </div>
            <div className="field">
              <label>Comune</label>
              <input
                value={draft.property.municipality}
                onChange={(e) => patchProperty({ municipality: e.target.value })}
              />
            </div>
            <div className="field">
              <label>CAP</label>
              <input value={draft.postalCode} onChange={(e) => patch({ postalCode: e.target.value })} />
            </div>
            <div className="field">
              <label>Telefono</label>
              <input value={draft.property.phone} onChange={(e) => patchProperty({ phone: e.target.value })} />
            </div>
            <div className="field">
              <label>Email</label>
              <input value={draft.property.email} onChange={(e) => patchProperty({ email: e.target.value })} />
            </div>
            <div className="field">
              <label>Sito web</label>
              <input
                value={draft.property.website}
                placeholder="https://…"
                onChange={(e) => patchProperty({ website: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Titolare</label>
              <input value={draft.property.ownerName} onChange={(e) => patchProperty({ ownerName: e.target.value })} />
            </div>
            <div className="field">
              <label>Codice fiscale titolare</label>
              <input
                value={draft.property.ownerFiscalCode}
                onChange={(e) => patchProperty({ ownerFiscalCode: e.target.value.toUpperCase() })}
              />
            </div>
            <div className={`field${draft.property.vatNumber ? "" : " field-todo"}`}>
              <label>
                Partita IVA {draft.property.vatNumber ? "" : <span className="todo-tag">da compilare</span>}
              </label>
              <input value={draft.property.vatNumber} onChange={(e) => patchProperty({ vatNumber: e.target.value })} />
            </div>
            <div className="field">
              <label>CIN</label>
              <input value={draft.property.cin} onChange={(e) => patchProperty({ cin: e.target.value.toUpperCase() })} />
            </div>
            <div className="field">
              <label>CIR</label>
              <input value={draft.property.cir} onChange={(e) => patchProperty({ cir: e.target.value.toUpperCase() })} />
            </div>
          </div>

          <h3 className="section-title" style={{ fontSize: "1rem" }}>
            Coordinate bancarie
          </h3>
          <p className="section-hint">Usate nei riepiloghi pagamenti e nei preventivi. Visibili solo al proprietario.</p>
          <div className="field-grid">
            <div className="field">
              <label>Intestatario</label>
              <input
                value={draft.property.bank.holder}
                onChange={(e) => patchProperty({ bank: { ...draft.property.bank, holder: e.target.value } })}
              />
            </div>
            <div className="field">
              <label>IBAN</label>
              <input
                value={draft.property.bank.iban}
                onChange={(e) => patchProperty({ bank: { ...draft.property.bank, iban: e.target.value } })}
                style={{ fontFamily: "monospace" }}
              />
            </div>
            <div className="field">
              <label>BIC</label>
              <input
                value={draft.property.bank.bic}
                onChange={(e) => patchProperty({ bank: { ...draft.property.bank, bic: e.target.value } })}
              />
            </div>
            <div className="field">
              <label>Istituto</label>
              <input
                value={draft.property.bank.bank}
                onChange={(e) => patchProperty({ bank: { ...draft.property.bank, bank: e.target.value } })}
              />
            </div>
          </div>
        </section>
      )}

      {(!wizard || step === 1) && (
        <section className="section">
          <h2 className="section-title">Camere</h2>
          <p className="section-hint">
            Rinomina le camere come le chiami tu: il nome cambia ovunque, ma le prenotazioni già
            salvate e i link iCal consegnati alle OTA restano validi. Disattiva quelle che non
            affitti — spariscono dalla board senza perdere lo storico.
          </p>
          <div className="rooms-grid">
            {draft.rooms.map((room) => (
              <article key={room.id} className="room-card" data-active={room.active}>
                <header>
                  <span className="room-dot" style={{ background: room.color }} />
                  <span className="room-id">{room.id}</span>
                  <label className="checkbox-line" style={{ marginLeft: "auto" }}>
                    <input
                      type="checkbox"
                      checked={room.active}
                      onChange={(e) => patchRoom(room.id, { active: e.target.checked })}
                    />
                    Attiva
                  </label>
                </header>
                <div className="field">
                  <label>Nome mostrato</label>
                  <input value={room.name} onChange={(e) => patchRoom(room.id, { name: e.target.value })} />
                </div>
                <div className="field-grid">
                  <div className="field">
                    <label>Posti letto</label>
                    <input
                      type="number"
                      min={1}
                      value={room.capacity}
                      onChange={(e) => patchRoom(room.id, { capacity: Math.max(1, Number(e.target.value || 1)) })}
                    />
                  </div>
                  <div className="field">
                    <label>Colore</label>
                    <input
                      type="color"
                      value={room.color}
                      onChange={(e) => patchRoom(room.id, { color: e.target.value })}
                      style={{ height: 42, padding: 4 }}
                    />
                  </div>
                </div>
              </article>
            ))}
          </div>
          <p className="section-hint">
            Camere attive: <strong>{activeRooms.length}</strong> · posti letto totali:{" "}
            <strong>{activeRooms.reduce((acc, room) => acc + room.capacity, 0)}</strong>
            {activeRooms.length < LODGES.length ? " · gli slot spenti restano disponibili se aggiungi camere." : ""}
          </p>
        </section>
      )}

      {(!wizard || step === 2) && (
        <section className="section">
          <h2 className="section-title">Listino stagionale</h2>
          <p className="section-hint">
            Il prezzo proposto nel form prenotazione dipende dalla data di check-in. I periodi non
            sono precompilati: le stagioni le decidi tu, e un intervallo inventato produrrebbe
            preventivi sbagliati.
          </p>
          {draft.seasons.map((season) => (
            <div key={season.id} className="field-grid season-row">
              <div className="field">
                <label>Stagione</label>
                <input value={season.label} onChange={(e) => patchSeason(season.id, { label: e.target.value })} />
              </div>
              <div className={`field${season.from ? "" : " field-todo"}`}>
                <label>Dal (MM-GG)</label>
                <input
                  placeholder="06-01"
                  value={season.from}
                  onChange={(e) => patchSeason(season.id, { from: e.target.value })}
                />
              </div>
              <div className={`field${season.to ? "" : " field-todo"}`}>
                <label>Al (MM-GG)</label>
                <input
                  placeholder="09-15"
                  value={season.to}
                  onChange={(e) => patchSeason(season.id, { to: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Prezzo a notte (€)</label>
                <input
                  type="number"
                  min={0}
                  value={season.price ?? ""}
                  onChange={(e) =>
                    patchSeason(season.id, { price: e.target.value === "" ? null : Number(e.target.value) })
                  }
                />
                {season.note ? <span className="section-hint">{season.note}</span> : null}
              </div>
            </div>
          ))}
          <button
            type="button"
            className="ghost-btn"
            onClick={() =>
              patch({
                seasons: [
                  ...draft.seasons,
                  { id: `s-${Date.now()}`, label: "Nuova stagione", from: "", to: "", price: null, note: "" },
                ],
              })
            }
          >
            <Plus size={15} /> Aggiungi stagione
          </button>
        </section>
      )}

      {(!wizard || step === 3) && (
        <section className="section">
          <h2 className="section-title">Adempimenti e imposta di soggiorno</h2>
          <p className="section-hint">
            L&apos;imposta la delibera il Comune: finché i parametri restano vuoti la board scrive
            &quot;DA VERIFICARE&quot; invece di calcolare una cifra che finirebbe in mano a un ospite.
          </p>
          <div className="field-grid">
            <div className={`field${draft.touristTax.amountPerPersonPerNight === null ? " field-todo" : ""}`}>
              <label>
                € per persona a notte{" "}
                {draft.touristTax.amountPerPersonPerNight === null ? <span className="todo-tag">da compilare</span> : null}
              </label>
              <input
                type="number"
                step="0.01"
                min={0}
                value={draft.touristTax.amountPerPersonPerNight ?? ""}
                onChange={(e) =>
                  patch({
                    touristTax: {
                      ...draft.touristTax,
                      amountPerPersonPerNight: e.target.value === "" ? null : Number(e.target.value),
                    },
                  })
                }
              />
            </div>
            <div className={`field${draft.touristTax.maxTaxableNights === null ? " field-todo" : ""}`}>
              <label>Notti massime tassabili (vuoto = nessun tetto)</label>
              <input
                type="number"
                min={0}
                value={draft.touristTax.maxTaxableNights ?? ""}
                onChange={(e) =>
                  patch({
                    touristTax: {
                      ...draft.touristTax,
                      maxTaxableNights: e.target.value === "" ? null : Number(e.target.value),
                    },
                  })
                }
              />
            </div>
            <div className="field">
              <label>Esenzione sotto i (anni)</label>
              <input
                type="number"
                min={0}
                value={draft.touristTax.exemptUnderAge ?? ""}
                onChange={(e) =>
                  patch({
                    touristTax: {
                      ...draft.touristTax,
                      exemptUnderAge: e.target.value === "" ? null : Number(e.target.value),
                    },
                  })
                }
              />
            </div>
            <div className="field">
              <label>Periodo di applicazione (MM-GG)</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  placeholder="dal 04-01"
                  value={draft.touristTax.seasonStart ?? ""}
                  onChange={(e) =>
                    patch({ touristTax: { ...draft.touristTax, seasonStart: e.target.value || null } })
                  }
                />
                <input
                  placeholder="al 10-31"
                  value={draft.touristTax.seasonEnd ?? ""}
                  onChange={(e) => patch({ touristTax: { ...draft.touristTax, seasonEnd: e.target.value || null } })}
                />
              </div>
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label>Altre esenzioni (note per il rendiconto)</label>
              <textarea
                rows={2}
                value={draft.touristTax.exemptionNotes}
                onChange={(e) => patch({ touristTax: { ...draft.touristTax, exemptionNotes: e.target.value } })}
              />
            </div>
            <div className="field">
              <label>URL portale ROSS1000</label>
              <input value={draft.ross1000Url} onChange={(e) => patch({ ross1000Url: e.target.value })} />
              <span className="section-hint">
                Verifica l&apos;indirizzo corrente della piattaforma flussi turistici della tua Regione.
              </span>
            </div>
            <div className="field">
              <label>Portale Alloggiati Web</label>
              <input readOnly value={ALLOGGIATI_WEB_URL} style={{ color: "var(--muted)" }} />
            </div>
          </div>
        </section>
      )}

      {(!wizard || step === 4) && (
        <section className="section">
          <h2 className="section-title">Canali OTA e feed iCal</h2>
          <p className="section-hint">
            Incolla qui i link iCal di Booking e Airbnb: la board li legge e importa le prenotazioni.
            Un feed senza camera indicata finisce nella corsia &quot;Da assegnare&quot;, perché i portali
            multi-unità non dicono quale camera hanno venduto.
          </p>

          {draft.icalFeeds.length === 0 && <p className="today-empty">Nessun feed configurato.</p>}

          {draft.icalFeeds.map((feed, index) => (
            <div key={feed.id} className="field-grid season-row">
              <div className="field">
                <label>Canale</label>
                <select
                  value={feed.channel}
                  onChange={(e) => {
                    const feeds = [...draft.icalFeeds];
                    feeds[index] = { ...feed, channel: e.target.value as IcalFeed["channel"] };
                    patch({ icalFeeds: feeds });
                  }}
                >
                  <option value="booking">Booking.com</option>
                  <option value="airbnb">Airbnb</option>
                  <option value="expedia">Expedia</option>
                  <option value="other">Altro</option>
                </select>
              </div>
              <div className="field">
                <label>Camera</label>
                <select
                  value={feed.lodge}
                  onChange={(e) => {
                    const feeds = [...draft.icalFeeds];
                    feeds[index] = { ...feed, lodge: e.target.value as Lodge | "" };
                    patch({ icalFeeds: feeds });
                  }}
                >
                  <option value="">Feed di struttura (da assegnare)</option>
                  {activeRooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field" style={{ gridColumn: "span 2" }}>
                <label>URL iCal</label>
                <input
                  value={feed.url}
                  placeholder="https://…/calendar.ics"
                  onChange={(e) => {
                    const feeds = [...draft.icalFeeds];
                    feeds[index] = { ...feed, url: e.target.value };
                    patch({ icalFeeds: feeds });
                  }}
                />
              </div>
              <button
                type="button"
                className="danger-btn"
                onClick={() => patch({ icalFeeds: draft.icalFeeds.filter((f) => f.id !== feed.id) })}
              >
                <Trash2 size={15} /> Rimuovi
              </button>
            </div>
          ))}

          <button
            type="button"
            className="ghost-btn"
            onClick={() =>
              patch({
                icalFeeds: [
                  ...draft.icalFeeds,
                  { id: `f-${Date.now()}`, lodge: "", channel: "booking", url: "", label: "" },
                ],
              })
            }
          >
            <Plus size={15} /> Aggiungi feed
          </button>

          <h3 className="section-title" style={{ fontSize: "1rem" }}>
            I tuoi feed da consegnare alle OTA
          </h3>
          <p className="section-hint">
            Un link per camera: incollalo nell&apos;extranet del portale perché veda le tue date occupate.
          </p>
          {activeRooms.map((room) => {
            const url = typeof window !== "undefined" ? `${window.location.origin}/api/ical/${encodeURIComponent(room.id)}.ics` : "";
            return (
              <div key={room.id} className="feed-row">
                <span className="room-dot" style={{ background: room.color }} />
                <strong>{room.name}</strong>
                <code>{url}</code>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => void navigator.clipboard.writeText(url)}
                  aria-label={`Copia link di ${room.name}`}
                >
                  <Copy size={14} /> Copia
                </button>
              </div>
            );
          })}
        </section>
      )}

      <section className="section save-bar">
        {missing.length > 0 && (
          <p className="section-hint">
            Da completare: <strong>{missing.join(", ")}</strong>. Puoi salvare comunque e finire dopo.
          </p>
        )}
        {error && <p className="login-error">{error}</p>}
        {savedAt && !saving && <span className="pill pill-ok">Salvato alle {savedAt}</span>}

        <div style={{ display: "flex", gap: 10, marginLeft: "auto", flexWrap: "wrap" }}>
          {wizard && step > 0 && (
            <button type="button" className="ghost-btn" onClick={() => setStep((s) => s - 1)}>
              <ChevronLeft size={15} /> Indietro
            </button>
          )}
          {wizard && step < STEPS.length - 1 ? (
            <button
              type="button"
              className="primary-btn"
              onClick={async () => {
                await persist();
                setStep((s) => s + 1);
              }}
            >
              Avanti <ChevronRight size={15} />
            </button>
          ) : (
            <button type="button" className="primary-btn" onClick={() => (wizard ? finishWizard() : persist())} disabled={saving}>
              {saving ? "Salvataggio…" : wizard ? "Fine — apri la board" : "Salva impostazioni"}
            </button>
          )}
        </div>
      </section>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SettingsPage />
    </Suspense>
  );
}
