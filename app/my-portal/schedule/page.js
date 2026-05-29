"use client";

import { useEffect, useMemo, useState } from "react";
import ClientShell from "app/_components/ClientShell";
import {
  buildScheduleActionLabel,
  buildScheduleReminderText,
  buildScheduleReminderWindows,
  formatScheduleDateLabel,
  formatScheduleTimeLabel,
  getNextScheduleReminderSummary,
  isUpcomingEvent,
  normalizeScheduleDate,
  normalizeScheduleTime,
  sortScheduleEvents,
} from "app/lib/schedule";
import SwipeableCard from "app/_components/SwipeableCard";

const REMINDER_KEY = "client-schedule-reminders-enabled";
const NOTIFIED_KEY = "client-schedule-notified";

function statusTone(status) {
  const value = String(status || "").toLowerCase();
  if (value === "accepted") return { color: "#34d399", border: "rgba(52, 211, 153, 0.35)" };
  if (value === "pending") return { color: "#facc15", border: "rgba(250, 204, 21, 0.35)" };
  if (value === "declined" || value === "cancelled") return { color: "#f87171", border: "rgba(248, 113, 113, 0.35)" };
  if (value === "completed") return { color: "#93c5fd", border: "rgba(147, 197, 253, 0.35)" };
  return { color: "#cbd5e1", border: "rgba(203, 213, 225, 0.25)" };
}

function defaultForm() {
  return {
    date: new Date().toISOString().slice(0, 10),
    time: "09:00",
    note: "",
  };
}

export default function Page() {
  const [sessionUser, setSessionUser] = useState(null);
  const [events, setEvents] = useState([]);
  const [editingId, setEditingId] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [remindersEnabled, setRemindersEnabled] = useState(false);
  const [form, setForm] = useState(defaultForm());
  const [sheetEvent, setSheetEvent] = useState(null);

  async function load() {
    const [sessionRes, eventsRes] = await Promise.all([fetch("/api/client-auth/session"), fetch("/api/schedule/events")]);
    const sessionJson = await sessionRes.json();
    const eventsJson = await eventsRes.json();

    const user = sessionJson?.data?.user ?? null;
    setSessionUser(user);
    setEvents(eventsJson?.data?.events ?? []);
  }

  useEffect(() => {
    load().catch(() => {
      setSessionUser(null);
      setEvents([]);
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      setRemindersEnabled(window.localStorage.getItem(REMINDER_KEY) === "1");
    } catch {
      setRemindersEnabled(false);
    }
  }, []);

  useEffect(() => {
    if (!remindersEnabled || typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    const scan = () => {
      const now = Date.now();
      const upcoming = sortScheduleEvents(events)
        .filter((event) => isUpcomingEvent(event, now))
        .filter((event) => !["declined", "cancelled", "completed"].includes(String(event.status || "").toLowerCase()));

      upcoming.slice(0, 5).forEach((event) => {
        buildScheduleReminderWindows(event, now).forEach((reminder) => {
          if (reminder.delayMs > 60000 || reminder.delayMs < -60000) return;
          const storageKey = `${NOTIFIED_KEY}:${reminder.marker}`;
          if (window.localStorage.getItem(storageKey)) return;
          window.localStorage.setItem(storageKey, "1");
          new Notification("Schedule reminder", {
            body: buildScheduleReminderText(event, reminder.hours),
            tag: `client-schedule-${event.id}-${reminder.hours}`,
          });
        });
      });
    };

    scan();
    const timer = window.setInterval(scan, 30000);
    return () => window.clearInterval(timer);
  }, [events, remindersEnabled]);

  const visibleEvents = useMemo(() => sortScheduleEvents(events), [events]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const event of visibleEvents) {
      const key = event.scheduled_date || "Unscheduled";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(event);
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [visibleEvents]);

  const upcoming = useMemo(() => {
    return sortScheduleEvents(events)
      .filter((event) => isUpcomingEvent(event))
      .filter((event) => !["declined", "cancelled", "completed"].includes(String(event.status || "").toLowerCase()))
      .slice(0, 3);
  }, [events]);

  const pendingEvents = useMemo(
    () => sortScheduleEvents(events).filter((event) => String(event.status || "").toLowerCase() === "pending"),
    [events]
  );

  async function enableReminders() {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setMessage("This browser does not support notifications.");
      return;
    }

    const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    if (permission !== "granted") {
      setMessage("Notifications are off. Your schedule tab still works as a reminder list.");
      return;
    }

    try {
      window.localStorage.setItem(REMINDER_KEY, "1");
    } catch {
      /* ignore */
    }

    setRemindersEnabled(true);
    setMessage("Browser reminders enabled.");
  }

  async function createOrUpdate() {
    setMessage("");
    setSaving(true);
    try {
      if (!sessionUser?.clientId) {
        throw new Error("Your client account could not be loaded.");
      }

      const body = {
        scheduledDate: normalizeScheduleDate(form.date),
        scheduledTime: normalizeScheduleTime(form.time),
        clientId: sessionUser.clientId,
        clientName: sessionUser.name || "Client",
        notes: form.note,
        createdByName: sessionUser.name || "Client",
      };

      const url = editingId ? `/api/schedule/events/${editingId}` : "/api/schedule/events";
      const method = editingId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.message ?? "Unable to save request.");

      setMessage(editingId ? "Request updated. If the time changed, it will return to pending." : "Request sent to your trainer.");
      setEditingId("");
      setForm(defaultForm());
      await load();
    } catch (error) {
      setMessage(error?.message ?? "Unable to save request.");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(id, status) {
    setMessage("");
    const res = await fetch(`/api/schedule/events/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const json = await res.json();
    if (!res.ok || !json?.ok) {
      setMessage(json?.message ?? `Unable to set status to ${status}.`);
      return;
    }
    setMessage(`Marked as ${buildScheduleActionLabel(status).toLowerCase()}.`);
    await load();
  }

  function editEvent(event) {
    setEditingId(event.id);
    setForm({
      date: event.scheduled_date || new Date().toISOString().slice(0, 10),
      time: event.scheduled_time || "09:00",
      note: event.notes || "",
    });
  }

  const ownRequests = events.filter((event) => String(event.created_by_role || "") === "client");

  return (
    <ClientShell title="My Schedule" subtitle="Simple requests, confirmations, reminders, and reschedules—no chat thread.">
      <article className="card panel">
        <div className="quick-actions" style={{ marginBottom: 10, flexWrap: "wrap" }}>
          <span className="status-chip">Total {events.length}</span>
          <span className="status-chip" style={{ color: "#facc15" }}>Pending {events.filter((event) => String(event.status || "").toLowerCase() === "pending").length}</span>
          <span className="status-chip" style={{ color: "#34d399" }}>Accepted {events.filter((event) => String(event.status || "").toLowerCase() === "accepted").length}</span>
        </div>
        <p className="item-sub">
          {sessionUser?.name ? `Signed in as ${sessionUser.name}.` : "Loading your client schedule..."}
        </p>
      </article>

      <article className="card panel">
        <div className="section-header" style={{ marginBottom: 10 }}>
          <div>
            <h2 style={{ marginBottom: 4 }}>Pending confirmations</h2>
            <p className="item-sub">These are the requests waiting for a response or a reschedule.</p>
          </div>
          <span className="status-chip" style={{ color: pendingEvents.length ? "#facc15" : "#cbd5e1" }}>
            {pendingEvents.length ? `${pendingEvents.length} waiting` : "All caught up"}
          </span>
        </div>
        {pendingEvents.length === 0 ? (
          <p className="item-sub">No pending confirmations right now.</p>
        ) : (
          <div className="list">
            {pendingEvents.slice(0, 3).map((event) => (
              <div key={event.id} className="list-item" style={{ alignItems: "flex-start" }}>
                <div>
                  <p className="item-title">{event.client_name || sessionUser?.name || "Schedule item"}</p>
                  <p className="item-sub">
                    {formatScheduleDateLabel(event.scheduled_date)} · {formatScheduleTimeLabel(event.scheduled_time)}
                  </p>
                  {event.notes ? <p className="item-sub">{event.notes}</p> : null}
                  {getNextScheduleReminderSummary(event) ? <p className="item-sub">{getNextScheduleReminderSummary(event)}</p> : null}
                </div>
                <span className="status-chip" style={statusTone(event.status)}>
                  {buildScheduleActionLabel(event.status)}
                </span>
              </div>
            ))}
          </div>
        )}
      </article>

      <article className="card panel">
        <div className="section-header" style={{ marginBottom: 10 }}>
          <div>
            <h2 style={{ marginBottom: 4 }}>Reminders</h2>
            <p className="item-sub">Turn on browser notifications for 24h and 1h reminder windows.</p>
          </div>
          <button type="button" className="mint-button mint-button-sm" onClick={enableReminders}>
            {remindersEnabled ? "Reminders enabled" : "Enable browser reminders"}
          </button>
        </div>
        {upcoming.length === 0 ? (
          <p className="item-sub">No upcoming reminders in the next 24 hours.</p>
        ) : (
          <div className="list">
            {upcoming.map((event) => (
              <div key={event.id} className="list-item" style={{ alignItems: "flex-start" }}>
                <div>
                  <p className="item-title">{event.client_name || sessionUser?.name || "Schedule item"}</p>
                  <p className="item-sub">
                    {formatScheduleDateLabel(event.scheduled_date)} · {formatScheduleTimeLabel(event.scheduled_time)}
                  </p>
                  {event.notes ? <p className="item-sub">{event.notes}</p> : null}
                  <p className="item-sub">{getNextScheduleReminderSummary(event) || "Reminder scheduled."}</p>
                </div>
                <span className="status-chip" style={statusTone(event.status)}>
                  {buildScheduleActionLabel(event.status)}
                </span>
              </div>
            ))}
          </div>
        )}
      </article>

      <article className="card panel">
        <h2>{editingId ? "Reschedule session" : "Request a session"}</h2>
        <p className="item-sub" style={{ marginBottom: 10 }}>
          Send one note with the request. Your trainer confirms, declines, or adjusts the time—there is no long chat.
        </p>
        {editingId ? <p className="item-sub">Editing an existing request keeps the note and will reset to pending if the time changes.</p> : null}
        <div className="form-grid">
          <label className="field">
            <span>Date</span>
            <input
              value={form.date}
              onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
              placeholder="YYYY-MM-DD"
              type="date"
            />
          </label>
          <label className="field">
            <span>Time</span>
            <input
              value={form.time}
              onChange={(e) => setForm((p) => ({ ...p, time: e.target.value }))}
              placeholder="09:00"
              type="time"
            />
          </label>
          <label className="field full">
            <span>Note for trainer (optional)</span>
            <textarea
              rows={2}
              value={form.note}
              onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
              placeholder="Example: Need a shorter session next week."
            />
          </label>
        </div>
        <div className="quick-actions" style={{ marginTop: 12, flexWrap: "wrap" }}>
          <button className="continue-btn" type="button" onClick={createOrUpdate} disabled={saving}>
            {editingId ? "Update request" : "Send request"}
          </button>
          {editingId ? (
            <button
              className="ghost-button"
              type="button"
              onClick={() => {
                setEditingId("");
                setForm(defaultForm());
              }}
            >
              Cancel edit
            </button>
          ) : null}
        </div>
      </article>

      <article className="card panel">
        <div className="section-header" style={{ marginBottom: 10 }}>
          <div>
            <h2 style={{ marginBottom: 4 }}>All sessions</h2>
            <p className="item-sub">Everything stays mirrored between trainer and client schedule tabs.</p>
          </div>
          <span className="status-chip">{ownRequests.length} shown</span>
        </div>
        {grouped.length === 0 ? (
          <p className="item-sub">No sessions yet.</p>
        ) : (
          grouped.map(([date, list]) => (
            <div key={date} className="metric-card" style={{ marginBottom: 10 }}>
              <p className="item-title" style={{ marginBottom: 8 }}>{formatScheduleDateLabel(date)}</p>
              {list.map((event) => {
                const tone = statusTone(event.status);
                const ownRequest = String(event.created_by_role || "") === "client";
                const status = String(event.status || "").toLowerCase();
                return (
                  <SwipeableCard
                    key={event.id}
                    disabled={status === "completed" || status === "cancelled"}
                    onSwipeLeft={() => setSheetEvent({ event, ownRequest })}
                    style={{ marginBottom: 8 }}
                  >
                    <div className="list-item" style={{ alignItems: "flex-start" }}>
                      <div style={{ flex: 1 }}>
                        <p className="item-title">
                          {formatScheduleTimeLabel(event.scheduled_time)} · {ownRequest ? "Your request" : "Trainer request"}
                        </p>
                        <p className="item-sub">{buildScheduleActionLabel(event.status)} · {ownRequest ? "You sent this note" : "Your trainer sent this note"}</p>
                        {event.notes ? <p className="item-sub">{event.notes}</p> : null}
                        {getNextScheduleReminderSummary(event) ? <p className="item-sub">{getNextScheduleReminderSummary(event)}</p> : null}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                        <span className="status-chip" style={tone}>{buildScheduleActionLabel(event.status)}</span>
                        {status !== "completed" && status !== "cancelled" ? (
                          <button className="ghost-button ghost-button-sm" type="button" onClick={() => setSheetEvent({ event, ownRequest })}>
                            Actions
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </SwipeableCard>
                );
              })}
            </div>
          ))
        )}
      </article>

      {message ? <p className="item-sub">{message}</p> : null}

      {sheetEvent ? (
        <div style={{ position: "fixed", inset: 0, background: "rgba(2,6,23,0.72)", zIndex: 60, display: "flex", alignItems: "flex-end" }} onClick={() => setSheetEvent(null)}>
          <div style={{ width: "100%", background: "#0f172a", borderRadius: "20px 20px 0 0", padding: "20px 16px", paddingBottom: "calc(20px + env(safe-area-inset-bottom))" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ width: 40, height: 4, borderRadius: 2, background: "#334155", margin: "0 auto 16px" }} />
            <p className="item-title" style={{ marginBottom: 4 }}>{sheetEvent.event.client_name || sessionUser?.name || "Session"}</p>
            <p className="item-sub" style={{ marginBottom: 16 }}>
              {formatScheduleDateLabel(sheetEvent.event.scheduled_date)} · {formatScheduleTimeLabel(sheetEvent.event.scheduled_time)}
            </p>
            <div style={{ display: "grid", gap: 8 }}>
              {sheetEvent.ownRequest ? (
                <>
                  <button className="ghost-button" type="button" onClick={() => { editEvent(sheetEvent.event); setSheetEvent(null); }}>Reschedule</button>
                  <button className="ghost-button" type="button" style={{ borderColor: "#7f1d1d", color: "#fecaca" }} onClick={() => { changeStatus(sheetEvent.event.id, "cancelled"); setSheetEvent(null); }}>Cancel request</button>
                </>
              ) : (
                <>
                  <button className="continue-btn" type="button" onClick={() => { changeStatus(sheetEvent.event.id, "accepted"); setSheetEvent(null); }}>Confirm</button>
                  <button className="ghost-button" type="button" onClick={() => { changeStatus(sheetEvent.event.id, "declined"); setSheetEvent(null); }}>Decline</button>
                </>
              )}
              <button className="ghost-button" type="button" onClick={() => setSheetEvent(null)}>Dismiss</button>
            </div>
          </div>
        </div>
      ) : null}
    </ClientShell>
  );
}
