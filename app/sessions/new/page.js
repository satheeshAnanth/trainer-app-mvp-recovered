"use client";

import { useState } from "react";
import TrainerShell from "app/_components/TrainerShell";

export default function Page() {
  const [form, setForm] = useState({
    clientName: "Ananya Rao",
    sessionDate: "",
    sessionTitle: "Strength + treadmill conditioning",
    warmup: "Treadmill walk 10 mins, dynamic mobility.",
    mainWork: "Lower body compounds, tempo sets, posture cues.",
    cooldown: "Stretching and breath work, RPE settled to 4/10.",
    goalUpdate: "Bodyweight stable, stamina improved, better squat depth.",
    duration: "10",
    incline: "6",
    distance: "1.10",
    customHr: "128",
  });
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSaveSession() {
    setSaveMessage("");
    if (!form.sessionTitle || !form.warmup || !form.mainWork || !form.cooldown || !form.goalUpdate) {
      setSaveMessage("Please complete all mandatory note sections before saving.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        sections: {
          warmup: form.warmup,
          mainWork: form.mainWork,
          cooldown: form.cooldown,
          goalUpdate: form.goalUpdate,
        },
        exercises: [
          {
            name: "Treadmill Walk",
            metricRequired: ["duration_minutes", "incline_percent", "distance_km"],
            metrics: {
              duration_minutes: Number(form.duration || 0),
              incline_percent: Number(form.incline || 0),
              distance_km: Number(form.distance || 0),
              custom_hr_avg: Number(form.customHr || 0),
            },
          },
        ],
      };

      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: "c1",
          clientName: form.clientName,
          sessionDate: form.sessionDate || null,
          sessionTitle: form.sessionTitle,
          rawNotes: `${form.warmup}\n\n${form.mainWork}\n\n${form.cooldown}`,
          summary: form.goalUpdate,
          status: "completed",
          payload,
          estimatedCalories: 420,
          durationMinutes: 65,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result?.ok) {
        setSaveMessage(result?.message ?? "Unable to save session.");
        return;
      }
      setSaveMessage("Session saved successfully.");
    } catch (_error) {
      setSaveMessage("Unable to save session.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <TrainerShell title="New Session" subtitle="Capture workout details with mandatory sections.">
      <article className="card panel">
        <h2>Session details</h2>
        <div className="form-grid">
          <label className="field">
            <span>Client</span>
            <input type="text" value={form.clientName} onChange={(event) => setField("clientName", event.target.value)} />
          </label>
          <label className="field">
            <span>Date</span>
            <input type="date" value={form.sessionDate} onChange={(event) => setField("sessionDate", event.target.value)} />
          </label>
          <label className="field">
            <span>Session title</span>
            <input type="text" value={form.sessionTitle} onChange={(event) => setField("sessionTitle", event.target.value)} />
          </label>
        </div>
      </article>

      <article className="card panel">
        <h2>Mandatory note sections</h2>
        <div className="form-grid">
          <label className="field full">
            <span>Warm-up notes *</span>
            <textarea rows={3} value={form.warmup} onChange={(event) => setField("warmup", event.target.value)} />
          </label>
          <label className="field full">
            <span>Main work notes *</span>
            <textarea rows={4} value={form.mainWork} onChange={(event) => setField("mainWork", event.target.value)} />
          </label>
          <label className="field full">
            <span>Cool down and recovery *</span>
            <textarea rows={3} value={form.cooldown} onChange={(event) => setField("cooldown", event.target.value)} />
          </label>
          <label className="field full">
            <span>Goal progress update *</span>
            <textarea rows={3} value={form.goalUpdate} onChange={(event) => setField("goalUpdate", event.target.value)} />
          </label>
        </div>
      </article>

      <article className="card panel">
        <h2>Exercise metrics</h2>
        <div className="metric-card">
          <p className="item-title">Treadmill Walk (Warm-up)</p>
          <div className="form-grid">
            <label className="field">
              <span>Duration (min) *</span>
              <input type="number" value={form.duration} onChange={(event) => setField("duration", event.target.value)} />
            </label>
            <label className="field">
              <span>Incline (%) *</span>
              <input type="number" value={form.incline} onChange={(event) => setField("incline", event.target.value)} />
            </label>
            <label className="field">
              <span>Distance (km) *</span>
              <input type="number" step="0.01" value={form.distance} onChange={(event) => setField("distance", event.target.value)} />
            </label>
            <label className="field">
              <span>Custom metric: HR avg</span>
              <input type="number" value={form.customHr} onChange={(event) => setField("customHr", event.target.value)} />
            </label>
          </div>
        </div>
        {saveMessage ? <p className="item-sub">{saveMessage}</p> : null}
        <div className="quick-actions">
          <button className="ghost-button" type="button">Add exercise</button>
          <button className="mint-button" type="button" onClick={handleSaveSession} disabled={saving}>
            {saving ? "Saving..." : "Save session"}
          </button>
        </div>
      </article>
    </TrainerShell>
  );
}
