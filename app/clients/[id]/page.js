"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import TrainerShell from "app/_components/TrainerShell";

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

  return (
    <TrainerShell title={client?.name || "Client"} subtitle="Client summary and progress actions">
      <article className="card panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2>{client?.name || "Client"}</h2>
          <Link href="/sessions/new" className="mint-button">+ New Session</Link>
        </div>
        <ul className="list" style={{ marginTop: 10 }}>
          <li className="list-item"><span>Goal</span><span>{client?.goal || "Not set"}</span></li>
          <li className="list-item"><span>Mobile</span><span>{client?.mobile || "-"}</span></li>
          <li className="list-item"><span>Age</span><span>{client?.age ? `${client.age} yrs` : "-"}</span></li>
          <li className="list-item"><span>Weight</span><span>{client?.weight_kg ? `${client.weight_kg} kg` : "-"}</span></li>
          <li className="list-item"><span>Height</span><span>{client?.height_cm ? `${client.height_cm} cm` : "-"}</span></li>
          <li className="list-item"><span>Gender</span><span>{client?.gender || "-"}</span></li>
        </ul>
      </article>

      <article className="card panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2>Goal progress</h2>
          <Link href={`/clients/${clientId}/goal-template`} className="ghost-button">Edit template</Link>
        </div>
        {!hasTemplate ? (
          <p className="item-sub" style={{ color: "#facc15" }}>
            No goal template set. Configure to track progress each session.
          </p>
        ) : (
          <p className="item-sub">Template configured. Mandatory updates are enabled for this client.</p>
        )}
      </article>

      <article className="card panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2>Trainer tips</h2>
          <Link href={`/clients/${clientId}/tips`} className="ghost-button">History</Link>
        </div>
        <p className="item-sub">{tips.length === 0 ? "No tips sent yet." : `${tips.length} tips available.`}</p>
      </article>

      <article className="card panel">
        <h2>Sessions</h2>
        <p className="item-sub">{sessions.length === 0 ? "No sessions yet." : `${sessions.length} sessions`}</p>
      </article>
    </TrainerShell>
  );
}
