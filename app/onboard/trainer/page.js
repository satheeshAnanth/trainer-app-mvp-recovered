"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

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

export default function TrainerOnboardPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [pricing, setPricing] = useState({ oneToOne: 1200, monthly: 9000, online: 800 });
  const [form, setForm] = useState({
    name: "",
    phone: "",
    gymName: "",
    specialization: "",
    yearsExperience: "",
    location: "",
    pricingTier: "starter",
  });
  const [walkIndex, setWalkIndex] = useState(0);

  const isValidPhone = useMemo(() => form.phone.replace(/\D/g, "").length === 10, [form.phone]);

  async function loadPricing() {
    try {
      const res = await fetch("/api/auth/pricing");
      const json = await res.json();
      setPricing(json?.data?.pricing ?? pricing);
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

  async function completeRegistration() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/admin/register-trainer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
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
              <div className="auth-form">
                <label className="auth-label">Full name</label>
                <input className="phone-input" value={form.name} onChange={(e) => setField("name", e.target.value)} />
                <label className="auth-label" style={{ marginTop: 10 }}>Mobile number</label>
                <div className="phone-input-shell">
                  <span className="country-code">+91</span>
                  <input className="phone-input" value={form.phone} onChange={(e) => setField("phone", e.target.value)} />
                </div>
                <label className="auth-label" style={{ marginTop: 10 }}>Gym name</label>
                <input className="phone-input" value={form.gymName} onChange={(e) => setField("gymName", e.target.value)} />
                <label className="auth-label" style={{ marginTop: 10 }}>Specialization</label>
                <input className="phone-input" value={form.specialization} onChange={(e) => setField("specialization", e.target.value)} />
                <label className="auth-label" style={{ marginTop: 10 }}>Years of experience</label>
                <input className="phone-input" type="number" value={form.yearsExperience} onChange={(e) => setField("yearsExperience", e.target.value)} />
                <label className="auth-label" style={{ marginTop: 10 }}>Location</label>
                <input className="phone-input" value={form.location} onChange={(e) => setField("location", e.target.value)} />
                {error ? <p className="auth-subtitle" style={{ color: "#fca5a5" }}>{error}</p> : null}
                <button className="continue-btn" type="button" onClick={nextFromProfile}>
                  Continue
                </button>
              </div>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <p className="eyebrow">Pricing</p>
              <h1 className="auth-title">Choose your plan</h1>
              <p className="auth-subtitle">You can update pricing later from profile settings.</p>
              <div className="auth-form">
                <label className="auth-label">Plan tier</label>
                <select className="phone-input" value={form.pricingTier} onChange={(e) => setField("pricingTier", e.target.value)}>
                  <option value="starter">Starter</option>
                  <option value="pro">Pro</option>
                  <option value="elite">Elite</option>
                </select>
                <p className="auth-subtitle">One-to-one: INR {pricing.oneToOne}</p>
                <p className="auth-subtitle">Monthly: INR {pricing.monthly}</p>
                <p className="auth-subtitle">Online: INR {pricing.online}</p>
                {error ? <p className="auth-subtitle" style={{ color: "#fca5a5" }}>{error}</p> : null}
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
