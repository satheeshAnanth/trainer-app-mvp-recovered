"use client";

import { useEffect, useMemo, useState } from "react";
import ClientShell from "app/_components/ClientShell";
import CollapsibleSection from "app/_components/CollapsibleSection";
import SwipeableCard from "app/_components/SwipeableCard";
import { useToast } from "app/_components/ToastProvider";
import {
  buildScheduleActionLabel,
  formatScheduleDateLabel,
  formatScheduleTimeLabel,
  getNextScheduleReminderSummary,
  normalizeScheduleDate,
  normalizeScheduleTime,
  sortScheduleEvents,
} from "app/lib/schedule";
import {
  enableScheduleReminders,
  isNativeApp,
  remindersButtonLabel,
  syncScheduleReminders,
} from "app/lib/scheduleRemindersClient";

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
  const { showToast } = useToast();
  const [sessionUser, setSessionUser] = useState(null);
  const [events, setEvents] = useState([]);
  const [editingId, setEditingId] = useState("");
  const [saving, setSaving] = useState(false);
  const [remindersEnabled, setRemindersEnabled] = useState(false);
  const [remindersNative, setRemindersNative] = useState(false);
  const [form, setForm] = useState(defaultForm());
  const [sheetEvent, setSheetEvent] = useState(null);

  async function load() {
    const [sessionRes, eventsRes] = await Promise.all([fetch("/api/client-auth/session"), fetch("/api/schedule/events")]);
    const sessionJson = await sessionRes.json();
    const eventsJson = await eventsRes.json();
    setSessionUser(sessionJson?.data?.user ?? null);
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
    isNativeApp().then(setRemindersNative).catch(() => setRemindersNative(false));
  }, []);

  useEffect(() => {
    if (!remindersEnabled) return undefined;
    let cancelled = false;
    const run = async () => {
      if (cancelled) return;
      await syncScheduleReminders({
        events,
        notifiedKeyPrefix: NOTIFIED_KEY,
        tagPrefix: "client-schedule",
      });
    };
    run();
    const timer = window.setInterval(run, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
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

  const pendingCount = useMemo(
    () => events.filter((event) => String(event.status || "").toLowerCase() === "pending").length,
    [events]
  );
  const acceptedCount = useMemo(
    () => events.filter((event) => String(event.status || "").toLowerCase() === "accepted").length,
    [events]
  );

  async function enableReminders() {
    const result = await enableScheduleReminders({ storageKey: REMINDER_KEY });
    showToast(result.message, { variant: result.ok ? "default" : "error" });
    if (result.ok) {
      setRemindersEnabled(true);
      await syncScheduleReminders({
        events,
        notifiedKeyPrefix: NOTIFIED_KEY,
        tagPrefix: "client-schedule",
      });
    }
  }

  async function createOrUpdate() {
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

      showToast(editingId ? "Request updated." : "Request sent to your trainer.");
      setEditingId("");
      setForm(defaultForm());
      await load();
    } catch (error) {
      showToast(error?.message ?? "Unable to save request.", { variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(id, status) {
    const res = await fetch(`/api/schedule/events/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const json = await res.json();
    if (!res.ok || !json?.ok) {
      showToast(json?.message ?? `Unable to set status to ${status}.`, { variant: "error" });
      return;
    }
    showToast(`Marked as ${buildScheduleActionLabel(status).toLowerCase()}.`);
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

  return (
    <ClientShell title="My Schedule" subtitle="Confirm sessions, request times, and get reminders.">
      <article className="card panel">
        <div className="filter-chip-row" style={{ marginBottom: 10 }}>
          <span className="status-chip" style={{ whiteSpace: "nowrap" }}>Total {events.length}</span>
          <span className="status-chip" style={{ color: "#facc15", whiteSpace: "nowrap" }}>Pending {pendingCount}</span>
          <span className="status-chip" style={{ color: "#34d399", whiteSpace: "nowrap" }}>Accepted {acceptedCount}</span>
        </div>
        <p className="item-sub" style={{ margin: 0 }}>
          {sessionUser?.name ? `Signed in as ${sessionUser.name}.` : "Loading your client schedule..."}
          {pendingCount > 0 ? ` ${pendingCount} waiting on a response.` : ""}
        </p>
      </article>

      <CollapsibleSection
        title="Reminders"
        subtitle="24h and 1h alerts for upcoming sessions"
        defaultOpen={false}
        badge={remindersEnabled ? "On" : null}
      >
        <button type="button" className="mint-button mint-button-sm" onClick={enableReminders} disabled={remindersEnabled}>
          {remindersButtonLabel({ enabled: remindersEnabled, native: remindersNative })}
        </button>
      </CollapsibleSection>

      <CollapsibleSection
        key={editingId || "create-request"}
        title={editingId ? "Reschedule session" : "Request a session"}
        subtitle="One note, clear confirmation — no chat thread"
        defaultOpen={Boolean(editingId)}
      >
        {editingId ? (
          <p className="item-sub" style={{ marginBottom: 10 }}>
            Editing keeps the note and returns the request to pending if the time changes.
          </p>
        ) : null}
        <div className="form-grid">
          <label className="field">
            <span>Date</span>
            <input value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} type="date" />
          </label>
          <label className="field">
            <span>Time</span>
            <input value={form.time} onChange={(e) => setForm((p) => ({ ...p, time: e.target.value }))} type="time" />
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
      </CollapsibleSection>

      <article className="card panel">
        <h2 style={{ marginBottom: 4 }}>Schedule</h2>
        <p className="item-sub" style={{ marginBottom: 12 }}>
          Swipe or tap Actions to confirm, decline, or reschedule.
        </p>
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
                        {event.notes ? <p className="item-sub">{event.notes}</p> : null}
                        {getNextScheduleReminderSummary(event) ? (
                          <p className="item-sub">{getNextScheduleReminderSummary(event)}</p>
                        ) : null}
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

      {sheetEvent ? (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(2,6,23,0.72)", zIndex: 60, display: "flex", alignItems: "flex-end" }}
          onClick={() => setSheetEvent(null)}
        >
          <div
            style={{
              width: "100%",
              background: "#0f172a",
              borderRadius: "20px 20px 0 0",
              padding: "20px 16px",
              paddingBottom: "calc(20px + env(safe-area-inset-bottom))",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ width: 40, height: 4, borderRadius: 2, background: "#334155", margin: "0 auto 16px" }} />
            <p className="item-title" style={{ marginBottom: 4 }}>{sheetEvent.event.client_name || sessionUser?.name || "Session"}</p>
            <p className="item-sub" style={{ marginBottom: 16 }}>
              {formatScheduleDateLabel(sheetEvent.event.scheduled_date)} · {formatScheduleTimeLabel(sheetEvent.event.scheduled_time)}
            </p>
            <div style={{ display: "grid", gap: 8 }}>
              {sheetEvent.ownRequest ? (
                <>
                  <button className="ghost-button" type="button" onClick={() => { editEvent(sheetEvent.event); setSheetEvent(null); }}>Reschedule</button>
                  <button
                    className="ghost-button"
                    type="button"
                    style={{ borderColor: "#7f1d1d", color: "#fecaca" }}
                    onClick={() => { changeStatus(sheetEvent.event.id, "cancelled"); setSheetEvent(null); }}
                  >
                    Cancel request
                  </button>
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
