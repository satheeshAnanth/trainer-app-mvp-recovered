"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import ClientShell from "app/_components/ClientShell";

function statusColor(status) {
  if (status === "completed") return "#34d399";
  if (status === "pending_notes") return "#facc15";
  if (status === "draft") return "#94a3b8";
  return "#94a3b8";
}

export default function Page() {
  const { id } = useParams();
  const [session, setSession] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");

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

  async function sendComment() {
    if (!newComment.trim()) return;
    setSending(true);
    setMessage("");
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
    } catch (e) {
      setMessage(e.message ?? "Unable to send.");
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
          <Link className="ghost-button" href="/my-portal" style={{ marginTop: 12, display: "inline-block" }}>← Back</Link>
        </article>
      </ClientShell>
    );
  }

  const payload = (() => {
    try {
      return typeof session.payload_json === "string" ? JSON.parse(session.payload_json) : (session.payload_json ?? {});
    } catch { return {}; }
  })();
  const exercises = Array.isArray(payload.exercises) ? payload.exercises : [];
  const assessment = payload.assessment ?? null;
  const sessionDate = session.session_date
    ? new Date(session.session_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "Date unknown";

  return (
    <ClientShell title={session.session_title || "Session"} subtitle={sessionDate}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <Link className="ghost-button ghost-button-sm" href="/my-portal">← Back</Link>
        <span className="status-chip" style={{ color: statusColor(session.status) }}>
          {String(session.status ?? "draft").replace(/_/g, " ")}
        </span>
      </div>

      {exercises.length > 0 ? (
        <article className="card panel">
          <h2>Exercises</h2>
          <ul className="list">
            {exercises.map((ex, i) => {
              const sets = ex.metrics?.setsData ?? [];
              return (
                <li key={`${ex.name}-${i}`} className="list-item" style={{ alignItems: "flex-start", padding: "10px 0" }}>
                  <div style={{ flex: 1 }}>
                    <p className="item-title">{ex.name || "Exercise"}</p>
                    {ex.completionStatus ? (
                      <p className="item-sub" style={{ marginTop: 4 }}>
                        Status: {ex.completionStatus}
                        {ex.skipReason ? ` · Reason: ${ex.skipReason}` : ""}
                      </p>
                    ) : null}
                    {sets.length > 0 ? (
                      <p className="item-sub" style={{ marginTop: 4 }}>
                        {sets.length} set{sets.length !== 1 ? "s" : ""}
                        {sets[0] ? " · " + Object.entries(sets[0]).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(", ") : ""}
                      </p>
                    ) : null}
                    {ex.note ? <p className="item-sub" style={{ marginTop: 4, color: "#cbd5e1" }}>{ex.note}</p> : null}
                  </div>
                  <span className="status-chip" style={{ color: ex.completionStatus === "completed" ? "#34d399" : ex.completionStatus === "skipped" ? "#f87171" : "#94a3b8" }}>
                    {ex.completionStatus || "logged"}
                  </span>
                </li>
              );
            })}
          </ul>
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
                {assessment.wentWell.map((w, i) => <li key={i} className="list-item"><span>{w}</span></li>)}
              </ul>
            </>
          ) : null}
          {(assessment.improve ?? []).length > 0 ? (
            <>
              <p className="item-sub" style={{ marginTop: 10, marginBottom: 6 }}>Next session focus</p>
              <ul className="list">
                {assessment.improve.map((w, i) => <li key={i} className="list-item"><span>{w}</span></li>)}
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
                  <p className="item-title">{c.author_name ?? c.authorName ?? "User"} · {c.author_role ?? c.authorRole ?? ""}</p>
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
        {message ? <p className="item-sub" style={{ color: "#fca5a5", marginTop: 8 }}>{message}</p> : null}
      </article>
    </ClientShell>
  );
}
