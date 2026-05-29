"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import TrainerShell from "app/_components/TrainerShell";
import { buildProfileSafetyPlan } from "app/lib/coachSafety";

function safeTime(value) {
  const d = new Date(value ?? "");
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

function sessionStatusChipClass(status) {
  const s = String(status ?? "").toLowerCase();
  if (s === "completed" || s === "shared") return "status-chip session-status-completed";
  if (s === "pending_notes" || s === "client_submitted" || s === "trainer_review") {
    return "status-chip session-status-pending";
  }
  if (s === "cancelled" || s === "rejected") return "status-chip session-status-cancelled";
  return "status-chip session-status-draft";
}

export default function Page() {
  const params = useParams();
  const clientId = useMemo(() => String(params?.id ?? ""), [params]);
  const [client, setClient] = useState(null);
  const [tips, setTips] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [hasTemplate, setHasTemplate] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    (async () => {
      const [clientRes, tipsRes, sessionsRes, templateRes] = await Promise.all([
        fetch(`/api/clients/${clientId}`),
        fetch(`/api/clients/${clientId}/tips`),
        fetch("/api/sessions"),
        fetch(`/api/clients/${clientId}/goal-template`),
      ]);
      const clientJson = await clientRes.json();
      const tipsJson = await tipsRes.json();
      const sessionsJson = await sessionsRes.json();
      const templateJson = await templateRes.json();
      if (cancelled) return;
      setClient(clientJson?.data?.client ?? null);
      setTips(tipsJson?.data?.tips ?? []);
      const allSessions = sessionsJson?.data?.sessions ?? [];
      setSessions(allSessions.filter((s) => s.client_id === clientId));
      setHasTemplate((templateJson?.data?.goalTemplate?.exercises ?? []).length > 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  const latestSessions = useMemo(() => {
    return [...sessions].sort((a, b) => {
      const ad = safeTime(a.session_date ?? a.date ?? a.updated_at ?? a.created_at);
      const bd = safeTime(b.session_date ?? b.date ?? b.updated_at ?? b.created_at);
      return bd - ad;
    });
  }, [sessions]);

  const safetyPlan = useMemo(
    () =>
      buildProfileSafetyPlan({
        goalText: client?.goal ?? "",
        priorCondition: client?.prior_condition ?? client?.priorCondition ?? "",
      }),
    [client]
  );

  return (
    <TrainerShell title={client?.name || "Client"} subtitle="Client summary and progress actions">
      <article className="card panel client-detail-card">
        <div className="client-detail-head">
          <h2>{client?.name || "Client"}</h2>
          <Link href="/sessions/new" className="mint-button">+ New Session</Link>
          <Link href={`/clients/${clientId}/week`} className="ghost-button ghost-button-sm">This week</Link>
        </div>
        <div className="client-detail-rows">
          <div className="client-detail-row"><span>Goal</span><strong>{client?.goal || "Not set"}</strong></div>
          <div className="client-detail-row"><span>Prior conditions / injuries</span><strong>{client?.prior_condition || client?.priorCondition || "-"}</strong></div>
          <div className="client-detail-row"><span>Mobile</span><strong>{client?.mobile || "-"}</strong></div>
          <div className="client-detail-row"><span>Age</span><strong>{client?.age ? `${client.age} yrs` : "-"}</strong></div>
          <div className="client-detail-row"><span>Weight</span><strong>{client?.weight_kg ? `${client.weight_kg} kg` : "-"}</strong></div>
          <div className="client-detail-row"><span>Height</span><strong>{client?.height_cm ? `${client.height_cm} cm` : "-"}</strong></div>
          <div className="client-detail-row"><span>Gender</span><strong>{client?.gender || "-"}</strong></div>
        </div>
      </article>

      <article className="card panel client-detail-card">
        <div className="client-detail-head">
          <h2>Suggested routine</h2>
          <span className="status-chip">Coach guidance</span>
        </div>
        <p className="item-title" style={{ marginTop: 0 }}>{safetyPlan.title}</p>
        <p className="item-sub" style={{ marginTop: 6 }}>{safetyPlan.note}</p>
        {safetyPlan.blocks.length > 0 ? (
          <ul className="list" style={{ marginTop: 12 }}>
            {safetyPlan.blocks.map((block) => (
              <li key={`${block.title}-${block.text}`} className="list-item" style={{ alignItems: "flex-start" }}>
                <div>
                  <p className="item-title">{block.title}</p>
                  <p className="item-sub" style={{ marginTop: 4 }}>{block.text}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
        {safetyPlan.warnings.length > 0 ? (
          <div className="metric-card" style={{ marginTop: 12, borderLeft: "4px solid #f59e0b" }}>
            <p className="item-title" style={{ marginTop: 0 }}>Exercise caution</p>
            <ul className="list" style={{ marginTop: 8 }}>
              {safetyPlan.warnings.map((warning) => (
                <li key={warning.label} className="list-item" style={{ alignItems: "flex-start" }}>
                  <div>
                    <p className="item-title">{warning.label}</p>
                    <p className="item-sub" style={{ marginTop: 4 }}>{warning.message}</p>
                    <p className="item-sub" style={{ marginTop: 4, color: "#94a3b8" }}>
                      Alternatives: {warning.alternatives.join(", ")}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </article>

      <article className="card panel client-detail-card">
        <div className="client-detail-head">
          <h2>Goal progress</h2>
          <Link href={`/clients/${clientId}/goal-template`} className="ghost-button">Edit template</Link>
        </div>
        {!hasTemplate ? (
          <p className="item-sub client-warning-text">
            No goal template set. Configure to track progress each session.
          </p>
        ) : (
          <p className="item-sub">Template configured. Mandatory updates are enabled for this client.</p>
        )}
      </article>

      <article className="card panel client-detail-card">
        <div className="client-detail-head">
          <h2>Trainer tips</h2>
          <Link href={`/clients/${clientId}/tips`} className="ghost-button">History</Link>
        </div>
        <p className="item-sub">{tips.length === 0 ? "No tips sent yet." : `${tips.length} tips available.`}</p>
      </article>

      <article className="card panel client-detail-card">
        <h2>Sessions</h2>
        {latestSessions.length === 0 ? (
          <p className="item-sub">No sessions yet.</p>
        ) : (
          <ul className="list" style={{ marginTop: 10 }}>
            {latestSessions.map((s) => (
              <li key={s.id} className="list-item" style={{ alignItems: "flex-start" }}>
                <Link
                  href={`/sessions/${s.id}`}
                  style={{ textDecoration: "none", color: "inherit", display: "block", width: "100%" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                    <p className="item-title">{s.session_title || s.title || "Session"}</p>
                    <span className={sessionStatusChipClass(s.status)}>
                      {String(s.status || "draft").replaceAll("_", " ")}
                    </span>
                  </div>
                  <p className="item-sub">{String(s.session_date || s.date || "").slice(0, 10) || "No date"}</p>
                  {(s.raw_notes_preview || s.summary) ? (
                    <p className="item-sub" style={{ marginTop: 6 }}>
                      {String(s.raw_notes_preview || s.summary).slice(0, 120)}
                    </p>
                  ) : null}
                  <p className="item-sub" style={{ marginTop: 8, color: "#5eead4" }}>
                    Tap to view exercises and notes
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </article>
    </TrainerShell>
  );
}
