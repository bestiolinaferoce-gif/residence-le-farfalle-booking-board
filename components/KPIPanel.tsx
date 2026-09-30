"use client";

import { BedDouble, TrendingUp, Wallet, BarChart3 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { formatMoney } from "@/lib/utils";

export type KPIData = {
  bookingsCount: number;
  revenue: number;
  depositsReceived: number;
  occupancyPct: number;
  newBookingsCount: number;
};

type CardDef = {
  icon: LucideIcon;
  iconColor: string | ((d: KPIData) => string);
  iconBg: string | ((d: KPIData) => string);
  label: string;
  getValue: (d: KPIData) => string;
  getSub: (d: KPIData) => string;
  badge?: (d: KPIData) => number | null;
};

/*
 * Colori dal design system della struttura: corallo, mare, sabbia. L'unico
 * colore "semantico" è quello dell'occupazione, che deve dire a colpo d'occhio
 * se il mese sta andando bene.
 */
const CARDS: CardDef[] = [
  {
    icon: BedDouble,
    iconColor: "var(--accent)",
    iconBg: "var(--accent-faint)",
    label: "Prenotazioni",
    getValue: (d) => String(d.bookingsCount),
    getSub: () => "Check-in nel mese",
    badge: (d) => (d.newBookingsCount > 0 ? d.newBookingsCount : null),
  },
  {
    icon: TrendingUp,
    iconColor: "var(--sea)",
    iconBg: "rgba(42,157,143,0.12)",
    label: "Fatturato mese",
    getValue: (d) => formatMoney(d.revenue),
    getSub: () => "Totale incassabile",
  },
  {
    icon: Wallet,
    iconColor: "var(--sand)",
    iconBg: "rgba(233,196,106,0.12)",
    label: "Caparre ricevute",
    getValue: (d) => formatMoney(d.depositsReceived),
    getSub: () => "Già incassate",
  },
  {
    icon: BarChart3,
    iconColor: (d: KPIData) =>
      d.occupancyPct >= 75 ? "var(--sea)" : d.occupancyPct >= 40 ? "var(--sand)" : "var(--muted)",
    iconBg: (d: KPIData) =>
      d.occupancyPct >= 75
        ? "rgba(42,157,143,0.14)"
        : d.occupancyPct >= 40
        ? "rgba(233,196,106,0.14)"
        : "rgba(255,255,255,0.06)",
    label: "Occupazione",
    getValue: (d) => `${Math.round(d.occupancyPct)}%`,
    getSub: () => "Camere × notti del mese",
  },
];

function resolve(val: string | ((d: KPIData) => string), data: KPIData): string {
  return typeof val === "function" ? val(data) : val;
}

type Props = { data: KPIData; monthLabel: string };

export function KPIPanel({ data, monthLabel }: Props) {
  return (
    <div className="kpi-panel" role="region" aria-label={`KPI ${monthLabel}`}>
      {CARDS.map((card) => {
        const Icon = card.icon;
        const iconColor = resolve(card.iconColor, data);
        const iconBg = resolve(card.iconBg, data);
        const badge = card.badge?.(data);
        return (
          <div key={card.label} className="kpi-card">
            <div className="kpi-card-header">
              <div className="kpi-icon-wrap" style={{ background: iconBg }}>
                <Icon size={20} color={iconColor} strokeWidth={2} />
              </div>
              <span className="kpi-label">{card.label}</span>
              {badge != null && (
                <span className="kpi-new-badge">
                  +{badge} nuov{badge === 1 ? "a" : "e"}
                </span>
              )}
            </div>
            {/* Il numero resta nel colore del testo: a colorarlo si perde gerarchia. */}
            <div className="kpi-value">
              {card.getValue(data)}
            </div>
            <div className="kpi-sub">{card.getSub(data)}</div>
          </div>
        );
      })}
    </div>
  );
}
