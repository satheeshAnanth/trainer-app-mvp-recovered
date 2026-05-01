"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import TrainerShell from "app/_components/TrainerShell";
import { labelizeMetricKey } from "app/lib/metricLabels";
import { parseSessionPayload } from "app/lib/payloadMerge";

const EMPTY_SECTIONS = {
  warmup: "",
  mainWork: "",
  cooldown: "",
  goalUpdate: "",
};

function normalizeCommentsPayload(data) {
  const raw = data?.comments ?? data?.data?.comments ?? [];
  return Array.isArray(raw) ? raw : [];
}

export default function Page() {
  const params = useParams();
  const sessionId = useMemo(() => String(params?.id ?? ""), [params]);
  const [session, setSession] = useState(null);
  const [status, setStatus] = useState("draft");
  const [summary, setSummary] = useState("");
  const [rawNotes, setRawNotes] = useState("");
  const [sections, setSections] = useState(() => ({ ...EMPTY_SECTIONS }));
  const [exercises, setExercises] = useState([]);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState([]);

  function hydrateFromRecord(record) {
    if (!record) return;
    setStatus(record.status ?? "draft");
    setSummary(record.summary ?? "");
    setRawNotes(record.raw_notes ?? record.rawNotes ?? "");
    const parsed = parseSessionPayload(record.payload_json ?? record.payloadJson);
    const sec = parsed.sections && typeof parsed.sections === "object" ? parsed.sections : {};
    setSections({
      warmup: typeof sec.warmup === "string" ? sec.warmup : "",
      mainWork: typeof sec.mainWork === "string" ? sec.mainWork : "",
      cooldown: typeof sec.cooldown === "string" ? sec.cooldown : "",
      goalUpdate: typeof sec.goalUpdate === "string" ? sec.goalUpdate : (record.summary ?? ""),
    });
    setExercises(Array.isArray(parsed.exercises) ? parsed.exercises : []);
  }

  async function loadSession() {
    if (!sessionId) return;
    setMessage("");
    const [sessionRes, commentsRes] = await Promise.all([
      fetch(`/api/sessions/${sessionId}`),
      fetch(`/api/sessions/${sessionId}/comments`),
    ]);
    const sessionJson = await sessionRes.json();
    const commentsJson = await commentsRes.json();

    const record = sessionJson?.data?.session ?? sessionJson?.data ?? null;
    setSession(record);
    hydrateFromRecord(record);
    setComments(normalizeCommentsPayload(commentsJson?.data ?? commentsJson));
  }

  useEffect(() => {
    loadSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

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
        setSearchResults(result?.data?.exercises ?? []);
      } catch {
        setSearchResults([]);
      }
    }, 320);
    return () => clearTimeout(t);
  }, [searchQ]);

  function setSection(key, value) {
    setSections((prev) => ({ ...prev, [key]: value }));
  }

  function setExerciseMetric(exIndex, metricKey, value) {
    setExercises((prev) =>
      prev.map((ex, i) =>
        i === exIndex ? { ...ex, metrics: { ...(ex.metrics ?? {}), [metricKey]: value } } : ex
      )
    );
  }

  function addExerciseFromCatalog(row) {
    const keys = Array.isArray(row.requiredKeys) ? row.requiredKeys : [];
    if (keys.length === 0) {
      setMessage("This exercise has no required metrics in the catalog yet.");
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
    setMessage("");
  }

  function removeExerciseAt(index) {
    setExercises((prev) => prev.filter((_, i) => i !== index));
  }

  function buildPayload() {
    const sectionPayload = {
      warmup: sections.warmup,
      mainWork: sections.mainWork,
      cooldown: sections.cooldown,
      goalUpdate: sections.goalUpdate,
    };
    const notesJoined = [sections.warmup, sections.mainWork, sections.cooldown].filter(Boolean).join("\n\n");
    return {
      payload: {
        sections: sectionPayload,
        exercises,
      },
      rawNotes: notesJoined || rawNotes,
      summary: sections.goalUpdate || summary,
    };
  }

  async function handleSave(nextStatus) {
    if (!sessionId) return;
    setMessage("");
    setSaving(true);
    try {
      const built = buildPayload();
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: built.summary,
          rawNotes: built.rawNotes,
          status: nextStatus ?? status,
          payload: built.payload,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        setMessage(json?.message ?? "Unable to save session.");
        return;
      }
      setMessage("Session updated.");
      await loadSession();
    } finally {
      setSaving(false);
    }
  }

  async function handleQuickStatus(nextStatus) {
    if (!sessionId) return;
    setMessage("");
    if (nextStatus === "completed") {
      await handleSave("completed");
      return;
    }
    const res = await fetch(`/api/sessions/${sessionId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    const json = await res.json();
    if (!res.ok || !json?.ok) {
      setMessage(json?.message ?? "Unable to update status.");
      return;
    }
    setStatus(nextStatus);
    setMessage(`Status set to ${nextStatus}.`);
    await loadSession();
  }

  async function handleAddComment() {
    if (!sessionId || !newComment.trim()) return;
    setMessage("");
    const res = await fetch(`/api/sessions/${sessionId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: newComment.trim(),
        authorRole: "trainer",
        authorName: "Trainer",
      }),
    });
    const json = await res.json();
    if (!res.ok || !json?.ok) {
      setMessage(json?.message ?? "Unable to add comment.");
      return;
    }
    setNewComment("");
    setMessage("Comment added.");
    await loadSession();
  }

  const metricKeysForExercise = (ex) => {
    const req = Array.isArray(ex.metricRequired) ? ex.metricRequired : [];
    const fromMetrics = Object.keys(ex.metrics ?? {});
    return [...new Set([...req, ...fromMetrics])];
  };

  return (
    <TrainerShell title="Session Details" subtitle="Structured notes, catalog metrics, and discussion.">
      <article className="card panel">
        <h2>Session summary</h2>
        <ul className="list">
          <li className="list-item">
            <span>Session ID</span>
            <span>{sessionId || "-"}</span>
          </li>
          <li className="list-item">
            <span>Client</span>
            <span>{session?.client_name_snapshot ?? "Unknown"}</span>
          </li>
          <li className="list-item">
            <span>Status</span>
            <span className="status-chip">{status || "draft"}</span>
          </li>
          <li className="list-item">
            <span>Duration</span>
            <span>{session?.duration_minutes ?? "-"} min</span>
          </li>
          <li className="list-item">
            <span>Estimated calories</span>
            <span>{session?.estimated_calories ?? "-"} kcal</span>
          </li>
        </ul>
      </article>

      <article className="card panel">
        <h2>Mandatory note sections</h2>
        <p className="item-sub">These map to session payload sections and sync with raw notes on save.</p>
        <div className="form-grid">
          <label className="field full">
            <span>Warm-up *</span>
            <textarea rows={3} value={sections.warmup} onChange={(e) => setSection("warmup", e.target.value)} />
          </label>
          <label className="field full">
            <span>Main work *</span>
            <textarea rows={4} value={sections.mainWork} onChange={(e) => setSection("mainWork", e.target.value)} />
          </label>
          <label className="field full">
            <span>Cool down *</span>
            <textarea rows={3} value={sections.cooldown} onChange={(e) => setSection("cooldown", e.target.value)} />
          </label>
          <label className="field full">
            <span>Goal progress update *</span>
            <textarea rows={3} value={sections.goalUpdate} onChange={(e) => setSection("goalUpdate", e.target.value)} />
          </label>
        </div>
      </article>

      <article className="card panel">
        <h2>Exercise metrics</h2>
        <p className="item-sub">Search the catalog to add exercises. Fill metrics before marking complete.</p>
        <label className="field full">
          <span>Search exercises</span>
          <input
            type="search"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="Type at least two letters (e.g. squat, walk)"
          />
        </label>
        {searchResults.length > 0 ? (
          <ul className="list" style={{ marginTop: "0.75rem" }}>
            {searchResults.map((row) => (
              <li className="list-item" key={row.id}>
                <div>
                  <p className="item-title">{row.name}</p>
                  <p className="item-sub">{row.category ?? "Exercise"}</p>
                </div>
                <button type="button" className="ghost-button" onClick={() => addExerciseFromCatalog(row)}>
                  Add
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {exercises.length === 0 ? (
          <p className="item-sub" style={{ marginTop: "1rem" }}>
            No structured exercises yet. Add from the catalog or paste details in raw notes.
          </p>
        ) : (
          exercises.map((ex, exIndex) => (
            <div key={`${ex.exerciseId ?? ex.name}-${exIndex}`} className="metric-card" style={{ marginTop: "1rem" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "0.5rem",
                  alignItems: "flex-start",
                }}
              >
                <p className="item-title">{ex.name ?? ex.exerciseId ?? `Exercise ${exIndex + 1}`}</p>
                <button type="button" className="ghost-button" onClick={() => removeExerciseAt(exIndex)}>
                  Remove
                </button>
              </div>
              <div className="form-grid">
                {metricKeysForExercise(ex).map((mk) => (
                  <label key={mk} className="field">
                    <span>{labelizeMetricKey(mk)}</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={(ex.metrics ?? {})[mk] ?? ""}
                      onChange={(e) => setExerciseMetric(exIndex, mk, e.target.value)}
                    />
                  </label>
                ))}
              </div>
            </div>
          ))
        )}
      </article>

      <article className="card panel">
        <h2>Raw notes (combined)</h2>
        <label className="field full">
          <span>Full text (optional override)</span>
          <textarea rows={5} value={rawNotes} onChange={(e) => setRawNotes(e.target.value)} />
        </label>
      </article>

      <article className="card panel">
        <h2>Status and save</h2>
        <div className="form-grid">
          <label className="field">
            <span>Status</span>
            <input type="text" value={status} onChange={(e) => setStatus(e.target.value)} />
          </label>
        </div>
        <div className="quick-actions">
          <button className="mint-button" type="button" disabled={saving} onClick={() => handleSave(null)}>
            {saving ? "Saving…" : "Save changes"}
          </button>
          <button className="ghost-button" type="button" disabled={saving} onClick={() => handleQuickStatus("pending_notes")}>
            Mark pending notes
          </button>
          <button className="ghost-button" type="button" disabled={saving} onClick={() => handleQuickStatus("completed")}>
            Mark complete
          </button>
        </div>
        <p className="item-sub" style={{ marginTop: "0.75rem" }}>
          Mark complete runs a full save with validation (mandatory sections + exercises). Use when the session is ready to close.
        </p>
      </article>

      <article className="card panel">
        <h2>Discussion comments</h2>
        <div className="form-grid">
          <label className="field full">
            <span>Add comment</span>
            <textarea rows={3} value={newComment} onChange={(e) => setNewComment(e.target.value)} />
          </label>
        </div>
        <div className="quick-actions">
          <button className="mint-button" type="button" onClick={handleAddComment}>
            Add comment
          </button>
        </div>

        <ul className="list" style={{ marginTop: 12 }}>
          {comments.length === 0 ? (
            <li className="list-item">
              <span>No comments yet.</span>
            </li>
          ) : (
            comments.map((comment) => (
              <li className="list-item" key={comment.id}>
                <div>
                  <p className="item-title">{comment.author_name ?? comment.authorName ?? "Trainer"}</p>
                  <p className="item-sub">{comment.text}</p>
                </div>
              </li>
            ))
          )}
        </ul>

        {message ? <p className="item-sub">{message}</p> : null}
      </article>
    </TrainerShell>
  );
}
