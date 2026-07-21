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

export default function AdminSessionDetailPage() {
  const params = useParams();
  const sessionId = params?.id;
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
      const res = await fetch(`/api/admin/sessions/${encodeURIComponent(sessionId)}`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.message ?? "Failed to load session.");
      setData(json.data);
      const s = json.data.session || {};
      setForm({
        session_title: s.session_title || "",
        status: s.status || "",
        summary: s.summary || "",
        raw_notes: s.raw_notes || "",
        estimated_calories: s.estimated_calories ?? "",
        duration_minutes: s.duration_minutes ?? "",
        session_date: s.session_date ? String(s.session_date).slice(0, 10) : "",
      });
    } catch (e) {
      setError(e.message ?? "Failed to load.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (sessionId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  async function save() {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const res = await fetch(`/api/admin/sessions/${encodeURIComponent(sessionId)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          estimated_calories: form.estimated_calories === "" ? null : Number(form.estimated_calories),
          duration_minutes: form.duration_minutes === "" ? null : Number(form.duration_minutes),
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
    if (!window.confirm(`${label} this session?`)) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/sessions/${encodeURIComponent(sessionId)}`, {
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

  const session = data?.session;
  const trainerDigits = String(session?.created_by_trainer || "").replace(/\D/g, "");

  return (
    <AdminShell title="ADMIN — SESSION">
      <div style={{ marginBottom: 12 }}>
        {session?.client_id ? (
          <Link
            href={trainerDigits ? `/admin/trainers/${trainerDigits}/clients/${session.client_id}` : `/admin`}
            style={{ color: "#94a3b8", fontSize: 12, textDecoration: "none" }}
          >
            ← Client
          </Link>
        ) : (
          <Link href="/admin" style={{ color: "#94a3b8", fontSize: 12, textDecoration: "none" }}>← Admin</Link>
        )}
      </div>

      {loading ? <p style={{ color: "#94a3b8", fontSize: 13 }}>Loading…</p> : null}
      {error ? <p style={{ color: "#f87171", fontSize: 13 }}>{error}</p> : null}
      {message ? <p style={{ color: "#34d399", fontSize: 13 }}>{message}</p> : null}

      {session ? (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <h1 style={{ color: "#e2e8f0", fontSize: 22, margin: 0 }}>{session.session_title || "Session"}</h1>
              <p style={{ color: "#64748b", margin: "6px 0 0", fontSize: 12 }}>
                {session.client_name || session.client_name_snapshot || session.client_id} · {fmt(session.session_date)}
              </p>
            </div>
            <StatusBadge status={session.archived_at ? "expired" : session.status} />
          </div>

          <Panel title="EDIT">
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
              <Field label="Title"><input style={adminInputStyle} value={form.session_title} onChange={(e) => setForm((f) => ({ ...f, session_title: e.target.value }))} /></Field>
              <Field label="Status"><input style={adminInputStyle} value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} /></Field>
              <Field label="Date"><input type="date" style={adminInputStyle} value={form.session_date} onChange={(e) => setForm((f) => ({ ...f, session_date: e.target.value }))} /></Field>
              <Field label="Calories"><input style={adminInputStyle} value={form.estimated_calories} onChange={(e) => setForm((f) => ({ ...f, estimated_calories: e.target.value }))} /></Field>
              <Field label="Duration min"><input style={adminInputStyle} value={form.duration_minutes} onChange={(e) => setForm((f) => ({ ...f, duration_minutes: e.target.value }))} /></Field>
            </div>
            <Field label="Summary">
              <textarea style={{ ...adminInputStyle, minHeight: 80 }} value={form.summary} onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))} />
            </Field>
            <Field label="Raw notes">
              <textarea style={{ ...adminInputStyle, minHeight: 80 }} value={form.raw_notes} onChange={(e) => setForm((f) => ({ ...f, raw_notes: e.target.value }))} />
            </Field>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
              <button type="button" disabled={saving} style={adminButtonStyle} onClick={save}>Save</button>
              {session.archived_at ? (
                <button type="button" disabled={saving} style={adminGhostButtonStyle} onClick={() => setArchived(false)}>Restore</button>
              ) : (
                <button type="button" disabled={saving} style={adminGhostButtonStyle} onClick={() => setArchived(true)}>Archive</button>
              )}
            </div>
          </Panel>

          <Panel title="PAYLOAD">
            <pre style={{ ...adminCardStyle, overflow: "auto", fontSize: 11, color: "#cbd5e1", margin: 0 }}>
              {JSON.stringify(session.payload_json ?? {}, null, 2)}
            </pre>
          </Panel>

          <Panel title="SHARES / PAYMENTS">
            <div style={{ display: "grid", gap: 6 }}>
              {(data.shares ?? []).map((s) => (
                <div key={s.id} style={adminCardStyle}>
                  <p style={{ color: "#e2e8f0", margin: 0, fontSize: 12 }}>Share · {fmt(s.shared_at || s.created_at)}</p>
                </div>
              ))}
              {(data.payments ?? []).map((p) => (
                <div key={p.id} style={adminCardStyle}>
                  <p style={{ color: "#e2e8f0", margin: 0, fontSize: 12 }}>
                    Payment event · {p.action} · {fmt(p.created_at)}
                  </p>
                </div>
              ))}
              {!data.shares?.length && !data.payments?.length ? (
                <p style={{ color: "#64748b", fontSize: 13 }}>No share/payment records.</p>
              ) : null}
            </div>
          </Panel>
        </>
      ) : null}
    </AdminShell>
  );
}
