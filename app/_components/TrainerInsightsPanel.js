"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SkeletonInsightsGrid } from "app/_components/Skeleton";

export default function TrainerInsightsPanel() {
  const [clients, setClients] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [activityEvents, setActivityEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadInsights = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [clientsRes, sessionsRes, activityRes] = await Promise.all([
        fetch("/api/clients"),
        fetch("/api/sessions"),
        fetch("/api/audit?limit=25"),
      ]);
      const [clientsJson, sessionsJson, activityJson] = await Promise.all([
        clientsRes.json(),
        sessionsRes.json(),
        activityRes.json(),
      ]);

      if (!clientsRes.ok || !sessionsRes.ok || !activityRes.ok) {
        throw new Error("Unable to load insights.");
      }
      if (clientsJson?.data?.source === "mock" || sessionsJson?.data?.source === "mock") {
        throw new Error("Live progress data is unavailable. Refresh after signing in again.");
      }

      setClients(Array.isArray(clientsJson?.data?.clients) ? clientsJson.data.clients : []);
      setSessions(Array.isArray(sessionsJson?.data?.sessions) ? sessionsJson.data.sessions : []);
      setActivityEvents(Array.isArray(activityJson?.data?.events) ? activityJson.data.events : []);
    } catch (e) {
      setError(e?.message ?? "Unable to load insights.");
      setClients([]);
      setSessions([]);
      setActivityEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInsights();
  }, [loadInsights]);

  const stats = useMemo(() => {
    const completed = sessions.filter((session) => String(session?.status ?? "").toLowerCase() === "completed");
    const scheduled = sessions.filter((session) => String(session?.status ?? "").toLowerCase() === "scheduled");
    const draft = sessions.filter((session) => String(session?.status ?? "").toLowerCase() === "draft");
    const totalCalories = completed.reduce((sum, session) => sum + Number(session?.estimated_calories ?? 0), 0);
    const totalMinutes = completed.reduce((sum, session) => sum + Number(session?.duration_minutes ?? 0), 0);
    const activeClients = clients.filter((client) => Boolean(client?.id)).length;
    const mostActiveClient = topBy(completed, (session) => session?.client_name_snapshot ?? session?.client_id);
    const recentActivity = activityEvents.slice(0, 5);
    const resolvedSessions = completed.length + draft.length;
    return {
      activeClients,
      completedCount: completed.length,
      scheduledCount: scheduled.length,
      draftCount: draft.length,
      completionRate: resolvedSessions ? Math.round((completed.length / resolvedSessions) * 100) : 0,
      totalCalories,
      totalMinutes,
      mostActiveClient,
      recentActivity,
    };
  }, [activityEvents, clients, sessions]);

  return (
    <>
      <article className="card panel">
        <div className="list-item" style={{ alignItems: "center" }}>
          <div>
            <p className="item-title">Progress overview</p>
            <p className="item-sub">Your coaching snapshot across clients and sessions.</p>
          </div>
          <button type="button" className="ghost-button" onClick={loadInsights} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </article>

      {error ? (
        <article className="card panel">
          <p className="item-title">Unable to load insights</p>
          <p className="item-sub">{error}</p>
        </article>
      ) : null}

      {loading ? <SkeletonInsightsGrid /> : null}

      {!loading ? (
        sessions.length === 0 ? (
          <article className="card panel">
            <p className="item-title">No session progress yet</p>
            <p className="item-sub">
              You have {stats.activeClients} active client{stats.activeClients === 1 ? "" : "s"}. Complete the first session to populate coaching time, calories and progress.
            </p>
          </article>
        ) : (
          <section className="spec-grid">
            <MetricCard label="Clients" value={stats.activeClients} help="Active client records" />
            <MetricCard label="Sessions" value={sessions.length} help={`${stats.completedCount} completed · ${stats.scheduledCount} scheduled`} />
            <MetricCard label="Completion rate" value={`${stats.completionRate}%`} help={`${stats.draftCount} draft session${stats.draftCount === 1 ? "" : "s"}`} />
            <MetricCard label="Coaching minutes" value={stats.totalMinutes} help="Completed sessions only" />
            <MetricCard label="Calories estimated" value={stats.totalCalories} help="Completed sessions only" />
            <MetricCard label="Most active client" value={stats.mostActiveClient} help="Based on completed sessions" />
          </section>
        )
      ) : null}

      {!loading ? (
      <article className="card panel">
        <h2>Recent activity</h2>
        <div style={{ display: "grid", gap: 10 }}>
          {stats.recentActivity.length === 0 ? <p className="item-sub">No recent activity yet.</p> : null}
          {stats.recentActivity.map((event) => (
            <div key={event.id} className="list-item">
              <div>
                <p className="item-title">{formatAction(event.action)}</p>
                <p className="item-sub">{formatEntity(event.entityType)}</p>
              </div>
              <span className="status-chip">{formatTime(event.createdAt)}</span>
            </div>
          ))}
        </div>
      </article>
      ) : null}
    </>
  );
}

function MetricCard({ label, value, help }) {
  return (
    <article className="card surface-glass" style={{ padding: 16 }}>
      <p className="item-sub">{label}</p>
      <p className="item-title" style={{ fontSize: 28, margin: "6px 0", overflowWrap: "anywhere" }}>{value}</p>
      <p className="item-sub">{help}</p>
    </article>
  );
}

function topBy(items, getKey) {
  const counts = new Map();
  for (const item of items) {
    const key = String(getKey(item) ?? "Unknown").trim() || "Unknown";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return top ? `${top[0]} (${top[1]})` : "No sessions yet";
}

function formatAction(action) {
  const value = String(action ?? "event").replace(/_/g, " ").trim();
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : "Event";
}

function formatEntity(entityType) {
  const type = String(entityType ?? "system").replace(/_/g, " ");
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function formatTime(value) {
  if (!value) return "Just now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
