"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import TrainerShell from "app/_components/TrainerShell";

const STATUS_COLORS = {
  draft: "#94a3b8",
  pending_notes: "#facc15",
  completed: "#34d399",
  client_submitted: "#60a5fa",
  shared: "#a78bfa",
};

function statusLabel(s) {
  return String(s ?? "draft").replace(/_/g, " ");
}

function statusColor(s) {
  return STATUS_COLORS[String(s ?? "").toLowerCase()] ?? "#94a3b8";
}

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function NeedsWorkBanner() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    fetch("/api/sessions")
      .then((r) => r.json())
      .then((json) => {
        const sessions = json?.data?.sessions ?? [];
        setCount(sessions.filter((item) => ["draft", "pending_notes", "client_submitted"].includes(item.status)).length);
      })
      .catch(() => setCount(0));
  }, []);
  if (!count) return null;
  return (
    <div className="needs-work-banner">
      <div>
        <p className="item-title" style={{ margin: 0 }}>Needs Work</p>
        <p className="item-sub" style={{ margin: "4px 0 0" }}>
          {count} draft{count === 1 ? "" : "s"} / pending item{count === 1 ? "" : "s"} across clients
        </p>
      </div>
      <Link href="/sessions/needs-work" className="mint-button">Open queue</Link>
    </div>
  );
}

export default function Page() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    setLoading(true);
    const url = debouncedQuery
      ? `/api/sessions?q=${encodeURIComponent(debouncedQuery)}`
      : "/api/sessions";
    fetch(url)
      .then((r) => r.json())
      .then((json) => setSessions(json?.data?.sessions ?? []))
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, [debouncedQuery]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const s of sessions) {
      const month = s.session_date ? String(s.session_date).slice(0, 7) : "No date";
      if (!map.has(month)) map.set(month, []);
      map.get(month).push(s);
    }
    return [...map.entries()].sort((a, b) => (b[0] < a[0] ? -1 : 1));
  }, [sessions]);

  return (
    <TrainerShell title="Sessions" subtitle="All logged sessions — search by title, client, or notes.">
      <NeedsWorkBanner />
      <article className="card panel">
        <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search sessions…"
              style={{ width: "100%" }}
            />
          </div>
          <div className="quick-actions">
            <Link href="/sessions/new" className="mint-button mint-button-sm">+ New session</Link>
          </div>
        </div>
        {query && !loading ? (
          <p className="item-sub" style={{ marginTop: 8 }}>
            {sessions.length === 0 ? "No sessions match." : `${sessions.length} result${sessions.length !== 1 ? "s" : ""}`}
          </p>
        ) : null}
      </article>

      {loading ? (
        <article className="card panel"><p className="item-sub">Loading sessions…</p></article>
      ) : sessions.length === 0 && !query ? (
        <article className="card panel">
          <p className="item-sub">No sessions yet.</p>
          <Link href="/sessions/new" className="mint-button mint-button-sm" style={{ marginTop: 10, display: "inline-block" }}>Log first session</Link>
        </article>
      ) : query && sessions.length === 0 ? (
        <article className="card panel">
          <p className="item-sub">Nothing matched &ldquo;{query}&rdquo;. Try a client name or title fragment.</p>
        </article>
      ) : (
        grouped.map(([month, list]) => (
          <article key={month} className="card panel">
            <h2 style={{ marginBottom: 10, fontSize: "0.9rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8" }}>
              {month === "No date" ? "Undated" : new Date(month + "-01").toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
            </h2>
            <div className="list">
              {list.map((s) => (
                <Link
                  key={s.id}
                  href={`/sessions/${s.id}`}
                  className="list-item"
                  style={{ textDecoration: "none", display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "10px 0" }}
                >
                  <div>
                    <p className="item-title">{s.session_title || "Untitled session"}</p>
                    <p className="item-sub">
                      {s.client_name_snapshot || "Client"} · {formatDate(s.session_date)}
                      {s.duration_minutes ? ` · ${s.duration_minutes} min` : ""}
                    </p>
                  </div>
                  <span className="status-chip" style={{ color: statusColor(s.status), borderColor: `${statusColor(s.status)}44` }}>
                    {statusLabel(s.status)}
                  </span>
                </Link>
              ))}
            </div>
          </article>
        ))
      )}
    </TrainerShell>
  );
}
