"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import TrainerShell from "app/_components/TrainerShell";

function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + diff);
  return d;
}

function safeDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function statusChip(status) {
  const s = String(status ?? "").toLowerCase();
  if (s === "shared") return "recent-status recent-status-shared";
  return "recent-status";
}

export default function Page() {
  const [trainerName, setTrainerName] = useState("Coach");
  const [sessions, setSessions] = useState([]);
  const [clients, setClients] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [trainerRes, sessionsRes, clientsRes] = await Promise.all([
        fetch("/api/auth/session").catch(() => null),
        fetch("/api/sessions").catch(() => null),
        fetch("/api/clients").catch(() => null),
      ]);

      const trainerJson = trainerRes ? await trainerRes.json() : null;
      const sessionsJson = sessionsRes ? await sessionsRes.json() : null;
      const clientsJson = clientsRes ? await clientsRes.json() : null;

      if (cancelled) return;
      const trainer = trainerJson?.data?.user;
      if (trainer?.name) setTrainerName(trainer.name);
      setSessions(sessionsJson?.data?.sessions ?? []);
      setClients(clientsJson?.data?.clients ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const computed = useMemo(() => {
    const weekStart = startOfWeek(new Date());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    const thisWeek = sessions.filter((s) => {
      const d = safeDate(s.session_date ?? s.date);
      return d && d >= weekStart && d < weekEnd;
    }).length;

    const pendingReview = sessions.filter((s) =>
      ["client_submitted", "pending_notes"].includes(String(s.status ?? "").toLowerCase())
    ).length;

    const readyToShare = sessions.filter((s) =>
      ["completed", "trainer_review"].includes(String(s.status ?? "").toLowerCase())
    ).length;

    const clientNameById = new Map(
      clients.map((client) => [String(client?.id ?? ""), String(client?.name ?? "").trim()]).filter(([, name]) => name)
    );
    const frequency = new Map();
    for (const s of sessions) {
      const fallbackFromId = clientNameById.get(String(s.client_id ?? s.clientId ?? "")) ?? "";
      const snapshot = String(s.client_name_snapshot ?? s.clientName ?? "").trim();
      const key = snapshot || fallbackFromId || "";
      if (!key) continue;
      frequency.set(key, (frequency.get(key) ?? 0) + 1);
    }
    let mostActiveClient = "";
    let mostActiveCount = 0;
    for (const [name, count] of frequency) {
      if (count > mostActiveCount || (count === mostActiveCount && name.localeCompare(mostActiveClient) < 0)) {
        mostActiveClient = name;
        mostActiveCount = count;
      }
    }
    if (!mostActiveClient) {
      mostActiveClient = String(clients[0]?.name ?? "—");
    }

    const recentSessions = [...sessions]
      .sort((a, b) => {
        const ad = safeDate(a.session_date ?? a.created_at ?? a.date)?.getTime() ?? 0;
        const bd = safeDate(b.session_date ?? b.created_at ?? b.date)?.getTime() ?? 0;
        return bd - ad;
      })
      .slice(0, 2);

    return {
      clientsCount: clients.length,
      sessionsCount: sessions.length,
      thisWeek,
      pendingBillable: 0,
      pendingReview,
      readyToShare,
      mostActiveClient,
      mostActiveCount,
      recentSessions,
    };
  }, [clients, sessions]);
  return (
    <TrainerShell title="Trainer dashboard" subtitle="Live snapshot of your coaching pipeline and client workload">
      <article className="card panel dashboard-hero">
        <div>
          <p className="dashboard-hero-kicker">Trainer dashboard</p>
          <h2 className="dashboard-hero-title">Welcome, {trainerName}</h2>
          <p className="dashboard-hero-sub">Live snapshot of your coaching pipeline and client workload</p>
        </div>
        <Link href="/sessions/new" className="mint-button">
          + New Session
        </Link>
      </article>

      <div className="kpi-grid">
        <article className="kpi-card">
          <p className="kpi-label">Clients</p>
          <p className="kpi-value">{computed.clientsCount}</p>
        </article>
        <article className="kpi-card">
          <p className="kpi-label">Sessions</p>
          <p className="kpi-value">{computed.sessionsCount}</p>
        </article>
        <article className="kpi-card">
          <p className="kpi-label">This week</p>
          <p className="kpi-value">{computed.thisWeek}</p>
        </article>
        <article className="kpi-card">
          <p className="kpi-label">Pending billable sessions</p>
          <p className="kpi-value">{computed.pendingBillable}</p>
        </article>
      </div>

      <div className="kpi-grid">
        <article className="kpi-card">
          <p className="item-title">Pending review</p>
          <p className="kpi-value" style={{ fontSize: 36 }}>{computed.pendingReview}</p>
          <p className="item-sub">Client-submitted or note updates needing trainer action</p>
        </article>
        <article className="kpi-card">
          <p className="item-title">Ready to share</p>
          <p className="kpi-value" style={{ fontSize: 36 }}>{computed.readyToShare}</p>
          <p className="item-sub">Prepared sessions waiting for publish approval</p>
        </article>
        <article className="kpi-card">
          <p className="item-title">Most active client</p>
          <p className="kpi-value" style={{ fontSize: 36 }}>{computed.mostActiveClient}</p>
          <p className="item-sub">{computed.mostActiveCount} logged sessions</p>
        </article>
      </div>

      <article className="card panel">
        <h2>Schedule requests</h2>
        <p className="panel-value" style={{ fontSize: 40 }}>No pending requests</p>
      </article>

      <article className="card panel">
        <h2>Recent sessions</h2>
        <div className="list">
          {computed.recentSessions.length === 0 ? (
            <p className="item-sub">No sessions yet.</p>
          ) : (
            computed.recentSessions.map((s) => (
              <div className="recent-session-row" key={s.id}>
                <div>
                  <p className="item-title">
                    Session on {String(s.session_date ?? s.date ?? "").slice(0, 10)}
                  </p>
                  <p className="item-sub">
                    {s.client_name_snapshot ?? "Client"} · {String(s.session_date ?? s.date ?? "").slice(0, 10)}
                  </p>
                </div>
                <span className={statusChip(s.status)}>{String(s.status ?? "draft").replace("_", " ")}</span>
              </div>
            ))
          )}
        </div>
      </article>
    </TrainerShell>
  );
}
