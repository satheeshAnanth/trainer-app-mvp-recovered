"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

function safeNextPath(next) {
  if (!next || typeof next !== "string") return "/portal";
  if (!next.startsWith("/") || next.startsWith("//")) return "/portal";
  return next;
}

function normalizePhone(raw) {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.startsWith("91") && digits.length === 12) return `+${digits}`;
  if (String(raw).startsWith("+")) return String(raw);
  return `+${digits}`;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [uiStep, setUiStep] = useState("phone"); // phone | verify | unknown
  const [detectedRole, setDetectedRole] = useState("trainer"); // trainer | client
  const [resendCountdown, setResendCountdown] = useState(15);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isValidPhone = useMemo(() => phone.replace(/\D/g, "").length === 10, [phone]);
  const isValidOtp = useMemo(() => otp.replace(/\D/g, "").length === 6, [otp]);

  useEffect(() => {
    if (uiStep !== "verify") return;
    if (resendCountdown <= 0) return;
    const t = setTimeout(() => setResendCountdown((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [uiStep, resendCountdown]);

  async function sendTrainerOtp(normalizedPhone) {
    const response = await fetch("/api/auth/otp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: normalizedPhone }),
    });
    const json = await response.json();
    if (!response.ok || !json?.data?.sent) {
      throw new Error(json?.message ?? "Unable to send OTP.");
    }
  }

  async function sendClientOtp(normalizedPhone) {
    const response = await fetch("/api/client-auth/otp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: normalizedPhone }),
    });
    const json = await response.json();
    if (!response.ok || !json?.data?.sent) {
      throw new Error(json?.message ?? "Unable to send OTP.");
    }
  }

  async function handlePhoneContinue() {
    if (!isValidPhone || submitting) return;
    setSubmitting(true);
    setError("");

    try {
      const normalizedPhone = normalizePhone(phone);
      const [trainerRes, clientRes] = await Promise.all([
        fetch("/api/auth/check-phone", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: normalizedPhone }),
        }),
        fetch("/api/client-auth/check-phone", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: normalizedPhone }),
        }),
      ]);

      const trainerJson = await trainerRes.json();
      const clientJson = await clientRes.json();

      const trainerExists = Boolean(trainerRes.ok && trainerJson?.data?.exists);
      const clientExists = Boolean(clientRes.ok && clientJson?.data?.exists);

      if (trainerExists && clientExists) {
        setError("Phone is mapped to multiple roles. Contact support.");
        return;
      }

      if (trainerExists) {
        setDetectedRole("trainer");
        await sendTrainerOtp(normalizedPhone);
        setResendCountdown(15);
        setUiStep("verify");
        return;
      }

      if (clientExists) {
        setDetectedRole("client");
        await sendClientOtp(normalizedPhone);
        setResendCountdown(15);
        setUiStep("verify");
        return;
      }

      setUiStep("unknown");
    } catch (e) {
      setError(e?.message ?? "Unable to continue.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResendOtp() {
    if (resendCountdown > 0 || submitting) return;
    setSubmitting(true);
    setError("");

    try {
      const normalizedPhone = normalizePhone(phone);
      if (detectedRole === "client") {
        await sendClientOtp(normalizedPhone);
      } else {
        await sendTrainerOtp(normalizedPhone);
      }
      setResendCountdown(15);
    } catch (e) {
      setError(e?.message ?? "Unable to resend OTP.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifyOtp() {
    if (!isValidPhone || !isValidOtp || submitting) return;
    setSubmitting(true);
    setError("");

    try {
      const normalizedPhone = normalizePhone(phone);
      const endpoint = detectedRole === "client" ? "/api/client-auth/otp/verify" : "/api/auth/otp/verify";
      const verifyRes = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalizedPhone, code: otp.replace(/\D/g, "") }),
      });
      const verifyJson = await verifyRes.json();
      if (!verifyRes.ok || !verifyJson?.data?.verified) {
        setError(verifyJson?.message ?? "Invalid OTP.");
        return;
      }

      if (detectedRole === "client") {
        router.push("/my-portal");
      } else {
        router.push(safeNextPath(searchParams.get("next")));
      }
    } finally {
      setSubmitting(false);
    }
  }

  const stepLabel = uiStep === "phone" ? "Phone" : uiStep === "verify" ? "Verify" : "Not found";
  const progress = uiStep === "phone" ? 25 : uiStep === "verify" ? 100 : 50;

  return (
    <main className="auth-screen">
      <div className="auth-container">
        <section className="card auth-card">
          <div className="auth-progress">
            <div className="auth-progress-meta">
              <span>Step {uiStep === "phone" ? 1 : 2} of 2</span>
              <span>{stepLabel}</span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>

          {uiStep === "phone" ? (
            <>
              <p className="eyebrow">Welcome</p>
              <h1 className="auth-title">Sign In</h1>
              <p className="auth-subtitle">Enter your mobile number to get started</p>

              <div className="auth-form">
                <label className="auth-label" htmlFor="mobile">Mobile number</label>
                <div className="phone-input-shell">
                  <span className="country-code">+91</span>
                  <input
                    id="mobile"
                    type="tel"
                    className="phone-input"
                    autoComplete="tel"
                    placeholder="98765 43210"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                  />
                </div>

                {error ? <p className="auth-alert">{error}</p> : null}

                <button
                  type="button"
                  className="continue-btn"
                  disabled={!isValidPhone || submitting}
                  onClick={handlePhoneContinue}
                >
                  {submitting ? "Please wait..." : "Continue"}
                </button>
              </div>
            </>
          ) : null}

          {uiStep === "verify" ? (
            <>
              <p className="eyebrow">Verify OTP</p>
              <h1 className="auth-title">Enter OTP</h1>
              <p className="auth-subtitle">Enter the 6-digit code sent to {normalizePhone(phone)}</p>

              <div className="auth-form">
                <label className="auth-label" htmlFor="otp">OTP Code</label>
                <input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="one-time-code"
                  autoFocus
                  className="auth-input"
                  placeholder="123456"
                  maxLength={6}
                  value={otp}
                  onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
                />

                <div className="auth-button-row">
                  <button type="button" className="ghost-button" onClick={() => { setUiStep("phone"); setOtp(""); }}>
                    Change number
                  </button>
                  <button type="button" className="ghost-button" onClick={handleResendOtp} disabled={resendCountdown > 0 || submitting}>
                    {resendCountdown > 0 ? `Resend OTP in ${resendCountdown}s` : "Resend OTP"}
                  </button>
                </div>

                {error ? <p className="auth-alert">{error}</p> : null}

                <button
                  type="button"
                  className="continue-btn"
                  disabled={!isValidOtp || submitting}
                  onClick={handleVerifyOtp}
                >
                  {submitting ? "Please wait..." : "Verify & Sign In"}
                </button>
              </div>
            </>
          ) : null}

          {uiStep === "unknown" ? (
            <>
              <p className="eyebrow">Not found</p>
              <h1 className="auth-title">Number not registered</h1>
              <p className="auth-subtitle">
                This number is not registered as a trainer or a trainer-added client.
              </p>

              <div className="auth-form">
                <button
                  type="button"
                  className="continue-btn"
                  onClick={() => router.push(`/onboard/trainer?phone=${encodeURIComponent(normalizePhone(phone))}`)}
                >
                  New trainer? Start onboarding
                </button>
                <button type="button" className="ghost-button" onClick={() => router.push(`/client-onboard?phone=${encodeURIComponent(normalizePhone(phone))}`)}>
                  I am a client, talk to trainer
                </button>
                <button type="button" className="ghost-button" onClick={() => setUiStep("phone")}>Back</button>
              </div>
            </>
          ) : null}
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
      <LoginForm />
    </Suspense>
  );
}
