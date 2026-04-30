"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import TrainerShell from "app/_components/TrainerShell";

export default function Page() {
  const params = useParams();
  const sessionId = useMemo(() => String(params?.id ?? ""), [params]);
  const [session, setSession] = useState(null);
  const [status, setStatus] = useState("draft");
  const [summary, setSummary] = useState("");
  const [rawNotes, setRawNotes] = useState("");
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [message, setMessage] = useState("");

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
    setStatus(record?.status ?? "draft");
    setSummary(record?.summary ?? "");
    setRawNotes(record?.raw_notes ?? record?.rawNotes ?? "");

    const commentItems = commentsJson?.data?.comments ?? commentsJson?.data?.comments ?? [];
    setComments(commentItems);
  }

  useEffect(() => {
    loadSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  async function handleSave() {
    if (!sessionId) return;
    setMessage("");
    const res = await fetch(`/api/sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        summary,
        rawNotes,
        status,
      }),
    });
    const json = await res.json();
    if (!res.ok || !json?.ok) {
      setMessage(json?.message ?? "Unable to save session.");
      return;
    }
    setMessage("Session updated.");
    await loadSession();
  }

  async function handleStatus(nextStatus) {
    if (!sessionId) return;
    setMessage("");
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

  return (
    <TrainerShell title="Session Details" subtitle="Review captured notes, metrics, and sharing state.">
      <article className="card panel">
        <h2>Session summary</h2>
        <ul className="list">
          <li className="list-item"><span>Session ID</span><span>{sessionId || "-"}</span></li>
          <li className="list-item"><span>Client</span><span>{session?.client_name_snapshot ?? "Unknown"}</span></li>
          <li className="list-item"><span>Status</span><span className="status-chip">{status || "draft"}</span></li>
          <li className="list-item"><span>Duration</span><span>{session?.duration_minutes ?? "-"} min</span></li>
          <li className="list-item"><span>Estimated calories</span><span>{session?.estimated_calories ?? "-"} kcal</span></li>
        </ul>
      </article>

      <article className="card panel">
        <h2>Edit notes and summary</h2>
        <div className="form-grid">
          <label className="field full">
            <span>Raw notes</span>
            <textarea rows={6} value={rawNotes} onChange={(event) => setRawNotes(event.target.value)} />
          </label>
          <label className="field full">
            <span>Summary / goal update</span>
            <textarea rows={4} value={summary} onChange={(event) => setSummary(event.target.value)} />
          </label>
          <label className="field">
            <span>Status</span>
            <input type="text" value={status} onChange={(event) => setStatus(event.target.value)} />
          </label>
        </div>
        <div className="quick-actions">
          <button className="mint-button" type="button" onClick={handleSave}>Save changes</button>
          <button className="ghost-button" type="button" onClick={() => handleStatus("completed")}>Mark complete</button>
          <button className="ghost-button" type="button" onClick={() => handleStatus("pending_notes")}>Mark pending notes</button>
        </div>
      </article>

      <article className="card panel">
        <h2>Discussion comments</h2>
        <div className="form-grid">
          <label className="field full">
            <span>Add comment</span>
            <textarea rows={3} value={newComment} onChange={(event) => setNewComment(event.target.value)} />
          </label>
        </div>
        <div className="quick-actions">
          <button className="mint-button" type="button" onClick={handleAddComment}>Add comment</button>
        </div>

        <ul className="list" style={{ marginTop: 12 }}>
          {comments.length === 0 ? (
            <li className="list-item"><span>No comments yet.</span></li>
          ) : (
            comments.map((comment) => (
              <li className="list-item" key={comment.id}>
                <div>
                  <p className="item-title">{comment.author_name ?? "Trainer"}</p>
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
