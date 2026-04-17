"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowLeft } from "lucide-react";
import type { CSSProperties } from "react";
import { useMemo, useRef, useState } from "react";
import {
  lodgeStructuralLine,
  quoteLodges,
  quoteThemes,
  type QuoteThemeId,
} from "./quoteConfig";
import { QuoteForm } from "./QuoteForm";
import { QuoteTemplate } from "./QuoteTemplate";
import {
  computeQuote,
  type QuoteFormState,
} from "./quoteUtils";
import "./quotes.css";

const QuotePdfExport = dynamic(
  () => import("./QuotePDF").then((m) => m.QuotePdfExport),
  {
    ssr: false,
    loading: () => (
      <div className="quotes-actions no-print">
        <button
          type="button"
          className="quotes-btn quotes-btn-primary"
          disabled
        >
          Caricamento PDF…
        </button>
      </div>
    ),
  }
);

const initial: QuoteFormState = {
  clientName: "",
  checkIn: "",
  checkOut: "",
  guests: 2,
  lodgeId: "Limone",
  compareLodgeId: "",
  dailyRate: 0,
  discountPercent: 0,
  includeSanitization: false,
  includePetDomestic: false,
};

export function QuotesPage() {
  const [themeId, setThemeId] = useState<QuoteThemeId>("blu-oro");
  const [state, setState] = useState<QuoteFormState>(initial);
  const templateRef = useRef<HTMLDivElement>(null);
  const [quoteNumber] = useState(
    () => `PREV-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`
  );
  const issuedAt = useMemo(() => new Date().toISOString(), []);

  const computed = useMemo(() => computeQuote(state), [state]);
  const lodge =
    quoteLodges.find((l) => l.id === state.lodgeId) ?? quoteLodges[0];
  const lodgeFactsLine = lodgeStructuralLine(lodge);
  const compareLodge =
    state.compareLodgeId &&
    state.compareLodgeId !== state.lodgeId
      ? quoteLodges.find((l) => l.id === state.compareLodgeId)
      : undefined;

  const canExport =
    state.clientName.trim().length > 0 &&
    Boolean(state.checkIn && state.checkOut) &&
    computed.nights > 0 &&
    state.dailyRate > 0;

  function patch(next: Partial<QuoteFormState>) {
    setState((s) => ({ ...s, ...next }));
  }

  const theme = quoteThemes[themeId] ?? quoteThemes["blu-oro"];
  const themeVars = theme.vars as CSSProperties;

  return (
    <div className="quotes-page" data-theme={themeId} style={themeVars}>
      <div className="quotes-topbar">
        <Link href="/" className="quotes-back">
          <ArrowLeft size={18} />
          Torna al Booking Board
        </Link>
        <span style={{ fontSize: "0.85rem", color: "var(--q-muted)" }}>
          Modulo Preventivi — Residence Le Farfalle — uso interno
        </span>
      </div>

      <div className="quotes-layout">
        <div className="quotes-sidebar no-print">
          <QuoteForm
            state={state}
            onChange={patch}
            computed={computed}
            themeId={themeId}
            onThemeChange={setThemeId}
          />
          {!canExport && (
            <div className="quotes-export-hint no-print" role="status">
              <strong>Per abilitare «Scarica PDF» e «Stampa / PDF sistema»</strong>
              <ul>
                <li>inserire il nome cliente</li>
                <li>scegliere date valide (check-out dopo check-in, almeno una notte)</li>
                <li>impostare la tariffa giornaliera maggiore di zero</li>
              </ul>
            </div>
          )}
          <QuotePdfExport targetRef={templateRef} disabled={!canExport} />
        </div>

        <div className="quotes-template-wrap">
          <QuoteTemplate
            ref={templateRef}
            quoteNumber={quoteNumber}
            issuedAt={issuedAt}
            clientName={state.clientName}
            checkIn={state.checkIn}
            checkOut={state.checkOut}
            guests={state.guests}
            lodgeId={lodge.id}
            lodgeName={lodge.name}
            lodgeDescription={lodge.shortDescription}
            lodgeFactsLine={lodgeFactsLine}
            compareLodge={compareLodge}
            includeSanitization={state.includeSanitization}
            computed={computed}
            photoUrl={state.photoUrl}
          />
        </div>
      </div>
    </div>
  );
}
