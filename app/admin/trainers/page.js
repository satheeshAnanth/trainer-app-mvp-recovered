"use client";

import AdminShell, {
  Panel,
  StatusBadge,
  adminButtonStyle,
  adminCardStyle,
  adminGhostButtonStyle,
  adminInputStyle,
} from "app/_components/AdminShell";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function AdminTrainersPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [archived, setArchived] = useState("active");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load(nextPage = page) {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        q,
        status,
        archived,
        page: String(nextPage),
        limit: "25",
      });
      const res = await fetch(`/api/admin/trainers?${params}`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.message ?? "Failed to load trainers.");
      setData(json.data);
      setPage(nextPage);
    } catch (e) {
      setError(e.message ?? "Failed to load.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalPages = Math.max(1, Math.ceil((data?.total || 0) / (data?.limit || 25)));

  return (
    <AdminShell title="ADMIN — TRAINERS">
      <Panel title="FILTERS">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            load(1);
          }}
          style={{ display: "grid", gap: 10, gridTemplateColumns: "minmax(180px, 1.5fr) repeat(3, minmax(120px, 1fr)) auto", alignItems: "end" }}
        >
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ color: "#64748b", fontSize: 11 }}>Search</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, phone, gym…" style={adminInputStyle} />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ color: "#64748b", fontSize: 11 }}>Billing</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)} style={adminInputStyle}>
              <option value="all">All</option>
              <option value="trial">Trial</option>
              <option value="active">Active</option>
              <option value="expired">Expired</option>
              <option value="suspended">Suspended</option>
            </select>
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ color: "#64748b", fontSize: 11 }}>Account</span>
            <select value={archived} onChange={(e) => setArchived(e.target.value)} style={adminInputStyle}>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
              <option value="all">All</option>
            </select>
          </label>
          <button type="submit" disabled={loading} style={adminButtonStyle}>
            {loading ? "…" : "Apply"}
          </button>
        </form>
      </Panel>

      {error ? <p style={{ color: "#f87171", fontSize: 13 }}>{error}</p> : null}

      <Panel title={`RESULTS (${data?.total ?? 0})`}>
        <div style={{ display: "grid", gap: 6 }}>
          {(data?.items ?? []).map((t) => (
            <Link
              key={t.id}
              href={`/admin/trainers/${t.id}`}
              style={{ ...adminCardStyle, textDecoration: "none", display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "center" }}
            >
              <div>
                <p style={{ color: "#e2e8f0", margin: 0, fontSize: 14 }}>{t.name || "Unnamed trainer"}</p>
                <p style={{ color: "#64748b", margin: "4px 0 0", fontSize: 11 }}>
                  {t.phone}
                  {t.gym_name ? ` · ${t.gym_name}` : ""}
                  {t.location ? ` · ${t.location}` : ""}
                  {` · ${t.client_count ?? 0} clients`}
                </p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                <StatusBadge status={t.effective_status} />
                {t.effective_status !== t.billing_status ? (
                  <span style={{ color: "#64748b", fontSize: 10 }}>stored: {t.billing_status}</span>
                ) : null}
                {!t.is_active ? <span style={{ color: "#f87171", fontSize: 10 }}>archived</span> : null}
              </div>
            </Link>
          ))}
          {!loading && !(data?.items?.length) ? (
            <p style={{ color: "#64748b", fontSize: 13 }}>No trainers match these filters.</p>
          ) : null}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, gap: 10 }}>
          <button type="button" disabled={page <= 1 || loading} onClick={() => load(page - 1)} style={adminGhostButtonStyle}>
            Prev
          </button>
          <span style={{ color: "#64748b", fontSize: 12, alignSelf: "center" }}>
            Page {page} / {totalPages}
          </span>
          <button type="button" disabled={page >= totalPages || loading} onClick={() => load(page + 1)} style={adminGhostButtonStyle}>
            Next
          </button>
        </div>
      </Panel>
    </AdminShell>
  );
}
