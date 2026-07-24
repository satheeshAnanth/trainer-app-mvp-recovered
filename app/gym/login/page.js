"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function GymLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/gym";

  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState("phone");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  async function sendOtp(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setInfo("");
    try {
      const res = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.message ?? "Failed to send OTP.");
      setStep("otp");
      setInfo("OTP sent. Enter the code to open your gym portal.");
    } catch (err) {
      setError(err.message ?? "Failed to send OTP.");
    } finally {
      setLoading(false);
    }
  }

  async function verify(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/gym/session", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.message ?? "Login failed.");
      router.replace(next.startsWith("/gym") ? next : "/gym");
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
        background: "#0b1220",
        color: "#e2e8f0",
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
    >
      <form
        onSubmit={step === "phone" ? sendOtp : verify}
        style={{
          width: "min(100%, 400px)",
          border: "1px solid #1e293b",
          borderRadius: 16,
          padding: 24,
          background: "#111827",
        }}
      >
        <p style={{ margin: 0, fontSize: 11, letterSpacing: "0.08em", color: "#64748b", textTransform: "uppercase" }}>
          Gym portal
        </p>
        <h1 style={{ margin: "6px 0 8px", fontSize: 22 }}>Sign in</h1>
        <p style={{ margin: "0 0 18px", color: "#94a3b8", fontSize: 14 }}>
          Manage trainer seats for your facility. Client coaching data stays private to each trainer.
        </p>

        {step === "phone" ? (
          <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
            Admin phone
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              autoComplete="tel"
              placeholder="+91…"
              required
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                border: "1px solid #334155",
                background: "#0b1220",
                color: "#e2e8f0",
              }}
            />
          </label>
        ) : (
          <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
            OTP code
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              required
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                border: "1px solid #334155",
                background: "#0b1220",
                color: "#e2e8f0",
              }}
            />
          </label>
        )}

        {error ? <p style={{ color: "#f87171", fontSize: 13, marginTop: 12 }}>{error}</p> : null}
        {info ? <p style={{ color: "#34d399", fontSize: 13, marginTop: 12 }}>{info}</p> : null}

        <button
          type="submit"
          disabled={loading}
          style={{
            marginTop: 16,
            width: "100%",
            padding: "12px 14px",
            borderRadius: 10,
            border: "none",
            background: "#34d399",
            color: "#0b1220",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {loading ? "Please wait…" : step === "phone" ? "Send OTP" : "Open gym portal"}
        </button>
      </form>
    </main>
  );
}

export default function GymLoginPage() {
  return (
    <Suspense fallback={<main style={{ minHeight: "100vh", background: "#0b1220" }} />}>
      <GymLoginForm />
    </Suspense>
  );
}
