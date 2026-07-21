"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import TrainerShell from "app/_components/TrainerShell";
import CollapsibleSection from "app/_components/CollapsibleSection";

function labelForStatus(status) {
  return String(status || "draft").replace(/_/g, " ");
}

function exerciseSummary(session) {
  const payload = session?.payload_json;
  const parsed = typeof payload === "string"
    ? (() => { try { return JSON.parse(payload); } catch { return null; } })()
    : payload;
  const entries = Array.isArray(parsed?.entries) ? parsed.entries : [];
  if (!entries.length) return "No exercises logged yet";
  const names = entries.map((item) => item?.name).filter(Boolean).slice(0, 3);
  const more = entries.length > names.length ? ` +${entries.length - names.length} more` : "";
  return `${entries.length} exercise${entries.length === 1 ? "" : "s"}${names.length ? ` · ${names.join(", ")}${more}` : ""}`;
}

export default function Page() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("all");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadPending() {
    setLoading(true);
    try {
      const response = await fetch("/api/sessions");
      const json = await response.json();
      const sessions = json?.data?.sessions ?? [];
      const pending = sessions.filter((item) =>
        ["pending_notes", "client_submitted", "draft"].includes(item.status)
      );
      setItems(pending);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPending();
  }, []);

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    return items.filter((item) => item.status === filter);
  }, [filter, items]);

  const counts = useMemo(() => ({
    all: items.length,
    draft: items.filter((item) => item.status === "draft").length,
    pending_notes: items.filter((item) => item.status === "pending_notes").length,
    client_submitted: items.filter((item) => item.status === "client_submitted").length,
  }), [items]);

  async function approve(sessionId) {
    setMessage("");
    const response = await fetch(`/api/sessions/${sessionId}/complete`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewer: "trainer" }),
    });
    const json = await response.json();
    if (!response.ok || !json?.ok) {
      setMessage(json?.message ?? "Unable to approve session.");
      return;
    }
    setMessage("Session approved and marked complete.");
    await loadPending();
  }

  return (
    <TrainerShell
      title="Needs Work"
      subtitle="Drafts, pending notes, and client-submitted sessions across all clients."
    >
      <article className="card panel">
        <div className="client-detail-head">
          <div>
            <h2 style={{ margin: 0 }}>Action queue</h2>
            <p className="item-sub" style={{ marginTop: 4 }}>
              Resume unfinished logging or review client self-logs.
            </p>
          </div>
          <Link href="/sessions" className="ghost-button">All sessions</Link>
        </div>
        <div className="prototype-mode-row" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
          {[
            ["all", "All"],
            ["draft", "Drafts"],
            ["pending_notes", "Pending notes"],
            ["client_submitted", "Client submitted"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={filter === value ? "mint-button" : "ghost-button"}
              onClick={() => setFilter(value)}
            >
              {label} ({counts[value] ?? 0})
            </button>
          ))}
        </div>
      </article>

      <CollapsibleSection
        title="How this queue works"
        subtitle="Quick guide"
        defaultOpen={false}
      >
        <p className="item-sub">
          Client self-log: review the session, capture any missing details, then Approve.
        </p>
        <p className="item-sub" style={{ marginTop: 8 }}>
          Trainer draft or pending notes: open Resume to continue logging, then finish on Final.
        </p>
      </CollapsibleSection>

      <article className="card panel">
        {loading ? <p className="item-sub">Loading…</p> : null}
        {!loading && filtered.length === 0 ? (
          <p className="item-sub">Nothing needs work right now.</p>
        ) : null}
        <ul className="list">
          {filtered.map((item) => {
            const resumeHref = item.status === "draft"
              ? `/sessions/new?sessionId=${encodeURIComponent(item.id)}&clientId=${encodeURIComponent(item.client_id || "")}`
              : `/sessions/${item.id}`;
            return (
              <li className="list-item" key={item.id} style={{ alignItems: "flex-start" }}>
                <div style={{ minWidth: 0 }}>
                  <p className="item-title">
                    {item.client_name_snapshot} — {item.session_title}
                  </p>
                  <p className="item-sub">
                    <span className="status-chip">{labelForStatus(item.status)}</span>
                  </p>
                  <p className="item-sub" style={{ marginTop: 4 }}>{exerciseSummary(item)}</p>
                  {item.raw_notes ? (
                    <p className="item-sub" style={{ marginTop: "0.35rem" }}>
                      {String(item.raw_notes).slice(0, 160)}
                      {String(item.raw_notes).length > 160 ? "…" : ""}
                    </p>
                  ) : null}
                </div>
                <div className="quick-actions">
                  <Link href={resumeHref} className="mint-button">
                    {item.status === "draft" ? "Resume" : "Review"}
                  </Link>
                  {item.status === "client_submitted" ? (
                    <button className="ghost-button" type="button" onClick={() => approve(item.id)}>
                      Approve
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
        {message ? <p className="item-sub">{message}</p> : null}
      </article>
    </TrainerShell>
  );
}
