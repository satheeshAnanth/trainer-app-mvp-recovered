"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import TrainerShell from "app/_components/TrainerShell";
import CollapsibleSection from "app/_components/CollapsibleSection";
import { useToast } from "app/_components/ToastProvider";
import { useModalDismiss } from "app/_components/useModalDismiss";

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
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    goal: "",
    prior_condition: "",
    age: "",
    weight_kg: "",
    height_cm: "",
    gender: "",
    activity_level: "",
  });
  const { showToast } = useToast();
  const closeEdit = useCallback(() => setEditOpen(false), []);
  useModalDismiss(editOpen, closeEdit);

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
      const loadedClient = clientJson?.data?.client ?? null;
      setClient(loadedClient);
      setEditForm({
        name: loadedClient?.name ?? "",
        goal: loadedClient?.goal ?? "",
        prior_condition: loadedClient?.prior_condition ?? loadedClient?.priorCondition ?? "",
        age: loadedClient?.age ?? "",
        weight_kg: loadedClient?.weight_kg ?? "",
        height_cm: loadedClient?.height_cm ?? "",
        gender: loadedClient?.gender ?? "",
        activity_level: loadedClient?.activity_level ?? "",
      });
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

  async function saveClient() {
    setSaving(true);
    try {
      const response = await fetch(`/api/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const json = await response.json();
      if (!response.ok || !json?.ok) throw new Error(json?.message ?? "Unable to update client.");
      setClient(json.data.client);
      setEditOpen(false);
      showToast("Client profile updated.");
    } catch (error) {
      showToast(error?.message ?? "Unable to update client.", { variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <TrainerShell title={client?.name || "Client"} subtitle="Client summary and progress actions">
      <article className="card panel client-detail-card">
        <div className="client-detail-head">
          <h2>{client?.name || "Client"}</h2>
          <div className="client-detail-actions">
            <button type="button" className="ghost-button ghost-button-sm" onClick={() => setEditOpen(true)}>Edit client</button>
            <Link href={`/sessions/new?clientId=${encodeURIComponent(clientId)}`} className="mint-button">+ New Session</Link>
            <Link href={`/clients/${clientId}/week`} className="ghost-button ghost-button-sm">This week</Link>
          </div>
        </div>
        <div className="client-detail-rows">
          <div className="client-detail-row"><span>Goal</span><strong>{client?.goal || "Not set"}</strong></div>
          <div className="client-detail-row"><span>Prior conditions / injuries</span><strong>{client?.prior_condition || client?.priorCondition || "-"}</strong></div>
          <div className="client-detail-row"><span>Mobile</span><strong>{client?.mobile || "-"}</strong></div>
          <div className="client-detail-row"><span>Age</span><strong>{client?.age ? `${client.age} yrs` : "-"}</strong></div>
          <div className="client-detail-row"><span>Weight</span><strong>{client?.weight_kg ? `${client.weight_kg} kg` : "-"}</strong></div>
          <div className="client-detail-row"><span>Height</span><strong>{client?.height_cm ? `${client.height_cm} cm` : "-"}</strong></div>
          <div className="client-detail-row"><span>Gender</span><strong>{client?.gender || "-"}</strong></div>
          <div className="client-detail-row"><span>Activity level</span><strong>{client?.activity_level?.replaceAll("_", " ") || "-"}</strong></div>
        </div>
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

      <CollapsibleSection
        title="Trainer tips"
        subtitle={tips.length === 0 ? "No tips sent yet" : `${tips.length} tips available`}
        defaultOpen={false}
        className="card panel client-detail-card"
      >
        <div className="client-detail-head" style={{ marginBottom: 8 }}>
          <span className="item-sub">Private coaching notes history</span>
          <Link href={`/clients/${clientId}/tips`} className="ghost-button">History</Link>
        </div>
        <p className="item-sub">{tips.length === 0 ? "No tips sent yet." : `${tips.length} tips available.`}</p>
      </CollapsibleSection>

      <CollapsibleSection
        title="Sessions"
        subtitle={latestSessions.length === 0 ? "No sessions yet" : `${latestSessions.length} on record`}
        defaultOpen
        className="card panel client-detail-card"
      >
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
      </CollapsibleSection>

      {editOpen ? (
        <div className="modal-backdrop">
          <section className="modal-card card client-edit-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="client-detail-head">
              <div>
                <p className="eyebrow" style={{ margin: 0 }}>Client profile</p>
                <h2 style={{ marginTop: 4 }}>Edit {client?.name || "client"}</h2>
              </div>
            <button type="button" className="ghost-button" onClick={closeEdit}>Close</button>
            </div>
            <div className="form-grid" style={{ marginTop: 14 }}>
              <label className="field full"><span>Name</span><input value={editForm.name} onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))} /></label>
              <label className="field full"><span>Goal</span><input value={editForm.goal} onChange={(event) => setEditForm((prev) => ({ ...prev, goal: event.target.value }))} /></label>
              <label className="field full"><span>Mobile (locked)</span><input value={client?.mobile || ""} disabled /></label>
              <label className="field"><span>Age</span><input inputMode="numeric" value={editForm.age} onChange={(event) => setEditForm((prev) => ({ ...prev, age: event.target.value }))} /></label>
              <label className="field"><span>Weight (kg)</span><input inputMode="decimal" value={editForm.weight_kg} onChange={(event) => setEditForm((prev) => ({ ...prev, weight_kg: event.target.value }))} /></label>
              <label className="field"><span>Height (cm)</span><input inputMode="decimal" value={editForm.height_cm} onChange={(event) => setEditForm((prev) => ({ ...prev, height_cm: event.target.value }))} /></label>
              <label className="field">
                <span>Gender</span>
                <select value={editForm.gender} onChange={(event) => setEditForm((prev) => ({ ...prev, gender: event.target.value }))}>
                  <option value="">Not set</option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="field">
                <span>Activity level</span>
                <select value={editForm.activity_level} onChange={(event) => setEditForm((prev) => ({ ...prev, activity_level: event.target.value }))}>
                  <option value="">Not set</option>
                  <option value="sedentary">Sedentary</option>
                  <option value="light">Light</option>
                  <option value="moderate">Moderate</option>
                  <option value="active">Active</option>
                  <option value="very_active">Very active</option>
                </select>
              </label>
              <label className="field full"><span>Prior conditions / injuries</span><textarea rows={4} value={editForm.prior_condition} onChange={(event) => setEditForm((prev) => ({ ...prev, prior_condition: event.target.value }))} /></label>
            </div>
            <button type="button" className="continue-btn" disabled={saving || !editForm.name.trim()} onClick={saveClient}>
              {saving ? "Saving…" : "Save client"}
            </button>
          </section>
        </div>
      ) : null}
    </TrainerShell>
  );
}
