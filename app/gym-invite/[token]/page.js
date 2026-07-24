"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function GymInviteAcceptPage() {
  const { token } = useParams();
  const router = useRouter();
  const [invite, setInvite] = useState(null);
  const [error, setError] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [step, setStep] = useState("preview");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/gym-invitations/${token}`);
        const json = await res.json();
        if (!json.ok) throw new Error(json.message ?? "Invite not found.");
        setInvite(json.data);
        if (json.data?.trainerName) setName(json.data.trainerName);
      } catch (err) {
        setError(err.message ?? "Invite not found.");
      }
    })();
  }, [token]);

  async function sendOtp() {
    if (!invite?.trainerPhone) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: invite.trainerPhone }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.message ?? "Failed to send OTP.");
      setStep("otp");
    } catch (err) {
      setError(err.message ?? "Failed to send OTP.");
    } finally {
      setLoading(false);
    }
  }

  async function accept(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/gym-invitations/${token}/accept`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, name }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.message ?? "Accept failed.");
      router.replace("/portal");
    } catch (err) {
      setError(err.message ?? "Accept failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0b1220",
        color: "#e2e8f0",
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "min(100%, 440px)",
          border: "1px solid #1e293b",
          borderRadius: 16,
          padding: 24,
          background: "#111827",
        }}
      >
        <p style={{ margin: 0, fontSize: 11, letterSpacing: "0.08em", color: "#64748b", textTransform: "uppercase" }}>
          Gym trainer invite
        </p>
        {invite ? (
          <>
            <h1 style={{ margin: "8px 0", fontSize: 22 }}>Join {invite.gymName}</h1>
            <p style={{ color: "#94a3b8", fontSize: 14, marginTop: 0 }}>
              {invite.gymCity ? `${invite.gymCity} · ` : ""}
              Confirm with OTP on {invite.trainerPhone}. You keep owning your clients — the gym only manages your seat.
            </p>
            {invite.status !== "pending" ? (
              <p style={{ color: "#facc15" }}>This invitation is {invite.status}.</p>
            ) : step === "preview" ? (
              <button
                type="button"
                onClick={sendOtp}
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: "none",
                  background: "#34d399",
                  color: "#0b1220",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {loading ? "Sending…" : "Send OTP to accept"}
              </button>
            ) : (
              <form onSubmit={accept} style={{ display: "grid", gap: 12 }}>
                <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
                  Your name
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
                <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
                  OTP
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    required
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
                  disabled={loading}
                  style={{
                    padding: "12px 14px",
                    borderRadius: 10,
                    border: "none",
                    background: "#34d399",
                    color: "#0b1220",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {loading ? "Joining…" : "Join gym & open trainer portal"}
                </button>
              </form>
            )}
          </>
        ) : (
          <p style={{ color: "#94a3b8" }}>{error || "Loading invite…"}</p>
        )}
        {error && invite ? <p style={{ color: "#f87171", fontSize: 13 }}>{error}</p> : null}
      </div>
    </main>
  );
}
