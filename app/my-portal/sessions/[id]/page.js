"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import ClientShell from "app/_components/ClientShell";
import { useToast } from "app/_components/ToastProvider";
import {
  describeExerciseDone,
  friendlyExerciseStatus,
  friendlySessionStatus,
  isGoalExercise,
} from "app/lib/clientSessionLabels";

function ExerciseRow({ exercise }) {
  const status = friendlyExerciseStatus(exercise.completionStatus);
  const done = describeExerciseDone(exercise);
  const target = String(exercise.target ?? "").trim();
  const skipReason = String(exercise.skipReason ?? "").trim();
  const note = String(exercise.note ?? exercise.notes ?? "").trim();

  return (
    <li className="list-item" style={{ alignItems: "flex-start", padding: "10px 0" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p className="item-title">{exercise.name || "Exercise"}</p>
        <p className="item-sub" style={{ marginTop: 4 }}>
          Target: {target || "—"}
          {done ? ` · Done: ${done}` : ""}
        </p>
        {skipReason ? (
          <p className="item-sub" style={{ marginTop: 4, color: "#fecaca" }}>
            Skip reason: {skipReason}
          </p>
        ) : null}
        {note ? <p className="item-sub" style={{ marginTop: 4, color: "#cbd5e1" }}>{note}</p> : null}
      </div>
      <span className="status-chip" style={{ color: status.color }}>
        {status.label}
      </span>
    </li>
  );
}

export default function Page() {
  const { id } = useParams();
  const { showToast } = useToast();
  const [session, setSession] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetch(`/api/sessions/${id}`).then((r) => r.json()),
      fetch(`/api/sessions/${id}/comments`).then((r) => r.json()),
    ])
      .then(([sessJson, commJson]) => {
        setSession(sessJson?.data?.session ?? sessJson?.data ?? null);
        const raw = commJson?.data?.comments ?? commJson?.data ?? [];
        setComments(Array.isArray(raw) ? raw : []);
      })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [id]);

  const payload = useMemo(() => {
    if (!session) return {};
    try {
      return typeof session.payload_json === "string"
        ? JSON.parse(session.payload_json)
        : (session.payload_json ?? session.payload ?? {});
    } catch {
      return {};
    }
  }, [session]);

  const exercises = useMemo(
    () => (Array.isArray(payload.exercises) ? payload.exercises : []),
    [payload]
  );
  const goalExercises = useMemo(() => exercises.filter(isGoalExercise), [exercises]);
  const otherExercises = useMemo(() => exercises.filter((ex) => !isGoalExercise(ex)), [exercises]);
  const goalName = String(payload.goalTemplateName ?? payload.goalName ?? "").trim();
  const assessment = payload.assessment ?? null;
  const sessionStatus = friendlySessionStatus(session?.status);

  const sessionDate = session?.session_date
    ? new Date(session.session_date).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Date unknown";

  async function sendComment() {
    if (!newComment.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/sessions/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: newComment.trim(), authorRole: "client", authorName: "Client" }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.message ?? "Unable to send.");
      setNewComment("");
      const updated = await fetch(`/api/sessions/${id}/comments`).then((r) => r.json());
      const raw = updated?.data?.comments ?? updated?.data ?? [];
      setComments(Array.isArray(raw) ? raw : []);
      showToast("Message sent.");
    } catch (e) {
      showToast(e.message ?? "Unable to send.", { variant: "error" });
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <ClientShell title="Session" subtitle="">
        <article className="card panel"><p className="item-sub">Loading session…</p></article>
      </ClientShell>
    );
  }

  if (!session) {
    return (
      <ClientShell title="Session" subtitle="">
        <article className="card panel">
          <p className="item-sub">Session not found.</p>
          <Link className="ghost-button" href="/my-portal" style={{ marginTop: 12, display: "inline-block" }}>
            ← Back
          </Link>
        </article>
      </ClientShell>
    );
  }

  return (
    <ClientShell title={session.session_title || "Session"} subtitle={sessionDate}>
      {(goalName || goalExercises.length > 0) ? (
        <div className="session-goal-sticky">
          <p className="item-title" style={{ marginBottom: 4 }}>
            {goalName || "Your goal work"}
          </p>
          <p className="item-sub">
            {goalExercises.length
              ? `${goalExercises.length} goal exercise${goalExercises.length === 1 ? "" : "s"} in this session`
              : "Goal context from your coach"}
            {" · "}
            <span style={{ color: sessionStatus.color }}>{sessionStatus.label}</span>
          </p>
        </div>
      ) : null}

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
        <Link className="ghost-button ghost-button-sm" href="/my-portal">← Home</Link>
        <Link className="ghost-button ghost-button-sm" href="/my-portal/progress">Progress</Link>
        <span className="status-chip" style={{ color: sessionStatus.color }}>
          {sessionStatus.label}
        </span>
      </div>

      {goalExercises.length > 0 ? (
        <article className="card panel">
          <h2>Goal exercises</h2>
          <p className="item-sub" style={{ marginBottom: 8 }}>
            What your coach planned for this session.
          </p>
          <ul className="list">
            {goalExercises.map((ex, i) => (
              <ExerciseRow key={`goal-${ex.name}-${i}`} exercise={ex} />
            ))}
          </ul>
        </article>
      ) : null}

      {otherExercises.length > 0 ? (
        <article className="card panel">
          <h2>{goalExercises.length ? "Additional work" : "Exercises"}</h2>
          <ul className="list">
            {otherExercises.map((ex, i) => (
              <ExerciseRow key={`other-${ex.name}-${i}`} exercise={ex} />
            ))}
          </ul>
        </article>
      ) : null}

      {exercises.length === 0 ? (
        <article className="card panel">
          <h2>Exercises</h2>
          <p className="item-sub">No structured exercises on this session yet.</p>
        </article>
      ) : null}

      {assessment ? (
        <article className="card panel">
          <h2>Session assessment</h2>
          <p className="item-title">Quality score: {assessment.score}/5</p>
          {(assessment.wentWell ?? []).length > 0 ? (
            <>
              <p className="item-sub" style={{ marginTop: 10, marginBottom: 6 }}>What went well</p>
              <ul className="list">
                {assessment.wentWell.map((w, i) => (
                  <li key={i} className="list-item"><span>{w}</span></li>
                ))}
              </ul>
            </>
          ) : null}
          {(assessment.improve ?? []).length > 0 ? (
            <>
              <p className="item-sub" style={{ marginTop: 10, marginBottom: 6 }}>Next session focus</p>
              <ul className="list">
                {assessment.improve.map((w, i) => (
                  <li key={i} className="list-item"><span>{w}</span></li>
                ))}
              </ul>
            </>
          ) : null}
        </article>
      ) : null}

      {session.raw_notes ? (
        <article className="card panel">
          <h2>Trainer notes</h2>
          <p className="item-sub" style={{ whiteSpace: "pre-wrap" }}>{session.raw_notes}</p>
        </article>
      ) : null}

      <article className="card panel">
        <h2>Discussion</h2>
        {comments.length === 0 ? (
          <p className="item-sub">No messages yet.</p>
        ) : (
          <ul className="list" style={{ marginBottom: 12 }}>
            {comments.map((c) => (
              <li key={c.id} className="list-item" style={{ alignItems: "flex-start" }}>
                <div>
                  <p className="item-title">
                    {c.author_name ?? c.authorName ?? "User"} · {c.author_role ?? c.authorRole ?? ""}
                  </p>
                  <p className="item-sub">{c.text}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <input
            style={{ flex: 1 }}
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Reply to your trainer…"
          />
          <button className="mint-button" type="button" onClick={sendComment} disabled={sending || !newComment.trim()}>
            {sending ? "…" : "Send"}
          </button>
        </div>
      </article>
    </ClientShell>
  );
}
