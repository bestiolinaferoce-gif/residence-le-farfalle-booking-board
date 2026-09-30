"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DEFAULT_PROPERTY } from "@/lib/property";

function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json()) as { ok?: boolean };
      if (res.ok && data.ok) {
        window.location.href = next.startsWith("/") ? next : "/";
        return;
      }
      setError("Password errata. Riprova.");
    } catch {
      setError("Errore di rete. Riprova.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="login-card">
      <div className="login-mark" aria-hidden>
        🦋
      </div>
      <h1>{DEFAULT_PROPERTY.name}</h1>
      <p className="login-sub">Booking Board · area riservata</p>

      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        autoFocus
        autoComplete="current-password"
        className="login-input"
        aria-label="Password"
      />
      {error && <p className="login-error">{error}</p>}
      <button type="submit" className="login-btn" disabled={loading || password.length === 0}>
        {loading ? "Accesso in corso…" : "Entra"}
      </button>
      {DEFAULT_PROPERTY.cin ? <p className="login-cin">CIN {DEFAULT_PROPERTY.cin}</p> : null}
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="login-page">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
