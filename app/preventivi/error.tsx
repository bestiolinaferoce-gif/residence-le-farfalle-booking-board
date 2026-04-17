"use client";

import Link from "next/link";

export default function PreventiviError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeContent: "center",
        padding: 24,
        textAlign: "center",
        fontFamily: "system-ui, sans-serif",
        background: "linear-gradient(165deg, #0a1628 0%, #152a45 100%)",
        color: "#e8ecf4",
      }}
    >
      <div
        style={{
          maxWidth: 420,
          padding: 28,
          borderRadius: 16,
          border: "1px solid rgba(201, 162, 39, 0.35)",
          background: "rgba(255,255,255,0.06)",
        }}
      >
        <h1 style={{ margin: "0 0 12px", fontSize: "1.25rem" }}>
          Errore nel modulo Preventivi
        </h1>
        <p style={{ margin: "0 0 20px", fontSize: "0.9rem", opacity: 0.9 }}>
          {error.message || "Si è verificato un errore imprevisto."}
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={reset}
            style={{
              padding: "10px 18px",
              borderRadius: 10,
              border: "none",
              fontWeight: 700,
              cursor: "pointer",
              background: "linear-gradient(135deg, #c9a227 0%, #a8841a 100%)",
              color: "#0a1628",
            }}
          >
            Riprova
          </button>
          <Link
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "10px 18px",
              borderRadius: 10,
              border: "1px solid rgba(201, 162, 39, 0.4)",
              color: "#e8d48b",
              textDecoration: "none",
            }}
          >
            Torna al Booking Board
          </Link>
        </div>
      </div>
    </div>
  );
}
