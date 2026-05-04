"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import TrainerShell from "app/_components/TrainerShell";

export default function InsightsPage() {
  const [clients, setClients] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [audit, setAudit] = useState([]);
  const [source, setSource] = useState({ clients: "mock", sessions: "mock", audit: "mock" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadInsights = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [clientsRes, sessionsRes, auditRes] = await Promise.all([
        fetch("/api/clients"),
        fetch("/api/sessions"),
        fetch("/api/audit?limit=25"),
      ]);
      const [clientsJson, sessionsJson, auditJson] = await Promise.all([
        clientsRes.json(),
        sessionsRes.json(),
        auditRes.json(),
      ]);

      if (!clientsRes.ok || !sessionsRes.ok || !auditRes.ok) {
        throw new Error("Unable to load insights.");
      }

      setClients(Array.isArray(clientsJson?.data?.clients) ? clientsJson.data.clients : []);
      setSessions(Array.isArray(sessionsJson?.data?.sessions) ? sessionsJson.data.sessions : []);
      setAudit(Array.isArray(auditJson?.data?.events) ? auditJson.data.events : []);
      setSource({
        clients: String(clientsJson?.data?.source ?? "mock"),
        sessions: String(sessionsJson?.data?.source ?? "mock"),
        audit: String(auditJson?.data?.source ?? "mock"),
      });
    } catch (e) {
      setError(e?.message ?? "Unable to load insights.");
      setClients([]);
      setSessions([]);
      setAudit([]);
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
    const totalCalories = sessions.reduce((sum, session) => sum + Number(session?.estimated_calories ?? 0), 0);
    const totalMinutes = sessions.reduce((sum, session) => sum + Number(session?.duration_minutes ?? 0), 0);
    const activeClients = clients.filter((client) => Boolean(client?.id)).length;
    const mostActiveClient = topBy(sessions, (session) => session?.client_name_snapshot ?? session?.client_id);
    const recentActivity = audit.slice(0, 5);
    return {
      activeClients,
      completedCount: completed.length,
      scheduledCount: scheduled.length,
      draftCount: draft.length,
      completionRate: sessions.length ? Math.round((completed.length / sessions.length) * 100) : 0,
      totalCalories,
      totalMinutes,
      mostActiveClient,
      recentActivity,
    };
  }, [audit, clients, sessions]);

  return (
    <TrainerShell title="Insights" subtitle="Quick progress snapshot for clients, sessions, and activity.">
      <article className="card panel">
        <div className="list-item" style={{ alignItems: "center" }}>
          <div>
            <p className="item-title">Progress overview</p>
            <p className="item-sub">
              Client source: {source.clients} · Session source: {source.sessions} · Audit source: {source.audit}
            </p>
          </div>
          <button type="button" className="ghost-button" onClick={loadInsights} disabled={loading}>
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
      </article>

      {error ? (
        <article className="card panel">
          <p className="item-title">Unable to load insights</p>
          <p className="item-sub">{error}</p>
        </article>
      ) : null}

      <section className="spec-grid">
        <MetricCard label="Clients" value={stats.activeClients} help="Active client records" />
        <MetricCard label="Sessions" value={sessions.length} help={`${stats.completedCount} completed · ${stats.scheduledCount} scheduled`} />
        <MetricCard label="Completion rate" value={`${stats.completionRate}%`} help={`${stats.draftCount} draft session${stats.draftCount === 1 ? "" : "s"}`} />
        <MetricCard label="Coaching minutes" value={stats.totalMinutes} help="Logged across sessions" />
        <MetricCard label="Calories estimated" value={stats.totalCalories} help="Across tracked sessions" />
        <MetricCard label="Most active client" value={stats.mostActiveClient} help="Based on session count" />
      </section>

      <article className="card panel">
        <h2>Recent activity</h2>
        <div style={{ display: "grid", gap: 10 }}>
          {stats.recentActivity.length === 0 ? <p className="item-sub">No recent activity yet.</p> : null}
          {stats.recentActivity.map((event) => (
            <div key={event.id} className="list-item">
              <div>
                <p className="item-title">{formatAction(event.action)}</p>
                <p className="item-sub">{formatEntity(event.entityType, event.entityId)}</p>
              </div>
              <span className="status-chip">{formatTime(event.createdAt)}</span>
            </div>
          ))}
        </div>
      </article>
    </TrainerShell>
  );
}

function MetricCard({ label, value, help }) {
  return (
    <article className="card surface-glass" style={{ padding: 16 }}>
      <p className="item-sub">{label}</p>
      <p className="item-title" style={{ fontSize: 28, margin: "6px 0" }}>{value}</p>
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

function formatEntity(entityType, entityId) {
  const type = String(entityType ?? "system").replace(/_/g, " ");
  const id = entityId ? `#${entityId}` : "";
  return `${type}${id}`.trim();
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
