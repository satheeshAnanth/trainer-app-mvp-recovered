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
  const [loaded, setLoaded] = useState(false);

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
      setLoaded(true);
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

    const pendingBillable = sessions.filter((s) => {
      try {
        const payload = typeof s.payload_json === "string" ? JSON.parse(s.payload_json) : (s.payload_json ?? {});
        const amount = payload?.payment?.amountInr;
        return amount && Number(amount) > 0 && !payload?.paymentReceived;
      } catch {
        return false;
      }
    }).length;

    // Retention signals
    const now = Date.now();
    const STALE_MS = 14 * 24 * 60 * 60 * 1000;
    const STUCK_MS = 7 * 24 * 60 * 60 * 1000;

    const lastSessionByClientId = new Map();
    for (const s of sessions) {
      const cid = String(s.client_id ?? "");
      if (!cid) continue;
      const d = safeDate(s.session_date ?? s.updated_at)?.getTime() ?? 0;
      if (!lastSessionByClientId.has(cid) || d > lastSessionByClientId.get(cid)) {
        lastSessionByClientId.set(cid, d);
      }
    }
    const staleClients = clients.filter((c) => {
      const last = lastSessionByClientId.get(String(c.id ?? ""));
      return last && now - last > STALE_MS;
    });
    const noSessionClients = clients.filter((c) => !lastSessionByClientId.has(String(c.id ?? "")));
    const stuckSessions = sessions.filter((s) => {
      const status = String(s.status ?? "").toLowerCase();
      if (!["draft", "pending_notes"].includes(status)) return false;
      const updated = safeDate(s.updated_at ?? s.created_at)?.getTime() ?? now;
      return now - updated > STUCK_MS;
    });

    return {
      clientsCount: clients.length,
      sessionsCount: sessions.length,
      thisWeek,
      pendingBillable,
      pendingReview,
      readyToShare,
      mostActiveClient,
      mostActiveCount,
      recentSessions,
      staleClients,
      noSessionClients,
      stuckSessions,
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
        <article className="kpi-card" style={{ cursor: "pointer" }}>
          <Link href="/revenue" style={{ textDecoration: "none", display: "block" }}>
            <p className="kpi-label">Pending billable</p>
            <p className="kpi-value" style={{ color: computed.pendingBillable > 0 ? "#facc15" : undefined }}>{computed.pendingBillable}</p>
            <p className="item-sub" style={{ marginTop: 4, color: "var(--mint)", fontSize: 11 }}>Open revenue →</p>
          </Link>
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

      {loaded && (computed.staleClients.length > 0 || computed.noSessionClients.length > 0 || computed.stuckSessions.length > 0) ? (
        <article className="card panel" style={{ borderLeft: "4px solid #f59e0b" }}>
          <h2 style={{ marginBottom: 12 }}>Needs attention</h2>
          {computed.staleClients.length > 0 ? (
            <div className="metric-card" style={{ marginBottom: 10 }}>
              <p className="item-title">No session in 14+ days</p>
              <div className="list" style={{ marginTop: 8 }}>
                {computed.staleClients.slice(0, 5).map((c) => (
                  <div key={c.id} className="list-item">
                    <p className="item-title">{c.name}</p>
                    <Link href={`/clients/${c.id}`} className="ghost-button ghost-button-sm">View</Link>
                  </div>
                ))}
                {computed.staleClients.length > 5 ? <p className="item-sub">+{computed.staleClients.length - 5} more</p> : null}
              </div>
            </div>
          ) : null}
          {computed.noSessionClients.length > 0 ? (
            <div className="metric-card" style={{ marginBottom: 10 }}>
              <p className="item-title">Added but no sessions yet</p>
              <div className="list" style={{ marginTop: 8 }}>
                {computed.noSessionClients.slice(0, 3).map((c) => (
                  <div key={c.id} className="list-item">
                    <p className="item-title">{c.name}</p>
                    <Link href="/sessions/new" className="ghost-button ghost-button-sm">Log session</Link>
                  </div>
                ))}
                {computed.noSessionClients.length > 3 ? <p className="item-sub">+{computed.noSessionClients.length - 3} more</p> : null}
              </div>
            </div>
          ) : null}
          {computed.stuckSessions.length > 0 ? (
            <div className="metric-card">
              <p className="item-title">Sessions stuck in draft/pending for 7+ days</p>
              <div className="list" style={{ marginTop: 8 }}>
                {computed.stuckSessions.slice(0, 3).map((s) => (
                  <div key={s.id} className="list-item">
                    <div>
                      <p className="item-title">{s.session_title || "Untitled"}</p>
                      <p className="item-sub">{s.client_name_snapshot || "Client"} · {String(s.status ?? "").replace("_", " ")}</p>
                    </div>
                    <Link href={`/sessions/${s.id}`} className="ghost-button ghost-button-sm">Open</Link>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </article>
      ) : null}

      {loaded && clients.length === 0 && sessions.length === 0 ? (
        <article className="card panel" style={{ borderLeft: "4px solid var(--mint)", background: "linear-gradient(135deg, rgba(45,212,191,0.08), transparent)" }}>
          <p className="eyebrow" style={{ marginTop: 0 }}>Get started</p>
          <h2 style={{ marginBottom: 4 }}>Welcome to your trainer portal</h2>
          <p className="item-sub" style={{ marginBottom: 16 }}>Three steps to get your practice running:</p>
          <div style={{ display: "grid", gap: 10 }}>
            {[
              { step: "1", title: "Add your first client", sub: "Enter their name, goal, and mobile number.", href: "/clients", label: "Add client" },
              { step: "2", title: "Log a session", sub: "Record exercises, sets, and coach notes.", href: "/sessions/new", label: "New session" },
              { step: "3", title: "Invite the client", sub: "Send a link so they can view their own portal.", href: "/clients", label: "Go to clients" },
            ].map(({ step, title, sub, href, label }) => (
              <div key={step} className="list-item" style={{ alignItems: "flex-start", gap: 14 }}>
                <span className="status-chip" style={{ color: "var(--mint)", borderColor: "rgba(45,212,191,0.35)", minWidth: 28, textAlign: "center", fontWeight: 700 }}>{step}</span>
                <div style={{ flex: 1 }}>
                  <p className="item-title">{title}</p>
                  <p className="item-sub">{sub}</p>
                </div>
                <Link href={href} className="ghost-button ghost-button-sm">{label}</Link>
              </div>
            ))}
          </div>
        </article>
      ) : null}

      <article className="card panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>Schedule requests</h2>
          <Link href="/schedule" className="ghost-button ghost-button-sm">Open schedule</Link>
        </div>
        {computed.pendingReview > 0 ? (
          <p className="panel-value" style={{ fontSize: 36, color: "#facc15" }}>{computed.pendingReview} pending</p>
        ) : (
          <p className="panel-value" style={{ fontSize: 36 }}>All clear</p>
        )}
        <p className="item-sub">Go to Schedule to confirm or reschedule appointments.</p>
      </article>

      <article className="card panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>Recent sessions</h2>
          <Link href="/sessions" className="ghost-button ghost-button-sm">All sessions</Link>
        </div>
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
