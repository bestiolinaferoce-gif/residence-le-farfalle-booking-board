/**
 * Camere: identificativi stabili + nomi modificabili.
 *
 * L'id della camera (Limone, Macaone, Vanessa, Aurora) è scritto dentro ogni
 * prenotazione salvata e negli URL dei feed iCal già consegnati alle OTA:
 * non cambia mai; dalle Impostazioni cambia solo l'etichetta mostrata.
 *
 * Residence Le Farfalle ha 4 camere, tutte attive all'avvio.
 */

import { LODGES, type Lodge } from "@/lib/types";

export type RoomConfig = {
  id: Lodge;
  /** Nome mostrato in board, PDF, preventivi ed export iCal. */
  name: string;
  /** Posti letto: usato per il controllo capienza nel form prenotazione. */
  capacity: number;
  active: boolean;
  /** Colore della riga in board e nei grafici di occupazione. */
  color: string;
};

/** Palette della board (stesso design system della board Corallo). */
const ROOM_COLORS = [
  "#e2725b",
  "#d1495b",
  "#00798c",
  "#2e8b8b",
  "#c77b52",
  "#8a5a44",
  "#3f7d8c",
  "#a3543f",
];

export const DEFAULT_ACTIVE_ROOMS = 4;

/**
 * Posti letto di partenza: gli stessi già usati dal modulo Preventivi di
 * Le Farfalle (maxGuests). Si correggono dalle Impostazioni.
 */
const DEFAULT_CAPACITY: Record<string, number> = {
  Limone: 2,
  Macaone: 4,
  Vanessa: 3,
  Aurora: 4,
};

export function defaultRooms(): RoomConfig[] {
  return LODGES.map((id, index) => ({
    id,
    name: id,
    capacity: DEFAULT_CAPACITY[id] ?? 2,
    active: index < DEFAULT_ACTIVE_ROOMS,
    color: ROOM_COLORS[index] ?? "#e2725b",
  }));
}

/** Normalizza una config letta da KV/localStorage: tollera versioni parziali. */
export function normalizeRooms(input: unknown): RoomConfig[] {
  const base = defaultRooms();
  if (!Array.isArray(input)) return base;
  return base.map((room) => {
    const stored = input.find(
      (item) => item && typeof item === "object" && (item as RoomConfig).id === room.id
    ) as Partial<RoomConfig> | undefined;
    if (!stored) return room;
    return {
      id: room.id,
      name: typeof stored.name === "string" && stored.name.trim() ? stored.name.trim() : room.name,
      capacity:
        typeof stored.capacity === "number" && stored.capacity > 0 ? stored.capacity : room.capacity,
      active: typeof stored.active === "boolean" ? stored.active : room.active,
      color: typeof stored.color === "string" && stored.color ? stored.color : room.color,
    };
  });
}

export function activeRooms(rooms: RoomConfig[]): RoomConfig[] {
  const active = rooms.filter((room) => room.active);
  // Una board senza camere attive non è configurabile né usabile: meglio la
  // prima camera che una griglia vuota senza spiegazione.
  return active.length > 0 ? active : rooms.slice(0, 1);
}

export function activeRoomIds(rooms: RoomConfig[]): Lodge[] {
  return activeRooms(rooms).map((room) => room.id);
}

export function roomLabel(rooms: RoomConfig[], id: string): string {
  return rooms.find((room) => room.id === id)?.name ?? id;
}

export function roomColor(rooms: RoomConfig[], id: string): string {
  return rooms.find((room) => room.id === id)?.color ?? "#e2725b";
}

export function roomCapacity(rooms: RoomConfig[], id: string): number | null {
  return rooms.find((room) => room.id === id)?.capacity ?? null;
}
