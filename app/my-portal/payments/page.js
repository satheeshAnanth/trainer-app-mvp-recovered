"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ClientShell from "app/_components/ClientShell";
import { formatSessionDateShort, listOutstandingPayments, normalizeClientSession, sumPayments } from "app/lib/clientDashboard";

export default function Page() {
  const [sessions, setSessions] = useState([]);
  const [clientName, setClientName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [authRes, sessionsRes] = await Promise.all([fetch("/api/client-auth/session"), fetch("/api/client/sessions")]);
        const authJson = authRes.ok ? await authRes.json() : null;
        const sessJson = sessionsRes.ok ? await sessionsRes.json() : null;

        if (cancelled) return;

        setClientName(String(authJson?.data?.user?.name ?? ""));
        setSessions(Array.isArray(sessJson?.data?.sessions) ? sessJson.data.sessions : []);
      } catch {
        if (!cancelled) {
          setSessions([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const normalized = useMemo(() => sessions.map(normalizeClientSession).filter(Boolean), [sessions]);
  const outstanding = useMemo(() => listOutstandingPayments(normalized), [normalized]);
  const dueTotal = sumPayments(outstanding);
  const paidRows = useMemo(
    () =>
      [...normalized]
        .filter((session) => Number(session.amount) > 0 && session.paid === true)
        .sort((a, b) => new Date(b.sessionDate ?? b.updated_at ?? b.created_at ?? 0).getTime() - new Date(a.sessionDate ?? a.updated_at ?? a.created_at ?? 0).getTime())
        .slice(0, 4),
    [normalized]
  );

  return (
    <ClientShell
      title="Payments"
      subtitle={clientName ? `Track what is due for your sessions, ${clientName.split(/\s+/)[0]}.` : "Track what is due for your sessions."}
    >
      <section className="card panel" style={{ borderLeft: "4px solid var(--mint)" }}>
        <p className="eyebrow" style={{ marginTop: 0 }}>
          Payment overview
        </p>
        <div className="quick-actions" style={{ marginTop: 14 }}>
          <Link className="mint-button mint-button-sm" href="/my-portal">
            Back to dashboard
          </Link>
          <Link className="ghost-button ghost-button-sm" href="/my-portal/schedule">
            Open schedule
          </Link>
        </div>
      </section>

      <div
        style={{
          display: "grid",
          gap: 14,
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
        }}
      >
        <article className="card panel">
          <p className="eyebrow" style={{ marginTop: 0 }}>
            Outstanding total
          </p>
          <p className="panel-value" style={{ fontSize: 30 }}>
            ₹{Math.round(dueTotal).toLocaleString("en-IN")}
          </p>
          <p className="item-sub" style={{ marginBottom: 0 }}>
            {outstanding.length} session{outstanding.length === 1 ? "" : "s"} pending.
          </p>
        </article>

        <article className="card panel">
          <p className="eyebrow" style={{ marginTop: 0 }}>
            Current status
          </p>
          <p className="panel-value" style={{ fontSize: 30 }}>
            {outstanding.length === 0 ? "Clear" : "Pending"}
          </p>
          <p className="item-sub" style={{ marginBottom: 0 }}>
            {loading ? "Loading payment history…" : outstanding.length === 0 ? "No open fees right now." : "Session fees are waiting on your trainer's request."}
          </p>
        </article>
      </div>

      <article className="card panel">
        <h2>Open items</h2>
        {outstanding.length === 0 ? (
          <p className="item-sub" style={{ marginBottom: 0 }}>
            When your trainer requests payment for a session, the amount will appear here with the session context.
          </p>
        ) : (
          <ul className="list">
            {outstanding.map((line) => {
              const related = normalized.find((session) => session.id === line.sessionId) ?? null;
              return (
                <li key={line.sessionId} className="list-item" style={{ alignItems: "flex-start" }}>
                  <div>
                    <p className="item-title">{line.title}</p>
                    <p className="item-sub">{formatSessionDateShort(related?.sessionDate) || "Date TBD"} · Session fee</p>
                    {related?.status ? <p className="item-sub" style={{ marginTop: 4 }}>Status: {related.status}</p> : null}
                  </div>
                  <span className="status-chip" style={{ color: "#f97316" }}>
                    ₹{Math.round(line.amountInr).toLocaleString("en-IN")}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </article>

      <article className="card panel">
        <h2>Recent settled sessions</h2>
        {paidRows.length === 0 ? (
          <p className="item-sub" style={{ marginBottom: 0 }}>
            Paid sessions will show here once a fee is settled.
          </p>
        ) : (
          <ul className="list">
            {paidRows.map((session) => (
              <li key={session.id} className="list-item" style={{ alignItems: "flex-start" }}>
                <div>
                  <p className="item-title">{session.sessionTitle}</p>
                  <p className="item-sub">{formatSessionDateShort(session.sessionDate) || "Date TBD"}</p>
                </div>
                <span className="status-chip" style={{ color: "#4ade80" }}>
                  ₹{Math.round(Number(session.amount) || 0).toLocaleString("en-IN")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </article>
    </ClientShell>
  );
}
