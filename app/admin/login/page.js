"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = (() => {
    const next = searchParams.get("next");
    if (!next || !next.startsWith("/admin")) return "/admin";
    return next;
  })();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function login(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.message ?? "Login failed.");
      router.replace(nextPath);
      router.refresh();
    } catch (err) {
      setError(err.message ?? "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "#020617",
        color: "#e2e8f0",
      }}
    >
      <form
        onSubmit={login}
        style={{
          width: "100%",
          maxWidth: 380,
          display: "grid",
          gap: 12,
          padding: 24,
          borderRadius: 16,
          border: "1px solid rgba(148,163,184,0.2)",
          background: "rgba(15,23,42,0.9)",
        }}
      >
        <p style={{ margin: 0, color: "#2dd4bf", fontSize: 12, fontWeight: 700, letterSpacing: "0.06em" }}>
          TRAINERAPP ADMIN
        </p>
        <h1 style={{ margin: 0, fontSize: "1.4rem" }}>Sign in</h1>
        <p style={{ margin: 0, color: "#94a3b8", fontSize: 13 }}>Ops console access is restricted.</p>
        <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
          Email
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(148,163,184,0.3)",
              background: "#0f172a",
              color: "#e2e8f0",
            }}
          />
        </label>
        <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
          Password
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(148,163,184,0.3)",
              background: "#0f172a",
              color: "#e2e8f0",
            }}
          />
        </label>
        {error ? <p style={{ margin: 0, color: "#f87171", fontSize: 13 }}>{error}</p> : null}
        <button
          type="submit"
          disabled={loading}
          style={{
            marginTop: 4,
            padding: "12px 14px",
            borderRadius: 12,
            border: "none",
            background: "#2dd4bf",
            color: "#042f2e",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#020617", color: "#94a3b8" }}>
          Loading…
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
