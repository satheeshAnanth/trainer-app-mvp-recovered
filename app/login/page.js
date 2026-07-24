"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

function safeNextPath(next, fallback = "/portal") {
  if (!next || typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  return next;
}

function normalizePhone(raw) {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.startsWith("91") && digits.length === 12) return `+${digits}`;
  if (String(raw).startsWith("+")) return String(raw);
  return `+${digits}`;
}

function homeForRole(role, nextParam) {
  if (role === "gym") {
    const next = safeNextPath(nextParam, "/gym");
    return next.startsWith("/gym") ? next : "/gym";
  }
  if (role === "client") return "/my-portal";
  const next = safeNextPath(nextParam, "/portal");
  // Don't send a trainer into gym routes via a stale next= param
  if (next.startsWith("/gym") || next.startsWith("/my-portal")) return "/portal";
  return next;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [uiStep, setUiStep] = useState("phone"); // phone | choose | verify | unknown
  const [roles, setRoles] = useState([]); // gym | trainer | client
  const [detectedRole, setDetectedRole] = useState("trainer");
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

  async function sendOtpForRole(role, normalizedPhone) {
    if (role === "client") {
      await sendClientOtp(normalizedPhone);
    } else {
      // trainer and gym admin share the same OTP send path
      await sendTrainerOtp(normalizedPhone);
    }
  }

  async function beginVerify(role, normalizedPhone) {
    setDetectedRole(role);
    await sendOtpForRole(role, normalizedPhone);
    setResendCountdown(15);
    setUiStep("verify");
  }

  async function handlePhoneContinue() {
    if (!isValidPhone || submitting) return;
    setSubmitting(true);
    setError("");

    try {
      const normalizedPhone = normalizePhone(phone);
      const [trainerRes, clientRes, gymRes] = await Promise.all([
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
        fetch("/api/gym/check-phone", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: normalizedPhone }),
        }),
      ]);

      const trainerJson = await trainerRes.json();
      const clientJson = await clientRes.json();
      const gymJson = await gymRes.json();

      const found = [];
      if (gymRes.ok && gymJson?.data?.exists) found.push("gym");
      if (trainerRes.ok && trainerJson?.data?.exists) found.push("trainer");
      if (clientRes.ok && clientJson?.data?.exists) found.push("client");

      setRoles(found);

      if (found.length === 0) {
        setUiStep("unknown");
        return;
      }

      // Trainer + client on one number remains unsupported (identity conflict).
      if (found.includes("trainer") && found.includes("client")) {
        setError("Phone is mapped to both trainer and client. Contact support.");
        return;
      }

      if (found.length === 1) {
        await beginVerify(found[0], normalizedPhone);
        return;
      }

      // Multiple roles from records (e.g. gym admin + trainer) → choose once.
      setUiStep("choose");
    } catch (e) {
      setError(e?.message ?? "Unable to continue.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleChooseRole(role) {
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      await beginVerify(role, normalizePhone(phone));
    } catch (e) {
      setError(e?.message ?? "Unable to send OTP.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResendOtp() {
    if (resendCountdown > 0 || submitting) return;
    setSubmitting(true);
    setError("");

    try {
      await sendOtpForRole(detectedRole, normalizePhone(phone));
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
      const code = otp.replace(/\D/g, "");
      let endpoint = "/api/auth/otp/verify";
      if (detectedRole === "client") endpoint = "/api/client-auth/otp/verify";
      if (detectedRole === "gym") endpoint = "/api/gym/session";

      const verifyRes = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalizedPhone, code }),
      });
      const verifyJson = await verifyRes.json();

      const ok =
        detectedRole === "gym"
          ? Boolean(verifyRes.ok && verifyJson?.ok && verifyJson?.data?.authenticated)
          : Boolean(verifyRes.ok && verifyJson?.data?.verified);

      if (!ok) {
        setError(verifyJson?.message ?? "Invalid OTP.");
        return;
      }

      router.push(homeForRole(detectedRole, searchParams.get("next")));
    } finally {
      setSubmitting(false);
    }
  }

  const stepLabel =
    uiStep === "phone" ? "Phone" : uiStep === "choose" ? "Role" : uiStep === "verify" ? "Verify" : "Not found";
  const progress = uiStep === "phone" ? 25 : uiStep === "choose" ? 50 : uiStep === "verify" ? 100 : 50;

  const roleLabels = {
    gym: "Gym admin",
    trainer: "Trainer",
    client: "Client",
  };

  return (
    <main className="auth-screen">
      <div className="auth-container">
        <section className="card auth-card">
          <div className="auth-progress">
            <div className="auth-progress-meta">
              <span>Step {uiStep === "phone" ? 1 : uiStep === "choose" ? 2 : 2} of 2</span>
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

          {uiStep === "choose" ? (
            <>
              <p className="eyebrow">Choose role</p>
              <h1 className="auth-title">How do you want to sign in?</h1>
              <p className="auth-subtitle">
                This number is registered for more than one role. Pick one for this session.
              </p>
              <div className="auth-form">
                {roles.map((role) => (
                  <button
                    key={role}
                    type="button"
                    className="continue-btn"
                    disabled={submitting}
                    onClick={() => handleChooseRole(role)}
                    style={role !== roles[0] ? { marginTop: 8, background: "transparent", border: "1px solid #334155", color: "#e2e8f0" } : undefined}
                  >
                    {submitting ? "Please wait..." : `Continue as ${roleLabels[role] || role}`}
                  </button>
                ))}
                {error ? <p className="auth-alert">{error}</p> : null}
                <button type="button" className="ghost-button" onClick={() => setUiStep("phone")}>
                  Change number
                </button>
              </div>
            </>
          ) : null}

          {uiStep === "verify" ? (
            <>
              <p className="eyebrow">Verify OTP</p>
              <h1 className="auth-title">Enter OTP</h1>
              <p className="auth-subtitle">
                Enter the 6-digit code sent to {normalizePhone(phone)}
                {detectedRole ? ` · ${roleLabels[detectedRole] || detectedRole}` : ""}
              </p>

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
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => {
                      setUiStep(roles.length > 1 ? "choose" : "phone");
                      setOtp("");
                    }}
                  >
                    Back
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
                This number is not registered as a gym admin, trainer, or trainer-added client.
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
        <p className="auth-legal-links">
          <a href="/privacy">Privacy Policy</a>
          <span aria-hidden="true"> · </span>
          <a href="/terms">Terms of Use</a>
        </p>
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
