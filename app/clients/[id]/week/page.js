"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import TrainerShell from "app/_components/TrainerShell";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getWeekDates(pivot) {
  const d = new Date(pivot);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + diff);
  return Array.from({ length: 7 }, (_, i) => {
    const c = new Date(d);
    c.setDate(d.getDate() + i);
    return c;
  });
}

function isoDate(d) { return d.toISOString().slice(0, 10); }
function addDays(str, n) { const d = new Date(str); d.setDate(d.getDate() + n); return isoDate(d); }

export default function Page() {
  const { id } = useParams();
  const [client, setClient] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [events, setEvents] = useState([]);
  const [pivot, setPivot] = useState(new Date().toISOString().slice(0, 10));
  const [selectedDay, setSelectedDay] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetch(`/api/clients/${id}`).then((r) => r.json()),
      fetch(`/api/sessions?clientId=${id}`).then((r) => r.json()),
      fetch(`/api/schedule/events`).then((r) => r.json()),
    ])
      .then(([cJson, sJson, eJson]) => {
        setClient(cJson?.data?.client ?? null);
        setSessions(Array.isArray(sJson?.data?.sessions) ? sJson.data.sessions : []);
        const allEvents = Array.isArray(eJson?.data?.events) ? eJson.data.events : [];
        setEvents(allEvents.filter((e) => e.client_id === id));
      })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [id]);

  const weekDates = useMemo(() => getWeekDates(pivot), [pivot]);

  const dayData = useMemo(() => {
    return weekDates.map((date) => {
      const key = isoDate(date);
      const daySessions = sessions.filter((s) => {
        const d = String(s.session_date ?? s.sessionDate ?? "").slice(0, 10);
        return d === key;
      });
      const dayEvents = events.filter((e) => String(e.scheduled_date ?? "").slice(0, 10) === key);
      return { key, date, sessions: daySessions, events: dayEvents };
    });
  }, [weekDates, sessions, events]);

  const selected = useMemo(() => dayData.find((d) => d.key === selectedDay) ?? null, [dayData, selectedDay]);

  if (loading) {
    return (
      <TrainerShell title="This week" subtitle="">
        <article className="card panel"><p className="item-sub">Loading…</p></article>
      </TrainerShell>
    );
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <TrainerShell title={client?.name ? `${client.name} — this week` : "This week"} subtitle="">
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <Link className="ghost-button ghost-button-sm" href={`/clients/${id}`}>← Back</Link>
      </div>

      <article className="card panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <button className="ghost-button ghost-button-sm" type="button" onClick={() => { setPivot(addDays(isoDate(weekDates[0]), -7)); setSelectedDay(null); }}>← Prev</button>
          <p className="item-sub" style={{ margin: 0, fontWeight: 600 }}>
            {weekDates[0].toLocaleDateString("en-IN", { day: "numeric", month: "short" })} –{" "}
            {weekDates[6].toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
          </p>
          <button className="ghost-button ghost-button-sm" type="button" onClick={() => { setPivot(addDays(isoDate(weekDates[0]), 7)); setSelectedDay(null); }}>Next →</button>
        </div>

        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8 }}>
          {dayData.map(({ key, date, sessions: ds, events: de }, i) => {
            const isToday = key === today;
            const isSelected = key === selectedDay;
            const hasSessions = ds.length > 0;
            const hasEvents = de.length > 0;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedDay(isSelected ? null : key)}
                style={{
                  flex: "0 0 auto", minWidth: 52, borderRadius: 12, padding: "8px 4px",
                  border: isToday ? "1px solid var(--mint)" : "1px solid rgba(255,255,255,0.1)",
                  background: isSelected ? "rgba(45,212,191,0.15)" : "transparent",
                  cursor: "pointer", textAlign: "center",
                }}
              >
                <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: isToday ? "var(--mint)" : "#94a3b8" }}>{DAYS[i]}</p>
                <p style={{ margin: "2px 0 6px", fontSize: 15, fontWeight: 700, color: isToday ? "var(--mint)" : "#e2e8f0" }}>{date.getDate()}</p>
                <div style={{ display: "flex", gap: 3, justifyContent: "center" }}>
                  {hasSessions && <div style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--mint)" }} title="Session logged" />}
                  {hasEvents && <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#facc15" }} title="Appointment" />}
                  {!hasSessions && !hasEvents && <div style={{ width: 7, height: 7 }} />}
                </div>
              </button>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--mint)", display: "inline-block" }} />
            <span className="item-sub" style={{ fontSize: 12 }}>Session</span>
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#facc15", display: "inline-block" }} />
            <span className="item-sub" style={{ fontSize: 12 }}>Appointment</span>
          </span>
        </div>
      </article>

      {selected ? (
        <article className="card panel">
          <h2>{selected.date.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</h2>

          {selected.sessions.length === 0 && selected.events.length === 0 ? (
            <p className="item-sub">Nothing logged for this day.</p>
          ) : null}

          {selected.sessions.map((s) => (
            <div key={s.id} className="metric-card" style={{ marginBottom: 10, borderLeft: "3px solid var(--mint)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <p className="item-title">{s.session_title || "Session"}</p>
                  <span className="status-chip" style={{ color: s.status === "completed" ? "#34d399" : "#facc15", marginTop: 4, display: "inline-block" }}>
                    {String(s.status ?? "draft").replace(/_/g, " ")}
                  </span>
                </div>
                <Link className="ghost-button ghost-button-sm" href={`/sessions/${s.id}`}>View</Link>
              </div>
            </div>
          ))}

          {selected.events.map((e) => (
            <div key={e.id} className="metric-card" style={{ marginBottom: 10, borderLeft: "3px solid #facc15" }}>
              <p className="item-title">{e.scheduled_time ? e.scheduled_time.slice(0, 5) : ""} Appointment</p>
              <span className="status-chip" style={{ color: "#facc15", marginTop: 4, display: "inline-block" }}>
                {String(e.status ?? "pending")}
              </span>
              {e.notes ? <p className="item-sub" style={{ marginTop: 6 }}>{e.notes}</p> : null}
            </div>
          ))}
        </article>
      ) : (
        <article className="card panel">
          <p className="item-sub">Tap a day to see what was logged.</p>
        </article>
      )}
    </TrainerShell>
  );
}
