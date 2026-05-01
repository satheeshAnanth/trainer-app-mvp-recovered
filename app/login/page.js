"use client";

import Link from "next/link";
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

function TrainerLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [uiStep, setUiStep] = useState("phone");
  const [selectedRole, setSelectedRole] = useState("trainer");
  const [trainerExists, setTrainerExists] = useState(false);
  const [profile, setProfile] = useState({
    name: "",
    gymName: "",
    specialization: [],
    yearsExperience: "5",
    location: "",
  });
  const [pricingTier, setPricingTier] = useState("starter");
  const [accessDeniedPhone, setAccessDeniedPhone] = useState("");
  const [resendCountdown, setResendCountdown] = useState(15);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isValidPhone = useMemo(() => phone.replace(/\D/g, "").length === 10, [phone]);
  const isValidOtp = useMemo(() => otp.replace(/\D/g, "").length === 6, [otp]);

  const uiMeta = useMemo(() => {
    if (uiStep === "phone") return { step: 1, total: 4, label: "Phone", progress: 25 };
    if (uiStep === "role") return { step: 2, total: 4, label: "Role", progress: 50 };
    if (uiStep === "profile" || uiStep === "pricing") {
      return { step: 3, total: 4, label: "Profile", progress: 75 };
    }
    if (uiStep === "verify") return { step: 4, total: 4, label: "Verify", progress: 100 };
    if (uiStep === "accessDenied") {
      return { step: 2, total: 4, label: "Access check", progress: 50 };
    }
    return { step: 1, total: 4, label: "Phone", progress: 25 };
  }, [uiStep]);

  useEffect(() => {
    if (uiStep !== "verify") return;
    if (resendCountdown <= 0) return;
    const t = setTimeout(() => setResendCountdown((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [uiStep, resendCountdown]);

  function setProfileField(key, value) {
    setProfile((prev) => ({ ...prev, [key]: value }));
  }

  function toggleSpecialization(item) {
    setProfile((prev) => {
      const exists = prev.specialization.includes(item);
      return {
        ...prev,
        specialization: exists
          ? prev.specialization.filter((v) => v !== item)
          : [...prev.specialization, item],
      };
    });
  }

  async function sendTrainerOtp(normalizedPhone) {
    const otpRes = await fetch("/api/auth/otp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: normalizedPhone }),
    });
    const otpJson = await otpRes.json();
    if (!otpRes.ok || !otpJson?.data?.sent) {
      throw new Error(otpJson?.message ?? "Unable to send OTP. Try again.");
    }
  }

  async function sendClientOtp(normalizedPhone) {
    const otpRes = await fetch("/api/client-auth/otp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: normalizedPhone }),
    });
    const otpJson = await otpRes.json();
    if (!otpRes.ok || !otpJson?.data?.sent) {
      throw new Error(otpJson?.message ?? "Unable to send OTP. Try again.");
    }
  }

  async function handlePhoneContinue() {
    if (!isValidPhone || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const normalizedPhone = normalizePhone(phone);
      const checkRes = await fetch("/api/auth/check-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalizedPhone }),
      });
      const checkJson = await checkRes.json();
      setTrainerExists(Boolean(checkRes.ok && checkJson?.data?.exists));
      setUiStep("role");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRoleVerify() {
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const normalizedPhone = normalizePhone(phone);
      if (selectedRole === "client") {
        const checkRes = await fetch("/api/client-auth/check-phone", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: normalizedPhone }),
        });
        const checkJson = await checkRes.json();
        if (!checkRes.ok || !checkJson?.data?.exists) {
          setAccessDeniedPhone(normalizedPhone);
          setUiStep("accessDenied");
          return;
        }
        await sendClientOtp(normalizedPhone);
        setResendCountdown(15);
        setUiStep("verify");
        return;
      }

      if (trainerExists) {
        await sendTrainerOtp(normalizedPhone);
        setResendCountdown(15);
        setUiStep("verify");
        return;
      }
      setUiStep("profile");
    } catch (e) {
      setError(e?.message ?? "Unable to proceed.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleProfileContinue() {
    if (!profile.name.trim()) {
      setError("Please enter your name");
      return;
    }
    setError("");
    setUiStep("pricing");
  }

  async function handlePricingContinue() {
    setSubmitting(true);
    setError("");
    try {
      const normalizedPhone = normalizePhone(phone);
      const response = await fetch("/api/admin/register-trainer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: normalizedPhone,
          name: profile.name,
          gymName: profile.gymName,
          specialization: profile.specialization.join(", "),
          yearsExperience: Number(profile.yearsExperience || 0),
          location: profile.location,
          pricingTier,
        }),
      });
      const json = await response.json();
      if (!response.ok || !json?.ok) {
        setError(json?.message ?? "Could not create trainer profile.");
        return;
      }
      await sendTrainerOtp(normalizedPhone);
      setResendCountdown(15);
      setUiStep("verify");
    } catch (e) {
      setError(e?.message ?? "Could not create trainer profile.");
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
      if (selectedRole === "client") {
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
      const endpoint = selectedRole === "client" ? "/api/client-auth/otp/verify" : "/api/auth/otp/verify";
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
      if (selectedRole === "client") {
        router.push("/my-portal");
      } else {
        router.push(safeNextPath(searchParams.get("next")));
      }
    } finally {
      setSubmitting(false);
    }
  }

  const specializations = [
    "Strength Training",
    "Cardio & Conditioning",
    "Yoga & Flexibility",
    "Sports Performance",
    "Rehabilitation",
    "Nutrition & Wellness",
    "General Fitness",
  ];

  return (
    <main className="auth-screen">
      <div className="auth-container">
        <section className="card auth-card">
          <div className="auth-progress">
            <div className="auth-progress-meta">
              <span>Step {uiMeta.step} of {uiMeta.total}</span>
              <span>{uiMeta.label}</span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${uiMeta.progress}%` }} />
            </div>
          </div>

          {uiStep === "phone" ? (
            <>
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
                {error ? <p className="auth-subtitle" style={{ color: "#fca5a5" }}>{error}</p> : null}
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

          {uiStep === "role" ? (
            <>
              <p className="eyebrow">Select role</p>
              <h1 className="auth-title">Are you a Trainer or Client?</h1>
              <p className="auth-subtitle">Help us set up your account correctly</p>
              <div className="auth-form">
                <button
                  type="button"
                  className={`role-option ${selectedRole === "trainer" ? "role-option-active" : ""}`}
                  onClick={() => setSelectedRole("trainer")}
                >
                  <strong>I&apos;m a Trainer</strong>
                  <span>I train clients and want to manage their progress</span>
                </button>
                <button
                  type="button"
                  className={`role-option ${selectedRole === "client" ? "role-option-active" : ""}`}
                  onClick={() => setSelectedRole("client")}
                >
                  <strong>I&apos;m a Client</strong>
                  <span>I work with a trainer and want to view my sessions</span>
                </button>
                {error ? <p className="auth-subtitle" style={{ color: "#fca5a5" }}>{error}</p> : null}
                <button type="button" className="continue-btn" onClick={handleRoleVerify} disabled={submitting}>
                  {submitting ? "Please wait..." : "Verify & Sign In"}
                </button>
                <button type="button" className="ghost-button" onClick={() => setUiStep("phone")}>
                  Back
                </button>
              </div>
            </>
          ) : null}

          {uiStep === "accessDenied" ? (
            <>
              <p className="eyebrow">Access required</p>
              <h1 className="auth-title">Trainer Access Required</h1>
              <p className="auth-subtitle">Your trainer needs to add you to their client list</p>
              <article className="card panel" style={{ marginTop: "1rem" }}>
                <p className="item-sub">
                  To access the app, your trainer needs to add your mobile number to their client list.
                </p>
                <p className="item-sub" style={{ marginTop: 8 }}>
                  Your number: <span style={{ color: "var(--mint)" }}>{accessDeniedPhone}</span>
                </p>
                <ol className="item-sub" style={{ marginTop: 12 }}>
                  <li>Log in to their trainer account</li>
                  <li>Go to Clients - Add Client</li>
                  <li>Enter your name and this mobile number</li>
                </ol>
                <div className="quick-actions" style={{ marginTop: 12 }}>
                  <button type="button" className="ghost-button" onClick={() => setUiStep("phone")}>
                    Back to login
                  </button>
                </div>
              </article>
            </>
          ) : null}

          {uiStep === "profile" ? (
            <>
              <p className="eyebrow">Trainer profile</p>
              <h1 className="auth-title">Create Your Profile</h1>
              <p className="auth-subtitle">Tell us about yourself and your training practice</p>
              <div className="auth-form">
                <label className="auth-label">Full Name *</label>
                <input className="phone-input" value={profile.name} onChange={(e) => setProfileField("name", e.target.value)} />
                <label className="auth-label" style={{ marginTop: 8 }}>Gym/Studio Name</label>
                <input className="phone-input" value={profile.gymName} onChange={(e) => setProfileField("gymName", e.target.value)} />
                <label className="auth-label" style={{ marginTop: 8 }}>Specializations (select all that apply)</label>
                <div className="spec-grid">
                  {specializations.map((item) => (
                    <button
                      key={item}
                      type="button"
                      className={`spec-item ${profile.specialization.includes(item) ? "spec-item-active" : ""}`}
                      onClick={() => toggleSpecialization(item)}
                    >
                      {item}
                    </button>
                  ))}
                </div>
                <label className="auth-label" style={{ marginTop: 8 }}>Years of Experience</label>
                <input
                  className="phone-input"
                  type="number"
                  value={profile.yearsExperience}
                  onChange={(e) => setProfileField("yearsExperience", e.target.value)}
                />
                <label className="auth-label" style={{ marginTop: 8 }}>Location</label>
                <input className="phone-input" value={profile.location} onChange={(e) => setProfileField("location", e.target.value)} />
                {error ? <p className="auth-subtitle" style={{ color: "#fca5a5" }}>{error}</p> : null}
                <button type="button" className="continue-btn" onClick={handleProfileContinue}>
                  Continue to Pricing
                </button>
                <button type="button" className="ghost-button" onClick={() => setUiStep("role")}>
                  Back
                </button>
              </div>
            </>
          ) : null}

          {uiStep === "pricing" ? (
            <>
              <p className="eyebrow">Welcome</p>
              <h1 className="auth-title">Choose Your Plan</h1>
              <p className="auth-subtitle">
                Transparent pricing based on your needs. Start free, upgrade when you&apos;re ready.
              </p>
              <div className="auth-form">
                <div className="plan-grid">
                  <button
                    type="button"
                    className={`plan-card ${pricingTier === "starter" ? "plan-card-active" : ""}`}
                    onClick={() => setPricingTier("starter")}
                  >
                    <h3>Free</h3>
                    <p>Free Trial</p>
                    <p className="item-sub">Track 1 client</p>
                    <p className="item-sub">Basic session logging</p>
                    <p className="item-sub">14-day trial</p>
                  </button>
                  <button
                    type="button"
                    className={`plan-card ${pricingTier === "pro" ? "plan-card-active" : ""}`}
                    onClick={() => setPricingTier("pro")}
                  >
                    <h3>INR 99 / month</h3>
                    <p>Pro</p>
                    <p className="item-sub">Unlimited clients</p>
                    <p className="item-sub">Client portal access</p>
                    <p className="item-sub">Session sharing with clients</p>
                  </button>
                </div>
                {error ? <p className="auth-subtitle" style={{ color: "#fca5a5" }}>{error}</p> : null}
                <button
                  type="button"
                  className="continue-btn"
                  onClick={handlePricingContinue}
                  disabled={submitting}
                >
                  {submitting ? "Please wait..." : "Continue"}
                </button>
                <button type="button" className="ghost-button" onClick={() => setUiStep("profile")}>
                  Back to profile
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
                  placeholder="123456"
                  className="phone-input"
                  value={otp}
                  onChange={(event) => setOtp(event.target.value)}
                />
                <div className="quick-actions" style={{ marginTop: 10 }}>
                  <button type="button" className="ghost-button" onClick={() => { setUiStep("phone"); setOtp(""); }}>
                    Change phone number
                  </button>
                  <button type="button" className="ghost-button" onClick={handleResendOtp} disabled={resendCountdown > 0 || submitting}>
                    {resendCountdown > 0 ? `Resend OTP in ${resendCountdown}s` : "Resend OTP"}
                  </button>
                </div>
                {error ? <p className="auth-subtitle" style={{ color: "#fca5a5" }}>{error}</p> : null}
                <button
                  type="button"
                  className="continue-btn"
                  disabled={!isValidOtp || submitting}
                  onClick={handleVerifyOtp}
                >
                  {submitting ? "Please wait..." : "Verify & Sign In"}
                </button>
                <button type="button" className="ghost-button" onClick={() => setUiStep("role")}>
                  Back
                </button>
              </div>
            </>
          ) : null}

          {uiStep === "phone" ? (
            <div className="auth-form">
              <p className="auth-subtitle" style={{ marginTop: 16 }}>
                New trainer?{" "}
                <Link href="/onboard/trainer" style={{ color: "var(--mint)" }}>
                  Start onboarding
                </Link>
              </p>
              <p className="auth-subtitle" style={{ marginTop: 6 }}>
                Client?{" "}
                <Link href="/client-login" style={{ color: "var(--mint)" }}>
                  Client sign in
                </Link>
              </p>
            </div>
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
      <TrainerLoginForm />
    </Suspense>
  );
}
