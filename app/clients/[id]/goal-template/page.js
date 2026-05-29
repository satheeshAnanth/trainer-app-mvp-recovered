"use client";

import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import TrainerShell from "app/_components/TrainerShell";
import { buildExerciseWarnings, buildProfileSafetyPlan } from "app/lib/coachSafety";
import TipBanner from "app/_components/TipBanner";

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
  const [clientProfile, setClientProfile] = useState(null);
  const [exercises, setExercises] = useState([newExercise()]);
  const [searchModal, setSearchModal] = useState({ open: false, exIndex: -1, query: "" });
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState("");
  const [saveSuccessModalOpen, setSaveSuccessModalOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    (async () => {
      const [profileResponse, templateResponse] = await Promise.all([
        fetch(`/api/clients/${clientId}`),
        fetch(`/api/clients/${clientId}/goal-template`),
      ]);
      const profileJson = await profileResponse.json();
      const templateJson = await templateResponse.json();
      if (cancelled) return;
      const profile = profileJson?.data?.client ?? profileJson?.data?.profile ?? null;
      const template = templateJson?.data?.goalTemplate;
      setClientProfile(profile);
      setClientName(template?.name ?? profile?.name ?? "Client");
      setGoalName(template?.goalName ?? template?.goal ?? profile?.goal ?? "");
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

  const profileSafety = useMemo(
    () =>
      buildProfileSafetyPlan({
        goalText: goalName || clientProfile?.goal || "",
        priorCondition: clientProfile?.prior_condition ?? clientProfile?.priorCondition ?? "",
      }),
    [goalName, clientProfile]
  );

  const exerciseWarningsById = useMemo(
    () =>
      new Map(
        exercises.map((exercise) => [
          exercise.id,
          buildExerciseWarnings({
            exerciseName: exercise.exercise,
            goalText: goalName || clientProfile?.goal || "",
            priorCondition: clientProfile?.prior_condition ?? clientProfile?.priorCondition ?? "",
          }),
        ])
      ),
    [exercises, goalName, clientProfile]
  );

  function setExerciseField(index, key, value) {
    setExercises((prev) => prev.map((e, i) => (i === index ? { ...e, [key]: value } : e)));
  }

  function addExercise() {
    setExercises((prev) => [...prev, newExercise()]);
  }

  function removeExercise(index) {
    setExercises((prev) => prev.filter((_, i) => i !== index));
  }

  async function searchExercises(term) {
    const q = String(term ?? "").trim();
    if (q.length < 4) {
      setMessage("Type at least 4 characters, then tap o.");
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const response = await fetch(`/api/exercises/master/search?q=${encodeURIComponent(q)}&limit=200`);
      const json = await response.json();
      const results = Array.isArray(json?.data?.exercises) ? json.data.exercises : [];
      setSearchResults(uniqueExerciseResults(results).slice(0, 120));
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
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
      const payloadExercises = exercises
        .filter((exercise) => {
          const hasValue =
            String(exercise.masterExerciseId ?? "").trim() ||
            String(exercise.exercise ?? "").trim() ||
            String(exercise.variation ?? "").trim() ||
            String(exercise.target ?? "").trim() ||
            String(exercise.search ?? "").trim();
          return Boolean(hasValue);
        })
        .map((exercise) => ({
        id: exercise.id,
        masterExerciseId: exercise.masterExerciseId,
        exercise: exercise.exercise,
        variation: exercise.variation,
        target: exercise.target,
        frequency: exercise.frequency,
        priority: exercise.priority,
        }));
      if (payloadExercises.length === 0) {
        setMessage("Add at least one goal exercise before saving.");
        return;
      }
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
      setSaveSuccessModalOpen(true);
      try { localStorage.setItem("trainer-goal-template-saved", "1"); } catch { /* ignore */ }
    } catch {
      setMessage("Could not save goal template.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <TrainerShell title={clientName} subtitle="Client goal setup">
      <TipBanner
        storageKey="tip-goal-template-v1"
        title="What is a goal template?"
        steps={[
          "A goal template is the exercise plan you design for this client — the moves, targets, and frequencies.",
          "Every time you log a session for them, these exercises auto-load as mandatory items to review.",
          "Search an exercise by name, set a target (e.g. '3×8 at 60kg') and a frequency, then Save.",
          "You can update the template any time — changes apply from the next session onwards.",
        ]}
      />
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

        <div className="metric-card" style={{ marginTop: 12, borderLeft: "4px solid var(--mint)" }}>
          <div className="client-detail-head" style={{ marginBottom: 8 }}>
            <h2 style={{ margin: 0 }}>Suggested routine</h2>
            <span className="status-chip">Advisory only</span>
          </div>
          <p className="item-title" style={{ marginTop: 0 }}>{profileSafety.title}</p>
          <p className="item-sub" style={{ marginTop: 6 }}>{profileSafety.note}</p>
          {profileSafety.blocks.length > 0 ? (
            <ul className="list" style={{ marginTop: 10 }}>
              {profileSafety.blocks.map((block) => (
                <li key={`${block.title}-${block.text}`} className="list-item" style={{ alignItems: "flex-start" }}>
                  <div>
                    <p className="item-title">{block.title}</p>
                    <p className="item-sub" style={{ marginTop: 4 }}>{block.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          {exercises.map((exercise, exIndex) => (
            <div key={`ex-${exIndex}`} className="metric-card">
              <div className="form-grid">
                <label className="field full">
                  <span>Goal exercise {exIndex + 1} (master library)</span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      value={exercise.search}
                      onChange={(e) => setExerciseField(exIndex, "search", e.target.value)}
                      placeholder="Search exercise (e.g. Back Squat)"
                    />
                    <button
                      type="button"
                      className="ghost-button"
                      style={{ width: 36, minWidth: 36, padding: "8px 0", textAlign: "center" }}
                      onClick={() => {
                        setSearchResults([]);
                        setSearchModal({ open: true, exIndex, query: exercise.search });
                        searchExercises(exercise.search);
                      }}
                      title="Search"
                    >
                      o
                    </button>
                  </div>
                </label>
                {exercise.exercise ? <p className="item-sub" style={{ gridColumn: "1 / -1" }}>{exercise.exercise}</p> : null}
                {exercise.imageUrl ? (
                  <button
                    type="button"
                    className="ghost-button"
                    style={{ width: "fit-content" }}
                    onClick={() => setPreviewImageUrl(exercise.imageUrl)}
                    title="View exercise image"
                  >
                    View image
                  </button>
                ) : null}
                {((exerciseWarningsById.get(exercise.id) ?? [])).length > 0 ? (
                  <div className="metric-card" style={{ gridColumn: "1 / -1", borderLeft: "4px solid #f59e0b", marginTop: 4 }}>
                    <p className="item-title" style={{ marginTop: 0 }}>Potential contraindication</p>
                    <ul className="list" style={{ marginTop: 8 }}>
                      {(exerciseWarningsById.get(exercise.id) ?? []).map((warning) => (
                        <li key={`${exercise.id}-${warning.label}`} className="list-item" style={{ alignItems: "flex-start" }}>
                          <div>
                            <p className="item-title">{warning.label}</p>
                            <p className="item-sub" style={{ marginTop: 4 }}>{warning.message}</p>
                            <p className="item-sub" style={{ marginTop: 4, color: "#94a3b8" }}>
                              Alternatives: {warning.alternatives.join(", ")}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
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
            <div style={{ position: "relative", width: "100%", aspectRatio: "16 / 9", borderRadius: 12, overflow: "hidden", border: "1px solid rgba(148,163,184,0.25)" }}>
              <Image
                src={previewImageUrl}
                alt="Selected exercise preview"
                fill
                unoptimized
                sizes="100vw"
                style={{ objectFit: "contain", background: "rgba(15,23,42,0.12)" }}
              />
            </div>
          </div>
        ) : null}
        {searchModal.open ? (
          <div className="modal-backdrop">
            <div
              className="modal-card card"
              style={{ width: "100vw", maxWidth: "100vw", minHeight: "100vh", borderRadius: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2 style={{ margin: 0 }}>Search exercise</h2>
                <button className="ghost-button" type="button" onClick={() => setSearchModal({ open: false, exIndex: -1, query: "" })}>Close</button>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <input
                  value={searchModal.query}
                  onChange={(e) => setSearchModal((prev) => ({ ...prev, query: e.target.value }))}
                  placeholder="Type at least 4 characters"
                />
                <button
                  type="button"
                  className="ghost-button"
                  style={{ width: 36, minWidth: 36, padding: "8px 0", textAlign: "center" }}
                  onClick={() => searchExercises(searchModal.query)}
                >
                  Search
                </button>
              </div>
              <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                {searching ? <p className="item-sub">Searching...</p> : null}
                {!searching && searchResults.length === 0 && String(searchModal.query ?? "").trim().length >= 4 ? (
                  <p className="item-sub">No matches found. Try a different keyword.</p>
                ) : null}
                {searchResults.map((item) => (
                  <button
                    key={`search-modal-${item.id}`}
                    type="button"
                    className="ghost-button"
                    style={{ textAlign: "left" }}
                    onClick={() => {
                      chooseExercise(searchModal.exIndex, item);
                      setSearchModal({ open: false, exIndex: -1, query: "" });
                    }}
                  >
                    {item.displayName ?? normalizeExerciseDisplayName(item?.name)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}
        {saveSuccessModalOpen ? (
          <div className="modal-backdrop" onClick={() => setSaveSuccessModalOpen(false)}>
            <div className="modal-card card" onClick={(e) => e.stopPropagation()}>
              <div style={{ minHeight: "55vh", display: "grid", alignContent: "center", gap: 12, textAlign: "center" }}>
                <p className="eyebrow" style={{ margin: 0 }}>Saved</p>
                <h2 style={{ margin: 0 }}>Goal template saved successfully</h2>
                <p className="item-sub" style={{ margin: 0 }}>
                  This goal plan will now load into every new session for this client.
                </p>
                <button
                  type="button"
                  className="continue-btn"
                  style={{ marginTop: 8 }}
                  onClick={() => setSaveSuccessModalOpen(false)}
                >
                  Continue
                </button>
              </div>
            </div>
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
