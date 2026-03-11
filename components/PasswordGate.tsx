"use client";

import { useEffect, useState } from "react";

const SESSION_KEY = "le-farfalle:auth";

export function PasswordGate({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem(SESSION_KEY) === "1") {
      setUnlocked(true);
    }
  }, []);
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);

  if (unlocked) return <>{children}</>;

  function submit() {
    const password = process.env.NEXT_PUBLIC_APP_PASSWORD ?? "farfalle2024";
    if (value === password) {
      sessionStorage.setItem(SESSION_KEY, "1");
      setUnlocked(true);
    } else {
      setError(true);
      setValue("");
    }
  }

  return (
    <div className="auth-gate">
      <div className="auth-card">
        <div className="auth-icon">🦋</div>
        <div className="auth-titles">
          <h1>Residence Le Farfalle</h1>
          <p>Booking Board</p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="auth-form"
        >
          <input
            type="password"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(false);
            }}
            placeholder="Password"
            autoFocus
            className="auth-input"
          />
          {error && <span className="field-error">Password non corretta</span>}
          <button type="submit" className="primary-btn auth-btn">
            Accedi
          </button>
        </form>
      </div>
    </div>
  );
}
