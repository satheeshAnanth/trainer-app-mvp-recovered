"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";

function safeNextPath(next) {
  if (!next || typeof next !== "string") return "/my-portal";
  if (!next.startsWith("/") || next.startsWith("//")) return "/my-portal";
  return next;
}

function ClientLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = useMemo(() => email.trim().length > 3 && email.includes("@"), [email]);

  async function handleSubmit() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/client-auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        setError(json?.message ?? "Unable to sign in.");
        return;
      }
      router.push(safeNextPath(searchParams.get("next")));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-screen">
      <div className="auth-container">
        <section className="card auth-card">
          <div className="auth-progress">
            <div className="auth-progress-meta">
              <span>Client</span>
              <span>Email</span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: "40%" }} />
            </div>
          </div>

          <p className="eyebrow">Client portal</p>
          <h1 className="auth-title">Sign In</h1>
          <p className="auth-subtitle">Use the email on your client account. Without a database, any email works in recovery mode.</p>

          <div className="auth-form">
            <label className="auth-label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              className="phone-input"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <label className="auth-label" htmlFor="password" style={{ marginTop: 12 }}>
              Password (if your account has one)
            </label>
            <input
              id="password"
              type="password"
              className="phone-input"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            {error ? <p className="auth-subtitle" style={{ color: "#fca5a5" }}>{error}</p> : null}

            <button
              type="button"
              className="continue-btn"
              disabled={!canSubmit || submitting}
              onClick={handleSubmit}
            >
              {submitting ? "Please wait..." : "Continue"}
            </button>

            <p className="auth-subtitle" style={{ marginTop: 16 }}>
              Trainer?{" "}
              <Link href="/login" style={{ color: "var(--mint)" }}>
                Trainer sign in
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <main className="auth-screen">
          <div className="auth-container">
            <p className="auth-subtitle">Loading…</p>
          </div>
        </main>
      }
    >
      <ClientLoginForm />
    </Suspense>
  );
}
