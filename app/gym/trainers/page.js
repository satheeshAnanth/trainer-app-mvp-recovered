"use client";

import GymShell from "app/_components/GymShell";
import { useCallback, useEffect, useState } from "react";

export default function GymTrainersPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/gym/ops", { credentials: "include" });
    const json = await res.json();
    if (!json.ok) throw new Error(json.message ?? "Failed to load.");
    setData(json.data);
  }, []);

  useEffect(() => {
    load().catch((err) => setError(err.message ?? "Failed to load."));
  }, [load]);

  async function invite(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setInviteLink("");
    try {
      const res = await fetch("/api/gym/invitations", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trainerPhone: phone, trainerName: name }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.message ?? "Invite failed.");
      setInviteLink(json.data?.inviteLink || "");
      setPhone("");
      setName("");
      await load();
    } catch (err) {
      setError(err.message ?? "Invite failed.");
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(membershipId) {
    if (!window.confirm("Remove this trainer from gym seats? Their clients stay with them.")) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/gym/ops?membershipId=${encodeURIComponent(membershipId)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.message ?? "Remove failed.");
      await load();
    } catch (err) {
      setError(err.message ?? "Remove failed.");
    } finally {
      setBusy(false);
    }
  }

  const ops = data?.ops;
  const memberships = (data?.memberships ?? []).filter((m) => m.status !== "removed");

  return (
    <GymShell title={data?.gymName || "Trainers"}>
      <p style={{ color: "#94a3b8", fontSize: 14, marginTop: 0 }}>
        Seats {ops ? `${ops.seatsUsed} / ${ops.seatLimit}` : "…"} · Invite trainers who operate at your facility.
      </p>

      <form
        onSubmit={invite}
        style={{
          border: "1px solid #1e293b",
          borderRadius: 12,
          padding: 16,
          background: "#111827",
          display: "grid",
          gap: 10,
          marginBottom: 20,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 15 }}>Invite trainer</h2>
        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          Phone
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            required
            placeholder="+91…"
            style={{
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid #334155",
              background: "#0b1220",
              color: "#e2e8f0",
            }}
          />
        </label>
        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          Name (optional)
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid #334155",
              background: "#0b1220",
              color: "#e2e8f0",
            }}
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          style={{
            padding: "10px 12px",
            borderRadius: 8,
            border: "none",
            background: "#34d399",
            color: "#0b1220",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {busy ? "Sending…" : "Send invite"}
        </button>
        {inviteLink ? (
          <p style={{ margin: 0, fontSize: 12, color: "#94a3b8", wordBreak: "break-all" }}>
            Invite link: {inviteLink}
          </p>
        ) : null}
      </form>

      {error ? <p style={{ color: "#f87171" }}>{error}</p> : null}

      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
        {memberships.map((m) => (
          <li
            key={m.id}
            style={{
              border: "1px solid #1e293b",
              borderRadius: 10,
              padding: "12px 14px",
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "center",
            }}
          >
            <div>
              <p style={{ margin: 0, fontSize: 14 }}>{m.trainer_name || m.trainer_phone}</p>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748b" }}>
                {m.trainer_phone} · {m.status}
                {m.joined_at ? ` · joined ${String(m.joined_at).slice(0, 10)}` : ""}
              </p>
            </div>
            {m.status !== "removed" ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => removeMember(m.id)}
                style={{
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid #334155",
                  background: "transparent",
                  color: "#f87171",
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                Remove
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </GymShell>
  );
}
