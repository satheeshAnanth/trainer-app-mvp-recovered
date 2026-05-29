"use client";

import { useEffect, useMemo, useState } from "react";
import TrainerShell from "app/_components/TrainerShell";
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

const FILTERS = ["all", "pending", "accepted", "declined", "cancelled", "completed"];
const REMINDER_KEY = "trainer-schedule-reminders-enabled";
const NOTIFIED_KEY = "trainer-schedule-notified";
const RECURRENCE_OPTIONS = [
  { value: "none", label: "No repeat" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Every 2 weeks" },
  { value: "monthly", label: "Monthly" },
];
const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getWeekDates(pivot) {
  const d = new Date(pivot);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + diff);
  return Array.from({ length: 7 }, (_, i) => {
    const copy = new Date(d);
    copy.setDate(d.getDate() + i);
    return copy;
  });
}

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr, n) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return isoDate(d);
}

function addMonths(dateStr, n) {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + n);
  return isoDate(d);
}

function statusTone(status) {
  const value = String(status || "").toLowerCase();
  if (value === "accepted") return { color: "#34d399", border: "rgba(52, 211, 153, 0.35)" };
  if (value === "pending") return { color: "#facc15", border: "rgba(250, 204, 21, 0.35)" };
  if (value === "declined" || value === "cancelled") return { color: "#f87171", border: "rgba(248, 113, 113, 0.35)" };
  if (value === "completed") return { color: "#93c5fd", border: "rgba(147, 197, 253, 0.35)" };
  return { color: "#cbd5e1", border: "rgba(203, 213, 225, 0.25)" };
}

function sortNewFirst(events) {
  return sortScheduleEvents(events);
}

function defaultForm() {
  return {
    date: new Date().toISOString().slice(0, 10),
    time: "12:30",
    clientId: "",
    note: "",
    recurrence: "none",
    recurrenceCount: 4,
  };
}

export default function Page() {
  const [events, setEvents] = useState([]);
  const [clients, setClients] = useState([]);
  const [editingId, setEditingId] = useState("");
  const [filter, setFilter] = useState("all");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [remindersEnabled, setRemindersEnabled] = useState(false);
  const [form, setForm] = useState(defaultForm());
  const [calView, setCalView] = useState("list");
  const [weekPivot, setWeekPivot] = useState(new Date().toISOString().slice(0, 10));
  const [sheetEvent, setSheetEvent] = useState(null);

  async function load() {
    const [eventsRes, clientsRes] = await Promise.all([fetch("/api/schedule/events"), fetch("/api/clients")]);
    const eventsJson = await eventsRes.json();
    const clientsJson = await clientsRes.json();

    setEvents(eventsJson?.data?.events ?? []);
    setClients(clientsJson?.data?.clients ?? []);
  }

  useEffect(() => {
    load().catch(() => {
      setEvents([]);
      setClients([]);
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
      const upcoming = sortNewFirst(events)
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
            tag: `trainer-schedule-${event.id}-${reminder.hours}`,
          });
        });
      });
    };

    scan();
    const timer = window.setInterval(scan, 30000);
    return () => window.clearInterval(timer);
  }, [events, remindersEnabled]);

  const counts = useMemo(() => {
    const by = { total: events.length, pending: 0, accepted: 0, declined: 0, cancelled: 0, completed: 0 };
    for (const event of events) {
      const status = String(event.status || "").toLowerCase();
      if (status in by) by[status] += 1;
    }
    return by;
  }, [events]);

  const pendingEvents = useMemo(
    () => sortNewFirst(events).filter((event) => String(event.status || "").toLowerCase() === "pending"),
    [events]
  );

  const visibleEvents = useMemo(() => {
    const source = filter === "all" ? events : events.filter((event) => String(event.status || "").toLowerCase() === filter);
    return sortNewFirst(source);
  }, [events, filter]);

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
    return sortNewFirst(events)
      .filter((event) => isUpcomingEvent(event))
      .filter((event) => !["declined", "cancelled", "completed"].includes(String(event.status || "").toLowerCase()))
      .slice(0, 3);
  }, [events]);

  const weekDates = useMemo(() => getWeekDates(weekPivot), [weekPivot]);

  const weekEventsByDay = useMemo(() => {
    const map = new Map(weekDates.map((d) => [isoDate(d), []]));
    for (const event of events) {
      const key = event.scheduled_date;
      if (map.has(key)) map.get(key).push(event);
    }
    return map;
  }, [events, weekDates]);

  async function enableReminders() {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setMessage("This browser does not support notifications.");
      return;
    }

    const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    if (permission !== "granted") {
      setMessage("Notifications are off. You can still use the schedule tab as your reminder list.");
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
      const selectedClient = clients.find((c) => String(c.id) === String(form.clientId));
      if (!selectedClient) throw new Error("Choose a client before saving the appointment.");

      const baseDate = normalizeScheduleDate(form.date);
      const baseBody = {
        scheduledTime: normalizeScheduleTime(form.time),
        clientId: selectedClient.id,
        clientName: selectedClient.name,
        notes: form.note,
        createdByName: "Trainer",
      };

      if (editingId) {
        const res = await fetch(`/api/schedule/events/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...baseBody, scheduledDate: baseDate }),
        });
        const json = await res.json();
        if (!res.ok || !json?.ok) throw new Error(json?.message ?? "Unable to update appointment.");
        setMessage("Appointment updated. Time changes go back to pending confirmation.");
        setEditingId("");
        setForm(defaultForm());
        await load();
        return;
      }

      // Build list of dates for recurring
      const count = form.recurrence !== "none" ? Math.max(1, Math.min(24, Number(form.recurrenceCount) || 4)) : 1;
      const dates = [baseDate];
      for (let i = 1; i < count; i++) {
        const prev = dates[dates.length - 1];
        if (form.recurrence === "weekly") dates.push(addDays(prev, 7));
        else if (form.recurrence === "biweekly") dates.push(addDays(prev, 14));
        else if (form.recurrence === "monthly") dates.push(addMonths(prev, 1));
        else break;
      }

      await Promise.all(dates.map((d) =>
        fetch("/api/schedule/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...baseBody, scheduledDate: d }),
        })
      ));

      setMessage(dates.length > 1 ? `${dates.length} recurring appointments created.` : "Appointment request sent.");
      setForm(defaultForm());
      await load();
    } catch (error) {
      setMessage(error?.message ?? "Unable to save appointment.");
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
      time: event.scheduled_time || "12:30",
      clientId: event.client_id || "",
      note: event.notes || "",
    });
  }

  return (
    <TrainerShell title="Schedule Calendar" subtitle="Simple two-way requests, confirmations, and calendar-style reminders.">
      <article className="card panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div className="filter-chip-row" style={{ flex: 1, paddingBottom: 0 }}>
            <span className="status-chip" style={{ whiteSpace: "nowrap" }}>Total {counts.total}</span>
            <span className="status-chip" style={{ color: "#facc15", whiteSpace: "nowrap" }}>Pending {counts.pending}</span>
            <span className="status-chip" style={{ color: "#34d399", whiteSpace: "nowrap" }}>Accepted {counts.accepted}</span>
            <span className="status-chip" style={{ color: "#93c5fd", whiteSpace: "nowrap" }}>Done {counts.completed}</span>
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0, marginLeft: 8 }}>
            <button type="button" className={calView === "list" ? "mint-button mint-button-sm" : "ghost-button ghost-button-sm"} onClick={() => setCalView("list")}>List</button>
            <button type="button" className={calView === "week" ? "mint-button mint-button-sm" : "ghost-button ghost-button-sm"} onClick={() => setCalView("week")}>Week</button>
          </div>
        </div>
        {calView === "list" ? (
          <div className="filter-chip-row">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                style={{ whiteSpace: "nowrap" }}
                className={f === filter ? "mint-button mint-button-sm" : "ghost-button ghost-button-sm"}
                onClick={() => setFilter(f)}
              >
                {f === "all" ? "All" : f[0].toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        ) : null}
      </article>

      {calView === "week" ? (
        <article className="card panel">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <button className="ghost-button ghost-button-sm" type="button" onClick={() => setWeekPivot(addDays(isoDate(weekDates[0]), -7))}>← Prev</button>
            <p className="item-title" style={{ margin: 0 }}>
              {weekDates[0].toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – {weekDates[6].toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </p>
            <button className="ghost-button ghost-button-sm" type="button" onClick={() => setWeekPivot(addDays(isoDate(weekDates[0]), 7))}>Next →</button>
          </div>
          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8 }}>
            {WEEK_DAYS.map((d, i) => {
              const date = weekDates[i];
              const key = isoDate(date);
              const dayEvents = weekEventsByDay.get(key) ?? [];
              const isToday = key === new Date().toISOString().slice(0, 10);
              const isSelected = key === weekPivot || (weekPivot === isoDate(weekDates[0]) && i === 0);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setWeekPivot(key)}
                  style={{
                    flex: "0 0 auto",
                    minWidth: 52,
                    borderRadius: 12,
                    border: isToday ? "1px solid var(--mint)" : "1px solid rgba(255,255,255,0.1)",
                    background: isSelected ? "rgba(45,212,191,0.15)" : "transparent",
                    padding: "8px 4px",
                    cursor: "pointer",
                    textAlign: "center",
                    position: "relative",
                  }}
                >
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: isToday ? "var(--mint)" : "#94a3b8" }}>{d}</p>
                  <p style={{ margin: "2px 0 4px", fontSize: 15, fontWeight: 700, color: isToday ? "var(--mint)" : "#e2e8f0" }}>{date.getDate()}</p>
                  {dayEvents.length > 0 ? (
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--mint)", margin: "0 auto" }} />
                  ) : <div style={{ width: 6, height: 6 }} />}
                </button>
              );
            })}
          </div>
          {(() => {
            const selectedDay = weekPivot;
            const dayEvents = weekEventsByDay.get(selectedDay) ?? [];
            const label = (() => {
              try { return new Date(selectedDay).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" }); } catch { return selectedDay; }
            })();
            return (
              <div style={{ marginTop: 12 }}>
                <p className="item-sub" style={{ marginBottom: 8, fontWeight: 600, color: "#cbd5e1" }}>{label}</p>
                {dayEvents.length === 0 ? (
                  <p className="item-sub">No appointments this day.</p>
                ) : dayEvents.map((event) => {
                  const tone = statusTone(event.status);
                  return (
                    <div key={event.id} className="list-item" style={{ marginBottom: 8, alignItems: "flex-start", borderLeft: `3px solid ${tone.color}`, paddingLeft: 10 }}>
                      <div style={{ flex: 1 }}>
                        <p className="item-title">{event.client_name || "Client"} · {formatScheduleTimeLabel(event.scheduled_time)}</p>
                        {event.notes ? <p className="item-sub">{event.notes}</p> : null}
                      </div>
                      <span className="status-chip" style={tone}>{buildScheduleActionLabel(event.status)}</span>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </article>
      ) : null}

      <article className="card panel">
        <div className="section-header" style={{ marginBottom: 10 }}>
          <div>
            <h2 style={{ marginBottom: 4 }}>Pending confirmations</h2>
            <p className="item-sub">These requests still need a response. Reschedule moves them back to pending if the time changes.</p>
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
                  <p className="item-title">{event.client_name || "Client"}</p>
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
            <p className="item-sub">Use the schedule tab as a lightweight calendar view. Browser notifications are optional.</p>
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
                  <p className="item-title">{event.client_name || "Client"}</p>
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
        <h2>{editingId ? "Reschedule appointment" : "Create appointment request"}</h2>
        <p className="item-sub" style={{ marginBottom: 10 }}>
          Keep it simple: one note, one status, and a clear confirmation state.
        </p>
        {editingId ? <p className="item-sub">Editing an existing session keeps the note and sends the time change back to pending.</p> : null}
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
              placeholder="12:30"
              type="time"
            />
          </label>
          <label className="field full">
            <span>Client</span>
            <select value={form.clientId} onChange={(e) => setForm((p) => ({ ...p, clientId: e.target.value }))}>
              <option value="">Select a client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field full">
            <span>Note for client (optional)</span>
            <textarea
              rows={2}
              value={form.note}
              onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
              placeholder="A short request note. No chat thread, just the context needed for this session."
            />
          </label>
          {!editingId ? (
            <>
              <label className="field">
                <span>Repeat</span>
                <select value={form.recurrence} onChange={(e) => setForm((p) => ({ ...p, recurrence: e.target.value }))}>
                  {RECURRENCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
              {form.recurrence !== "none" ? (
                <label className="field">
                  <span>Occurrences (max 24)</span>
                  <input
                    type="number"
                    min={2}
                    max={24}
                    value={form.recurrenceCount}
                    onChange={(e) => setForm((p) => ({ ...p, recurrenceCount: e.target.value }))}
                  />
                </label>
              ) : null}
            </>
          ) : null}
        </div>
        <div className="quick-actions" style={{ marginTop: 12, flexWrap: "wrap" }}>
          <button className="continue-btn" type="button" onClick={createOrUpdate} disabled={saving}>
            {saving ? "Saving…" : editingId ? "Update request" : form.recurrence !== "none" ? `Create ${Math.min(24, Number(form.recurrenceCount) || 4)} appointments` : "Send request"}
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
        {grouped.length === 0 ? (
          <p className="item-sub">No appointments yet.</p>
        ) : (
          grouped.map(([date, list]) => (
            <div key={date} className="metric-card" style={{ marginBottom: 10 }}>
              <p className="item-title" style={{ marginBottom: 8 }}>{formatScheduleDateLabel(date)}</p>
              {list.map((event) => {
                const tone = statusTone(event.status);
                const actionable = !["completed", "cancelled"].includes(String(event.status || "").toLowerCase());
                return (
                  <SwipeableCard
                    key={event.id}
                    disabled={!actionable}
                    onSwipeLeft={() => setSheetEvent(event)}
                    style={{ marginBottom: 8 }}
                  >
                    <div className="list-item" style={{ alignItems: "flex-start" }}>
                      <div style={{ flex: 1 }}>
                        <p className="item-title">
                          {formatScheduleTimeLabel(event.scheduled_time)} · {event.client_name || "Client"}
                        </p>
                        <p className="item-sub">Requested by {event.created_by_role || "trainer"}</p>
                        {event.notes ? <p className="item-sub">{event.notes}</p> : null}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                        <span className="status-chip" style={tone}>{buildScheduleActionLabel(event.status)}</span>
                        {actionable ? (
                          <button className="ghost-button ghost-button-sm" type="button" onClick={() => setSheetEvent(event)}>
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
            <p className="item-title" style={{ marginBottom: 4 }}>{sheetEvent.client_name || "Client"}</p>
            <p className="item-sub" style={{ marginBottom: 16 }}>
              {formatScheduleDateLabel(sheetEvent.scheduled_date)} · {formatScheduleTimeLabel(sheetEvent.scheduled_time)}
            </p>
            <div style={{ display: "grid", gap: 8 }}>
              {String(sheetEvent.status || "").toLowerCase() === "pending" ? (
                <>
                  <button className="continue-btn" type="button" onClick={() => { changeStatus(sheetEvent.id, "accepted"); setSheetEvent(null); }}>Confirm</button>
                  <button className="ghost-button" type="button" onClick={() => { changeStatus(sheetEvent.id, "declined"); setSheetEvent(null); }}>Decline</button>
                </>
              ) : null}
              {String(sheetEvent.status || "").toLowerCase() === "accepted" ? (
                <button className="continue-btn" type="button" onClick={() => { changeStatus(sheetEvent.id, "completed"); setSheetEvent(null); }}>Mark completed</button>
              ) : null}
              <button className="ghost-button" type="button" onClick={() => { editEvent(sheetEvent); setSheetEvent(null); }}>Reschedule</button>
              <button className="ghost-button" type="button" style={{ borderColor: "#7f1d1d", color: "#fecaca" }} onClick={() => { changeStatus(sheetEvent.id, "cancelled"); setSheetEvent(null); }}>Cancel appointment</button>
              <button className="ghost-button" type="button" onClick={() => setSheetEvent(null)}>Dismiss</button>
            </div>
          </div>
        </div>
      ) : null}
    </TrainerShell>
  );
}
