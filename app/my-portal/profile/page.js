"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ClientShell from "app/_components/ClientShell";
import CollapsibleSection from "app/_components/CollapsibleSection";
import { useToast } from "app/_components/ToastProvider";

const ACTIVITY_OPTIONS = ["sedentary", "lightly active", "moderately active", "very active"];

export default function Page() {
  const { showToast } = useToast();
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({ weight_kg: "", height_cm: "", activity_level: "", goal: "" });
  const [saving, setSaving] = useState(false);

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
    try {
      const res = await fetch("/api/client/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.message ?? "Unable to save.");
      showToast("Profile updated.");
    } catch (e) {
      showToast(e.message ?? "Unable to save.", { variant: "error" });
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
                  {ACTIVITY_OPTIONS.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
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
            <button className="continue-btn" type="button" style={{ marginTop: 14 }} onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save profile"}
            </button>
          </>
        )}
      </article>

      <CollapsibleSection title="More" subtitle="Library, progress, tips, and account" defaultOpen={false}>
        <div className="quick-actions" style={{ flexWrap: "wrap" }}>
          <Link href="/exercises" className="ghost-button ghost-button-sm">Exercise library</Link>
          <Link href="/my-portal/progress" className="ghost-button ghost-button-sm">Progress</Link>
          <Link href="/my-portal/tips" className="ghost-button ghost-button-sm">Tips</Link>
        </div>
        <button
          type="button"
          className="ghost-button"
          style={{ width: "100%", marginTop: 14, borderColor: "#7f1d1d", color: "#fca5a5" }}
          onClick={signOut}
        >
          Sign Out
        </button>
      </CollapsibleSection>
    </ClientShell>
  );
}
