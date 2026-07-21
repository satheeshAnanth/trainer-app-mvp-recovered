"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ClientShell from "app/_components/ClientShell";

const ACTIVITY_OPTIONS = ["sedentary", "lightly active", "moderately active", "very active"];

export default function Page() {
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({ weight_kg: "", height_cm: "", activity_level: "", goal: "" });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/client/profile")
      .then((r) => r.json())
      .then((json) => {
        const p = json?.data?.profile;
        if (!p) return;
        setProfile(p);
        setForm({
          weight_kg: p.weight_kg ?? "",
          height_cm: p.height_cm ?? "",
          activity_level: p.activity_level ?? "",
          goal: p.goal ?? "",
        });
      })
      .catch(() => null);
  }, []);

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/client/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.message ?? "Unable to save.");
      setMessage("Profile updated.");
    } catch (e) {
      setMessage(e.message ?? "Unable to save.");
    } finally {
      setSaving(false);
    }
  }

  async function signOut() {
    await fetch("/api/client-auth/session", { method: "DELETE" });
    window.location.href = "/login";
  }

  return (
    <ClientShell title="My Profile" subtitle="Keep your baseline and activity data updated.">
      <article className="card panel">
        <h2>Health profile</h2>
        {profile === null ? (
          <p className="item-sub">Loading…</p>
        ) : (
          <>
            <div className="form-grid">
              <label className="field">
                <span>Weight (kg)</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  value={form.weight_kg}
                  onChange={(e) => setForm((p) => ({ ...p, weight_kg: e.target.value }))}
                />
              </label>
              <label className="field">
                <span>Height (cm)</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={form.height_cm}
                  onChange={(e) => setForm((p) => ({ ...p, height_cm: e.target.value }))}
                />
              </label>
              <label className="field full">
                <span>Activity level</span>
                <select
                  value={form.activity_level}
                  onChange={(e) => setForm((p) => ({ ...p, activity_level: e.target.value }))}
                >
                  <option value="">Not set</option>
                  {ACTIVITY_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </label>
              <label className="field full">
                <span>Primary goal</span>
                <input
                  type="text"
                  value={form.goal}
                  onChange={(e) => setForm((p) => ({ ...p, goal: e.target.value }))}
                  placeholder="e.g. Lose 5kg in 12 weeks"
                />
              </label>
            </div>
            {message ? (
              <p className="item-sub" style={{ color: message.includes("Unable") ? "#fca5a5" : "#34d399", marginTop: 10 }}>
                {message}
              </p>
            ) : null}
            <button className="continue-btn" type="button" style={{ marginTop: 14 }} onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save profile"}
            </button>
          </>
        )}
      </article>

      <article className="card panel">
        <h2>Exercise Library</h2>
        <p className="item-sub" style={{ marginBottom: 12 }}>Browse exercises and watch form examples.</p>
        <Link href="/exercises" className="ghost-button" style={{ display: "inline-block" }}>Open exercise library</Link>
      </article>

      <article className="card panel">
        <h2>Session</h2>
        <button
          type="button"
          className="ghost-button"
          style={{ width: "100%", borderColor: "#7f1d1d", color: "#fca5a5" }}
          onClick={signOut}
        >
          Sign Out
        </button>
      </article>
    </ClientShell>
  );
}
