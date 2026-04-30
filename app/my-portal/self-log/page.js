"use client";

import { useState } from "react";
import ClientShell from "app/_components/ClientShell";

export default function Page() {
  const [form, setForm] = useState({
    workoutType: "Home lower body",
    duration: "45",
    details: "Bodyweight squats, lunges, glute bridge, brisk walk warm-up.",
    discomfort: "Mild lower-back tightness after lunges.",
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit() {
    setMessage("");
    if (!form.workoutType || !form.details) {
      setMessage("Please fill required workout fields.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/client/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: "c1",
          clientName: "Ananya Rao",
          sessionDate: new Date().toISOString().slice(0, 10),
          sessionTitle: form.workoutType,
          details: form.details,
          discomfort: form.discomfort,
          durationMinutes: Number(form.duration || 0),
        }),
      });
      const json = await response.json();
      if (!response.ok || !json?.ok) {
        setMessage(json?.message ?? "Unable to submit self log.");
        return;
      }
      setMessage("Submitted for trainer review.");
    } catch (_error) {
      setMessage("Unable to submit self log.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ClientShell title="Self Log" subtitle="Submit your off-trainer workout for approval.">
      <article className="card panel">
        <h2>Submit session</h2>
        <div className="form-grid">
          <label className="field">
            <span>Workout type *</span>
            <input type="text" value={form.workoutType} onChange={(event) => setField("workoutType", event.target.value)} />
          </label>
          <label className="field">
            <span>Duration (min) *</span>
            <input type="number" value={form.duration} onChange={(event) => setField("duration", event.target.value)} />
          </label>
          <label className="field full">
            <span>Workout details *</span>
            <textarea rows={4} value={form.details} onChange={(event) => setField("details", event.target.value)} />
          </label>
          <label className="field full">
            <span>Any pain / discomfort</span>
            <textarea rows={3} value={form.discomfort} onChange={(event) => setField("discomfort", event.target.value)} />
          </label>
        </div>
        {message ? <p className="item-sub">{message}</p> : null}
        <div className="quick-actions">
          <button className="mint-button" type="button" onClick={handleSubmit} disabled={saving}>
            {saving ? "Submitting..." : "Submit for trainer review"}
          </button>
        </div>
      </article>
    </ClientShell>
  );
}
