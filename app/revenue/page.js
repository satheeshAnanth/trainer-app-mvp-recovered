"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import TrainerShell from "app/_components/TrainerShell";

function safeJson(text) {
  if (!text) return {};
  if (typeof text === "object") return text;
  try { return JSON.parse(text); } catch { return {}; }
}

function inr(amount) {
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

function monthLabel(yyyymm) {
  if (!yyyymm || yyyymm === "Unknown") return "Undated";
  try { return new Date(yyyymm + "-01").toLocaleDateString("en-IN", { month: "long", year: "numeric" }); }
  catch { return yyyymm; }
}

export default function Page() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/sessions")
      .then((r) => r.json())
      .then((json) => setSessions(json?.data?.sessions ?? []))
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, []);

  const rev = useMemo(() => {
    const enriched = sessions.map((s) => {
      const payload = safeJson(s.payload_json);
      return {
        ...s,
        paymentReceived: Boolean(payload?.paymentReceived),
        amountInr: Number(payload?.payment?.amountInr ?? 0),
      };
    });

    const billed = enriched.filter((s) => s.amountInr > 0);
    const collected = billed.filter((s) => s.paymentReceived);
    const outstanding = billed.filter((s) => !s.paymentReceived);

    const totalCollected = collected.reduce((sum, s) => sum + s.amountInr, 0);
    const totalOutstanding = outstanding.reduce((sum, s) => sum + s.amountInr, 0);

    const monthlyMap = new Map();
    for (const s of collected) {
      const month = String(s.session_date ?? "").slice(0, 7) || "Unknown";
      monthlyMap.set(month, (monthlyMap.get(month) ?? 0) + s.amountInr);
    }
    const monthly = [...monthlyMap.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 12);

    const clientMap = new Map();
    for (const s of collected) {
      const key = s.client_id ?? s.client_name_snapshot;
      if (!clientMap.has(key)) clientMap.set(key, { name: s.client_name_snapshot || "Unknown", total: 0, sessions: 0 });
      const e = clientMap.get(key);
      e.total += s.amountInr;
      e.sessions += 1;
    }
    const clientLtv = [...clientMap.values()].sort((a, b) => b.total - a.total);

    return { totalCollected, totalOutstanding, monthly, clientLtv, outstanding, billedCount: billed.length };
  }, [sessions]);

  return (
    <TrainerShell title="Revenue" subtitle="Earnings, outstanding invoices, and client lifetime value.">
      <div className="kpi-grid">
        <article className="kpi-card">
          <p className="kpi-label">Collected</p>
          <p className="kpi-value" style={{ color: "#34d399" }}>{loading ? "—" : inr(rev.totalCollected)}</p>
        </article>
        <article className="kpi-card">
          <p className="kpi-label">Outstanding</p>
          <p className="kpi-value" style={{ color: rev.totalOutstanding > 0 ? "#facc15" : "#94a3b8" }}>
            {loading ? "—" : inr(rev.totalOutstanding)}
          </p>
        </article>
        <article className="kpi-card">
          <p className="kpi-label">Billed sessions</p>
          <p className="kpi-value">{loading ? "—" : rev.billedCount}</p>
        </article>
      </div>

      {rev.outstanding.length > 0 ? (
        <article className="card panel" style={{ borderLeft: "4px solid #facc15" }}>
          <h2>Outstanding invoices</h2>
          <p className="item-sub" style={{ marginBottom: 12 }}>
            Payment requested but not yet marked received. Open the session to confirm payment.
          </p>
          <div className="list">
            {rev.outstanding.map((s) => (
              <Link key={s.id} href={`/sessions/${s.id}`} className="list-item" style={{ textDecoration: "none" }}>
                <div>
                  <p className="item-title">{s.session_title || "Session"}</p>
                  <p className="item-sub">{s.client_name_snapshot || "Client"} · {String(s.session_date ?? "").slice(0, 10) || "—"}</p>
                </div>
                <span className="status-chip" style={{ color: "#facc15", borderColor: "rgba(250,204,21,0.35)" }}>
                  {inr(s.amountInr)} due
                </span>
              </Link>
            ))}
          </div>
        </article>
      ) : !loading && rev.billedCount === 0 ? (
        <article className="card panel">
          <p className="item-sub">No billed sessions yet. Open a session, enter a payment amount under "Session Payment (UPI)", and click "Request payment" to start tracking here.</p>
          <Link href="/sessions/new" className="mint-button mint-button-sm" style={{ marginTop: 10, display: "inline-block" }}>New session</Link>
        </article>
      ) : null}

      <article className="card panel">
        <h2>Monthly collected</h2>
        {loading ? (
          <p className="item-sub">Loading…</p>
        ) : rev.monthly.length === 0 ? (
          <p className="item-sub">Monthly breakdown will appear once payments are confirmed received.</p>
        ) : (
          <>
            <div className="list">
              {rev.monthly.map(([month, amount]) => (
                <div key={month} className="list-item">
                  <p className="item-title">{monthLabel(month)}</p>
                  <span className="status-chip" style={{ color: "#34d399" }}>{inr(amount)}</span>
                </div>
              ))}
            </div>
            <p className="item-sub" style={{ marginTop: 10 }}>
              Total collected: <strong style={{ color: "#34d399" }}>{inr(rev.totalCollected)}</strong>
            </p>
          </>
        )}
      </article>

      <article className="card panel">
        <h2>Client lifetime value</h2>
        {loading ? (
          <p className="item-sub">Loading…</p>
        ) : rev.clientLtv.length === 0 ? (
          <p className="item-sub">Lifetime value will appear once payments are collected per client.</p>
        ) : (
          <div className="list">
            {rev.clientLtv.map((c, idx) => (
              <div key={`${c.name}-${idx}`} className="list-item">
                <div>
                  <p className="item-title">{c.name}</p>
                  <p className="item-sub">{c.sessions} paid session{c.sessions !== 1 ? "s" : ""}</p>
                </div>
                <span className="status-chip" style={{ color: "#34d399" }}>{inr(c.total)}</span>
              </div>
            ))}
          </div>
        )}
      </article>
    </TrainerShell>
  );
}
