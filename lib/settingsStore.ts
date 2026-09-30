"use client";

import { create } from "zustand";
import { BoardSettings, defaultSettings, normalizeSettings } from "@/lib/settings";
import { activeRoomIds, roomColor, roomLabel, type RoomConfig } from "@/lib/rooms";
import type { Lodge } from "@/lib/types";
import { SETTINGS_LOCAL_KEY } from "@/lib/utils";

type SettingsState = {
  settings: BoardSettings;
  loaded: boolean;
  saving: boolean;
  error: string | null;
  load: () => Promise<void>;
  save: (patch: Partial<BoardSettings>) => Promise<boolean>;
};

function readLocal(): BoardSettings | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SETTINGS_LOCAL_KEY);
    return raw ? normalizeSettings(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function writeLocal(settings: BoardSettings): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SETTINGS_LOCAL_KEY, JSON.stringify(settings));
  } catch {
    /* quota piena: le impostazioni restano comunque su KV */
  }
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: defaultSettings(),
  loaded: false,
  saving: false,
  error: null,

  load: async () => {
    // Prima la copia locale: la board si disegna subito coi nomi giusti anche
    // se la rete è lenta, poi il server corregge.
    const cached = readLocal();
    if (cached) set({ settings: cached });

    try {
      const res = await fetch("/api/settings", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { ok: boolean; settings?: unknown; persisted?: boolean };

      // Server senza database (sviluppo o KV non configurato): risponde coi
      // valori di fabbrica. Sovrascrivere la copia locale rispedirebbe il
      // cliente nel wizard a ogni ricarica.
      if (body.persisted === false && cached) {
        set({ loaded: true, error: "Database non configurato: impostazioni salvate solo su questo dispositivo." });
        return;
      }

      const next = normalizeSettings(body.settings);
      set({ settings: next, loaded: true, error: null });
      writeLocal(next);
    } catch {
      // Senza server si lavora con la copia locale: mai una board vuota.
      set({ loaded: true, error: "Impostazioni non sincronizzate col server." });
    }
  },

  save: async (patch) => {
    const next: BoardSettings = {
      ...get().settings,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    set({ settings: next, saving: true });
    writeLocal(next);

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: next }),
      });
      // 503 = nessun database configurato: la copia locale è già stata scritta,
      // quindi il salvataggio è riuscito per quanto l'ambiente permette.
      if (res.status === 503) {
        set({ saving: false, error: "Database non configurato: modifiche salvate solo su questo dispositivo." });
        return true;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      set({ saving: false, error: null });
      return true;
    } catch {
      set({ saving: false, error: "Salvataggio sul server non riuscito: modifiche salvate solo su questo dispositivo." });
      return false;
    }
  },
}));

/** Scorciatoie di lettura, per non ripetere selettori in ogni componente. */
export function useRooms(): RoomConfig[] {
  return useSettingsStore((s) => s.settings.rooms);
}

export function useActiveRoomIds(): Lodge[] {
  return activeRoomIds(useSettingsStore((s) => s.settings.rooms));
}

export function useRoomLabel(): (id: string) => string {
  const rooms = useRooms();
  return (id: string) => roomLabel(rooms, id);
}

export function useRoomColor(): (id: string) => string {
  const rooms = useRooms();
  return (id: string) => roomColor(rooms, id);
}

export function useProperty() {
  return useSettingsStore((s) => s.settings.property);
}
