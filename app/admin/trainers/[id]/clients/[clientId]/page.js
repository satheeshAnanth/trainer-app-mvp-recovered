"use client";

import AdminShell, {
  Field,
  Panel,
  StatusBadge,
  adminButtonStyle,
  adminCardStyle,
  adminGhostButtonStyle,
  adminInputStyle,
} from "app/_components/AdminShell";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

function fmt(value) {
  if (!value) return "—";
  return String(value).replace("T", " ").slice(0, 19);
}

export default function AdminClientDetailPage() {
  const params = useParams();
  const trainerId = params?.id;
  const clientId = params?.clientId;
  const [data, setData] = useState(null);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/clients/${encodeURIComponent(clientId)}`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.message ?? "Failed to load client.");
      setData(json.data);
      const c = json.data.client || {};
      setForm({
        name: c.name || "",
        mobile: c.mobile || "",
        goal: c.goal || "",
        age: c.age ?? "",
        gender: c.gender || "",
        weight_kg: c.weight_kg ?? "",
        height_cm: c.height_cm ?? "",
        activity_level: c.activity_level || "",
        updated_at: c.updated_at,
      });
    } catch (e) {
      setError(e.message ?? "Failed to load.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (clientId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  async function save() {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const res = await fetch(`/api/admin/clients/${encodeURIComponent(clientId)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          age: form.age === "" ? null : Number(form.age),
          weight_kg: form.weight_kg === "" ? null : Number(form.weight_kg),
          height_cm: form.height_cm === "" ? null : Number(form.height_cm),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.message ?? "Save failed.");
      setMessage("Saved.");
      await load();
    } catch (e) {
      setError(e.message ?? "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function setArchived(archive) {
    const label = archive ? "Archive" : "Restore";
    if (!window.confirm(`${label} this client?`)) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/clients/${encodeURIComponent(clientId)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: archive ? "archive" : "restore" }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.message ?? `${label} failed.`);
      setMessage(`${label}d.`);
      await load();
    } catch (e) {
      setError(e.message ?? "Action failed.");
    } finally {
      setSaving(false);
    }
  }

  const client = data?.client;

  return (
    <AdminShell title="ADMIN — CLIENT">
      <div style={{ marginBottom: 12 }}>
        <Link href={`/admin/trainers/${trainerId}`} style={{ color: "#94a3b8", fontSize: 12, textDecoration: "none" }}>
          ← Trainer
        </Link>
      </div>

      {loading ? <p style={{ color: "#94a3b8", fontSize: 13 }}>Loading…</p> : null}
      {error ? <p style={{ color: "#f87171", fontSize: 13 }}>{error}</p> : null}
      {message ? <p style={{ color: "#34d399", fontSize: 13 }}>{message}</p> : null}

      {client ? (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <h1 style={{ color: "#e2e8f0", fontSize: 22, margin: 0 }}>{client.name || "Unnamed client"}</h1>
              <p style={{ color: "#64748b", margin: "6px 0 0", fontSize: 12 }}>
                Trainer: {data.trainer?.name || data.trainer?.phone || client.created_by_trainer || "—"}
              </p>
            </div>
            <StatusBadge status={client.archived_at ? "expired" : "active"} />
          </div>

          <Panel title="PROFILE">
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
              <Field label="Name"><input style={adminInputStyle} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></Field>
              <Field label="Mobile"><input style={adminInputStyle} value={form.mobile} onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))} /></Field>
              <Field label="Goal"><input style={adminInputStyle} value={form.goal} onChange={(e) => setForm((f) => ({ ...f, goal: e.target.value }))} /></Field>
              <Field label="Age"><input style={adminInputStyle} value={form.age} onChange={(e) => setForm((f) => ({ ...f, age: e.target.value }))} /></Field>
              <Field label="Gender"><input style={adminInputStyle} value={form.gender} onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))} /></Field>
              <Field label="Weight kg"><input style={adminInputStyle} value={form.weight_kg} onChange={(e) => setForm((f) => ({ ...f, weight_kg: e.target.value }))} /></Field>
              <Field label="Height cm"><input style={adminInputStyle} value={form.height_cm} onChange={(e) => setForm((f) => ({ ...f, height_cm: e.target.value }))} /></Field>
              <Field label="Activity">
                <input style={adminInputStyle} value={form.activity_level} onChange={(e) => setForm((f) => ({ ...f, activity_level: e.target.value }))} />
              </Field>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
              <button type="button" disabled={saving} style={adminButtonStyle} onClick={save}>Save</button>
              {client.archived_at ? (
                <button type="button" disabled={saving} style={adminGhostButtonStyle} onClick={() => setArchived(false)}>Restore</button>
              ) : (
                <button type="button" disabled={saving} style={adminGhostButtonStyle} onClick={() => setArchived(true)}>Archive</button>
              )}
            </div>
          </Panel>

          <Panel title="SESSIONS">
            <div style={{ display: "grid", gap: 6 }}>
              {(data.sessions ?? []).map((s) => (
                <Link key={s.id} href={`/admin/sessions/${s.id}`} style={{ ...adminCardStyle, textDecoration: "none" }}>
                  <p style={{ color: "#e2e8f0", margin: 0, fontSize: 13 }}>{s.session_title || "Session"}</p>
                  <p style={{ color: "#64748b", margin: "4px 0 0", fontSize: 11 }}>{s.status} · {fmt(s.session_date || s.created_at)}</p>
                </Link>
              ))}
              {!data.sessions?.length ? <p style={{ color: "#64748b", fontSize: 13 }}>No sessions.</p> : null}
            </div>
          </Panel>

          <Panel title="SCHEDULE">
            <div style={{ display: "grid", gap: 6 }}>
              {(data.events ?? []).map((e) => (
                <div key={e.id} style={adminCardStyle}>
                  <p style={{ color: "#e2e8f0", margin: 0, fontSize: 13 }}>{e.scheduled_date} {e.scheduled_time || ""}</p>
                  <p style={{ color: "#64748b", margin: "4px 0 0", fontSize: 11 }}>{e.status} {e.notes ? `· ${e.notes}` : ""}</p>
                </div>
              ))}
              {!data.events?.length ? <p style={{ color: "#64748b", fontSize: 13 }}>No events.</p> : null}
            </div>
          </Panel>

          <Panel title="MESSAGES">
            <div style={{ display: "grid", gap: 6 }}>
              {(data.messages ?? []).map((m) => (
                <div key={m.id} style={adminCardStyle}>
                  <p style={{ color: "#e2e8f0", margin: 0, fontSize: 13 }}>{m.sender_role}: {m.body}</p>
                  <p style={{ color: "#64748b", margin: "4px 0 0", fontSize: 11 }}>{fmt(m.created_at)}</p>
                </div>
              ))}
              {!data.messages?.length ? <p style={{ color: "#64748b", fontSize: 13 }}>No messages.</p> : null}
            </div>
          </Panel>
        </>
      ) : null}
    </AdminShell>
  );
}
