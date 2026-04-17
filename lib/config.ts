/**
 * Residence Le Farfalle — Configurazione centralizzata
 *
 * Modifica qui per aggiornare unità, prezzi e tipologie
 * senza toccare il resto del codice.
 */

export const PROPERTY_NAME = "Residence Le Farfalle";
export const PROPERTY_LOCATION = "Capo Rizzuto";
export const PROPERTY_EMAIL = "lefarfallecaporizzuto@gmail.com";
export const PROPERTY_PHONE = "+39 3500979130";

/**
 * Prezzi di riferimento per notte (€).
 * Usati come valore predefinito nel form prenotazione.
 */
export const LODGE_BASE_PRICES: Record<string, number> = {
  Limone: 100,
  Macaone: 100,
  Vanessa: 100,
  Aurora: 100,
};

/**
 * Tipologia camere (B&B con colazione inclusa).
 */
export const LODGE_TYPE: Record<string, string> = {
  Limone: "Camera doppia B&B",
  Macaone: "Camera doppia B&B",
  Vanessa: "Camera doppia B&B",
  Aurora: "Camera doppia B&B",
};

/**
 * Descrizione camere.
 */
export const LODGE_DESCRIPTION: Record<string, string> = {
  Limone: "2 posti letto, bagno privato",
  Macaone: "2 posti letto, bagno privato",
  Vanessa: "2 posti letto, bagno privato",
  Aurora: "2 posti letto, bagno privato",
};
