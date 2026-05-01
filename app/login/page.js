"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";

function safeNextPath(next) {
  if (!next || typeof next !== "string") return "/portal";
  if (!next.startsWith("/") || next.startsWith("//")) return "/portal";
  return next;
}

function TrainerLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState("phone");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isValidPhone = useMemo(() => phone.replace(/\D/g, "").length === 10, [phone]);
  const isValidOtp = useMemo(() => otp.replace(/\D/g, "").length === 6, [otp]);

  async function handleContinue() {
    if (!isValidPhone || submitting) return;
    setSubmitting(true);
    setError("");

    try {
      const normalizedPhone = `+91${phone.replace(/\D/g, "")}`;
      const checkRes = await fetch("/api/auth/check-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalizedPhone }),
      });
      const checkJson = await checkRes.json();
      if (!checkRes.ok || !checkJson?.data?.exists) {
        setError("Trainer phone not found.");
        return;
      }

      const otpRes = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalizedPhone }),
      });
      const otpJson = await otpRes.json();
      if (!otpRes.ok || !otpJson?.data?.sent) {
        setError("Unable to send OTP. Try again.");
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
      const verifyRes = await fetch("/api/auth/otp/verify", {
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
              <span>Step 1 of 4</span>
              <span>Phone</span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: "25%" }} />
            </div>
          </div>

          <p className="eyebrow">Welcome</p>
          <h1 className="auth-title">Sign In</h1>
          <p className="auth-subtitle">Enter your mobile number to get started</p>

          <div className="auth-form">
            <label className="auth-label" htmlFor="mobile">
              Mobile number
            </label>
            <div className="phone-input-shell">
              <span className="country-code">+91</span>
              <input
                id="mobile"
                type="tel"
                placeholder="98765 43210"
                className="phone-input"
                autoComplete="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            </div>

            {step === "otp" ? (
              <label className="auth-label" htmlFor="otp" style={{ marginTop: 12 }}>
                OTP code
                <input
                  id="otp"
                  type="text"
                  placeholder="123456"
                  className="phone-input"
                  value={otp}
                  onChange={(event) => setOtp(event.target.value)}
                />
              </label>
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
      <TrainerLoginForm />
    </Suspense>
  );
}
