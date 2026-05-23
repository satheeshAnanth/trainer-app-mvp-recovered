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
        <div className="quick-actions" style={{ marginBottom: 10, flexWrap: "wrap" }}>
          <span className="status-chip">Total {counts.total}</span>
          <span className="status-chip" style={{ color: "#facc15" }}>Pending {counts.pending}</span>
          <span className="status-chip" style={{ color: "#34d399" }}>Accepted {counts.accepted}</span>
          <span className="status-chip" style={{ color: "#93c5fd" }}>Completed {counts.completed}</span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
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
                className={f === filter ? "mint-button mint-button-sm" : "ghost-button ghost-button-sm"}
                onClick={() => setFilter(f)}
              >
                {f === "all" ? "All statuses" : f[0].toUpperCase() + f.slice(1)}
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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
            {WEEK_DAYS.map((d, i) => {
              const date = weekDates[i];
              const key = isoDate(date);
              const dayEvents = weekEventsByDay.get(key) ?? [];
              const isToday = key === new Date().toISOString().slice(0, 10);
              return (
                <div key={key} style={{ minHeight: 80, borderRadius: 6, border: isToday ? "1px solid var(--mint)" : "1px solid rgba(255,255,255,0.08)", padding: "6px 4px" }}>
                  <p className="item-sub" style={{ margin: "0 0 4px", textAlign: "center", color: isToday ? "var(--mint)" : "#94a3b8", fontSize: 11, fontWeight: 600 }}>
                    {d}<br />{date.getDate()}
                  </p>
                  {dayEvents.slice(0, 3).map((event) => {
                    const tone = statusTone(event.status);
                    return (
                      <div key={event.id} style={{ background: "rgba(255,255,255,0.05)", borderLeft: `3px solid ${tone.color}`, borderRadius: 3, padding: "3px 5px", marginBottom: 3 }}>
                        <p style={{ margin: 0, fontSize: 10, color: "#e2e8f0", lineHeight: 1.3, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                          {formatScheduleTimeLabel(event.scheduled_time)} {event.client_name || "Client"}
                        </p>
                      </div>
                    );
                  })}
                  {dayEvents.length > 3 ? <p className="item-sub" style={{ margin: 0, fontSize: 10, textAlign: "center" }}>+{dayEvents.length - 3}</p> : null}
                </div>
              );
            })}
          </div>
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
                const canEdit = !["completed"].includes(String(event.status || "").toLowerCase());
                const isPending = String(event.status || "").toLowerCase() === "pending";
                return (
                  <div key={event.id} className="list-item" style={{ marginBottom: 8, alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                      <p className="item-title">
                        {formatScheduleTimeLabel(event.scheduled_time)} · {event.client_name || "Client"}
                      </p>
                      <p className="item-sub">Requested by {event.created_by_role || "trainer"}</p>
                      {event.notes ? <p className="item-sub">{event.notes}</p> : null}
                      {getNextScheduleReminderSummary(event) ? <p className="item-sub">{getNextScheduleReminderSummary(event)}</p> : null}
                    </div>
                    <div className="quick-actions" style={{ flexDirection: "column", alignItems: "stretch", minWidth: 120 }}>
                      <span className="status-chip" style={tone}>{buildScheduleActionLabel(event.status)}</span>
                      {isPending ? (
                        <>
                          <button className="ghost-button ghost-button-sm" type="button" onClick={() => changeStatus(event.id, "accepted")}>
                            Confirm
                          </button>
                          <button className="ghost-button ghost-button-sm" type="button" onClick={() => changeStatus(event.id, "declined")}>
                            Decline
                          </button>
                        </>
                      ) : null}
                      {canEdit ? (
                        <button className="ghost-button ghost-button-sm" type="button" onClick={() => editEvent(event)}>
                          Reschedule
                        </button>
                      ) : null}
                      {!isPending && String(event.status || "").toLowerCase() === "accepted" ? (
                        <button className="ghost-button ghost-button-sm" type="button" onClick={() => changeStatus(event.id, "completed")}>
                          Complete
                        </button>
                      ) : null}
                      <button
                        className="ghost-button ghost-button-sm"
                        type="button"
                        style={{ borderColor: "#7f1d1d", color: "#fecaca" }}
                        onClick={() => changeStatus(event.id, "cancelled")}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </article>

      {message ? <p className="item-sub">{message}</p> : null}
    </TrainerShell>
  );
}
