"use client";

import { CalendarCheck, Plus, RefreshCw, Search } from "lucide-react";

/**
 * Barra fissa in basso, su telefono: le quattro azioni che il gestore fa
 * davvero in piedi, con una mano sola. Sta sopra la barra home dell'iPhone
 * grazie a `--safe-bottom`.
 */
export function ThumbBar({
  onToday,
  onNew,
  onSearch,
  onSync,
  syncing,
}: {
  onToday: () => void;
  onNew: () => void;
  onSearch: () => void;
  onSync: () => void;
  syncing?: boolean;
}) {
  return (
    <nav className="thumb-bar no-print" aria-label="Azioni rapide">
      <button type="button" className="thumb-btn" onClick={onToday}>
        <CalendarCheck size={20} />
        Oggi
      </button>
      <button type="button" className="thumb-btn" onClick={onSearch}>
        <Search size={20} />
        Cerca
      </button>
      <button type="button" className="thumb-btn" onClick={onSync} disabled={syncing}>
        <RefreshCw size={20} className={syncing ? "spin" : undefined} />
        {syncing ? "Sync…" : "Sync"}
      </button>
      <button type="button" className="thumb-btn" data-primary="true" onClick={onNew}>
        <Plus size={22} />
        Nuova
      </button>
    </nav>
  );
}
