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
import { useEffect, useMemo, useState } from "react";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "billing", label: "Billing" },
  { id: "clients", label: "Clients" },
  { id: "sessions", label: "Sessions" },
  { id: "schedule", label: "Schedule" },
  { id: "communication", label: "Comms" },
  { id: "activity", label: "Activity" },
];

function fmt(value) {
  if (!value) return "—";
  return String(value).replace("T", " ").slice(0, 19);
}

export default function AdminTrainerDetailPage() {
  const params = useParams();
  const trainerId = params?.id;
  const [tab, setTab] = useState("overview");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({});

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/trainers/${encodeURIComponent(trainerId)}`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.message ?? "Failed to load trainer.");
      setData(json.data);
      const t = json.data.trainer || {};
      setForm({
        name: t.name || "",
        gym_name: t.gym_name || "",
        specialization: t.specialization || "",
        years_experience: t.years_experience ?? "",
        location: t.location || "",
        max_clients: t.max_clients ?? "",
        billing_status: t.billing_status || "trial",
        trial_ends_at: t.trial_ends_at ? String(t.trial_ends_at).slice(0, 10) : "",
        is_active: Boolean(t.is_active ?? 1),
        updated_at: t.updated_at,
      });
    } catch (e) {
      setError(e.message ?? "Failed to load.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (trainerId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trainerId]);

  async function patch(payload, successMsg) {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const res = await fetch(`/api/admin/trainers/${encodeURIComponent(trainerId)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, updated_at: form.updated_at }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.message ?? "Save failed.");
      setMessage(successMsg || "Saved.");
      await load();
    } catch (e) {
      setError(e.message ?? "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function archiveToggle() {
    const nextActive = !form.is_active;
    const label = nextActive ? "restore" : "archive";
    if (!window.confirm(`${label === "archive" ? "Archive" : "Restore"} this trainer account?`)) return;
    await patch({ is_active: nextActive }, nextActive ? "Trainer restored." : "Trainer archived.");
  }

  const trainer = data?.trainer;
  const billing = data?.billing;
  const storedDiffers = billing && billing.status !== billing.storedStatus;

  const content = useMemo(() => {
    if (!data) return null;
    if (tab === "overview") {
      return (
        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
            <Field label="Name">
              <input style={adminInputStyle} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </Field>
            <Field label="Gym">
              <input style={adminInputStyle} value={form.gym_name} onChange={(e) => setForm((f) => ({ ...f, gym_name: e.target.value }))} />
            </Field>
            <Field label="Specialization">
              <input style={adminInputStyle} value={form.specialization} onChange={(e) => setForm((f) => ({ ...f, specialization: e.target.value }))} />
            </Field>
            <Field label="Years experience">
              <input style={adminInputStyle} value={form.years_experience} onChange={(e) => setForm((f) => ({ ...f, years_experience: e.target.value }))} />
            </Field>
            <Field label="Location">
              <input style={adminInputStyle} value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} />
            </Field>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              disabled={saving}
              style={adminButtonStyle}
              onClick={() =>
                patch({
                  name: form.name,
                  gym_name: form.gym_name,
                  specialization: form.specialization,
                  years_experience: form.years_experience === "" ? null : form.years_experience,
                  location: form.location,
                })
              }
            >
              Save profile
            </button>
            <button type="button" disabled={saving} style={adminGhostButtonStyle} onClick={archiveToggle}>
              {form.is_active ? "Archive trainer" : "Restore trainer"}
            </button>
          </div>
          <div style={adminCardStyle}>
            <p style={{ color: "#94a3b8", margin: 0, fontSize: 12 }}>Phone · {trainer?.phone}</p>
            <p style={{ color: "#94a3b8", margin: "6px 0 0", fontSize: 12 }}>Referral · {trainer?.referral_code || "—"}</p>
            <p style={{ color: "#94a3b8", margin: "6px 0 0", fontSize: 12 }}>Created · {fmt(trainer?.created_at)}</p>
            <p style={{ color: "#94a3b8", margin: "6px 0 0", fontSize: 12 }}>Updated · {fmt(trainer?.updated_at)}</p>
          </div>
        </div>
      );
    }

    if (tab === "billing") {
      return (
        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <StatusBadge status={billing?.status} />
            {storedDiffers ? (
              <span style={{ color: "#fb923c", fontSize: 12 }}>
                Stored was {billing.storedStatus}; reconciled to effective {billing.status}.
              </span>
            ) : null}
          </div>
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
            <Field label="Billing status">
              <select
                style={adminInputStyle}
                value={form.billing_status}
                onChange={(e) => setForm((f) => ({ ...f, billing_status: e.target.value }))}
              >
                <option value="trial">trial</option>
                <option value="active">active</option>
                <option value="per_client">per_client</option>
                <option value="expired">expired</option>
                <option value="suspended">suspended</option>
              </select>
            </Field>
            <Field label="Trial ends">
              <input
                type="date"
                style={adminInputStyle}
                value={form.trial_ends_at}
                onChange={(e) => setForm((f) => ({ ...f, trial_ends_at: e.target.value }))}
              />
            </Field>
            <Field label="Max clients">
              <input
                style={adminInputStyle}
                value={form.max_clients}
                onChange={(e) => setForm((f) => ({ ...f, max_clients: e.target.value }))}
              />
            </Field>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              disabled={saving}
              style={adminButtonStyle}
              onClick={() => {
                if (form.billing_status === "suspended" && !window.confirm("Suspend this trainer?")) return;
                patch({
                  billing_status: form.billing_status,
                  trial_ends_at: form.trial_ends_at || null,
                  max_clients: form.max_clients === "" ? null : Number(form.max_clients),
                });
              }}
            >
              Save billing
            </button>
            <button
              type="button"
              disabled={saving}
              style={adminGhostButtonStyle}
              onClick={() => {
                const base = form.trial_ends_at ? new Date(form.trial_ends_at) : new Date();
                if (base.getTime() < Date.now()) base.setTime(Date.now());
                base.setUTCDate(base.getUTCDate() + 14);
                patch({
                  billing_status: "trial",
                  trial_ends_at: base.toISOString().slice(0, 10),
                }, "Trial extended 14 days.");
              }}
            >
              Extend trial +14d
            </button>
            <button
              type="button"
              disabled={saving}
              style={adminGhostButtonStyle}
              onClick={() => {
                if (!window.confirm("Activate paid access for this trainer?")) return;
                patch({ billing_status: "active" }, "Trainer activated.");
              }}
            >
              Activate
            </button>
          </div>
          <Panel title="BILLING RECORDS">
            <div style={{ display: "grid", gap: 6 }}>
              {(data.billingRecords ?? []).map((r) => (
                <div key={r.id} style={adminCardStyle}>
                  <p style={{ color: "#e2e8f0", margin: 0, fontSize: 13 }}>
                    {r.month_year || "—"} · ₹{r.amount_inr ?? 0} · {r.status}
                  </p>
                  <p style={{ color: "#64748b", margin: "4px 0 0", fontSize: 11 }}>
                    clients {r.active_clients ?? "—"} · paid {fmt(r.paid_at)}
                  </p>
                </div>
              ))}
              {!data.billingRecords?.length ? <p style={{ color: "#64748b", fontSize: 13 }}>No billing records.</p> : null}
            </div>
          </Panel>
        </div>
      );
    }

    if (tab === "clients") {
      return (
        <div style={{ display: "grid", gap: 6 }}>
          {(data.clients ?? []).map((c) => (
            <Link
              key={c.id}
              href={`/admin/trainers/${trainerId}/clients/${c.id}`}
              style={{ ...adminCardStyle, textDecoration: "none", display: "flex", justifyContent: "space-between", gap: 10 }}
            >
              <div>
                <p style={{ color: "#e2e8f0", margin: 0, fontSize: 13 }}>{c.name || "—"}</p>
                <p style={{ color: "#64748b", margin: "4px 0 0", fontSize: 11 }}>
                  {c.mobile || "no mobile"} · {c.goal || "no goal"}
                </p>
              </div>
              {c.archived_at ? <StatusBadge status="expired" /> : <StatusBadge status="active" />}
            </Link>
          ))}
          {!data.clients?.length ? <p style={{ color: "#64748b", fontSize: 13 }}>No clients.</p> : null}
        </div>
      );
    }

    if (tab === "sessions") {
      return (
        <div style={{ display: "grid", gap: 6 }}>
          {(data.sessions ?? []).map((s) => (
            <Link
              key={s.id}
              href={`/admin/sessions/${s.id}`}
              style={{ ...adminCardStyle, textDecoration: "none", display: "flex", justifyContent: "space-between", gap: 10 }}
            >
              <div>
                <p style={{ color: "#e2e8f0", margin: 0, fontSize: 13 }}>{s.session_title || "Session"}</p>
                <p style={{ color: "#64748b", margin: "4px 0 0", fontSize: 11 }}>
                  {s.client_name_snapshot || s.client_id} · {fmt(s.session_date || s.created_at)}
                </p>
              </div>
              <StatusBadge status={s.archived_at ? "expired" : s.status} />
            </Link>
          ))}
          {!data.sessions?.length ? <p style={{ color: "#64748b", fontSize: 13 }}>No sessions.</p> : null}
        </div>
      );
    }

    if (tab === "schedule") {
      return (
        <div style={{ display: "grid", gap: 6 }}>
          {(data.events ?? []).map((e) => (
            <div key={e.id} style={adminCardStyle}>
              <p style={{ color: "#e2e8f0", margin: 0, fontSize: 13 }}>
                {e.client_name || e.client_id} · {e.scheduled_date} {e.scheduled_time || ""}
              </p>
              <p style={{ color: "#64748b", margin: "4px 0 0", fontSize: 11 }}>
                {e.status} {e.notes ? `· ${e.notes}` : ""}
              </p>
            </div>
          ))}
          {!data.events?.length ? <p style={{ color: "#64748b", fontSize: 13 }}>No schedule events.</p> : null}
        </div>
      );
    }

    if (tab === "communication") {
      return (
        <div style={{ display: "grid", gap: 16 }}>
          <Panel title="INVITATIONS">
            <div style={{ display: "grid", gap: 6 }}>
              {(data.invitations ?? []).map((i) => (
                <div key={i.id} style={adminCardStyle}>
                  <p style={{ color: "#e2e8f0", margin: 0, fontSize: 13 }}>
                    {i.client_name || "—"} · {i.client_phone || ""}
                  </p>
                  <p style={{ color: "#64748b", margin: "4px 0 0", fontSize: 11 }}>
                    {i.status} · created {fmt(i.created_at)}
                  </p>
                </div>
              ))}
              {!data.invitations?.length ? <p style={{ color: "#64748b", fontSize: 13 }}>No invitations.</p> : null}
            </div>
          </Panel>
          <Panel title="PUSH LOG">
            <div style={{ display: "grid", gap: 6 }}>
              {(data.pushLogs ?? []).map((p) => (
                <div key={p.id} style={adminCardStyle}>
                  <p style={{ color: "#e2e8f0", margin: 0, fontSize: 13 }}>{p.title}</p>
                  <p style={{ color: "#64748b", margin: "4px 0 0", fontSize: 11 }}>
                    success {p.success_count}/{p.token_count} · {fmt(p.created_at)}
                  </p>
                  {p.error_message ? <p style={{ color: "#f87171", margin: "4px 0 0", fontSize: 11 }}>{p.error_message}</p> : null}
                </div>
              ))}
              {!data.pushLogs?.length ? <p style={{ color: "#64748b", fontSize: 13 }}>No push logs.</p> : null}
            </div>
          </Panel>
        </div>
      );
    }

    return (
      <div style={{ display: "grid", gap: 6 }}>
        {(data.audits ?? []).map((a) => (
          <div key={a.id} style={adminCardStyle}>
            <p style={{ color: "#e2e8f0", margin: 0, fontSize: 13 }}>{a.action}</p>
            <p style={{ color: "#64748b", margin: "4px 0 0", fontSize: 11 }}>{fmt(a.created_at)}</p>
          </div>
        ))}
        {!data.audits?.length ? <p style={{ color: "#64748b", fontSize: 13 }}>No audit events yet.</p> : null}
      </div>
    );
  }, [data, tab, form, saving, billing, storedDiffers, trainer, trainerId]);

  return (
    <AdminShell title="ADMIN — TRAINER">
      <div style={{ marginBottom: 12 }}>
        <Link href="/admin/trainers" style={{ color: "#94a3b8", fontSize: 12, textDecoration: "none" }}>
          ← Trainers
        </Link>
      </div>

      {loading ? <p style={{ color: "#94a3b8", fontSize: 13 }}>Loading…</p> : null}
      {error ? <p style={{ color: "#f87171", fontSize: 13 }}>{error}</p> : null}
      {message ? <p style={{ color: "#34d399", fontSize: 13 }}>{message}</p> : null}

      {trainer ? (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
            <div>
              <h1 style={{ color: "#e2e8f0", fontSize: 22, margin: 0 }}>{trainer.name || "Unnamed trainer"}</h1>
              <p style={{ color: "#64748b", margin: "6px 0 0", fontSize: 12 }}>{trainer.phone}</p>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <StatusBadge status={billing?.status || trainer.effective_status} />
              {!trainer.is_active ? <StatusBadge status="suspended" /> : null}
            </div>
          </div>

          <nav style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 16 }}>
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                style={{
                  ...adminGhostButtonStyle,
                  background: tab === item.id ? "#134e4a" : "#111827",
                  color: tab === item.id ? "#6ee7b7" : "#94a3b8",
                }}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div style={{ marginTop: 16 }}>{content}</div>
        </>
      ) : null}
    </AdminShell>
  );
}
