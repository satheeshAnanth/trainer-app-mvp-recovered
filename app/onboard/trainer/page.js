"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const ALL_SKILLS = [
  "Strength Training",
  "Cardio & Conditioning",
  "Yoga & Flexibility",
  "Sports Performance",
  "Rehabilitation",
  "Nutrition & Wellness",
  "General Fitness",
];

const WALKTHROUGH = [
  {
    title: "Track every session clearly",
    text: "Capture structured notes and exercise-specific metrics in each session.",
  },
  {
    title: "Mandatory goal template",
    text: "Every completed session must include goal progress updates before closing.",
  },
  {
    title: "Client self-logs and approvals",
    text: "Clients can submit off-trainer workouts; you review and approve from pending notes.",
  },
];

function TrainerOnboardForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [pricing, setPricing] = useState({
    billingModels: {
      trial: { clientLimit: 5, perClientCostInr: 0 },
      perClient: { clientLimit: 5000, perClientCostInr: 99 },
    },
  });
  const [form, setForm] = useState({
    name: "",
    phone: "",
    gymName: "",
    specialization: [],
    yearsExperience: "",
    location: "",
    pricingTier: "starter",
    billingModel: "trial",
  });
  const [walkIndex, setWalkIndex] = useState(0);
  const [phoneLocked, setPhoneLocked] = useState(false);

  const isValidPhone = useMemo(() => form.phone.replace(/\D/g, "").length === 10, [form.phone]);

  useEffect(() => {
    const rawPhone = String(searchParams.get("phone") ?? "").trim();
    if (!rawPhone) return;
    const digits = rawPhone.replace(/\D/g, "");
    const local10 = digits.length >= 10 ? digits.slice(-10) : "";
    if (!local10) return;
    setForm((prev) => ({ ...prev, phone: local10 }));
    setPhoneLocked(true);
  }, [searchParams]);

  async function loadPricing() {
    try {
      const res = await fetch("/api/auth/pricing");
      const json = await res.json();
      setPricing({
        ...pricing,
        ...(json?.data ?? {}),
      });
    } catch {
      // keep defaults
    }
  }

  async function nextFromProfile() {
    if (!form.name.trim() || !isValidPhone) {
      setError("Name and a valid mobile number are required.");
      return;
    }
    setError("");
    await loadPricing();
    setStep(2);
  }

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleSpecialization(skill) {
    setForm((prev) => {
      const current = Array.isArray(prev.specialization) ? prev.specialization : [];
      const exists = current.includes(skill);
      return {
        ...prev,
        specialization: exists ? current.filter((item) => item !== skill) : [...current, skill],
      };
    });
  }

  async function completeRegistration() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/admin/register-trainer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          specialization: Array.isArray(form.specialization) ? form.specialization.join(", ") : "",
          yearsExperience: Number(form.yearsExperience || 0),
        }),
      });
      const json = await response.json();
      if (!response.ok || !json?.ok) {
        setError(json?.message ?? "Could not register trainer profile.");
        return;
      }
      setStep(3);
    } finally {
      setSaving(false);
    }
  }

  function nextWalkthrough() {
    if (walkIndex < WALKTHROUGH.length - 1) {
      setWalkIndex((n) => n + 1);
      return;
    }
    router.push("/portal");
  }

  return (
    <main className="auth-screen">
      <div className="auth-container">
        <section className="card auth-card">
          <div className="auth-progress">
            <div className="auth-progress-meta">
              <span>Step {step} of 3</span>
              <span>Trainer onboarding</span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${(step / 3) * 100}%` }} />
            </div>
          </div>

          {step === 1 ? (
            <>
              <p className="eyebrow">New Trainer</p>
              <h1 className="auth-title">Set up your account</h1>
              <p className="auth-subtitle">These details are used to create your trainer profile.</p>
              <div className="auth-form auth-field-stack">
                <label className="auth-label">Full name</label>
                <input className="auth-input" value={form.name} onChange={(e) => setField("name", e.target.value)} />
                <label className="auth-label" style={{ marginTop: 10 }}>Mobile number</label>
                <div className="phone-input-shell">
                  <span className="country-code">+91</span>
                  <input
                    className="phone-input"
                    value={form.phone}
                    onChange={(e) => setField("phone", e.target.value)}
                    disabled={phoneLocked}
                  />
                </div>
                {phoneLocked ? <p className="item-sub">Mobile number is locked from your login step.</p> : null}
                <label className="auth-label" style={{ marginTop: 10 }}>Gym name</label>
                <input className="auth-input" value={form.gymName} onChange={(e) => setField("gymName", e.target.value)} />
                <label className="auth-label" style={{ marginTop: 10 }}>Specialization</label>
                <div className="spec-grid">
                  {ALL_SKILLS.map((skill) => {
                    const active = Array.isArray(form.specialization) && form.specialization.includes(skill);
                    return (
                      <button
                        key={skill}
                        type="button"
                        className={`spec-item ${active ? "spec-item-active" : ""}`}
                        onClick={() => toggleSpecialization(skill)}
                      >
                        {active ? "✓ " : "○ "}
                        {skill}
                      </button>
                    );
                  })}
                </div>
                <label className="auth-label" style={{ marginTop: 10 }}>Years of experience</label>
                <input className="auth-input" type="number" value={form.yearsExperience} onChange={(e) => setField("yearsExperience", e.target.value)} />
                <label className="auth-label" style={{ marginTop: 10 }}>Location</label>
                <input className="auth-input" value={form.location} onChange={(e) => setField("location", e.target.value)} />
                {error ? <p className="auth-alert">{error}</p> : null}
                <button className="continue-btn" type="button" onClick={nextFromProfile}>
                  Continue
                </button>
              </div>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <p className="eyebrow">Pricing</p>
              <h1 className="auth-title">Choose billing model</h1>
              <p className="auth-subtitle">Start free, then switch to per-client billing as you scale.</p>
              <div className="auth-form auth-field-stack">
                <div className="plan-grid">
                  <button
                    type="button"
                    className={`plan-card ${form.billingModel === "trial" ? "plan-card-active" : ""}`}
                    onClick={() => setField("billingModel", "trial")}
                  >
                    <h3>Free trial up to {pricing?.billingModels?.trial?.clientLimit ?? 5} clients</h3>
                    <p className="item-sub">Ideal for getting started quickly.</p>
                  </button>
                  <button
                    type="button"
                    className={`plan-card ${form.billingModel === "per_client" ? "plan-card-active" : ""}`}
                    onClick={() => setField("billingModel", "per_client")}
                  >
                    <h3>Per-client pricing after threshold</h3>
                    <p className="item-sub">
                      INR {pricing?.billingModels?.perClient?.perClientCostInr ?? 99} per active client / month.
                    </p>
                  </button>
                </div>
                <p className="auth-subtitle">
                  Trial limit: {pricing?.billingModels?.trial?.clientLimit ?? 5} clients.
                </p>
                {error ? <p className="auth-alert">{error}</p> : null}
                <button className="continue-btn" type="button" disabled={saving} onClick={completeRegistration}>
                  {saving ? "Creating..." : "Create trainer account"}
                </button>
              </div>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <p className="eyebrow">Walkthrough</p>
              <h1 className="auth-title">{WALKTHROUGH[walkIndex].title}</h1>
              <p className="auth-subtitle">{WALKTHROUGH[walkIndex].text}</p>
              <div className="auth-form">
                <p className="auth-subtitle">
                  Page {walkIndex + 1} of {WALKTHROUGH.length}
                </p>
                <button className="continue-btn" type="button" onClick={nextWalkthrough}>
                  {walkIndex < WALKTHROUGH.length - 1 ? "Next" : "Go to dashboard"}
                </button>
              </div>
            </>
          ) : null}
        </section>
      </div>
    </main>
  );
}

export default function TrainerOnboardPage() {
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
      <TrainerOnboardForm />
    </Suspense>
  );
}
