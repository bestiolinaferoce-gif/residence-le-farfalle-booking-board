"use client";

import { useEffect, useState } from "react";
import { STORAGE_KEY } from "@/lib/utils";

const MIGRATION_KEY = "le-farfalle:migration-done";

export function MigrationHelper() {
  const [banner, setBanner] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(MIGRATION_KEY) === "true") return;

    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Nessun dato locale: segna come già fatto
      localStorage.setItem(MIGRATION_KEY, "true");
      return;
    }

    let bookings: unknown[];
    try {
      const parsed = JSON.parse(raw);
      bookings = Array.isArray(parsed) ? parsed : [];
    } catch {
      localStorage.setItem(MIGRATION_KEY, "true");
      return;
    }

    if (bookings.length === 0) {
      localStorage.setItem(MIGRATION_KEY, "true");
      return;
    }

    fetch("/api/bookings/migrate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookings }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("migrate failed");
        const data = (await res.json()) as { inserted: number; skipped: number };
        localStorage.setItem(MIGRATION_KEY, "true");
        if (data.inserted > 0) {
          setBanner(`✓ Migrazione completata: ${data.inserted} prenotazion${data.inserted === 1 ? "e importata" : "i importate"} sul cloud.`);
          setTimeout(() => setBanner(null), 8000);
        }
      })
      .catch(() => {
        // Silenzioso: ritenterà al prossimo mount finché non va a buon fine
      });
  }, []);

  if (!banner) return null;

  return (
    <div
      role="status"
      style={{
        position: "fixed",
        bottom: "80px",
        left: "50%",
        transform: "translateX(-50%)",
        background: "#16a34a",
        color: "#fff",
        padding: "10px 20px",
        borderRadius: "8px",
        fontWeight: 600,
        fontSize: "14px",
        boxShadow: "0 4px 16px rgba(22,163,74,0.35)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        gap: "12px",
      }}
    >
      {banner}
      <button
        onClick={() => setBanner(null)}
        style={{
          background: "none",
          border: "none",
          color: "#fff",
          cursor: "pointer",
          fontSize: "16px",
          lineHeight: 1,
          padding: 0,
        }}
        aria-label="Chiudi"
      >
        ×
      </button>
    </div>
  );
}
