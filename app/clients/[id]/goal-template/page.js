"use client";

import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import TrainerShell from "app/_components/TrainerShell";
import { buildExerciseWarnings, buildProfileSafetyPlan } from "app/lib/coachSafety";
import TipBanner from "app/_components/TipBanner";
import ExercisePicker from "app/_components/ExercisePicker";
import CollapsibleSection from "app/_components/CollapsibleSection";
import { useModalDismiss } from "app/_components/useModalDismiss";

function newExercise(partial = {}) {
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
    ...partial,
  };
}

function normalizeExerciseDisplayName(rawName) {
  let name = String(rawName ?? "").trim();
  name = name.replace(/^[A-Z]{1,4}\d+\s*-\s*/i, "");
  name = name.replace(/\s+/g, " ").trim();
  name = name.replace(/\(([^)]+)\)\s*\(\1\)$/i, "($1)");
  return name;
}

function mapPickerItem(item, defaults = {}) {
  const primary = item?.media?.gifMedia ?? item?.media?.primaryMedia;
  const mediaImage = primary?.type === "image" ? primary.imageUrl : "";
  return newExercise({
    masterExerciseId: String(item?.id ?? item?.masterExerciseId ?? ""),
    exercise: normalizeExerciseDisplayName(item?.name ?? item?.exercise),
    variation: defaults.variation || "",
    target: defaults.target || item?.target || "",
    frequency: defaults.frequency || item?.frequency || "every_session",
    priority: defaults.priority || item?.priority || "mandatory",
    imageUrl: String(mediaImage || item?.imageUrl || ""),
    search: normalizeExerciseDisplayName(item?.name ?? item?.exercise),
  });
}

export default function Page() {
  const params = useParams();
  const clientId = useMemo(() => String(params?.id ?? ""), [params]);
  const [clientName, setClientName] = useState("Client");
  const [goalName, setGoalName] = useState("");
  const [clientProfile, setClientProfile] = useState(null);
  const [exercises, setExercises] = useState([]);
  const [pickerMode, setPickerMode] = useState(null);
  const [previewImageUrl, setPreviewImageUrl] = useState("");
  const [saveSuccessModalOpen, setSaveSuccessModalOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [questionnaire, setQuestionnaire] = useState({
    outcome: "strength",
    successTarget: "",
    sessionsPerWeek: "3",
    constraints: "",
  });

  const closeSaveSuccessModal = useCallback(() => setSaveSuccessModalOpen(false), []);
  useModalDismiss(saveSuccessModalOpen, closeSaveSuccessModal);
  useModalDismiss(suggestOpen, () => setSuggestOpen(false));

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
      setQuestionnaire((prev) => ({
        ...prev,
        constraints: String(profile?.prior_condition ?? profile?.priorCondition ?? ""),
        successTarget: String(template?.goalName ?? template?.goal ?? profile?.goal ?? ""),
      }));
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

  function removeExercise(index) {
    setExercises((prev) => prev.filter((_, i) => i !== index));
  }

  function chooseExercise(index, item) {
    setExercises((prev) =>
      prev.map((ex, i) => (i === index ? { ...mapPickerItem(item, { variation: ex.variation, target: ex.target, frequency: ex.frequency, priority: ex.priority }), id: ex.id } : ex))
    );
  }

  function addExercisesFromPicker(items) {
    if (!Array.isArray(items) || items.length === 0) return;
    setExercises((prev) => {
      const existingIds = new Set(prev.map((item) => String(item.masterExerciseId || "")).filter(Boolean));
      const mapped = items
        .filter((item) => item?.id && !existingIds.has(String(item.id)))
        .map((item) => mapPickerItem(item));
      return [...prev, ...mapped];
    });
  }

  async function runSuggest() {
    setSuggesting(true);
    setMessage("");
    try {
      const response = await fetch(`/api/clients/${clientId}/goal-template/suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...questionnaire,
          goalName: goalName || questionnaire.successTarget,
        }),
      });
      const json = await response.json();
      if (!response.ok || !json?.ok) throw new Error(json?.message ?? "Could not draft a template.");
      if (json?.data?.goalName) setGoalName(json.data.goalName);
      const proposed = Array.isArray(json?.data?.exercises) ? json.data.exercises : [];
      setExercises(proposed.map((item) => mapPickerItem(item, item)));
      setSuggestOpen(false);
      setMessage(`Draft ready (${json?.data?.model || "rule-based"}). Review targets, then Save.`);
    } catch (error) {
      setMessage(error?.message ?? "Could not draft a template.");
    } finally {
      setSuggesting(false);
    }
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

  const alreadySelectedIds = exercises.map((item) => item.masterExerciseId).filter(Boolean);
  const changeIndex = typeof pickerMode === "number" ? pickerMode : -1;

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
        <div className="quick-actions" style={{ marginTop: 10 }}>
          <button className="ghost-button" type="button" onClick={() => setSuggestOpen(true)}>
            Draft with 4 questions
          </button>
        </div>
      </article>

      <CollapsibleSection
        title="Suggested routine"
        subtitle="Advisory guidance from goal + prior conditions"
        badge="Guidance only"
        defaultOpen={false}
      >
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
        ) : (
          <p className="item-sub">No routine blocks for the current profile inputs.</p>
        )}
      </CollapsibleSection>

      <article className="card panel">
        <div className="client-detail-head" style={{ marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>Goal exercises</h2>
          <span className="status-chip">{exercises.length}</span>
        </div>
        <p className="item-sub">Add from the library, then set targets one exercise at a time.</p>

        <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
          {exercises.length === 0 ? (
            <p className="item-sub">No exercises yet. Add from the library or draft with questions.</p>
          ) : null}
          {exercises.map((exercise, exIndex) => (
            <div key={exercise.id} className="metric-card">
              <div className="form-grid">
                <label className="field full">
                  <span>Goal exercise {exIndex + 1}</span>
                  <button
                    type="button"
                    className={exercise.exercise ? "ghost-button" : "mint-button"}
                    style={{ width: "100%", textAlign: "left" }}
                    onClick={() => setPickerMode(exIndex)}
                  >
                    {exercise.exercise ? `Change: ${exercise.exercise}` : "Choose exercise"}
                  </button>
                </label>
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
                    <p className="item-title" style={{ marginTop: 0 }}>Potential contraindication (guidance only)</p>
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
                  Remove from plan
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="quick-actions" style={{ marginTop: 12 }}>
          <button className="mint-button" type="button" onClick={() => setPickerMode("multi")}>
            + Add from library
          </button>
        </div>

        <p className="item-sub" style={{ marginTop: 10 }}>
          Goal exercises capture mapped movement, target progression, frequency, and priority.
        </p>
        {message ? <p className="item-sub" style={{ marginTop: 8 }}>{message}</p> : null}
        <button className="continue-btn" type="button" style={{ marginTop: 12 }} onClick={saveTemplate} disabled={saving}>
          {saving ? "Saving…" : "Save goal template"}
        </button>
      </article>

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

      <ExercisePicker
        open={pickerMode === "multi"}
        mode="multi"
        title="Choose goal exercises"
        confirmLabel="Add to plan"
        alreadySelectedIds={alreadySelectedIds}
        onClose={() => setPickerMode(null)}
        onConfirm={(items) => {
          addExercisesFromPicker(items);
          setPickerMode(null);
        }}
      />
      <ExercisePicker
        open={changeIndex >= 0}
        mode="single"
        title="Change goal exercise"
        initialQuery={changeIndex >= 0 ? exercises[changeIndex]?.exercise || "" : ""}
        confirmLabel="Use this exercise"
        onClose={() => setPickerMode(null)}
        onSelect={(item) => {
          chooseExercise(changeIndex, item);
          setPickerMode(null);
        }}
      />

      {suggestOpen ? (
        <div className="modal-backdrop" onClick={() => setSuggestOpen(false)}>
          <div className="modal-card card" onClick={(e) => e.stopPropagation()}>
            <p className="eyebrow" style={{ margin: 0 }}>Quick draft</p>
            <h2 style={{ margin: "6px 0 0" }}>Four questions</h2>
            <p className="item-sub">Proposes library-mapped exercises. You review and edit before saving.</p>
            <div className="form-grid" style={{ marginTop: 12 }}>
              <label className="field full">
                <span>1. Primary outcome</span>
                <select
                  value={questionnaire.outcome}
                  onChange={(e) => setQuestionnaire((prev) => ({ ...prev, outcome: e.target.value }))}
                >
                  <option value="strength">Strength</option>
                  <option value="fat_loss">Fat loss</option>
                  <option value="mobility">Mobility</option>
                  <option value="sport">Sport performance</option>
                  <option value="rehab">Rehab / return to training</option>
                  <option value="general">General fitness</option>
                </select>
              </label>
              <label className="field full">
                <span>2. Success target + timeframe</span>
                <input
                  value={questionnaire.successTarget}
                  onChange={(e) => setQuestionnaire((prev) => ({ ...prev, successTarget: e.target.value }))}
                  placeholder="e.g. 10 push-ups in 12 weeks"
                />
              </label>
              <label className="field full">
                <span>3. Sessions per week</span>
                <select
                  value={questionnaire.sessionsPerWeek}
                  onChange={(e) => setQuestionnaire((prev) => ({ ...prev, sessionsPerWeek: e.target.value }))}
                >
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4+</option>
                </select>
              </label>
              <label className="field full">
                <span>4. Experience, equipment, limitations</span>
                <textarea
                  rows={3}
                  value={questionnaire.constraints}
                  onChange={(e) => setQuestionnaire((prev) => ({ ...prev, constraints: e.target.value }))}
                  placeholder="Beginner · dumbbells + bands · lower-back caution"
                />
              </label>
            </div>
            <div className="quick-actions" style={{ marginTop: 12 }}>
              <button className="ghost-button" type="button" onClick={() => setSuggestOpen(false)}>Cancel</button>
              <button className="mint-button" type="button" onClick={runSuggest} disabled={suggesting}>
                {suggesting ? "Drafting…" : "Propose template"}
              </button>
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
                These exercises will load into the next session for this client.
              </p>
              <div className="quick-actions" style={{ justifyContent: "center" }}>
                <Link href={`/clients/${clientId}`} className="mint-button">Back to client</Link>
                <button className="ghost-button" type="button" onClick={() => setSaveSuccessModalOpen(false)}>Keep editing</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </TrainerShell>
  );
}
