"use client";

import AdminShell from "app/_components/AdminShell";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const STATUSES = [
  { id: "pending_review", label: "Pending" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
  { id: "all", label: "All" },
];

function ExerciseMediaConsole() {
  const [status, setStatus] = useState("pending_review");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    exerciseId: "",
    youtubeUrlOrId: "",
    title: "",
    channelName: "",
    autoApprove: false,
    isPrimary: true,
  });

  const pendingCount = useMemo(
    () => items.filter((item) => item.status === "pending_review").length,
    [items]
  );

  async function load(nextStatus = status) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/exercise-media?status=${encodeURIComponent(nextStatus)}&limit=100`, {
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.message ?? "Unable to load media.");
      setItems(Array.isArray(json?.data?.items) ? json.data.items : []);
      setMessage(json?.data?.note ?? "");
    } catch (e) {
      setError(e.message ?? "Failed to load.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load("pending_review");
  }, []);

  async function submitMedia(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/admin/exercise-media", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.message ?? "Submit failed.");
      setMessage(json?.data?.note ?? "Submitted.");
      setForm((prev) => ({ ...prev, exerciseId: "", youtubeUrlOrId: "", title: "", channelName: "" }));
      await load(status);
    } catch (err) {
      setError(err.message ?? "Submit failed.");
    }
  }

  async function review(id, action) {
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/admin/exercise-media/${encodeURIComponent(id)}/review`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, isPrimary: true }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.message ?? "Review failed.");
      setMessage(`${action === "approve" ? "Approved" : "Rejected"} ${id.slice(0, 8)}…`);
      await load(status);
    } catch (err) {
      setError(err.message ?? "Review failed.");
    }
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
        <Link href="/admin" style={{ color: "#64748b", fontSize: 12 }}>← Ops console</Link>
      </div>

      {error ? <p style={{ color: "#f87171", marginTop: 12, fontSize: 13 }}>{error}</p> : null}
      {message ? <p style={{ color: "#94a3b8", marginTop: 12, fontSize: 13 }}>{message}</p> : null}

      <section style={{ marginTop: 8 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {STATUSES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setStatus(item.id);
                load(item.id);
              }}
              style={{
                ...buttonStyle,
                background: status === item.id ? "#134e4a" : "#111827",
                color: status === item.id ? "#6ee7b7" : "#94a3b8",
              }}
            >
              {item.label}
            </button>
          ))}
          <span style={{ color: "#64748b", fontSize: 12 }}>
            {loading ? "Loading…" : `${pendingCount} pending in current list · ${items.length} shown`}
          </span>
        </div>
      </section>

      <section style={{ marginTop: 24, background: "#111827", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: 16 }}>
        <p style={{ color: "#64748b", fontSize: 11, marginBottom: 12 }}>SUBMIT MEDIA</p>
        <form onSubmit={submitMedia} style={{ display: "grid", gap: 10 }}>
          <input
            style={inputStyle}
            placeholder="Exercise ID (from master_exercises)"
            value={form.exerciseId}
            onChange={(e) => setForm((p) => ({ ...p, exerciseId: e.target.value }))}
            required
          />
          <input
            style={inputStyle}
            placeholder="YouTube URL or 11-char video ID"
            value={form.youtubeUrlOrId}
            onChange={(e) => setForm((p) => ({ ...p, youtubeUrlOrId: e.target.value }))}
            required
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <input
              style={inputStyle}
              placeholder="Title (optional)"
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            />
            <input
              style={inputStyle}
              placeholder="Channel name (optional)"
              value={form.channelName}
              onChange={(e) => setForm((p) => ({ ...p, channelName: e.target.value }))}
            />
          </div>
          <label style={{ color: "#94a3b8", fontSize: 12, display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={form.autoApprove}
              onChange={(e) => setForm((p) => ({ ...p, autoApprove: e.target.checked }))}
            />
            Auto-approve (skip pending gate)
          </label>
          <button type="submit" style={buttonStyle}>Submit for review</button>
        </form>
      </section>

      <section style={{ marginTop: 24 }}>
        <p style={{ color: "#64748b", fontSize: 11, marginBottom: 10 }}>QUEUE</p>
        <div style={{ display: "grid", gap: 10 }}>
          {items.length === 0 ? (
            <p style={{ color: "#64748b", fontSize: 13 }}>No media rows for this filter.</p>
          ) : null}
          {items.map((item) => (
            <article
              key={item.id}
              style={{ background: "#111827", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: 14 }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <p style={{ color: "#e2e8f0", margin: 0, fontSize: 14 }}>{item.exerciseName}</p>
                  <p style={{ color: "#64748b", margin: "4px 0 0", fontSize: 11 }}>
                    {item.category || "Uncategorized"}
                    {item.equipment ? ` · ${item.equipment}` : ""}
                    {" · "}
                    {item.status}
                    {item.isPrimary ? " · primary" : ""}
                    {item.media?.type ? ` · ${item.media.type}` : ""}
                  </p>
                  <p style={{ color: "#94a3b8", margin: "6px 0 0", fontSize: 12 }}>
                    {item.media?.title || "Untitled"}
                    {item.media?.channelName ? ` · ${item.media.channelName}` : ""}
                    {item.media?.youtubeVideoId ? ` · ${item.media.youtubeVideoId}` : ""}
                  </p>
                  <p style={{ color: "#475569", margin: "4px 0 0", fontSize: 11 }}>
                    exercise_id: {item.exerciseId}
                  </p>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
                  {item.media?.type === "youtube_video" && item.media.youtubeVideoId ? (
                    <a
                      href={`https://www.youtube.com/watch?v=${item.media.youtubeVideoId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ ...buttonStyle, textDecoration: "none" }}
                    >
                      Open YouTube
                    </a>
                  ) : null}
                  {item.media?.type === "image" && item.media.imageUrl ? (
                    <a
                      href={item.media.imageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ ...buttonStyle, textDecoration: "none" }}
                    >
                      Open GIF
                    </a>
                  ) : null}
                  {item.status !== "approved" ? (
                    <button type="button" style={{ ...buttonStyle, background: "#14532d", color: "#86efac" }} onClick={() => review(item.id, "approve")}>
                      Approve
                    </button>
                  ) : null}
                  {item.status !== "rejected" ? (
                    <button type="button" style={{ ...buttonStyle, background: "#7f1d1d", color: "#fecaca" }} onClick={() => review(item.id, "reject")}>
                      Reject
                    </button>
                  ) : null}
                </div>
              </div>
              {item.media?.type === "youtube_video" && item.media.youtubeVideoId ? (
                <div style={{ marginTop: 12, aspectRatio: "16 / 9", maxWidth: 420, borderRadius: 8, overflow: "hidden", border: "1px solid rgba(148,163,184,0.2)" }}>
                  <iframe
                    title={item.media.title || item.exerciseName}
                    src={`https://www.youtube-nocookie.com/embed/${item.media.youtubeVideoId}`}
                    style={{ width: "100%", height: "100%", border: 0 }}
                    allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : null}
              {item.media?.type === "image" && item.media.imageUrl ? (
                <div style={{ marginTop: 12, maxWidth: 280 }}>
                  <img
                    src={item.media.imageUrl}
                    alt={item.media.title || item.exerciseName}
                    style={{
                      width: "100%",
                      height: "auto",
                      borderRadius: 8,
                      border: "1px solid rgba(148,163,184,0.25)",
                      background: "#0b1220",
                      display: "block",
                    }}
                  />
                  {item.media.attribution ? (
                    <p style={{ color: "#64748b", margin: "6px 0 0", fontSize: 11 }}>{item.media.attribution}</p>
                  ) : null}
                </div>
              ) : null}
              {!item.media?.youtubeVideoId && !item.media?.imageUrl ? (
                <p style={{ color: "#f87171", margin: "10px 0 0", fontSize: 12 }}>
                  No playable media URL on this row.
                </p>
              ) : null}
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

const inputStyle = {
  width: "100%",
  background: "#0f172a",
  border: "1px solid #334155",
  borderRadius: 6,
  padding: "8px 12px",
  color: "#e2e8f0",
  fontFamily: "monospace",
  boxSizing: "border-box",
};

const buttonStyle = {
  background: "#134e4a",
  border: "none",
  borderRadius: 6,
  padding: "8px 14px",
  color: "#6ee7b7",
  fontFamily: "monospace",
  cursor: "pointer",
  fontSize: 12,
};

export default function AdminExerciseMediaPage() {
  return (
    <AdminShell title="CADENCE — EXERCISE MEDIA REVIEW">
      <ExerciseMediaConsole />
    </AdminShell>
  );
}
