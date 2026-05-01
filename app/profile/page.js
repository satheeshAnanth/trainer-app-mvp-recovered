"use client";

import { useEffect, useMemo, useState } from "react";
import TrainerShell from "app/_components/TrainerShell";

const ALL_SKILLS = [
  "Strength Training",
  "Cardio & Conditioning",
  "Yoga & Flexibility",
  "Sports Performance",
  "Rehabilitation",
  "Nutrition & Wellness",
  "General Fitness",
];

export default function Page() {
  const [profile, setProfile] = useState(null);
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [skills, setSkills] = useState([]);
  const [billing, setBilling] = useState({ status: "trial", maxClients: 5 });
  const [pricing, setPricing] = useState({ billingModels: { trial: { clientLimit: 5 }, perClient: { perClientCostInr: 99 } } });
  const [clientCount, setClientCount] = useState(0);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [profileRes, sessionRes, pricingRes, clientsRes] = await Promise.all([
          fetch("/api/profile/trainer"),
          fetch("/api/auth/session"),
          fetch("/api/auth/pricing"),
          fetch("/api/clients"),
        ]);
        const profileJson = await profileRes.json();
        const sessionJson = await sessionRes.json();
        const pricingJson = await pricingRes.json();
        const clientsJson = await clientsRes.json();
        const trainer = profileJson?.data?.trainer ?? null;
        const sessionUser = sessionJson?.data?.user ?? {};
        setProfile(trainer);
        setName(trainer?.name ?? sessionUser?.name ?? "");
        setMobile(trainer?.phone ?? sessionUser?.phone ?? "");
        const normalized = String(trainer?.specialization ?? "")
          .split(/[;,]/)
          .map((s) => s.trim())
          .filter(Boolean);
        setSkills(normalized);
        setBilling({
          status: String(trainer?.billing_status ?? "trial"),
          maxClients: Number(trainer?.max_clients ?? 5),
        });
        if (pricingJson?.data) setPricing((prev) => ({ ...prev, ...pricingJson.data }));
        setClientCount((clientsJson?.data?.clients ?? []).length);
      } catch {
        setProfile(null);
      }
    })();
  }, []);

  const specialization = useMemo(() => skills.join(", "), [skills]);
  const isTrial = String(billing.status).toLowerCase() === "trial";
  const perClientCost = Number(pricing?.billingModels?.perClient?.perClientCostInr ?? 99);
  const trialLimit = Number(pricing?.billingModels?.trial?.clientLimit ?? 5);
  const maxClients = Number(billing.maxClients || (isTrial ? trialLimit : 5000));

  function toggleSkill(skill) {
    setSkills((prev) => (prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]));
  }

  async function saveProfile() {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/profile/trainer", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, specialization }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.message ?? "Unable to save profile.");
      setMessage("Profile saved.");
      setProfile((prev) => ({ ...(prev || {}), name, phone: mobile, specialization }));
    } catch (e) {
      setMessage(e?.message ?? "Unable to save profile.");
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/session", { method: "DELETE" });
    window.location.href = "/login";
  }

  return (
    <TrainerShell title="Profile" subtitle="">
      <article className="card panel">
        <h2>Account</h2>
        <div className="form-grid">
          <label className="field full">
            <span>Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="field full">
            <span>Mobile Number (locked)</span>
            <input value={mobile} disabled />
          </label>
        </div>

        <p className="item-title" style={{ marginTop: 10 }}>Skills / Specializations</p>
        <div className="spec-grid">
          {ALL_SKILLS.map((skill) => {
            const active = skills.includes(skill);
            return (
              <button
                key={skill}
                type="button"
                className={`spec-item ${active ? "spec-item-active" : ""}`}
                onClick={() => toggleSkill(skill)}
              >
                {active ? "✓ " : "○ "}
                {skill}
              </button>
            );
          })}
        </div>

        <button className="continue-btn" type="button" onClick={saveProfile} disabled={saving}>
          Save Profile
        </button>
      </article>

      <article className="card panel">
        <h2>Billing</h2>
        <div className="list-item">
          <div>
            <p className="item-title">{isTrial ? "Free trial up to X clients" : "Per-client pricing after threshold"}</p>
            <p className="item-sub">
              {isTrial
                ? `${clientCount}/${maxClients} clients used in trial`
                : `INR ${perClientCost} per active client per month · ${clientCount} active clients`}
            </p>
          </div>
          <span className="status-chip">{Math.max(0, maxClients - clientCount)} slots left</span>
        </div>
      </article>

      <article className="card panel">
        <h2>Settings</h2>
        <div className="list-item">
          <span>Notifications</span>
          <span className="item-sub">Coming soon</span>
        </div>
        <div className="list-item" style={{ marginTop: 8 }}>
          <span>Theme</span>
          <button className="ghost-button" type="button">☼ Light</button>
        </div>
      </article>

      <article className="card panel">
        <h2>Session</h2>
        <button className="ghost-button" type="button" style={{ width: "100%", borderColor: "#7f1d1d", color: "#fca5a5" }} onClick={logout}>
          Logout
        </button>
        <p className="item-sub" style={{ textAlign: "center", marginTop: 10 }}>Trainer App MVP v0.1.0</p>
      </article>

      {message ? <p className="item-sub">{message}</p> : null}
    </TrainerShell>
  );
}
