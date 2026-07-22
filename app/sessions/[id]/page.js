"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import TrainerShell from "app/_components/TrainerShell";
import { labelizeMetricKey } from "app/lib/metricLabels";
import { parseSessionPayload } from "app/lib/payloadMerge";

function normalizeCommentsPayload(data) {
  const raw = data?.comments ?? data?.data?.comments ?? [];
  return Array.isArray(raw) ? raw : [];
}

export default function Page() {
  const params = useParams();
  const sessionId = useMemo(() => String(params?.id ?? ""), [params]);
  const [session, setSession] = useState(null);
  const [sections, setSections] = useState({ warmup: "", mainWork: "", cooldown: "", goalUpdate: "" });
  const [exercises, setExercises] = useState([]);
  const [comments, setComments] = useState([]);
  const [rawNotes, setRawNotes] = useState("");
  const [newComment, setNewComment] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadSession() {
    if (!sessionId) return;
    setLoading(true);
    setMessage("");
    try {
      const [sessionRes, commentsRes] = await Promise.all([
        fetch(`/api/sessions/${sessionId}`),
        fetch(`/api/sessions/${sessionId}/comments`),
      ]);
      const sessionJson = await sessionRes.json();
      const commentsJson = await commentsRes.json();
      const record = sessionJson?.data?.session ?? sessionJson?.data ?? null;
      setSession(record);
      setRawNotes(record?.raw_notes ?? record?.rawNotes ?? "");
      const parsed = parseSessionPayload(record?.payload_json ?? record?.payloadJson);
      const sec = parsed.sections && typeof parsed.sections === "object" ? parsed.sections : {};
      setSections({
        warmup: typeof sec.warmup === "string" ? sec.warmup : "",
        mainWork: typeof sec.mainWork === "string" ? sec.mainWork : "",
        cooldown: typeof sec.cooldown === "string" ? sec.cooldown : "",
        goalUpdate: typeof sec.goalUpdate === "string" ? sec.goalUpdate : (record?.summary ?? ""),
      });
      setExercises(Array.isArray(parsed.exercises) ? parsed.exercises : []);
      setComments(normalizeCommentsPayload(commentsJson?.data ?? commentsJson));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

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

  const status = String(session?.status || "draft");
  const clientId = session?.client_id ? String(session.client_id) : "";
  const editHref = `/sessions/new?sessionId=${encodeURIComponent(sessionId)}${
    clientId ? `&clientId=${encodeURIComponent(clientId)}` : ""
  }`;

  return (
    <TrainerShell title="Session" subtitle={session?.client_name_snapshot || "Read-only record"}>
      <article className="card panel">
        <div className="quick-actions" style={{ marginBottom: 12 }}>
          <Link className="mint-button" href={editHref}>
            Edit in Log
          </Link>
          <Link className="ghost-button" href="/sessions">
            All sessions
          </Link>
        </div>
        {loading ? <p className="item-sub">Loading…</p> : null}
        <ul className="list">
          <li className="list-item">
            <span>Client</span>
            <span>{session?.client_name_snapshot ?? "—"}</span>
          </li>
          <li className="list-item">
            <span>Status</span>
            <span className="status-chip">{status}</span>
          </li>
          <li className="list-item">
            <span>Date</span>
            <span>{String(session?.session_date || "").slice(0, 10) || "—"}</span>
          </li>
          <li className="list-item">
            <span>Duration</span>
            <span>{session?.duration_minutes ?? "—"} min</span>
          </li>
        </ul>
      </article>

      <article className="card panel">
        <h2>Notes</h2>
        {[
          ["Warm-up", sections.warmup],
          ["Main work", sections.mainWork],
          ["Cool down", sections.cooldown],
          ["Goal update", sections.goalUpdate],
        ].map(([label, value]) => (
          <div key={label} style={{ marginBottom: 12 }}>
            <p className="item-title" style={{ marginBottom: 4 }}>{label}</p>
            <p className="item-sub" style={{ whiteSpace: "pre-wrap" }}>{value || "—"}</p>
          </div>
        ))}
        {rawNotes ? (
          <div style={{ marginTop: 8 }}>
            <p className="item-title" style={{ marginBottom: 4 }}>Raw notes</p>
            <p className="item-sub" style={{ whiteSpace: "pre-wrap" }}>{rawNotes}</p>
          </div>
        ) : null}
      </article>

      <article className="card panel">
        <h2>Exercises</h2>
        {exercises.length === 0 ? (
          <p className="item-sub">No structured exercises on this record.</p>
        ) : (
          <ul className="list">
            {exercises.map((ex, index) => {
              const metrics = ex.metrics && typeof ex.metrics === "object" ? ex.metrics : {};
              const metricLine = Object.entries(metrics)
                .filter(([, v]) => String(v ?? "").trim())
                .map(([k, v]) => `${labelizeMetricKey(k)}: ${v}`)
                .join(" · ");
              return (
                <li className="list-item" key={`${ex.exerciseId || ex.name}-${index}`}>
                  <div>
                    <p className="item-title">{ex.name || ex.exerciseId || `Exercise ${index + 1}`}</p>
                    <p className="item-sub">{metricLine || "No metrics logged"}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </article>

      <article className="card panel">
        <h2>Discussion</h2>
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
            <li className="list-item"><span>No comments yet.</span></li>
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
