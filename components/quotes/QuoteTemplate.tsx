"use client";

import { forwardRef, useCallback, useState } from "react";
import {
  Anchor,
  Building2,
  CalendarDays,
  Car,
  Castle,
  Check,
  Copy,
  FileText,
  Home,
  Landmark,
  MapPin,
  PawPrint,
  Phone,
  Sparkles,
  TreePine,
  Users,
  Waves,
  Wifi,
} from "lucide-react";
import {
  bankDetails,
  policies,
  quoteDocument,
  quoteLodges,
  residenceContact,
  residenceStructure,
  residenceTerritoryPoints,
  getLodgeQuoteProfile,
  lodgeQuotePresentation,
  lodgeStructuralLine,
  type QuoteLodge,
  type QuoteLodgeId,
} from "./quoteConfig";
import type { QuoteComputed } from "./quoteUtils";
import { formatCurrencyEUR, formatDateIt, formatIbanSpaced } from "./quoteUtils";

export type QuoteTemplateProps = {
  quoteNumber: string;
  issuedAt: string;
  clientName: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  lodgeId: QuoteLodgeId;
  lodgeName: string;
  lodgeDescription: string;
  lodgeFactsLine?: string | null;
  compareLodge?: QuoteLodge;
  includeSanitization: boolean;
  computed: QuoteComputed;
  photoUrl?: string;
};

function TerritoryIcon({ kind }: { kind: (typeof residenceTerritoryPoints)[number]["icon"] }) {
  switch (kind) {
    case "waves": return <Waves size={18} aria-hidden />;
    case "anchor": return <Anchor size={18} aria-hidden />;
    case "castle": return <Castle size={18} aria-hidden />;
    default: return <MapPin size={18} aria-hidden />;
  }
}

function BankBlock({ featured }: { featured?: boolean }) {
  const [copied, setCopied] = useState(false);
  const spaced = bankDetails.iban !== "—" ? formatIbanSpaced(bankDetails.iban) : "—";
  const copy = useCallback(async () => {
    const raw = bankDetails.iban.replace(/\s/g, "");
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(raw);
      } else {
        const ta = document.createElement("textarea");
        ta.value = raw;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.alert(`Copia manualmente l'IBAN:\n${raw}`);
    }
  }, []);

  return (
    <div className={`qt-bank${featured ? " qt-bank--featured" : ""}`}>
      <div className="qt-bank-head">
        <Landmark className="qt-bank-icon" size={24} aria-hidden />
        <div>
          <h3 className="qt-bank-title">Coordinate bancarie — versamento acconto</h3>
          <p className="qt-bank-sub">Dati per bonifico bancario (30% acconto)</p>
        </div>
      </div>
      <div className="qt-bank-grid">
        <div className="qt-bank-field">
          <span className="qt-bank-label">Intestatario</span>
          <span className="qt-bank-value">{bankDetails.accountHolder}</span>
        </div>
        <div className="qt-bank-field qt-bank-iban-wrap">
          <span className="qt-bank-label">IBAN</span>
          {bankDetails.iban === "—" ? (
            <span className="qt-bank-value" style={{ opacity: 0.6 }}>Da comunicare in fase di conferma</span>
          ) : (
            <div className="qt-bank-iban-row">
              <code className="qt-bank-iban">{spaced}</code>
              <button type="button" className="qt-bank-copy" onClick={copy} title="Copia IBAN">
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? " Copiato" : " Copia"}
              </button>
            </div>
          )}
        </div>
        {bankDetails.bic !== "—" && (
          <div className="qt-bank-field">
            <span className="qt-bank-label">BIC / SWIFT</span>
            <span className="qt-bank-value">{bankDetails.bic}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function CompareRow({ lodge }: { lodge: QuoteLodge }) {
  const pres = lodgeQuotePresentation(lodge);
  const facts = lodgeStructuralLine(lodge);
  return (
    <tr>
      <th scope="row" className="qt-compare-lodge">{lodge.name}</th>
      <td>
        <p className="qt-compare-cell-lead">{pres.composition}</p>
        {facts ? <p className="qt-compare-cell-sub">{facts}</p> : null}
      </td>
      <td>
        <ul className="qt-compare-list">{pres.strengths.map((s) => <li key={s}>{s}</li>)}</ul>
      </td>
      <td>
        <ul className="qt-compare-list">{pres.equipment.map((s) => <li key={s}>{s}</li>)}</ul>
      </td>
    </tr>
  );
}

function SheetRunning({ page, quoteNumber }: { page: string; quoteNumber: string }) {
  return (
    <div className="qt-sheet-running">
      <span>Residence Le Farfalle — {quoteDocument.docTitle}</span>
      <span>Rif. {quoteNumber} · pag. {page}</span>
    </div>
  );
}

export const QuoteTemplate = forwardRef<HTMLDivElement, QuoteTemplateProps>(
  function QuoteTemplate(props, ref) {
    const {
      quoteNumber,
      issuedAt,
      clientName,
      checkIn,
      checkOut,
      guests,
      lodgeId,
      lodgeName,
      lodgeDescription,
      lodgeFactsLine,
      compareLodge,
      includeSanitization,
      computed,
      photoUrl,
    } = props;

    const primaryLodge = quoteLodges.find((l) => l.id === lodgeId) ?? quoteLodges[0];
    const lodgeProfile = getLodgeQuoteProfile(primaryLodge);

    const waDigits = residenceContact.whatsappDigits;
    const whatsappHref = /^[0-9]{10,15}$/.test(waDigits) ? `https://wa.me/${waDigits}` : null;

    const clientLine =
      clientName.trim().length > 0
        ? `${quoteDocument.clientGreetingLead} ${clientName.trim()},`
        : `${quoteDocument.clientGreetingLead} cliente,`;

    const showCompare = compareLodge && compareLodge.id !== primaryLodge.id;
    const optionCount = showCompare ? 2 : 1;
    const issuedLabel = formatDateIt(issuedAt.slice(0, 10));

    return (
      <div ref={ref} className="quotes-template">
        {/* ——— Pagina 1: copertina ——— */}
        <div className="qt-sheet" data-quote-page="1">
          <header className="qt-header qt-header--cover" data-quote-section="copertina">
            <div className="qt-logo" aria-hidden style={{ fontSize: 36, display: "flex", alignItems: "center", justifyContent: "center" }}>
              🦋
            </div>
            <div className="qt-header-text">
              <span className="qt-badge">
                <FileText size={13} style={{ verticalAlign: "middle", marginRight: 6 }} />
                {quoteDocument.docBadge}
              </span>
              <h1>{quoteDocument.docTitle}</h1>
              <p className="qt-header-tagline">{quoteDocument.headerTagline}</p>
              <p className="qt-ref">
                Riferimento pratica: <strong>{quoteNumber}</strong>
                {" · "}Emesso il <strong>{issuedLabel}</strong>
              </p>
            </div>
          </header>

          <div className="qt-cover-body">
            <div className="qt-cover-grid">
              <div className="qt-cover-card">
                <Users className="qt-cover-card-ic" size={18} aria-hidden />
                <span className="qt-cover-card-label">Cliente</span>
                <span className="qt-cover-card-value">{clientName.trim() || "—"}</span>
              </div>
              <div className="qt-cover-card">
                <Home className="qt-cover-card-ic" size={18} aria-hidden />
                <span className="qt-cover-card-label">Camera proposta</span>
                <span className="qt-cover-card-value">{lodgeName}</span>
              </div>
              <div className="qt-cover-card">
                <CalendarDays className="qt-cover-card-ic" size={18} aria-hidden />
                <span className="qt-cover-card-label">Check-in</span>
                <span className="qt-cover-card-value">{formatDateIt(checkIn)}</span>
              </div>
              <div className="qt-cover-card">
                <CalendarDays className="qt-cover-card-ic" size={18} aria-hidden />
                <span className="qt-cover-card-label">Check-out</span>
                <span className="qt-cover-card-value">{formatDateIt(checkOut)}</span>
              </div>
              <div className="qt-cover-card">
                <span className="qt-cover-card-ic" aria-hidden>☾</span>
                <span className="qt-cover-card-label">Notti</span>
                <span className="qt-cover-card-value">{computed.nights > 0 ? String(computed.nights) : "—"}</span>
              </div>
              <div className="qt-cover-card">
                <Users className="qt-cover-card-ic" size={18} aria-hidden />
                <span className="qt-cover-card-label">Ospiti</span>
                <span className="qt-cover-card-value">{guests}</span>
              </div>
              <div className="qt-cover-card qt-cover-card--wide">
                <Sparkles className="qt-cover-card-ic" size={18} aria-hidden />
                <span className="qt-cover-card-label">Opzioni nel documento</span>
                <span className="qt-cover-card-value">
                  {optionCount} {optionCount === 1 ? "soluzione" : "soluzioni a confronto"}
                </span>
              </div>
            </div>

            {photoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoUrl}
                alt={`Foto ${lodgeName}`}
                className="qt-cover-photo"
                style={{ width: "100%", maxHeight: 260, objectFit: "cover", borderRadius: 8, marginBottom: 16, display: "block" }}
              />
            )}

            <div className="qt-cover-intro-wrap">
              <p className="qt-cover-intro-lead">{clientLine}</p>
              <p className="qt-cover-intro-text">{quoteDocument.coverIntro}</p>
            </div>

            <div className="qt-cover-contacts">
              <span className="qt-cover-contacts-label">Contatti</span>
              <a href={`mailto:${residenceContact.email}`}>{residenceContact.email}</a>
              {" · "}
              <a href={`tel:${residenceContact.phone}`}>{residenceContact.phone}</a>
              {whatsappHref ? (
                <>{" · "}<a href={whatsappHref} target="_blank" rel="noopener noreferrer">WhatsApp</a></>
              ) : null}
            </div>
          </div>
        </div>

        {/* ——— Pagina 2: messaggio + struttura + territorio ——— */}
        <div className="qt-sheet" data-quote-page="2">
          <SheetRunning page="2" quoteNumber={quoteNumber} />
          <div className="qt-body qt-body--sheet">
            <section className="qt-section" data-quote-section="intro-cliente">
              <h2>Messaggio al cliente</h2>
              <p className="qt-block-text">{quoteDocument.availabilityIntro}</p>
              <p className="qt-block-text">{quoteDocument.choiceGuide}</p>
            </section>

            <section className="qt-section" data-quote-section="struttura">
              <h2>Residence Le Farfalle — struttura e territorio</h2>
              <p className="qt-block-text qt-block-lead">{quoteDocument.residenceLead}</p>
              <div className="qt-pill-row">
                <span className="qt-pill"><Waves size={15} aria-hidden /> Mare Ionio</span>
                <span className="qt-pill"><TreePine size={15} aria-hidden /> Natura</span>
                <span className="qt-pill"><Castle size={15} aria-hidden /> Le Castella</span>
              </div>
              <p className="qt-block-text" style={{ marginTop: 14 }}>{residenceStructure.sea}</p>
              <p className="qt-block-text">{residenceStructure.territory}</p>

              <div className="qt-territory-grid">
                {residenceTerritoryPoints.map((pt) => (
                  <div key={pt.key} className="qt-territory-tile">
                    <span className="qt-territory-tile-ic" aria-hidden>
                      <TerritoryIcon kind={pt.icon} />
                    </span>
                    <strong>{pt.title}</strong>
                    <p>{pt.text}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="qt-section" data-quote-section="servizi-indicativi">
              <h2>Servizi generali (indicativi)</h2>
              <div className="qt-service-grid">
                <div className="qt-service">
                  <Wifi className="qt-service-ic" size={20} aria-hidden />
                  <div>
                    <strong>Wi‑Fi</strong>
                    <p>Copertura e accesso confermati al check-in.</p>
                  </div>
                </div>
                <div className="qt-service">
                  <Car className="qt-service-ic" size={20} aria-hidden />
                  <div>
                    <strong>Parcheggio</strong>
                    <p>Disponibilità in base al periodo; dettagli in conferma prenotazione.</p>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>

        {/* ——— Pagina 3: camera selezionata ——— */}
        <div className="qt-sheet" data-quote-page="3">
          <SheetRunning page="3" quoteNumber={quoteNumber} />
          <div className="qt-body qt-body--sheet">
            <section className="qt-section qt-section--lodge" data-quote-section="camera">
              <div className="qt-lodge-hero">
                <div className="qt-lodge-hero-icon" aria-hidden>
                  <Building2 size={36} strokeWidth={1.5} />
                </div>
                <p className="qt-lodge-hero-label">Soluzione proposta</p>
                <h2 className="qt-lodge-hero-title">{lodgeName}</h2>
                <p className="qt-lodge-hero-lead">{lodgeProfile.premiumLead}</p>
                <p className="qt-lodge-hero-sub">{lodgeDescription}</p>
                {lodgeFactsLine ? <p className="qt-lodge-facts qt-lodge-facts--hero">{lodgeFactsLine}</p> : null}
              </div>

              <div className="qt-lodge-cards">
                <div className="qt-lodge-card">
                  <h3 className="qt-lodge-card-title"><Home size={16} aria-hidden /> Composizione interna</h3>
                  <p>{lodgeProfile.compositionDetail}</p>
                </div>
                <div className="qt-lodge-card">
                  <h3 className="qt-lodge-card-title"><TreePine size={16} aria-hidden /> Spazi e note</h3>
                  <p>{lodgeProfile.outdoorNote ?? "Spazi comuni della struttura disponibili per relax — dettagli confermati in struttura."}</p>
                </div>
              </div>

              <h3 className="qt-subsection-title">Punti distintivi</h3>
              <ul className="qt-bullet-list qt-bullet-list--check">
                {lodgeProfile.distinctive.map((s) => (
                  <li key={s}><Sparkles size={14} className="qt-li-ic" aria-hidden />{s}</li>
                ))}
              </ul>

              <h3 className="qt-subsection-title">Dotazioni principali</h3>
              <ul className="qt-bullet-list qt-bullet-list--check">
                {lodgeProfile.amenities.map((s) => (
                  <li key={s}><Check size={14} className="qt-li-ic" aria-hidden />{s}</li>
                ))}
              </ul>
            </section>
          </div>
        </div>

        {/* ——— Pagina 4: economico + condizioni + banca ——— */}
        <div className="qt-sheet" data-quote-page="4">
          <SheetRunning page="4" quoteNumber={quoteNumber} />
          <div className="qt-body qt-body--sheet">
            <section className="qt-section" data-quote-section="economico">
              <h2>Riepilogo economico</h2>
              <p className="qt-block-text qt-econ-intro">{quoteDocument.economicSolutionLead}</p>
              <div className="qt-econ qt-econ--prominent">
                <div className="qt-econ-row">
                  <span>Tariffa giornaliera (per notte)</span>
                  <span>{computed.dailyRate > 0 ? formatCurrencyEUR(computed.dailyRate) : "—"}</span>
                </div>
                <div className="qt-econ-row qt-econ-sub">
                  <span>
                    {computed.nights > 0
                      ? `Notti: ${computed.nights} · Soggiorno (${computed.nights} × ${formatCurrencyEUR(computed.dailyRate)})`
                      : "Totale soggiorno (notti × tariffa)"}
                  </span>
                  <span>{computed.nights > 0 ? formatCurrencyEUR(computed.stayGross) : "—"}</span>
                </div>
                {computed.discountPercent > 0 && (
                  <>
                    <div className="qt-econ-row">
                      <span>Sconto ({computed.discountPercent}%)</span>
                      <span>−{formatCurrencyEUR(computed.discountAmount)}</span>
                    </div>
                    <div className="qt-econ-row qt-econ-sub">
                      <span>Dopo sconto</span>
                      <span>{formatCurrencyEUR(computed.stayAfterDiscount)}</span>
                    </div>
                  </>
                )}
                {includeSanitization && (
                  <div className="qt-econ-row">
                    <span>Extra sanificazione</span>
                    <span>{formatCurrencyEUR(computed.sanitization)}</span>
                  </div>
                )}
                {computed.petEnvironmentFee > 0 && (
                  <div className="qt-econ-row qt-econ-row-single">
                    <span className="qt-econ-with-ic">
                      <PawPrint size={15} aria-hidden />
                      Sanificazione ambiente (animale domestico):{" "}
                      {formatCurrencyEUR(computed.petEnvironmentFee)}
                    </span>
                  </div>
                )}
                <div className="qt-econ-row">
                  <span>Tassa di soggiorno (stimata)</span>
                  <span>{formatCurrencyEUR(computed.touristTax)}</span>
                </div>
                <div className="qt-econ-row qt-econ-total">
                  <span>Totale complessivo</span>
                  <span>{formatCurrencyEUR(computed.grandTotal)}</span>
                </div>
                <div className="qt-econ-row qt-econ-deposit">
                  <span>Acconto {computed.depositPercent}% ({policies.depositLabel})</span>
                  <span>{formatCurrencyEUR(computed.deposit)}</span>
                </div>
                <div className="qt-econ-row qt-econ-balance">
                  <span>Saldo {100 - computed.depositPercent}% ({policies.balanceLabel})</span>
                  <span>{formatCurrencyEUR(computed.balance)}</span>
                </div>
              </div>
            </section>

            <section className="qt-section qt-policy" data-quote-section="condizioni">
              <h2>Condizioni di prenotazione e cancellazione</h2>
              <ul>
                <li>{policies.bookingNote}</li>
                <li><strong>Acconto e saldo:</strong> acconto {computed.depositPercent}% alla prenotazione; saldo {100 - computed.depositPercent}% come da {policies.balanceLabel.toLowerCase()}.</li>
                <li>{policies.cancellationFree}</li>
                <li>{policies.cancellationAfter}</li>
                <li>{policies.touristTaxNote}</li>
              </ul>
            </section>

            <section className="qt-section qt-section--bank" data-quote-section="banca">
              <h2 className="qt-sr-only">Coordinate bancarie</h2>
              <BankBlock featured />
            </section>
          </div>
        </div>

        {/* ——— Pagina 5: confronto (facoltativo) + CTA + footer ——— */}
        <div className="qt-sheet qt-sheet--last" data-quote-page="5">
          <SheetRunning page="5" quoteNumber={quoteNumber} />
          <div className="qt-body qt-body--sheet">
            {showCompare ? (
              <section className="qt-section" data-quote-section="confronto">
                <h2>Confronto tra soluzioni camera</h2>
                <p className="qt-block-text">{quoteDocument.compareFootnote}</p>
                <div className="qt-table-wrap">
                  <table className="qt-compare-table">
                    <thead>
                      <tr>
                        <th scope="col">Camera</th>
                        <th scope="col">Composizione</th>
                        <th scope="col">Punti distintivi</th>
                        <th scope="col">Dotazioni</th>
                      </tr>
                    </thead>
                    <tbody>
                      <CompareRow lodge={primaryLodge} />
                      <CompareRow lodge={compareLodge} />
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}

            <section className="qt-section qt-cta" data-quote-section="cta">
              <h2 className="qt-cta-heading">Come prenotare</h2>
              <ol className="qt-step-list">
                {quoteDocument.bookingSteps.map((step, i) => <li key={i}>{step}</li>)}
              </ol>
              <p className="qt-block-text qt-cta-strong">
                <Phone size={16} style={{ verticalAlign: "middle", marginRight: 6 }} />
                <strong>Contatti</strong>
              </p>
              <p>Email: <a href={`mailto:${residenceContact.email}`}>{residenceContact.email}</a></p>
              <p>Tel / WhatsApp: <a href={`tel:${residenceContact.phone}`}>{residenceContact.phone}</a></p>
              <p className="qt-cta-note">{residenceContact.addressLine} — {residenceContact.websiteNote}</p>
            </section>

            <section className="qt-section qt-section--lang" data-quote-section="english">
              <h2 className="qt-subsection-title">International guests</h2>
              <p className="qt-block-text">{quoteDocument.englishNote}</p>
            </section>

            <p className="qt-footer-note">
              Documento generato per uso informativo. Importi e condizioni definitivi previa conferma scritta della struttura.
            </p>
          </div>
        </div>
      </div>
    );
  }
);
