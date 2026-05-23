"use client";

import { useState } from "react";

const CHIP = {
  active: { color: "#34d399", border: "rgba(52,211,153,0.35)" },
  trial: { color: "#facc15", border: "rgba(250,204,21,0.35)" },
  suspended: { color: "#f87171", border: "rgba(248,113,113,0.35)" },
  expired: { color: "#f87171", border: "rgba(248,113,113,0.35)" },
};

function Chip({ status }) {
  const style = CHIP[status] ?? { color: "#94a3b8", border: "rgba(148,163,184,0.35)" };
  return (
    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, border: `1px solid ${style.border}`, color: style.color }}>
      {status ?? "unknown"}
    </span>
  );
}

function Kpi({ label, value, color }) {
  return (
    <div style={{ background: "#111827", borderRadius: 8, padding: "14px 18px", border: "1px solid rgba(255,255,255,0.06)" }}>
      <p style={{ color: "#94a3b8", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 4px" }}>{label}</p>
      <p style={{ color: color ?? "#e2e8f0", fontSize: 30, fontWeight: 700, margin: 0 }}>{value ?? "—"}</p>
    </div>
  );
}

export default function AdminPage() {
  const [secret, setSecret] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    if (!secret) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/ops", { headers: { "X-Admin-Secret": secret } });
      const json = await res.json();
      if (!json.ok) throw new Error(json.message ?? "Access denied.");
      setData(json.data);
    } catch (e) {
      setError(e.message ?? "Failed to load.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 24, maxWidth: 900, margin: "0 auto", fontFamily: "monospace" }}>
      <p style={{ color: "#6ee7b7", fontSize: 13, marginBottom: 24, letterSpacing: "0.04em" }}>
        TRAINER APP — OPS CONSOLE
      </p>

      {!data ? (
        <div style={{ display: "flex", gap: 10, maxWidth: 400 }}>
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") load(); }}
            placeholder="Admin secret"
            autoFocus
            style={{ flex: 1, background: "#0f172a", border: "1px solid #334155", borderRadius: 6, padding: "8px 12px", color: "#e2e8f0", fontFamily: "monospace" }}
          />
          <button
            onClick={load}
            disabled={loading || !secret}
            style={{ background: "#134e4a", border: "none", borderRadius: 6, padding: "8px 16px", color: "#6ee7b7", fontFamily: "monospace", cursor: "pointer" }}
          >
            {loading ? "…" : "Unlock"}
          </button>
        </div>
      ) : null}

      {error ? <p style={{ color: "#f87171", marginTop: 12, fontSize: 13 }}>{error}</p> : null}

      {data?.note ? <p style={{ color: "#94a3b8", marginTop: 12, fontSize: 13 }}>{data.note}</p> : null}

      {data && !data.note ? (
        <>
          <section style={{ marginTop: 24 }}>
            <p style={{ color: "#64748b", fontSize: 11, marginBottom: 10 }}>TRAINERS</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
              <Kpi label="Total" value={data.trainers?.total} />
              <Kpi label="Trial" value={data.trainers?.on_trial} color="#facc15" />
              <Kpi label="Active (paying)" value={data.trainers?.active} color="#34d399" />
              <Kpi label="Churned" value={data.trainers?.churned} color="#f87171" />
              <Kpi label="Signups (30d)" value={data.trainers?.signups_30d} color="#60a5fa" />
            </div>
          </section>

          <section style={{ marginTop: 20 }}>
            <p style={{ color: "#64748b", fontSize: 11, marginBottom: 10 }}>SESSIONS & CLIENTS</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
              <Kpi label="Total clients" value={data.clients?.total} />
              <Kpi label="Total sessions" value={data.sessions?.total} />
              <Kpi label="Sessions (7d)" value={data.sessions?.last_7_days} color="#60a5fa" />
              <Kpi label="Sessions (30d)" value={data.sessions?.last_30_days} color="#60a5fa" />
              <Kpi label="Completed" value={data.sessions?.completed} color="#34d399" />
              <Kpi label="In progress" value={data.sessions?.in_progress} color="#facc15" />
            </div>
          </section>

          {data.invitations?.total > 0 ? (
            <section style={{ marginTop: 20 }}>
              <p style={{ color: "#64748b", fontSize: 11, marginBottom: 10 }}>INVITATIONS</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
                <Kpi label="Total sent" value={data.invitations?.total} />
                <Kpi label="Accepted" value={data.invitations?.accepted} color="#34d399" />
                <Kpi label="Pending" value={data.invitations?.pending} color="#facc15" />
              </div>
            </section>
          ) : null}

          <section style={{ marginTop: 24 }}>
            <p style={{ color: "#64748b", fontSize: 11, marginBottom: 10 }}>RECENT TRAINER SIGNUPS</p>
            <div style={{ display: "grid", gap: 6 }}>
              {(data.recentTrainers ?? []).map((t) => (
                <div key={t.phone} style={{ background: "#111827", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 6, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <p style={{ color: "#e2e8f0", margin: 0, fontSize: 13 }}>{t.name || "—"}</p>
                    <p style={{ color: "#64748b", margin: 0, fontSize: 11 }}>
                      {t.phone} · joined {String(t.created_at ?? "").slice(0, 10)}
                      {t.trial_ends_at ? ` · trial ends ${String(t.trial_ends_at).slice(0, 10)}` : ""}
                    </p>
                  </div>
                  <Chip status={t.billing_status} />
                </div>
              ))}
            </div>
          </section>

          <button
            onClick={() => setData(null)}
            style={{ marginTop: 24, background: "none", border: "1px solid #334155", color: "#64748b", padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontFamily: "monospace", fontSize: 12 }}
          >
            Lock console
          </button>
        </>
      ) : null}
    </main>
  );
}
