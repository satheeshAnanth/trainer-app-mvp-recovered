"use client";

import AdminShell, { Panel, Kpi, adminButtonStyle, adminInputStyle, adminGhostButtonStyle } from "app/_components/AdminShell";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function AdminGymDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [seatLimit, setSeatLimit] = useState(5);
  const [busy, setBusy] = useState(false);

  async function load() {
    setError("");
    try {
      const res = await fetch(`/api/admin/gyms/${id}`, { credentials: "include" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.message ?? "Failed to load.");
      setData(json.data);
      setSeatLimit(json.data?.gym?.seat_limit ?? 5);
    } catch (err) {
      setError(err.message ?? "Failed to load.");
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  async function saveSeats() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/gyms/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seatLimit }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.message ?? "Update failed.");
      await load();
    } catch (err) {
      setError(err.message ?? "Update failed.");
    } finally {
      setBusy(false);
    }
  }

  const gym = data?.gym;
  const ops = data?.ops;

  return (
    <AdminShell title={gym?.name || "GYM"}>
      <p style={{ marginTop: 0 }}>
        <Link href="/admin/gyms" style={{ color: "#94a3b8", fontSize: 13 }}>
          ← All gyms
        </Link>
      </p>
      {error ? <p style={{ color: "#f87171", fontSize: 13 }}>{error}</p> : null}

      {gym ? (
        <>
          <Panel title="OVERVIEW">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
              <Kpi label="Seats" value={`${ops?.seatsUsed ?? 0}/${ops?.seatLimit ?? gym.seat_limit}`} />
              <Kpi label="Active trainers" value={ops?.trainersActive} />
              <Kpi label="Sessions 7d" value={ops?.sessionsLast7Days} />
              <Kpi label="Clients (count)" value={ops?.clientsTotal} />
            </div>
            <p style={{ color: "#64748b", fontSize: 12, marginBottom: 0 }}>
              {gym.slug}
              {gym.city ? ` · ${gym.city}` : ""} · billing {gym.billing_status} · status {gym.status}
            </p>
          </Panel>

          <Panel title="SEAT LIMIT">
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <input
                style={{ ...adminInputStyle, width: 100 }}
                type="number"
                min={1}
                value={seatLimit}
                onChange={(e) => setSeatLimit(Number(e.target.value) || 1)}
              />
              <button type="button" style={adminButtonStyle} disabled={busy} onClick={saveSeats}>
                Save
              </button>
              <button type="button" style={adminGhostButtonStyle} onClick={load}>
                Refresh
              </button>
            </div>
          </Panel>

          <Panel title="ADMINS">
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 6 }}>
              {(data.admins ?? []).map((a) => (
                <li key={a.id} style={{ color: "#cbd5e1", fontSize: 13 }}>
                  {a.name || "—"} · {a.phone} · {a.role}
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="MEMBERSHIPS">
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 6 }}>
              {(data.memberships ?? []).map((m) => (
                <li key={m.id} style={{ color: "#cbd5e1", fontSize: 13 }}>
                  {m.trainer_name || m.trainer_phone} · {m.status}
                </li>
              ))}
            </ul>
          </Panel>
        </>
      ) : null}
    </AdminShell>
  );
}
