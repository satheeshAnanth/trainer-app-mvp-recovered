"use client";

import { useEffect, useMemo, useState } from "react";
import ClientShell from "app/_components/ClientShell";

export default function Page() {
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/client/sessions");
        const json = await res.json();
        setSessions(Array.isArray(json?.data?.sessions) ? json.data.sessions : []);
      } catch {
        setSessions([]);
      }
    })();
  }, []);

  const stats = useMemo(() => {
    const completed = sessions.filter((s) => String(s?.status ?? "").toLowerCase() === "completed").length;
    const submitted = sessions.filter((s) => String(s?.status ?? "").toLowerCase() === "client_submitted").length;
    const pending = sessions.filter((s) => String(s?.status ?? "").toLowerCase().includes("pending")).length;
    return { completed, submitted, pending };
  }, [sessions]);

  return (
    <ClientShell title="My Portal" subtitle="Track personal sessions and coach updates.">
      <article className="card panel">
        <h2>Weekly summary</h2>
        <div className="stats-grid">
          <div className="metric-card">
            <p className="panel-label">Completed sessions</p>
            <p className="panel-value">{stats.completed}</p>
          </div>
          <div className="metric-card">
            <p className="panel-label">Self-logged workouts</p>
            <p className="panel-value">{stats.submitted}</p>
          </div>
          <div className="metric-card">
            <p className="panel-label">Coach feedback pending</p>
            <p className="panel-value">{stats.pending}</p>
          </div>
        </div>
      </article>

      <article className="card panel">
        <h2>Your Goal Plan</h2>
        {sessions.length === 0 ? (
          <p className="item-sub">No sessions available yet.</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {sessions.slice(0, 6).map((session) => (
              <div key={session.id} className="metric-card">
                <p className="item-title">{session.sessionTitle || "Session"}</p>
                <p className="item-sub">{String(session.sessionDate ?? "").slice(0, 10) || "No date"}</p>
                {!Array.isArray(session.goalRows) || session.goalRows.length === 0 ? (
                  <p className="item-sub">No goal exercise summary.</p>
                ) : (
                  session.goalRows.map((row, idx) => (
                    <div key={`${session.id}-${idx}`} className="list-item" style={{ marginTop: 8, alignItems: "flex-start" }}>
                      <div>
                        <p className="item-title">{row.name}</p>
                        <p className="item-sub">Target: {row.target || "-"}</p>
                        <p className="item-sub">Done: {row.done || "-"}</p>
                        {row.skipReason ? <p className="item-sub">Reason: {row.skipReason.replaceAll("_", " ")}</p> : null}
                      </div>
                      <span className="status-chip">
                        {row.progress === "up" ? "Progress ↑" : row.progress === "down" ? "Progress ↓" : "Progress →"}
                      </span>
                    </div>
                  ))
                )}
              </div>
            ))}
          </div>
        )}
      </article>
    </ClientShell>
  );
}
