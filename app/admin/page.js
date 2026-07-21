"use client";

import AdminShell, {
  Kpi,
  Panel,
  StatusBadge,
  adminButtonStyle,
  adminCardStyle,
  adminGhostButtonStyle,
  adminInputStyle,
} from "app/_components/AdminShell";
import Link from "next/link";
import { useEffect, useState } from "react";

function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/ops", { credentials: "include" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.message ?? "Access denied.");
      setData(json.data);
    } catch (e) {
      setError(e.message ?? "Failed to load.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <p style={{ color: "#94a3b8", fontSize: 13, margin: 0 }}>
          {data?.reconcile?.updated ? `Reconciled ${data.reconcile.updated} expired trial(s).` : "Live ops overview"}
        </p>
        <button type="button" onClick={load} disabled={loading} style={adminGhostButtonStyle}>
          {loading ? "…" : "Refresh"}
        </button>
      </div>

      {error ? <p style={{ color: "#f87171", marginTop: 12, fontSize: 13 }}>{error}</p> : null}
      {data?.note ? <p style={{ color: "#94a3b8", marginTop: 12, fontSize: 13 }}>{data.note}</p> : null}

      {data && !data.note ? (
        <>
          <Panel title="TRAINERS">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
              <Kpi label="Total" value={data.trainers?.total} />
              <Kpi label="Trial" value={data.trainers?.on_trial} color="#facc15" />
              <Kpi label="Active" value={data.trainers?.active} color="#34d399" />
              <Kpi label="Expired" value={data.trainers?.expired} color="#fb923c" />
              <Kpi label="Suspended" value={data.trainers?.suspended} color="#f87171" />
              <Kpi label="Signups (30d)" value={data.trainers?.signups_30d} color="#60a5fa" />
            </div>
          </Panel>

          <Panel title="SESSIONS & CLIENTS">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
              <Kpi label="Clients" value={data.clients?.active ?? data.clients?.total} />
              <Kpi label="Archived clients" value={data.clients?.archived} color="#94a3b8" />
              <Kpi label="Sessions" value={data.sessions?.total} />
              <Kpi label="Sessions (7d)" value={data.sessions?.last_7_days} color="#60a5fa" />
              <Kpi label="Completed" value={data.sessions?.completed} color="#34d399" />
            </div>
          </Panel>

          {data.invitations?.total > 0 ? (
            <Panel title="INVITATIONS">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
                <Kpi label="Total sent" value={data.invitations?.total} />
                <Kpi label="Accepted" value={data.invitations?.accepted} color="#34d399" />
                <Kpi label="Pending" value={data.invitations?.pending} color="#facc15" />
              </div>
            </Panel>
          ) : null}

          {(data.expiringSoon ?? []).length > 0 ? (
            <Panel title="TRIALS ENDING SOON">
              <div style={{ display: "grid", gap: 6 }}>
                {data.expiringSoon.map((t) => (
                  <Link key={t.id || t.phone} href={`/admin/trainers/${t.id || t.phone}`} style={{ ...adminCardStyle, textDecoration: "none", display: "flex", justifyContent: "space-between" }}>
                    <div>
                      <p style={{ color: "#e2e8f0", margin: 0, fontSize: 13 }}>{t.name || "—"}</p>
                      <p style={{ color: "#64748b", margin: 0, fontSize: 11 }}>
                        ends {String(t.trial_ends_at ?? "").slice(0, 10)}
                      </p>
                    </div>
                    <StatusBadge status={t.effective_status} />
                  </Link>
                ))}
              </div>
            </Panel>
          ) : null}

          <Panel
            title="RECENT TRAINER SIGNUPS"
            action={
              <Link href="/admin/trainers" style={{ ...adminButtonStyle, textDecoration: "none", display: "inline-block" }}>
                Browse all →
              </Link>
            }
          >
            <div style={{ display: "grid", gap: 6 }}>
              {(data.recentTrainers ?? []).map((t) => (
                <Link
                  key={t.id || t.phone}
                  href={`/admin/trainers/${t.id || t.phone}`}
                  style={{ ...adminCardStyle, textDecoration: "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                >
                  <div>
                    <p style={{ color: "#e2e8f0", margin: 0, fontSize: 13 }}>{t.name || "—"}</p>
                    <p style={{ color: "#64748b", margin: 0, fontSize: 11 }}>
                      {t.phone} · joined {String(t.created_at ?? "").slice(0, 10)}
                      {t.trial_ends_at ? ` · trial ends ${String(t.trial_ends_at).slice(0, 10)}` : ""}
                    </p>
                  </div>
                  <StatusBadge status={t.effective_status || t.billing_status} />
                </Link>
              ))}
            </div>
          </Panel>

          {(data.failedPushes ?? []).length > 0 ? (
            <Panel title="FAILED PUSHES (14d)">
              <div style={{ display: "grid", gap: 6 }}>
                {data.failedPushes.map((p) => (
                  <div key={p.id} style={adminCardStyle}>
                    <p style={{ color: "#e2e8f0", margin: 0, fontSize: 13 }}>{p.title || "Push"}</p>
                    <p style={{ color: "#f87171", margin: "4px 0 0", fontSize: 11 }}>{p.error_message || "Failed"}</p>
                  </div>
                ))}
              </div>
            </Panel>
          ) : null}
        </>
      ) : null}
    </>
  );
}

export default function AdminPage() {
  return (
    <AdminShell title="TRAINER APP — OPS CONSOLE">
      <Dashboard />
    </AdminShell>
  );
}
