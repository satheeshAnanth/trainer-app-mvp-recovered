"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import TrainerShell from "app/_components/TrainerShell";
import { SkeletonBlock } from "app/_components/Skeleton";

const LIMIT_OPTIONS = [25, 50, 100];

export default function AuditPage() {
  const [limit, setLimit] = useState(50);
  const [events, setEvents] = useState([]);
  const [source, setSource] = useState("mock");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadAudit = useCallback(async (currentLimit) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/audit?limit=${currentLimit}`);
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.message ?? "Unable to load audit trail.");
      setEvents(Array.isArray(json?.data?.events) ? json.data.events : []);
      setSource(String(json?.data?.source ?? "mock"));
    } catch (e) {
      setError(e?.message ?? "Unable to load audit trail.");
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAudit(limit);
  }, [limit, loadAudit]);

  const summary = useMemo(() => {
    const counts = events.reduce((acc, event) => {
      const key = String(event?.entityType ?? "system");
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([key, value]) => ({ key, value }));
  }, [events]);

  return (
    <TrainerShell title="Support Audit Trail" subtitle="Internal support feed for recent client, session, and payment changes.">
      <article className="card panel">
        <div className="list-item" style={{ alignItems: "center" }}>
          <div>
            <p className="item-title">Recent activity</p>
            <p className="item-sub">Showing the latest {limit} events from {source}.</p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <label className="field" style={{ minWidth: 110 }}>
              <span>Limit</span>
              <select value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
                {LIMIT_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
            <button type="button" className="ghost-button" onClick={() => loadAudit(limit)} disabled={loading}>
              {loading ? "Loading…" : "Refresh"}
            </button>
          </div>
        </div>

        <div className="spec-grid" style={{ marginTop: 12 }}>
          {summary.length > 0 ? (
            summary.map((item) => (
              <div key={item.key} className="card surface-glass" style={{ padding: 14 }}>
                <p className="item-title" style={{ textTransform: "capitalize" }}>{item.key}</p>
                <p className="item-sub">{item.value} event{item.value === 1 ? "" : "s"}</p>
              </div>
            ))
          ) : (
            <div className="card surface-glass" style={{ padding: 14 }}>
              <p className="item-title">No events yet</p>
              <p className="item-sub">Activity will appear here as trainers update clients and sessions.</p>
            </div>
          )}
        </div>
      </article>

      {error ? (
        <article className="card panel">
          <p className="item-title">Unable to load audit trail</p>
          <p className="item-sub">{error}</p>
        </article>
      ) : null}

      <article className="card panel">
        <h2>Event feed</h2>
        <div style={{ display: "grid", gap: 12 }}>
          {loading ? (
            <>
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="list-item" style={{ alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <SkeletonBlock style={{ width: "45%", height: 14, marginBottom: 8 }} />
                    <SkeletonBlock style={{ width: "70%", height: 12 }} />
                  </div>
                  <SkeletonBlock style={{ width: 72, height: 24, borderRadius: 999 }} />
                </div>
              ))}
            </>
          ) : null}
          {!loading && events.length === 0 ? <p className="item-sub">No audit events found.</p> : null}
          {events.map((event) => (
            <div key={event.id} className="list-item" style={{ alignItems: "flex-start" }}>
              <div>
                <p className="item-title">{formatAction(event.action)}</p>
                <p className="item-sub">
                  {formatEntity(event.entityType, event.entityId)}
                  {event.actor ? ` · by ${event.actor}` : ""}
                </p>
                {event.payload?.clientName || event.payload?.sessionTitle || event.payload?.amount ? (
                  <p className="item-sub">{formatPayloadSummary(event.payload)}</p>
                ) : null}
              </div>
              <div style={{ textAlign: "right" }}>
                <span className="status-chip">{formatTime(event.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      </article>
    </TrainerShell>
  );
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

function formatPayloadSummary(payload) {
  if (!payload || typeof payload !== "object") return "";
  if (payload.clientName) return `Client: ${payload.clientName}`;
  if (payload.sessionTitle) return `Session: ${payload.sessionTitle}`;
  if (payload.amount) return `Amount: ${payload.currency ?? "INR"} ${payload.amount}`;
  return "";
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
