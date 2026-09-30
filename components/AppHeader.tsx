"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, FileCheck2, Moon, Settings2, Sun, Trash2, TrendingUp } from "lucide-react";
import { useProperty } from "@/lib/settingsStore";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  /** Contatore mostrato accanto alla voce (es. adempimenti mancanti). */
  badge?: number;
};

export function AppHeader({
  pendingReports = 0,
  trashCount = 0,
  darkMode,
  onToggleDarkMode,
  right,
}: {
  pendingReports?: number;
  trashCount?: number;
  darkMode?: boolean;
  onToggleDarkMode?: () => void;
  right?: React.ReactNode;
}) {
  const pathname = usePathname();
  const property = useProperty();

  const items: NavItem[] = [
    { href: "/", label: "Board", icon: <CalendarDays size={16} /> },
    { href: "/adempimenti", label: "Adempimenti", icon: <FileCheck2 size={16} />, badge: pendingReports },
    { href: "/report", label: "Report", icon: <TrendingUp size={16} /> },
    { href: "/cestino", label: "Cestino", icon: <Trash2 size={16} />, badge: trashCount },
    { href: "/impostazioni", label: "Impostazioni", icon: <Settings2 size={16} /> },
  ];

  return (
    <header className="app-header no-print">
      <div className="brand">
        <span className="brand-mark" aria-hidden>
          🦋
        </span>
        <span className="brand-text">
          <span className="brand-name">{property.name}</span>
          <span className="brand-sub">{property.tagline || "Booking Board"}</span>
        </span>
      </div>

      <nav className="main-nav" aria-label="Sezioni">
        {items.map((item) => {
          const current = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} className="nav-link" aria-current={current ? "page" : undefined}>
              {item.icon}
              <span>{item.label}</span>
              {item.badge ? <span className="nav-badge">{item.badge}</span> : null}
            </Link>
          );
        })}
      </nav>

      <span className="header-spacer" />

      {right}

      {/* Obbligo di legge: il CIN resta esposto in ogni schermata. */}
      {property.cin ? <span className="cin-chip">CIN {property.cin}</span> : null}

      {onToggleDarkMode ? (
        <button
          type="button"
          className="icon-btn"
          onClick={onToggleDarkMode}
          aria-label={darkMode ? "Passa al tema chiaro" : "Passa al tema scuro"}
          title={darkMode ? "Tema chiaro" : "Tema scuro"}
        >
          {darkMode ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      ) : null}

      <button
        type="button"
        className="icon-btn"
        onClick={async () => {
          await fetch("/api/logout", { method: "POST" });
          window.location.href = "/login";
        }}
      >
        Esci
      </button>
    </header>
  );
}
