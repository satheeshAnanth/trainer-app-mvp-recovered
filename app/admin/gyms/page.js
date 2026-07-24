"use client";

import AdminShell, { Panel, adminButtonStyle, adminInputStyle, adminGhostButtonStyle } from "app/_components/AdminShell";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function AdminGymsPage() {
  const [gyms, setGyms] = useState([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    city: "",
    phone: "",
    seatLimit: 5,
    adminPhone: "",
    adminName: "",
  });
  const [busy, setBusy] = useState(false);

  async function load() {
    setError("");
    try {
      const res = await fetch("/api/admin/gyms", { credentials: "include" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.message ?? "Failed to load gyms.");
      setGyms(json.data?.gyms ?? []);
      if (json.data?.note) setError(json.data.note);
    } catch (err) {
      setError(err.message ?? "Failed to load.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createGym(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/gyms", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.message ?? "Create failed.");
      setForm({ name: "", city: "", phone: "", seatLimit: 5, adminPhone: "", adminName: "" });
      await load();
    } catch (err) {
      setError(err.message ?? "Create failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell title="GYMS">
      <p style={{ color: "#94a3b8", fontSize: 13, marginTop: 0 }}>
        B2B seat orgs. Solo trainers are unchanged. Gym admins use{" "}
        <Link href="/gym/login" style={{ color: "#34d399" }}>
          /gym/login
        </Link>
        .
      </p>

      <Panel title="CREATE GYM">
        <form onSubmit={createGym} style={{ display: "grid", gap: 10, maxWidth: 480 }}>
          <input
            style={adminInputStyle}
            placeholder="Gym name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
          <input
            style={adminInputStyle}
            placeholder="City"
            value={form.city}
            onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
          />
          <input
            style={adminInputStyle}
            placeholder="Gym phone (optional)"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          />
          <input
            style={adminInputStyle}
            type="number"
            min={1}
            placeholder="Seat limit"
            value={form.seatLimit}
            onChange={(e) => setForm((f) => ({ ...f, seatLimit: Number(e.target.value) || 1 }))}
          />
          <input
            style={adminInputStyle}
            placeholder="First admin phone *"
            value={form.adminPhone}
            onChange={(e) => setForm((f) => ({ ...f, adminPhone: e.target.value }))}
            required
          />
          <input
            style={adminInputStyle}
            placeholder="Admin name"
            value={form.adminName}
            onChange={(e) => setForm((f) => ({ ...f, adminName: e.target.value }))}
          />
          <button type="submit" disabled={busy} style={adminButtonStyle}>
            {busy ? "Creating…" : "Create gym"}
          </button>
        </form>
      </Panel>

      {error ? <p style={{ color: "#f87171", fontSize: 13 }}>{error}</p> : null}

      <Panel
        title="ALL GYMS"
        action={
          <button type="button" onClick={load} style={adminGhostButtonStyle}>
            Refresh
          </button>
        }
      >
        <div style={{ display: "grid", gap: 8 }}>
          {gyms.length === 0 ? (
            <p style={{ color: "#64748b", fontSize: 13, margin: 0 }}>No gyms yet.</p>
          ) : (
            gyms.map((g) => (
              <Link
                key={g.id}
                href={`/admin/gyms/${g.id}`}
                style={{
                  textDecoration: "none",
                  border: "1px solid #1e293b",
                  borderRadius: 10,
                  padding: "12px 14px",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div>
                  <p style={{ margin: 0, color: "#e2e8f0", fontSize: 14 }}>{g.name}</p>
                  <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 11 }}>
                    {g.slug}
                    {g.city ? ` · ${g.city}` : ""} · seats {g.seats_used ?? 0}/{g.seat_limit}
                  </p>
                </div>
                <span style={{ color: "#94a3b8", fontSize: 12, textTransform: "capitalize" }}>{g.status}</span>
              </Link>
            ))
          )}
        </div>
      </Panel>
    </AdminShell>
  );
}
