"use client";

import GymShell from "app/_components/GymShell";
import { useEffect, useState } from "react";

function Kpi({ label, value }) {
  return (
    <div style={{ border: "1px solid #1e293b", borderRadius: 12, padding: 14, background: "#111827" }}>
      <p style={{ margin: 0, fontSize: 12, color: "#94a3b8" }}>{label}</p>
      <p style={{ margin: "6px 0 0", fontSize: 28, fontWeight: 600 }}>{value ?? "—"}</p>
    </div>
  );
}

export default function GymOverviewPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/gym/ops", { credentials: "include" });
        const json = await res.json();
        if (!json.ok) throw new Error(json.message ?? "Failed to load.");
        setData(json.data);
      } catch (err) {
        setError(err.message ?? "Failed to load.");
      }
    })();
  }, []);

  const ops = data?.ops;

  return (
    <GymShell title={data?.gymName || "Overview"}>
      <p style={{ color: "#94a3b8", fontSize: 14, marginTop: 0 }}>
        {data?.privacyNote || "You manage trainer seats. Client coaching data stays private to each trainer."}
      </p>
      {error ? <p style={{ color: "#f87171" }}>{error}</p> : null}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
        <Kpi label="Seats used" value={ops ? `${ops.seatsUsed}/${ops.seatLimit}` : "…"} />
        <Kpi label="Active trainers" value={ops?.trainersActive} />
        <Kpi label="Pending invites" value={ops?.trainersInvited} />
        <Kpi label="Sessions (7d)" value={ops?.sessionsLast7Days} />
        <Kpi label="Clients (count)" value={ops?.clientsTotal} />
      </div>

      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 16, marginBottom: 10 }}>Recent invitations</h2>
        {(data?.invitations ?? []).length === 0 ? (
          <p style={{ color: "#64748b", fontSize: 13 }}>No invitations yet. Invite trainers from the Trainers tab.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
            {data.invitations.slice(0, 8).map((inv) => (
              <li
                key={inv.id}
                style={{
                  border: "1px solid #1e293b",
                  borderRadius: 10,
                  padding: "10px 12px",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div>
                  <p style={{ margin: 0, fontSize: 14 }}>{inv.trainer_name || inv.trainer_phone}</p>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748b" }}>{inv.trainer_phone}</p>
                </div>
                <span style={{ fontSize: 12, color: "#94a3b8", textTransform: "capitalize" }}>{inv.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </GymShell>
  );
}
