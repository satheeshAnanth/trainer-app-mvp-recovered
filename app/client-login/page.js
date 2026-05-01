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
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState("phone");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isValidPhone = useMemo(() => phone.replace(/\D/g, "").length === 10, [phone]);
  const isValidOtp = useMemo(() => otp.replace(/\D/g, "").length === 6, [otp]);
  const blockedReason = searchParams.get("reason");

  async function handleContinue() {
    if (!isValidPhone || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const normalizedPhone = `+91${phone.replace(/\D/g, "")}`;
      const checkRes = await fetch("/api/client-auth/check-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalizedPhone }),
      });
      const checkJson = await checkRes.json();
      if (!checkRes.ok || !checkJson?.data?.exists) {
        setError(checkJson?.message ?? "This mobile number is not registered. Please talk to your trainer.");
        router.push(`/client-onboard?phone=${encodeURIComponent(normalizedPhone)}`);
        return;
      }

      const otpRes = await fetch("/api/client-auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalizedPhone }),
      });
      const otpJson = await otpRes.json();
      if (!otpRes.ok || !otpJson?.data?.sent) {
        setError(otpJson?.message ?? "Unable to send OTP. Try again.");
        return;
      }
      setStep("otp");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerify() {
    if (!isValidPhone || !isValidOtp || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const normalizedPhone = `+91${phone.replace(/\D/g, "")}`;
      const verifyRes = await fetch("/api/client-auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalizedPhone, code: otp.replace(/\D/g, "") }),
      });
      const verifyJson = await verifyRes.json();
      if (!verifyRes.ok || !verifyJson?.data?.verified) {
        setError(verifyJson?.message ?? "Invalid OTP.");
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
              <span>Step 1 of 3</span>
              <span>Client mobile</span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: step === "phone" ? "33%" : "66%" }} />
            </div>
          </div>

          <p className="eyebrow">Client portal</p>
          <h1 className="auth-title">Sign In</h1>
          <p className="auth-subtitle">Enter the mobile number shared with your trainer.</p>

          <div className="auth-form">
            <label className="auth-label" htmlFor="mobile">
              Mobile number
            </label>
            <div className="phone-input-shell">
              <span className="country-code">+91</span>
              <input
                id="mobile"
                type="tel"
                className="phone-input"
                autoComplete="tel"
                placeholder="98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            {step === "otp" ? (
              <label className="auth-label" htmlFor="otp" style={{ marginTop: 12 }}>
                OTP code
                <input
                  id="otp"
                  type="text"
                  className="phone-input"
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                />
              </label>
            ) : null}

            {blockedReason === "registration_required" ? (
              <p className="auth-subtitle" style={{ color: "#fca5a5" }}>
                Your account is not active yet. Please talk to your trainer before accessing the app.
              </p>
            ) : null}
            {blockedReason === "login_required" ? (
              <p className="auth-subtitle">Please sign in to continue.</p>
            ) : null}

            {error ? <p className="auth-subtitle" style={{ color: "#fca5a5" }}>{error}</p> : null}

            {step === "phone" ? (
              <button
                type="button"
                className="continue-btn"
                disabled={!isValidPhone || submitting}
                onClick={handleContinue}
              >
                {submitting ? "Please wait..." : "Continue"}
              </button>
            ) : (
              <button
                type="button"
                className="continue-btn"
                disabled={!isValidOtp || submitting}
                onClick={handleVerify}
              >
                {submitting ? "Please wait..." : "Verify OTP"}
              </button>
            )}

            <p className="auth-subtitle" style={{ marginTop: 16 }}>
              Trainer?{" "}
              <Link href="/login" style={{ color: "var(--mint)" }}>
                Trainer sign in
              </Link>
            </p>
            <p className="auth-subtitle" style={{ marginTop: 6 }}>
              Not added yet?{" "}
              <Link href="/client-onboard" style={{ color: "var(--mint)" }}>
                Talk to trainer
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
