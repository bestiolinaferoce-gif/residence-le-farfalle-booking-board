/**
 * Residence Le Farfalle — dati struttura.
 *
 * Questi sono i VALORI INIZIALI: finiscono nelle Impostazioni al primo avvio e
 * da lì si modificano senza toccare il codice.
 *
 * Nessun valore è inventato: vengono dalla board e dal modulo Preventivi di
 * Le Farfalle già in uso. Dove un dato non è noto (CIN, CIR, IBAN, coordinate)
 * il campo resta vuoto e l'app mostra "da compilare" invece di stimare.
 */

export type BankDetails = {
  holder: string;
  iban: string;
  bic: string;
  bank: string;
};

export type PropertyProfile = {
  name: string;
  tagline: string;
  address: string;
  municipality: string;
  province: string;
  region: string;
  lat: number | null;
  lng: number | null;
  ownerName: string;
  ownerFiscalCode: string;
  vatNumber: string;
  phone: string;
  email: string;
  website: string;
  /** Codice Identificativo Nazionale — obbligo di esposizione negli annunci. */
  cin: string;
  /** Codice Identificativo Regionale (Calabria). */
  cir: string;
  classification: string;
  roomsCount: number;
  bedsCount: number;
  adultsOnly: boolean;
  services: string[];
  bank: BankDetails;
};

export const DEFAULT_PROPERTY: PropertyProfile = {
  name: "Residence Le Farfalle",
  tagline: "Isola di Capo Rizzuto",
  address: "Via Capo delle Colonne",
  municipality: "Isola di Capo Rizzuto",
  province: "KR",
  region: "Calabria",
  lat: null,
  lng: null,
  ownerName: "Nigro Francesco",
  ownerFiscalCode: "",
  vatNumber: "",
  phone: "+39 350 097 9130",
  email: "lefarfallecaporizzuto@gmail.com",
  website: "https://residencelefarfalle.com",
  cin: "",
  cir: "",
  classification: "",
  roomsCount: 4,
  bedsCount: 0,
  adultsOnly: false,
  services: ["Colazione inclusa", "Bagno privato", "Aria condizionata"],
  bank: {
    holder: "Nigro Francesco",
    iban: "",
    bic: "",
    bank: "",
  },
};

/** CAP di Isola di Capo Rizzuto (già nell'indirizzo usato dai preventivi). */
export const POSTAL_CODE_PLACEHOLDER = "88841";

export function formattedAddress(p: PropertyProfile): string {
  const town = [`${POSTAL_CODE_PLACEHOLDER} ${p.municipality}`, p.province ? `(${p.province})` : ""]
    .filter(Boolean)
    .join(" ");
  return [p.address, town].filter(Boolean).join(", ");
}

export function mapsUrl(p: PropertyProfile): string | null {
  if (p.lat === null || p.lng === null) return null;
  return `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`;
}

/** Portali degli adempimenti. Aperti in nuova scheda dalla sezione Adempimenti. */
export const ALLOGGIATI_WEB_URL = "https://alloggiatiweb.poliziadistato.it";

/**
 * ROSS1000 Calabria. La Regione espone la piattaforma sotto il portale del
 * turismo regionale; l'URL è configurabile in Impostazioni perché le regioni
 * cambiano dominio più spesso di quanto si aggiorni un deploy.
 */
export const ROSS1000_DEFAULT_URL = "https://calabria.ross1000.it";
