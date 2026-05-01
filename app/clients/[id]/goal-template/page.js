"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import TrainerShell from "app/_components/TrainerShell";

function newExercise() {
  return {
    id: crypto.randomUUID(),
    masterExerciseId: "",
    exercise: "",
    variation: "",
    target: "",
    frequency: "every_session",
    priority: "mandatory",
    imageUrl: "",
    search: "",
    showResults: false,
  };
}

function normalizeExerciseDisplayName(rawName) {
  let name = String(rawName ?? "").trim();
  name = name.replace(/^[A-Z]{1,4}\d+\s*-\s*/i, "");
  name = name.replace(/\s+/g, " ").trim();
  name = name.replace(/\(([^)]+)\)\s*\(\1\)$/i, "($1)");
  return name;
}

function uniqueExerciseResults(items) {
  const seen = new Set();
  const unique = [];
  for (const item of items) {
    const displayName = normalizeExerciseDisplayName(item?.name);
    if (!displayName) continue;
    const key = displayName.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push({ ...item, displayName });
  }
  return unique;
}

export default function Page() {
  const params = useParams();
  const clientId = useMemo(() => String(params?.id ?? ""), [params]);
  const [clientName, setClientName] = useState("Client");
  const [goalName, setGoalName] = useState("");
  const [exercises, setExercises] = useState([newExercise()]);
  const [searchResults, setSearchResults] = useState({});
  const [previewImageUrl, setPreviewImageUrl] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    (async () => {
      const response = await fetch(`/api/clients/${clientId}/goal-template`);
      const json = await response.json();
      if (cancelled) return;
      const template = json?.data?.goalTemplate;
      setClientName(template?.name ?? "Client");
      setGoalName(template?.goalName ?? template?.goal ?? "");
      if (Array.isArray(template?.exercises) && template.exercises.length > 0) {
        setExercises(
          template.exercises.map((exercise) => ({
            id: String(exercise?.id ?? crypto.randomUUID()),
            masterExerciseId: String(exercise?.masterExerciseId ?? ""),
            exercise: String(exercise?.exercise ?? ""),
            variation: String(exercise?.variation ?? ""),
            target: String(exercise?.target ?? ""),
            frequency: String(exercise?.frequency ?? "every_session"),
            priority: String(exercise?.priority ?? "mandatory"),
            imageUrl: String(exercise?.imageUrl ?? ""),
            search: "",
            showResults: false,
          }))
        );
      }
    })().catch(() => null);
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  function setExerciseField(index, key, value) {
    setExercises((prev) => prev.map((e, i) => (i === index ? { ...e, [key]: value } : e)));
  }

  function addExercise() {
    setExercises((prev) => [...prev, newExercise()]);
  }

  function removeExercise(index) {
    setExercises((prev) => prev.filter((_, i) => i !== index));
  }

  async function searchExercises(index, term) {
    setExerciseField(index, "search", term);
    setExerciseField(index, "showResults", true);
    if (!term.trim()) {
      setSearchResults((prev) => ({ ...prev, [index]: [] }));
      return;
    }
    try {
      const response = await fetch(`/api/exercises/master/search?q=${encodeURIComponent(term.trim())}`);
      const json = await response.json();
      const results = Array.isArray(json?.data?.exercises) ? json.data.exercises : [];
      setSearchResults((prev) => ({ ...prev, [index]: uniqueExerciseResults(results).slice(0, 8) }));
    } catch {
      setSearchResults((prev) => ({ ...prev, [index]: [] }));
    }
  }

  function chooseExercise(index, item) {
    setExercises((prev) =>
      prev.map((ex, i) =>
        i === index
          ? {
              ...ex,
              masterExerciseId: String(item?.id ?? ""),
              exercise: normalizeExerciseDisplayName(item?.name),
              variation: ex.variation || "",
              imageUrl: String(item?.imageUrl ?? ""),
              search: normalizeExerciseDisplayName(item?.name),
              showResults: false,
            }
          : ex
      )
    );
  }

  async function saveTemplate() {
    setMessage("");
    setSaving(true);
    try {
      const payloadExercises = exercises.map((exercise) => ({
        id: exercise.id,
        masterExerciseId: exercise.masterExerciseId,
        exercise: exercise.exercise,
        variation: exercise.variation,
        target: exercise.target,
        frequency: exercise.frequency,
        priority: exercise.priority,
      }));
      const response = await fetch(`/api/clients/${clientId}/goal-template`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goalName: goalName.trim(),
          exercises: payloadExercises.map((item) => ({
            ...item,
            imageUrl: exercises.find((x) => x.id === item.id)?.imageUrl ?? "",
          })),
        }),
      });
      const json = await response.json();
      if (!response.ok || !json?.ok) {
        setMessage(json?.message ?? "Could not save goal template.");
        return;
      }
      setMessage("Goal template saved.");
    } catch {
      setMessage("Could not save goal template.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <TrainerShell title={clientName} subtitle="Client goal setup">
      <article className="card panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p className="eyebrow" style={{ marginTop: 0 }}>Client goal setup</p>
            <h2 style={{ margin: "6px 0 0" }}>{clientName}</h2>
          </div>
          <Link href={`/clients/${clientId}`} className="ghost-button">Back</Link>
        </div>
        <p className="item-sub">This template becomes the mandatory goal progress card for every session.</p>
        <div className="form-grid" style={{ marginTop: 12 }}>
          <label className="field full">
            <span>Goal template name</span>
            <input
              value={goalName}
              onChange={(e) => setGoalName(e.target.value)}
              placeholder="e.g. Fat Loss + Lower Body Strength"
            />
          </label>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          {exercises.map((exercise, exIndex) => (
            <div key={`ex-${exIndex}`} className="metric-card">
              <div className="form-grid">
                <label className="field full">
                  <span>Goal exercise {exIndex + 1} (master library)</span>
                  <input
                    value={exercise.search}
                    onChange={(e) => searchExercises(exIndex, e.target.value)}
                    placeholder="Search exercise (e.g. Back Squat)"
                  />
                </label>
                {exercise.showResults && Array.isArray(searchResults[exIndex]) && searchResults[exIndex].length > 0 ? (
                  <div className="field full">
                    <div style={{ display: "grid", gap: 6 }}>
                      {searchResults[exIndex].map((item) => (
                        <button
                          key={`${exIndex}-${item.id}`}
                          type="button"
                          className="ghost-button"
                          onClick={() => chooseExercise(exIndex, item)}
                          style={{ textAlign: "left" }}
                        >
                          {item.displayName ?? normalizeExerciseDisplayName(item?.name)}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                <label className="field full">
                  <span>Selected mapped exercise</span>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input value={exercise.exercise} disabled placeholder="Select from search results" />
                    {exercise.imageUrl ? (
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => setPreviewImageUrl(exercise.imageUrl)}
                        title="View exercise image"
                      >
                        View image
                      </button>
                    ) : null}
                  </div>
                </label>
                <label className="field">
                  <span>Variation (optional)</span>
                  <input
                    value={exercise.variation}
                    onChange={(e) => setExerciseField(exIndex, "variation", e.target.value)}
                    placeholder="e.g. High bar"
                  />
                </label>
                <label className="field">
                  <span>Target progression</span>
                  <input
                    value={exercise.target}
                    onChange={(e) => setExerciseField(exIndex, "target", e.target.value)}
                    placeholder="e.g. 3x10 progressive load"
                  />
                </label>
                <label className="field">
                  <span>Target frequency</span>
                  <select value={exercise.frequency} onChange={(e) => setExerciseField(exIndex, "frequency", e.target.value)}>
                    <option value="every_session">Every session</option>
                    <option value="3x_week">3x per week</option>
                    <option value="2x_week">2x per week</option>
                    <option value="1x_week">1x per week</option>
                  </select>
                </label>
                <label className="field">
                  <span>Priority</span>
                  <select value={exercise.priority} onChange={(e) => setExerciseField(exIndex, "priority", e.target.value)}>
                    <option value="mandatory">Mandatory</option>
                    <option value="optional">Optional</option>
                  </select>
                </label>

              </div>
              <div className="quick-actions" style={{ marginTop: 8 }}>
                <button className="ghost-button" type="button" onClick={() => removeExercise(exIndex)}>
                  X
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="quick-actions" style={{ marginTop: 8 }}>
          <button className="ghost-button" type="button" onClick={addExercise}>+ Add goal exercise</button>
        </div>

        <p className="item-sub">Goal exercises capture mapped movement, target progression, frequency, and priority.</p>
        {previewImageUrl ? (
          <div className="metric-card" style={{ marginTop: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <p className="item-title" style={{ margin: 0 }}>Exercise preview</p>
              <button type="button" className="ghost-button" onClick={() => setPreviewImageUrl("")}>Close</button>
            </div>
            <img
              src={previewImageUrl}
              alt="Selected exercise preview"
              style={{ width: "100%", borderRadius: 12, border: "1px solid rgba(148,163,184,0.25)" }}
            />
          </div>
        ) : null}
        {message ? <p className="item-sub" style={{ color: message.includes("saved") ? "#34d399" : "#fca5a5" }}>{message}</p> : null}
        <button className="continue-btn" type="button" onClick={saveTemplate} disabled={saving}>
          {saving ? "Saving..." : "Save Goal Template"}
        </button>
      </article>
    </TrainerShell>
  );
}
