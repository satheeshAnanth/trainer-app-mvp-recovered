"use client";

import { useEffect, useMemo, useState } from "react";
import ClientShell from "app/_components/ClientShell";
import ExercisePicker from "app/_components/ExercisePicker";
import { ExerciseMediaSheet } from "app/_components/ExerciseMediaSheet";
import { useToast } from "app/_components/ToastProvider";

const DEFAULT_EXERCISES = [
  { name: "Warm-up & mobility", target: "8–10 min", actual: "", notes: "", effort: "", completionStatus: "planned" },
  { name: "Main strength block", target: "3 x 8 reps", actual: "", notes: "", effort: "", completionStatus: "planned" },
  { name: "Cool-down / recovery", target: "5 min breathing", actual: "", notes: "", effort: "", completionStatus: "planned" },
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function makeExerciseRow(seed = {}, index = 0) {
  return {
    id: seed.id ?? `exercise-${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`,
    masterExerciseId: String(seed.masterExerciseId ?? seed.exerciseId ?? ""),
    name: String(seed.name ?? seed.exercise ?? `Exercise ${index + 1}`),
    target: String(seed.target ?? ""),
    actual: String(seed.actual ?? seed.done ?? ""),
    notes: String(seed.notes ?? seed.variation ?? ""),
    effort: String(seed.effort ?? ""),
    completionStatus: String(seed.completionStatus ?? "planned"),
    skipReason: String(seed.skipReason ?? ""),
    source: String(seed.source ?? "client_log"),
  };
}

function templateToExercises(template) {
  const source = Array.isArray(template?.exercises) && template.exercises.length > 0
    ? template.exercises
    : Array.isArray(template?.sessionFields)
      ? template.sessionFields
      : [];

  if (source.length === 0) {
    return DEFAULT_EXERCISES.map((row, index) => makeExerciseRow(row, index));
  }

  return source.map((item, index) =>
    makeExerciseRow(
      {
        name: item?.exercise ?? item?.label ?? item?.name ?? item?.key ?? `Exercise ${index + 1}`,
        target: item?.target ?? item?.description ?? item?.goal ?? "",
        actual: item?.actual ?? "",
        notes: item?.variation ?? item?.notes ?? "",
        effort: item?.effort ?? "",
        completionStatus: item?.completionStatus ?? "planned",
        source: "goal",
      },
      index
    )
  );
}

function combineDetails(form, exercises) {
  const lines = [];
  if (form.workoutSummary.trim()) lines.push(form.workoutSummary.trim());
  if (form.wins.trim()) lines.push(`What went well: ${form.wins.trim()}`);
  if (form.challenges.trim()) lines.push(`What felt hard: ${form.challenges.trim()}`);
  if (form.discomfort.trim()) lines.push(`Pain / discomfort: ${form.discomfort.trim()}`);
  if (exercises.length > 0) {
    lines.push(`Exercises logged: ${exercises.length}`);
  }
  return lines.join(" • ");
}

export default function Page() {
  const [client, setClient] = useState(null);
  const [goalTemplateName, setGoalTemplateName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchModal, setSearchModal] = useState({ open: false, exerciseId: null, query: "" });
  const [mediaPreviewExercise, setMediaPreviewExercise] = useState(null);
  const { showToast } = useToast();

  const [form, setForm] = useState(() => ({
    workoutTitle: "Strength check-in",
    sessionDate: todayISO(),
    durationMinutes: "45",
    workoutSummary: "",
    wins: "",
    challenges: "",
    discomfort: "",
    exercises: DEFAULT_EXERCISES.map((row, index) => makeExerciseRow(row, index)),
  }));

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const authRes = await fetch("/api/client-auth/session");
        const authJson = authRes.ok ? await authRes.json() : null;
        const user = authJson?.data?.user ?? null;
        if (!cancelled) {
          setClient(user);
        }

        if (user?.clientId) {
          const profileFetch = await fetch("/api/client/profile");
          const profileJson = profileFetch.ok ? await profileFetch.json() : null;
          const profile = profileJson?.data?.profile ?? profileJson?.data ?? null;
          const goalName = String(profile?.goal ?? profile?.goalName ?? "").trim();
          if (!cancelled && goalName) {
            setGoalTemplateName(goalName);
            setForm((prev) => ({
              ...prev,
              workoutTitle: prev.workoutTitle === "Strength check-in" ? goalName : prev.workoutTitle,
            }));
          }

          const templateRes = await fetch(`/api/clients/${user.clientId}/goal-template`);
          const templateJson = templateRes.ok ? await templateRes.json() : null;
          const template = templateJson?.data?.goalTemplate ?? templateJson?.data ?? null;
          const templateName = String(template?.goalName ?? template?.goal ?? goalName ?? "").trim();
          const seededExercises = templateToExercises(template);

          if (!cancelled) {
            if (templateName) {
              setGoalTemplateName(templateName);
              setForm((prev) => ({
                ...prev,
                workoutTitle: prev.workoutTitle === "Strength check-in" || prev.workoutTitle === goalName ? templateName : prev.workoutTitle,
                exercises: prev.exercises.length === DEFAULT_EXERCISES.length ? seededExercises : prev.exercises,
              }));
            } else if (seededExercises.length > 0) {
              setForm((prev) => ({
                ...prev,
                exercises: prev.exercises.length === DEFAULT_EXERCISES.length ? seededExercises : prev.exercises,
              }));
            }
          }
        }
      } catch {
        if (!cancelled) {
          setClient(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const preview = useMemo(() => {
    const cleanExercises = form.exercises.filter((exercise) => {
      return Boolean(
        String(exercise.name).trim() ||
          String(exercise.actual).trim() ||
          String(exercise.notes).trim() ||
          String(exercise.target).trim()
      );
    });

    return {
      exerciseCount: cleanExercises.length,
      exerciseNames: cleanExercises.slice(0, 3).map((exercise) => String(exercise.name).trim()).filter(Boolean),
      details: combineDetails(form, cleanExercises),
    };
  }, [form]);

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateExercise(id, key, value) {
    setForm((prev) => ({
      ...prev,
      exercises: prev.exercises.map((exercise) => {
        if (exercise.id !== id) return exercise;
        const next = { ...exercise, [key]: value };
        if (key === "completionStatus" && value !== "skipped") {
          next.skipReason = "";
        }
        return next;
      }),
    }));
  }

  function addExercise() {
    setForm((prev) => ({
      ...prev,
      exercises: [...prev.exercises, makeExerciseRow({}, prev.exercises.length)],
    }));
  }

  function removeExercise(id) {
    setForm((prev) => ({
      ...prev,
      exercises: prev.exercises.length <= 1 ? prev.exercises : prev.exercises.filter((exercise) => exercise.id !== id),
    }));
  }

  function openCatalogSearch(exerciseRowId) {
    const row = form.exercises.find((exercise) => exercise.id === exerciseRowId);
    setSearchModal({
      open: true,
      exerciseId: exerciseRowId,
      query: String(row?.name ?? "").trim(),
    });
  }

  function applyCatalogExercise(catalogExercise) {
    if (!searchModal.exerciseId || !catalogExercise) return;
    setForm((prev) => ({
      ...prev,
      exercises: prev.exercises.map((exercise) =>
        exercise.id === searchModal.exerciseId
          ? {
              ...exercise,
              masterExerciseId: catalogExercise.id,
              name: catalogExercise.name,
              source: "catalog",
            }
          : exercise
      ),
    }));
    setSearchModal({ open: false, exerciseId: null, query: "" });
    showToast(`Selected ${catalogExercise.name}.`);
  }

  async function handleSubmit() {
    if (!client?.clientId) {
      showToast("Client session missing. Please sign in again.", { variant: "error" });
      return;
    }

    if (!form.workoutTitle.trim() || !form.sessionDate) {
      showToast("Please enter a workout title and date.", { variant: "error" });
      return;
    }

    const skippedMissingReason = form.exercises.filter((exercise) => {
      const status = String(exercise.completionStatus ?? "").toLowerCase();
      return status === "skipped" && !String(exercise.skipReason ?? "").trim();
    });
    if (skippedMissingReason.length > 0) {
      showToast("Add a skip reason for every skipped exercise.", { variant: "error" });
      return;
    }

    const exercises = form.exercises
      .map((exercise) => ({
        id: exercise.id,
        masterExerciseId: String(exercise.masterExerciseId ?? "").trim() || null,
        name: String(exercise.name ?? "").trim(),
        target: String(exercise.target ?? "").trim(),
        actual: String(exercise.actual ?? "").trim(),
        notes: String(exercise.notes ?? "").trim(),
        effort: String(exercise.effort ?? "").trim(),
        completionStatus: String(exercise.completionStatus ?? "planned").trim() || "planned",
        skipReason:
          String(exercise.completionStatus ?? "").toLowerCase() === "skipped"
            ? String(exercise.skipReason ?? "").trim()
            : "",
        source: String(exercise.source ?? "client_log").trim() || "client_log",
      }))
      .filter((exercise) => exercise.name || exercise.actual || exercise.notes || exercise.target);

    setSaving(true);
    try {
      const payload = {
        source: "client_self_log",
        workoutTitle: form.workoutTitle.trim(),
        sessionDate: form.sessionDate,
        durationMinutes: Number(form.durationMinutes || 0) || null,
        workoutSummary: form.workoutSummary.trim(),
        wins: form.wins.trim(),
        challenges: form.challenges.trim(),
        discomfort: form.discomfort.trim(),
        goalTemplateName,
        exercises,
      };

      const response = await fetch("/api/client/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: client.clientId,
          clientName: client.name ?? client.clientName ?? "Client",
          sessionDate: form.sessionDate,
          sessionTitle: form.workoutTitle.trim(),
          details: preview.details,
          discomfort: form.discomfort.trim(),
          durationMinutes: Number(form.durationMinutes || 0) || null,
          payload,
        }),
      });

      const json = await response.json();
      if (!response.ok || !json?.ok) {
        showToast(json?.message ?? "Unable to submit self log.", { variant: "error" });
        return;
      }

      showToast("Submitted for trainer review.");
    } catch {
      showToast("Unable to submit self log.", { variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <ClientShell title="Self Log" subtitle="Capture your workout in a structured way your coach can review.">
      <section className="session-goal-sticky" style={{ marginBottom: 12 }}>
        <p className="item-title" style={{ marginBottom: 4 }}>
          {goalTemplateName || (loading ? "Loading your setup…" : "Solo workout")}
        </p>
        <p className="item-sub" style={{ marginBottom: 0 }}>
          {goalTemplateName
            ? "Goal exercises are seeded below. Mark skipped ones with a reason so your coach sees why."
            : "Log what you did so your coach can review it."}
        </p>
      </section>

      <article className="card panel">
        <h2>Session details</h2>
        <div className="form-grid">
          <label className="field">
            <span>Workout title *</span>
            <input type="text" value={form.workoutTitle} onChange={(event) => setField("workoutTitle", event.target.value)} />
          </label>
          <label className="field">
            <span>Session date *</span>
            <input type="date" value={form.sessionDate} onChange={(event) => setField("sessionDate", event.target.value)} />
          </label>
          <label className="field">
            <span>Duration (min)</span>
            <input
              type="number"
              min="0"
              value={form.durationMinutes}
              onChange={(event) => setField("durationMinutes", event.target.value)}
            />
          </label>
          <label className="field full">
            <span>Workout summary</span>
            <textarea
              rows={4}
              value={form.workoutSummary}
              onChange={(event) => setField("workoutSummary", event.target.value)}
              placeholder="Short summary of the session and any notable changes"
            />
          </label>
        </div>
      </article>

      <article className="card panel">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <h2 style={{ marginBottom: 4 }}>Exercise blocks</h2>
            <p className="item-sub" style={{ marginBottom: 0 }}>
              {preview.exerciseCount > 0
                ? `${preview.exerciseCount} exercise block${preview.exerciseCount === 1 ? "" : "s"} ready for trainer review.`
                : "Add at least one exercise block before submitting."}
            </p>
          </div>
          <button className="ghost-button ghost-button-sm" type="button" onClick={addExercise}>
            Add exercise
          </button>
        </div>

        <div style={{ display: "grid", gap: 14, marginTop: 16 }}>
          {form.exercises.map((exercise, index) => (
            <section key={exercise.id} className="card" style={{ padding: 14, borderColor: "rgba(148, 163, 184, 0.18)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 12 }}>
                <div>
                  <p className="item-title" style={{ marginBottom: 4 }}>
                    Exercise {index + 1}
                    {exercise.source === "goal" ? (
                      <span className="status-chip" style={{ marginLeft: 8, color: "#2dd4bf" }}>Goal</span>
                    ) : null}
                  </p>
                  <p className="item-sub" style={{ marginBottom: 0 }}>
                    Keep it short and clear for your coach.
                  </p>
                </div>
                {form.exercises.length > 1 ? (
                  <button className="ghost-button ghost-button-sm" type="button" onClick={() => removeExercise(exercise.id)}>
                    Remove
                  </button>
                ) : null}
              </div>

              <div className="form-grid">
                <label className="field">
                  <span>Name</span>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <input
                      type="text"
                      style={{ flex: 1, minWidth: 160 }}
                      value={exercise.name}
                      onChange={(event) => updateExercise(exercise.id, "name", event.target.value)}
                    />
                    <button className="ghost-button-sm" type="button" onClick={() => openCatalogSearch(exercise.id)}>
                      Search catalog
                    </button>
                    {exercise.masterExerciseId ? (
                      <button
                        className="ghost-button-sm"
                        type="button"
                        onClick={() => setMediaPreviewExercise({ id: exercise.masterExerciseId, name: exercise.name })}
                      >
                        Example
                      </button>
                    ) : null}
                  </div>
                  {exercise.masterExerciseId ? (
                    <span className="item-sub" style={{ marginTop: 6, display: "block" }}>Linked to master catalog</span>
                  ) : null}
                </label>
                <label className="field">
                  <span>Target</span>
                  <input type="text" value={exercise.target} onChange={(event) => updateExercise(exercise.id, "target", event.target.value)} />
                </label>
                <label className="field">
                  <span>Actual</span>
                  <input type="text" value={exercise.actual} onChange={(event) => updateExercise(exercise.id, "actual", event.target.value)} />
                </label>
                <label className="field">
                  <span>Effort</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={exercise.effort}
                    onChange={(event) => updateExercise(exercise.id, "effort", event.target.value)}
                    placeholder="1-10"
                  />
                </label>
                <label className="field">
                  <span>Status</span>
                  <select value={exercise.completionStatus} onChange={(event) => updateExercise(exercise.id, "completionStatus", event.target.value)}>
                    <option value="planned">Planned</option>
                    <option value="completed">Completed</option>
                    <option value="partial">Partial</option>
                    <option value="skipped">Skipped</option>
                  </select>
                </label>
                {String(exercise.completionStatus).toLowerCase() === "skipped" ? (
                  <label className="field full">
                    <span>Skip reason *</span>
                    <input
                      type="text"
                      value={exercise.skipReason}
                      onChange={(event) => updateExercise(exercise.id, "skipReason", event.target.value)}
                      placeholder="e.g. Knee discomfort, ran out of time"
                    />
                  </label>
                ) : null}
                <label className="field full">
                  <span>Notes</span>
                  <textarea rows={3} value={exercise.notes} onChange={(event) => updateExercise(exercise.id, "notes", event.target.value)} />
                </label>
              </div>
            </section>
          ))}
        </div>
      </article>

      <ExercisePicker
        open={searchModal.open}
        mode="single"
        title="Choose exercise"
        initialQuery={searchModal.query}
        confirmLabel="Use this exercise"
        onClose={() => setSearchModal({ open: false, exerciseId: null, query: "" })}
        onSelect={applyCatalogExercise}
      />

      {mediaPreviewExercise ? (
        <ExerciseMediaSheet exercise={mediaPreviewExercise} onClose={() => setMediaPreviewExercise(null)} />
      ) : null}

      <article className="card panel">
        <h2>Reflection</h2>
        <div className="form-grid">
          <label className="field full">
            <span>What went well</span>
            <textarea
              rows={3}
              value={form.wins}
              onChange={(event) => setField("wins", event.target.value)}
              placeholder="What felt strong or improved today?"
            />
          </label>
          <label className="field full">
            <span>What felt hard</span>
            <textarea
              rows={3}
              value={form.challenges}
              onChange={(event) => setField("challenges", event.target.value)}
              placeholder="Any blockers, fatigue, or difficult movements?"
            />
          </label>
          <label className="field full">
            <span>Pain / discomfort</span>
            <textarea
              rows={3}
              value={form.discomfort}
              onChange={(event) => setField("discomfort", event.target.value)}
              placeholder="Note pain, soreness, or anything worth flagging"
            />
          </label>
        </div>
      </article>

      <article className="card panel">
        <h2>Submit</h2>
        <p className="item-sub">
          {form.workoutTitle || "Workout"} · {form.sessionDate || "date TBD"} · {preview.exerciseCount} exercise
          {preview.exerciseCount === 1 ? "" : "s"}
        </p>
        <div className="quick-actions" style={{ marginTop: 14 }}>
          <button className="mint-button" type="button" onClick={handleSubmit} disabled={saving || loading}>
            {saving ? "Submitting..." : "Submit for trainer review"}
          </button>
        </div>
      </article>
    </ClientShell>
  );
}
