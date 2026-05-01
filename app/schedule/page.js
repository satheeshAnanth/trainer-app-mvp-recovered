"use client";

import { useEffect, useMemo, useState } from "react";
import TrainerShell from "app/_components/TrainerShell";

const FILTERS = ["all", "pending", "accepted", "rejected", "cancelled", "completed"];

function formatTime(value) {
  if (!value) return "Any time";
  if (/^\d{2}:\d{2}/.test(value)) {
    const [h, m] = value.slice(0, 5).split(":");
    const hour = Number(h);
    const suffix = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12}:${m} ${suffix}`;
  }
  return value;
}

function toYMD(value) {
  const t = String(value || "").trim();
  if (!t) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return t;
}

export default function Page() {
  const [events, setEvents] = useState([]);
  const [clients, setClients] = useState([]);
  const [editingId, setEditingId] = useState("");
  const [filter, setFilter] = useState("all");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    time: "12:30 PM",
    clientId: "",
    note: "",
  });

  async function load() {
    const [eventsRes, clientsRes] = await Promise.all([fetch("/api/schedule/events"), fetch("/api/clients")]);
    const eventsJson = await eventsRes.json();
    const clientsJson = await clientsRes.json();
    const clientRows = clientsJson?.data?.clients ?? [];
    setEvents(eventsJson?.data?.events ?? []);
    setClients(clientRows);
  }

  useEffect(() => {
    load().catch(() => {
      setEvents([]);
      setClients([]);
    });
  }, []);

  const counts = useMemo(() => {
    const by = { total: events.length, pending: 0, accepted: 0 };
    for (const event of events) {
      const s = String(event.status || "").toLowerCase();
      if (s === "pending") by.pending += 1;
      if (s === "accepted") by.accepted += 1;
    }
    return by;
  }, [events]);

  const filtered = useMemo(() => {
    if (filter === "all") return events;
    return events.filter((e) => String(e.status || "").toLowerCase() === filter);
  }, [events, filter]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const event of filtered) {
      const key = event.scheduled_date || "No date";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(event);
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [filtered]);

  async function createOrUpdate() {
    setMessage("");
    setSaving(true);
    try {
      const selectedClient = clients.find((c) => c.id === form.clientId);
      const body = {
        scheduledDate: toYMD(form.date),
        scheduledTime: form.time,
        clientId: selectedClient?.id || null,
        clientName: selectedClient?.name || "Personal appointment",
        notes: form.note,
      };

      const url = editingId ? `/api/schedule/events/${editingId}` : "/api/schedule/events";
      const method = editingId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.message ?? "Unable to save appointment.");

      setMessage(editingId ? "Appointment updated." : "Appointment created.");
      setEditingId("");
      setForm((prev) => ({ ...prev, note: "", clientId: "" }));
      await load();
    } catch (e) {
      setMessage(e?.message ?? "Unable to save appointment.");
    } finally {
      setSaving(false);
    }
  }

  async function cancelEvent(id) {
    setMessage("");
    const res = await fetch(`/api/schedule/events/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    });
    const json = await res.json();
    if (!res.ok || !json?.ok) {
      setMessage(json?.message ?? "Unable to cancel event.");
      return;
    }
    setMessage("Appointment cancelled.");
    await load();
  }

  function editEvent(event) {
    setEditingId(event.id);
    setForm({
      date: event.scheduled_date || new Date().toISOString().slice(0, 10),
      time: event.scheduled_time || "Any time",
      clientId: event.client_id || "",
      note: event.notes || "",
    });
  }

  return (
    <TrainerShell title="Schedule Calendar" subtitle="Trainer/client appointments with optional client-visible note.">
      <article className="card panel">
        <div className="quick-actions" style={{ marginBottom: 10 }}>
          <span className="status-chip">Total {counts.total}</span>
          <span className="status-chip" style={{ color: "#facc15" }}>Pending {counts.pending}</span>
          <span className="status-chip" style={{ color: "#34d399" }}>Accepted {counts.accepted}</span>
        </div>
        <div className="filter-chip-row">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              className={f === filter ? "mint-button mint-button-sm" : "ghost-button ghost-button-sm"}
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "All statuses" : f[0].toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </article>

      <article className="card panel">
        <h2>Create Appointment</h2>
        <div className="form-grid">
          <label className="field">
            <span>Date</span>
            <input value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} placeholder="YYYY-MM-DD" />
          </label>
          <label className="field">
            <span>Time</span>
            <input value={form.time} onChange={(e) => setForm((p) => ({ ...p, time: e.target.value }))} placeholder="12:30 PM" />
          </label>
          <label className="field full">
            <span>Client</span>
            <select value={form.clientId} onChange={(e) => setForm((p) => ({ ...p, clientId: e.target.value }))}>
              <option value="">Personal appointment (no client)</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label className="field full">
            <span>Note to share with client (optional)</span>
            <textarea rows={2} value={form.note} onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} placeholder="Optional note visible to your client" />
          </label>
        </div>
        <button className="continue-btn" type="button" onClick={createOrUpdate} disabled={saving} style={{ marginTop: 12 }}>
          {editingId ? "Update Appointment" : "Create Appointment"}
        </button>
      </article>

      <article className="card panel">
        {grouped.length === 0 ? (
          <p className="item-sub">No appointments yet.</p>
        ) : (
          grouped.map(([date, list]) => (
            <div key={date} className="metric-card" style={{ marginBottom: 10 }}>
              <p className="item-title" style={{ marginBottom: 8 }}>{date}</p>
              {list.map((event) => (
                <div key={event.id} className="list-item" style={{ marginBottom: 8, alignItems: "flex-start" }}>
                  <div>
                    <p className="item-title">
                      {formatTime(event.scheduled_time)} · {event.client_name || "Personal appointment"}
                    </p>
                    <p className="item-sub">Booked by trainer · {event.status || "accepted"}</p>
                  </div>
                  <div className="quick-actions" style={{ flexDirection: "column", alignItems: "stretch" }}>
                    <button className="ghost-button ghost-button-sm" type="button" onClick={() => editEvent(event)}>
                      Edit
                    </button>
                    <button
                      className="ghost-button ghost-button-sm"
                      type="button"
                      style={{ borderColor: "#7f1d1d", color: "#fecaca" }}
                      onClick={() => cancelEvent(event.id)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </article>

      {message ? <p className="item-sub">{message}</p> : null}
    </TrainerShell>
  );
}
