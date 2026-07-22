"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ClientShell from "app/_components/ClientShell";
import { buildClientProgressSnapshot } from "app/lib/clientProgress";
import { formatSessionDateShort, normalizeClientSession } from "app/lib/clientDashboard";
import { friendlySessionStatus } from "app/lib/clientSessionLabels";

export default function Page() {
  const [sessions, setSessions] = useState([]);
  const [clientName, setClientName] = useState("");
  const [profileGoal, setProfileGoal] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [authRes, sessionsRes, profileRes] = await Promise.all([
          fetch("/api/client-auth/session"),
          fetch("/api/client/sessions"),
          fetch("/api/client/profile"),
        ]);

        const authJson = authRes.ok ? await authRes.json() : null;
        const sessJson = sessionsRes.ok ? await sessionsRes.json() : null;
        const profileJson = profileRes.ok ? await profileRes.json() : null;

        if (cancelled) return;

        setClientName(String(authJson?.data?.user?.name ?? ""));
        setSessions(Array.isArray(sessJson?.data?.sessions) ? sessJson.data.sessions : []);

        const profile = profileJson?.data?.profile ?? profileJson?.data ?? null;
        const goal = String(profile?.goal ?? profile?.goalName ?? "").trim();
        if (goal) setProfileGoal(goal);
      } catch {
        if (!cancelled) {
          setSessions([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const model = useMemo(() => buildClientProgressSnapshot(sessions, profileGoal), [sessions, profileGoal]);
  const maxDaily = Math.max(...model.daily.map((point) => point.value), 1);
  const recentSessions = [...(sessions ?? [])]
    .map(normalizeClientSession)
    .filter(Boolean)
    .sort((a, b) => new Date(b.sessionDate ?? b.updated_at ?? b.created_at ?? 0).getTime() - new Date(a.sessionDate ?? a.updated_at ?? a.created_at ?? 0).getTime())
    .slice(0, 4);

  return (
    <ClientShell
      title="Progress"
      subtitle={clientName ? `See how your training is trending, ${clientName.split(/\s+/)[0]}.` : "See how your training is trending."}
    >
      <section className="card panel" style={{ borderLeft: "4px solid var(--mint)" }}>
        <p className="eyebrow" style={{ marginTop: 0 }}>
          Progress at a glance
        </p>
        <div className="quick-actions" style={{ marginTop: 14 }}>
          <Link className="mint-button mint-button-sm" href="/my-portal/self-log">
            Log a workout
          </Link>
          <Link className="ghost-button ghost-button-sm" href="/my-portal/payments">
            Review payments
          </Link>
        </div>
      </section>

      <div
        style={{
          display: "grid",
          gap: 14,
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
        }}
      >
        <article className="card panel">
          <p className="eyebrow" style={{ marginTop: 0 }}>
            Completion rate
          </p>
          <p className="panel-value" style={{ fontSize: 30 }}>
            {model.completionRate}%
          </p>
          <p className="item-sub" style={{ marginBottom: 0 }}>
            {model.completedSessions} completed of {model.totalSessions} logged session{model.totalSessions === 1 ? "" : "s"}.
          </p>
        </article>

        <article className="card panel">
          <p className="eyebrow" style={{ marginTop: 0 }}>
            Current streak
          </p>
          <p className="panel-value" style={{ fontSize: 30 }}>
            {model.streakDays}
          </p>
          <p className="item-sub" style={{ marginBottom: 0 }}>
            Consecutive active day{model.streakDays === 1 ? "" : "s"}.
          </p>
        </article>

        <article className="card panel">
          <p className="eyebrow" style={{ marginTop: 0 }}>
            Review queue
          </p>
          <p className="panel-value" style={{ fontSize: 30 }}>
            {model.reviewQueue}
          </p>
          <p className="item-sub" style={{ marginBottom: 0 }}>
            Sessions waiting on trainer feedback.
          </p>
        </article>
      </div>

      <article className="card panel">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <h2 style={{ marginBottom: 4 }}>7-day trend</h2>
            <p className="item-sub" style={{ marginBottom: 0 }}>
              {loading ? "Loading trend data…" : "Simple activity chart based on recent sessions."}
            </p>
          </div>
          <span className="status-chip">{model.activeDays} active days</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 10, marginTop: 18, alignItems: "end" }}>
          {model.daily.map((point) => {
            const height = maxDaily > 0 ? Math.max(16, (point.value / maxDaily) * 160) : 16;
            return (
              <div key={point.key} style={{ display: "grid", gap: 8, alignItems: "end" }}>
                <div style={{ minHeight: 180, display: "flex", alignItems: "end", justifyContent: "center" }}>
                  <div
                    style={{
                      width: "100%",
                      maxWidth: 60,
                      height,
                      borderRadius: 16,
                      background: point.value > 0 ? "linear-gradient(180deg, rgba(45, 212, 191, 0.95), rgba(14, 165, 233, 0.75))" : "rgba(71, 85, 105, 0.55)",
                      boxShadow: point.value > 0 ? "0 12px 28px rgba(45, 212, 191, 0.18)" : "none",
                    }}
                  />
                </div>
                <div style={{ textAlign: "center" }}>
                  <p className="item-title" style={{ marginBottom: 2, fontSize: 12 }}>
                    {point.label}
                  </p>
                  <p className="item-sub" style={{ marginBottom: 0, fontSize: 12 }}>
                    {point.value} session{point.value === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </article>

      <div
        style={{
          display: "grid",
          gap: 14,
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
        }}
      >
        <article className="card panel">
          <h2>Goal snapshot</h2>
          {model.goalSnapshot.total === 0 ? (
            <p className="item-sub" style={{ marginBottom: 0 }}>
              {model.goalSnapshot.primaryGoal
                ? `${model.goalSnapshot.primaryGoal} will show richer progress once goal-linked exercises are logged.`
                : "Your coach will connect future workouts to a goal here."}
            </p>
          ) : (
            <div>
              {model.goalSnapshot.primaryGoal ? <p className="item-sub">{model.goalSnapshot.primaryGoal}</p> : null}
              <p className="item-title">Latest session: {model.goalSnapshot.sessionTitle}</p>
              <p className="item-sub">{formatSessionDateShort(model.goalSnapshot.sessionDate)}</p>
              <p className="item-sub" style={{ marginTop: 10 }}>
                {model.goalSnapshot.completed}/{model.goalSnapshot.total} goal exercises completed
                {model.goalSnapshot.partial ? ` · ${model.goalSnapshot.partial} partial` : ""}
                {model.goalSnapshot.skipped ? ` · ${model.goalSnapshot.skipped} skipped` : ""}
              </p>
              {model.goalSnapshot.sampleRows.length > 0 ? (
                <ul className="list" style={{ marginTop: 10 }}>
                  {model.goalSnapshot.sampleRows.map((row, index) => (
                    <li key={`${row.name}-${index}`} className="list-item" style={{ alignItems: "flex-start" }}>
                      <div>
                        <p className="item-title">{row.name}</p>
                        <p className="item-sub">Target: {row.target || "—"} · Done: {row.done || row.completionStatus || "—"}</p>
                        {row.skipReason ? (
                          <p className="item-sub" style={{ color: "#fecaca", marginTop: 4 }}>
                            Skip reason: {row.skipReason}
                          </p>
                        ) : null}
                      </div>
                      <span className="status-chip" style={{ color: String(row.completionStatus).toLowerCase() === "skipped" ? "#f87171" : row.progress === "up" ? "#4ade80" : row.progress === "down" ? "#f87171" : "#94a3b8" }}>
                        {String(row.completionStatus).toLowerCase() === "skipped"
                          ? "Skipped"
                          : row.progress === "up"
                            ? "↑"
                            : row.progress === "down"
                              ? "↓"
                              : "→"}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          )}
        </article>

        <article className="card panel">
          <h2>Recent sessions</h2>
          {recentSessions.length === 0 ? (
            <p className="item-sub" style={{ marginBottom: 0 }}>
              No logged sessions yet.
            </p>
          ) : (
            <ul className="list">
              {recentSessions.map((session) => {
                const status = friendlySessionStatus(session.status);
                const href = session.id ? `/my-portal/sessions/${session.id}` : "/my-portal/progress";
                return (
                  <li key={session.id || session.sessionTitle} className="list-item" style={{ alignItems: "flex-start" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Link href={href} className="item-title" style={{ color: "inherit", textDecoration: "none" }}>
                        {session.sessionTitle}
                      </Link>
                      <p className="item-sub">{formatSessionDateShort(session.sessionDate) || "Date TBD"}</p>
                    </div>
                    <span className="status-chip" style={{ color: status.color }}>{status.label}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </article>
      </div>
    </ClientShell>
  );
}
