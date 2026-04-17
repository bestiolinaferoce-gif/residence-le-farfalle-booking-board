/**
 * Configurazione modulo Preventivi — Residence Le Farfalle
 */

export const quoteThemeIds = ["blu-oro", "avorio-navy", "smeraldo-oro"] as const;
export type QuoteThemeId = (typeof quoteThemeIds)[number];

export const quoteThemes: Record<
  QuoteThemeId,
  { label: string; vars: Record<string, string> }
> = {
  "blu-oro": {
    label: "Blu / oro",
    vars: {
      "--q-navy": "#0a1628",
      "--q-navy-mid": "#152a45",
      "--q-gold": "#c9a227",
      "--q-gold-soft": "#e8d48b",
      "--q-cream": "#f8f6f0",
      "--q-text": "#e8ecf4",
      "--q-muted": "#9ca8bc",
      "--q-border": "rgba(201, 162, 39, 0.35)",
      "--qt-body-bg": "#f8f6f0",
      "--qt-body-text": "#1a1f2e",
      "--qt-header-1": "#0a1628",
      "--qt-header-2": "#1a3352",
      "--qt-header-text": "#f8f6f0",
      "--qt-badge-text": "#0a1628",
      "--qt-badge-bg-1": "#e8d48b",
      "--qt-badge-bg-2": "#c9a227",
      "--qt-section-accent": "#0a1628",
      "--qt-section-border": "#c9a227",
      "--qt-box-bg": "#f1f4f8",
      "--qt-box-border": "#d9e2ec",
      "--qt-box-label": "#4a5568",
      "--qt-econ-1": "#0a1628",
      "--qt-econ-2": "#132337",
      "--qt-econ-text": "#f8f6f0",
      "--qt-econ-total": "#e8d48b",
      "--qt-cta-bg": "#fffdf8",
      "--qt-footer": "#718096",
      "--qt-bank-bg": "#0f172a",
      "--qt-bank-text": "#f1f5f9",
      "--qt-bank-iban-bg": "#020617",
      "--qt-bank-accent": "#c9a227",
    },
  },
  "avorio-navy": {
    label: "Avorio / navy",
    vars: {
      "--q-navy": "#1e293b",
      "--q-navy-mid": "#334155",
      "--q-gold": "#b45309",
      "--q-gold-soft": "#fcd34d",
      "--q-cream": "#faf8f3",
      "--q-text": "#1e293b",
      "--q-muted": "#64748b",
      "--q-border": "rgba(30, 41, 59, 0.2)",
      "--qt-body-bg": "#faf8f3",
      "--qt-body-text": "#1e293b",
      "--qt-header-1": "#1e293b",
      "--qt-header-2": "#334155",
      "--qt-header-text": "#faf8f3",
      "--qt-badge-text": "#faf8f3",
      "--qt-badge-bg-1": "#b45309",
      "--qt-badge-bg-2": "#92400e",
      "--qt-section-accent": "#1e293b",
      "--qt-section-border": "#b45309",
      "--qt-box-bg": "#f1f5f9",
      "--qt-box-border": "#cbd5e1",
      "--qt-box-label": "#475569",
      "--qt-econ-1": "#1e293b",
      "--qt-econ-2": "#0f172a",
      "--qt-econ-text": "#f8fafc",
      "--qt-econ-total": "#fcd34d",
      "--qt-cta-bg": "#fffbeb",
      "--qt-footer": "#64748b",
      "--qt-bank-bg": "#1e293b",
      "--qt-bank-text": "#f8fafc",
      "--qt-bank-iban-bg": "#0f172a",
      "--qt-bank-accent": "#fcd34d",
    },
  },
  "smeraldo-oro": {
    label: "Smeraldo / oro",
    vars: {
      "--q-navy": "#064e3b",
      "--q-navy-mid": "#065f46",
      "--q-gold": "#d4a574",
      "--q-gold-soft": "#ecd9b8",
      "--q-cream": "#f4f7f5",
      "--q-text": "#ecfdf5",
      "--q-muted": "#a7f3d0",
      "--q-border": "rgba(212, 165, 116, 0.4)",
      "--qt-body-bg": "#f4f7f5",
      "--qt-body-text": "#134e4a",
      "--qt-header-1": "#064e3b",
      "--qt-header-2": "#047857",
      "--qt-header-text": "#ecfdf5",
      "--qt-badge-text": "#064e3b",
      "--qt-badge-bg-1": "#ecd9b8",
      "--qt-badge-bg-2": "#d4a574",
      "--qt-section-accent": "#064e3b",
      "--qt-section-border": "#d4a574",
      "--qt-box-bg": "#ecfdf5",
      "--qt-box-border": "#a7f3d0",
      "--qt-box-label": "#115e59",
      "--qt-econ-1": "#064e3b",
      "--qt-econ-2": "#022c22",
      "--qt-econ-text": "#ecfdf5",
      "--qt-econ-total": "#ecd9b8",
      "--qt-cta-bg": "#f0fdf4",
      "--qt-footer": "#0f766e",
      "--qt-bank-bg": "#022c22",
      "--qt-bank-text": "#ecfdf5",
      "--qt-bank-iban-bg": "#011a15",
      "--qt-bank-accent": "#d4a574",
    },
  },
};

export const residenceContact = {
  name: "Residence Le Farfalle",
  email: "lefarfallecaporizzuto@gmail.com",
  phone: "+39 3500979130",
  whatsappDigits: "393500979130",
  addressLine: "Via Capo delle Colonne, 88841 Isola di Capo Rizzuto (KR)",
  websiteNote: "Prenotazioni e informazioni su richiesta via email o telefono.",
} as const;

export const bankDetails = {
  iban: "—",
  bic: "—",
  accountHolder: "Nigro Francesco",
} as const;

export const policies = {
  depositPercent: 30,
  depositLabel: "Acconto alla prenotazione",
  balanceLabel: "Saldo al check-in",
  cancellationFreeDays: 30,
  cancellationFree:
    "Cancellazione gratuita se comunicata entro 30 giorni prima dell'arrivo.",
  cancellationAfter:
    "Oltre tale termine l'acconto versato non è rimborsabile, salvo diversa pattuizione scritta.",
  bookingNote:
    "La prenotazione si intende confermata dopo il versamento dell'acconto indicato e la ricezione di conferma da parte della struttura.",
  touristTaxNote:
    "Tassa di soggiorno: importo stimato in base a numero ospiti e notti; conferma definitiva al check-in secondo normativa locale.",
} as const;

export const quoteDocument = {
  docTitle: "Proposta di soggiorno",
  docBadge: "Preventivo strutturato",
  headerTagline: "Residence Le Farfalle — Isola di Capo Rizzuto (KR), Calabria",
  clientGreetingLead: "Gentile",
  availabilityIntro:
    "In base al periodo e al numero di ospiti indicati, verifichiamo la disponibilità del calendario camere e proponiamo la soluzione più coerente con le vostre esigenze.",
  choiceGuide:
    "Per orientare la scelta: camere con maggiore capienza sono indicate per famiglie o gruppi; soluzioni più compatte risultano ideali per coppie o soggiorni brevi.",
  residenceLead:
    "Residence Le Farfalle è una struttura ricettiva con gestione diretta a Isola di Capo Rizzuto: prenotazioni, pagamenti e assistenza in soggiorno con comunicazioni chiare e tempestive.",
  compareFootnote:
    "Il confronto è indicativo su composizione e caratteristiche descrittive. Tariffe e disponibilità della seconda camera non sono incluse in questo preventivo salvo esplicita integrazione scritta.",
  economicSolutionLead:
    "Importi riferiti alla soluzione camera indicata nel riquadro proposta. Acconto e saldo sono calcolati sul totale complessivo.",
  bookingSteps: [
    "Confermare via email o telefono interesse per il periodo e la camera proposta.",
    "Ricevere da Residence Le Farfalle conferma di disponibilità e istruzioni per l'acconto.",
    "Effettuare il bonifico dell'acconto (30%) e inviare la ricevuta.",
    "Ricevere conferma scritta di prenotazione; saldo (70%) al check-in come da condizioni.",
  ] as const,
  coverIntro:
    "Ci pregiamo di presentarVi questa proposta di soggiorno presso Residence Le Farfalle, redatta su misura per il periodo e la camera indicata.",
  englishNote:
    "Su richiesta via email è disponibile una sintesi in inglese della presente proposta.",
} as const;

export const quoteLodges = [
  {
    id: "Limone",
    name: "Camera Limone",
    shortDescription: "Camera luminosa e curata, ideale per coppie o soggiorni brevi.",
    maxGuests: 2,
  },
  {
    id: "Macaone",
    name: "Camera Macaone",
    shortDescription: "Spazio accogliente con dotazioni complete; adatta a famiglie o piccoli gruppi.",
    maxGuests: 4,
  },
  {
    id: "Vanessa",
    name: "Camera Vanessa",
    shortDescription: "Ambiente riservato e funzionale; ottima per soggiorni rilassanti.",
    maxGuests: 3,
  },
  {
    id: "Aurora",
    name: "Camera Aurora",
    shortDescription: "Soluzione spaziosa con vista; ideale per soggiorni di media durata.",
    maxGuests: 4,
  },
] as const;

export type QuoteLodgeId = (typeof quoteLodges)[number]["id"];
export type QuoteLodge = (typeof quoteLodges)[number];

export type LodgeQuoteProfile = {
  premiumLead: string;
  compositionDetail: string;
  outdoorNote: string | null;
  distinctive: readonly string[];
  amenities: readonly string[];
};

const LODGE_QUOTE_PROFILES = {
  Limone: {
    premiumLead: "Camera luminosa e ben curata — perfetta per una coppia in cerca di tranquillità.",
    compositionDetail:
      "Camera matrimoniale / doppia con bagno privato, dotata di tutti i comfort essenziali. Layout semplice e funzionale, ideale per soggiorni brevi o romantici.",
    outdoorNote: null,
    distinctive: [
      "Atmosfera intima e curata",
      "Ideale per coppie o soggiorni brevi",
      "Gestione diretta con supporto in struttura",
    ],
    amenities: [
      "Letto matrimoniale / twin su richiesta",
      "Bagno privato",
      "Aria condizionata",
    ],
  },
  Macaone: {
    premiumLead: "Camera spaziosa per famiglie o piccoli gruppi — la più capiente del residence.",
    compositionDetail:
      "Fino a 4 posti letto. Zona notte con letti separabili, spazio organizzato per famiglie con bambini o piccoli gruppi. Dotazioni complete per soggiorni confortevoli.",
    outdoorNote: null,
    distinctive: [
      "Capienza fino a 4 ospiti",
      "Ideale per famiglie con bambini",
      "Ampio spazio interno",
    ],
    amenities: [
      "Letti separabili/combinabili",
      "Bagno privato",
      "Aria condizionata",
    ],
  },
  Vanessa: {
    premiumLead: "Camera riservata con dotazioni complete — equilibrio tra spazio e comfort.",
    compositionDetail:
      "Fino a 3 posti letto. Soluzione equilibrata per coppie con un terzo ospite o piccoli nuclei familiari. Bagno privato e dotazioni curate.",
    outdoorNote: null,
    distinctive: [
      "Flessibile per 2 o 3 ospiti",
      "Atmosfera rilassante",
      "Buon rapporto spazio / comfort",
    ],
    amenities: [
      "Letto matrimoniale + letto singolo",
      "Bagno privato",
      "Aria condizionata",
    ],
  },
  Aurora: {
    premiumLead: "Camera spaziosa con vista — la scelta ideale per soggiorni di media durata.",
    compositionDetail:
      "Fino a 4 posti letto. Ambiente ampio e luminoso, con disposizione pensata per il comfort di più ospiti. Vista sul contesto naturalistico della struttura.",
    outdoorNote: "Vista sul giardino o contesto naturalistico della struttura.",
    distinctive: [
      "Vista panoramica",
      "Ampia superficie",
      "Adatta a famiglie o soggiorni estesi",
    ],
    amenities: [
      "Letti separabili/combinabili",
      "Bagno privato",
      "Aria condizionata",
    ],
  },
} as const satisfies Record<QuoteLodgeId, LodgeQuoteProfile>;

export function getLodgeQuoteProfile(lodge: QuoteLodge): LodgeQuoteProfile {
  return LODGE_QUOTE_PROFILES[lodge.id];
}

export function lodgeQuotePresentation(lodge: QuoteLodge): {
  composition: string;
  strengths: string[];
  equipment: string[];
} {
  const p = getLodgeQuoteProfile(lodge);
  return {
    composition: p.compositionDetail,
    strengths: [...p.distinctive],
    equipment: [...p.amenities],
  };
}

export function lodgeStructuralLine(lodge: QuoteLodge): string | null {
  const row = lodge as Record<string, unknown>;
  const parts: string[] = [];
  const mg = row.maxGuests;
  const br = row.bedrooms;
  if (typeof mg === "number" && Number.isFinite(mg)) {
    parts.push(`Capienza massima: ${mg} posti letto`);
  }
  if (typeof br === "number" && Number.isFinite(br)) {
    parts.push(`${br} camere da letto`);
  }
  return parts.length ? parts.join(" · ") : null;
}

export const residenceStructure = {
  sea: "A pochi minuti dal litorale ionico di Isola di Capo Rizzuto, con accesso facilitato alle spiagge della zona.",
  territory:
    "Capo Rizzuto (KR): territorio tra mare Ionio, natura e borghi. In prossimità: Area Marina Protetta Capo Rizzuto, il borgo e il castello di Le Castella, itinerari verso spiagge e servizi locali.",
} as const;

export const residenceTerritoryPoints = [
  {
    key: "mare",
    icon: "waves" as const,
    title: "Spiagge ioniche",
    text: "Litorale ionico a breve distanza dalla struttura; spiagge attrezzate e libere nelle vicinanze.",
  },
  {
    key: "amp",
    icon: "anchor" as const,
    title: "Area Marina Protetta",
    text: "Patrimonio naturalistico della costa di Capo Rizzuto, con possibilità di escursioni e attività marine.",
  },
  {
    key: "castella",
    icon: "castle" as const,
    title: "Le Castella",
    text: "Borgo e arco storico sul mare, meta classica per una passeggiata o una giornata tra storia e panorami.",
  },
] as const;

export const pricingDefaults = {
  sanitizationExtra: 50,
  petEnvironmentSanitization: 50,
  touristTaxPerPersonPerNight: 2,
} as const;

export const discountOptions = [
  { value: 0, label: "Nessuno" },
  { value: 5, label: "Sconto 5%" },
  { value: 10, label: "Sconto 10%" },
] as const;
