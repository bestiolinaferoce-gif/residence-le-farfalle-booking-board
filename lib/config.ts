/**
 * Residence Le Farfalle — Configurazione centralizzata
 *
 * Modifica qui per aggiornare unità, prezzi e tipologie
 * senza toccare il resto del codice.
 */

export const PROPERTY_NAME = "Residence Le Farfalle";
export const PROPERTY_LOCATION = "Le Farfalle";

/**
 * Prezzi di riferimento per notte (€).
 * Usati come valore predefinito nel form prenotazione.
 * Modifica liberamente in base alla stagione o accordi.
 */
export const LODGE_BASE_PRICES: Record<string, number> = {
  "Camera 1": 100,
  "Camera 2": 100,
  "Camera 3": 100,
  "Camera 4": 100,
  "Camera 5": 100,
};

/**
 * Descrizione breve delle tipologie (opzionale — per uso futuro).
 */
export const LODGE_TYPE: Record<string, string> = {
  "Camera 1": "Camera doppia",
  "Camera 2": "Camera doppia",
  "Camera 3": "Camera doppia",
  "Camera 4": "Camera doppia",
  "Camera 5": "Camera doppia",
};
