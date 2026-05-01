"use client";

import { useEffect, useState } from "react";
import TrainerShell from "app/_components/TrainerShell";

function labelizeMetricKey(key) {
  return String(key)
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

export default function Page() {
  const [clients, setClients] = useState([]);
  const [clientId, setClientId] = useState("");
  const [form, setForm] = useState({
    sessionDate: "",
    sessionTitle: "Strength + conditioning",
    warmup: "",
    mainWork: "",
    cooldown: "",
    goalUpdate: "",
  });
  const [exercises, setExercises] = useState([]);
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/clients");
        const result = await response.json();
        const list = result?.data?.clients ?? [];
        if (cancelled) return;
        setClients(list);
        if (list[0]?.id) {
          setClientId(list[0].id);
        }
      } catch {
        if (!cancelled) setClients([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const q = searchQ.trim();
    if (q.length < 2) {
      setSearchResults([]);
      return undefined;
    }
    const t = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/exercises/master/search?q=${encodeURIComponent(q)}&withKeys=1`
        );
        const result = await response.json();
        const rows = result?.data?.exercises ?? [];
        setSearchResults(rows);
      } catch {
        setSearchResults([]);
      }
    }, 320);
    return () => clearTimeout(t);
  }, [searchQ]);

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function addExercise(row) {
    const requiredKeys = row.requiredKeys ?? [];
    const keys = Array.isArray(requiredKeys) ? requiredKeys : [];
    if (keys.length === 0) {
      setSaveMessage("This exercise has no required metrics in the catalog yet; choose another.");
      return;
    }
    const metrics = Object.fromEntries(keys.map((k) => [k, ""]));
    setExercises((prev) => [
      ...prev,
      {
        exerciseId: row.id,
        name: row.name,
        metricRequired: keys,
        metrics,
      },
    ]);
    setSearchQ("");
    setSearchResults([]);
  }

  function removeExercise(index) {
    setExercises((prev) => prev.filter((_, i) => i !== index));
  }

  function setExerciseMetric(index, metricKey, value) {
    setExercises((prev) =>
      prev.map((ex, i) =>
        i === index ? { ...ex, metrics: { ...ex.metrics, [metricKey]: value } } : ex
      )
    );
  }

  function parseMetrics(metrics) {
    const out = {};
    for (const [k, v] of Object.entries(metrics ?? {})) {
      if (v === "" || v === null || v === undefined) {
        out[k] = v;
        continue;
      }
      const n = Number(v);
      out[k] = Number.isFinite(n) && String(v).trim() !== "" ? n : v;
    }
    return out;
  }

  async function submitSession(status) {
    setSaveMessage("");
    const client = clients.find((c) => c.id === clientId);
    if (!clientId || !client) {
      setSaveMessage("Select a client.");
      return;
    }
    if (!form.sessionTitle?.trim()) {
      setSaveMessage("Session title is required.");
      return;
    }

    if (status !== "draft") {
      if (!form.warmup?.trim() || !form.mainWork?.trim() || !form.cooldown?.trim() || !form.goalUpdate?.trim()) {
        setSaveMessage("Please complete all mandatory note sections before completing.");
        return;
      }
      if (exercises.length === 0) {
        setSaveMessage("Add at least one exercise before completing the session.");
        return;
      }
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
        exercises: exercises.map((ex) => ({
          exerciseId: ex.exerciseId,
          name: ex.name,
          metricRequired: ex.metricRequired,
          metrics: parseMetrics(ex.metrics),
        })),
      };

      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          clientName: client?.name ?? "Client",
          sessionDate: form.sessionDate || null,
          sessionTitle: form.sessionTitle.trim(),
          rawNotes: [form.warmup, form.mainWork, form.cooldown].filter(Boolean).join("\n\n"),
          summary: form.goalUpdate,
          status,
          payload,
          estimatedCalories: null,
          durationMinutes: null,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result?.ok) {
        setSaveMessage(result?.message ?? "Unable to save session.");
        return;
      }
      setSaveMessage(status === "draft" ? "Draft saved." : "Session completed and saved.");
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
            <select value={clientId} onChange={(event) => setClientId(event.target.value)}>
              <option value="">Select client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Date</span>
            <input type="date" value={form.sessionDate} onChange={(event) => setField("sessionDate", event.target.value)} />
          </label>
          <label className="field">
            <span>Session title</span>
            <input
              type="text"
              value={form.sessionTitle}
              onChange={(event) => setField("sessionTitle", event.target.value)}
            />
          </label>
        </div>
      </article>

      <article className="card panel">
        <h2>Mandatory note sections</h2>
        <p className="item-sub">Required when you complete a session (drafts can stay empty).</p>
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
        <h2>Exercises from catalog</h2>
        <p className="item-sub">Search the master library (type at least two letters). Metrics come from each exercise&apos;s required fields.</p>
        <label className="field full">
          <span>Search exercises</span>
          <input
            type="search"
            value={searchQ}
            onChange={(event) => setSearchQ(event.target.value)}
            placeholder="e.g. treadmill, squat, plank"
          />
        </label>
        {searchResults.length > 0 ? (
          <ul className="list" style={{ marginTop: "0.75rem" }}>
            {searchResults.map((row) => (
              <li key={row.id} className="list-item">
                <div>
                  <p className="item-title">{row.name}</p>
                  <p className="item-sub">
                    {row.category ?? "Exercise"}
                    {row.requiredKeys?.length ? ` · ${row.requiredKeys.length} required metrics` : ""}
                  </p>
                </div>
                <button type="button" className="ghost-button" onClick={() => addExercise(row)}>
                  Add
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {exercises.length === 0 ? (
          <p className="item-sub" style={{ marginTop: "1rem" }}>
            No exercises added yet. Completed sessions require at least one.
          </p>
        ) : (
          exercises.map((ex, index) => (
            <div key={`${ex.exerciseId}-${index}`} className="metric-card" style={{ marginTop: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", alignItems: "flex-start" }}>
                <p className="item-title">{ex.name}</p>
                <button type="button" className="ghost-button" onClick={() => removeExercise(index)}>
                  Remove
                </button>
              </div>
              <div className="form-grid">
                {ex.metricRequired.map((mk) => (
                  <label key={mk} className="field">
                    <span>{labelizeMetricKey(mk)} *</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={ex.metrics[mk] ?? ""}
                      onChange={(event) => setExerciseMetric(index, mk, event.target.value)}
                    />
                  </label>
                ))}
              </div>
            </div>
          ))
        )}

        {saveMessage ? <p className="item-sub" style={{ marginTop: "1rem" }}>{saveMessage}</p> : null}
        <div className="quick-actions" style={{ marginTop: "1rem" }}>
          <button className="ghost-button" type="button" disabled={saving} onClick={() => submitSession("draft")}>
            Save draft
          </button>
          <button className="mint-button" type="button" disabled={saving} onClick={() => submitSession("completed")}>
            {saving ? "Saving..." : "Complete session"}
          </button>
        </div>
      </article>
    </TrainerShell>
  );
}
