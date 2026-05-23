"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

function InvitePage() {
  const { token } = useParams();
  const router = useRouter();

  const [stage, setStage] = useState("loading"); // loading | details | otp | error | done
  const [invitation, setInvitation] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [otpSent, setOtpSent] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/invitations/validate?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((json) => {
        if (!json.ok) {
          setErrorMsg(json.message ?? "This invitation is no longer valid.");
          setStage("error");
        } else {
          setInvitation(json.data.invitation);
          setStage("details");
        }
      })
      .catch(() => {
        setErrorMsg("Unable to load invitation. Please check your connection.");
        setStage("error");
      });
  }, [token]);

  async function sendOtp() {
    setSending(true);
    setErrorMsg("");
    try {
      const res = await fetch(`/api/invitations/${encodeURIComponent(token)}/otp`, { method: "POST" });
      const json = await res.json();
      if (!json.ok) {
        setErrorMsg(json.message ?? "Failed to send OTP.");
        return;
      }
      setOtpSent(true);
      setStage("otp");
    } catch {
      setErrorMsg("Network error. Please try again.");
    } finally {
      setSending(false);
    }
  }

  async function verifyOtp() {
    if (otpCode.length !== 6) {
      setErrorMsg("Please enter the 6-digit code.");
      return;
    }
    setVerifying(true);
    setErrorMsg("");
    try {
      const res = await fetch(`/api/invitations/${encodeURIComponent(token)}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: otpCode }),
      });
      const json = await res.json();
      if (!json.ok) {
        setErrorMsg(json.message ?? "Verification failed.");
        return;
      }
      setStage("done");
      setTimeout(() => router.push("/my-portal"), 1500);
    } catch {
      setErrorMsg("Network error. Please try again.");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <main className="auth-screen">
      <div className="auth-container">
        <section className="card auth-card">

          {stage === "loading" && (
            <p className="auth-subtitle" style={{ textAlign: "center" }}>Loading your invitation…</p>
          )}

          {stage === "error" && (
            <>
              <p className="eyebrow">Invitation</p>
              <h1 className="auth-title">Link unavailable</h1>
              <p className="auth-subtitle">{errorMsg}</p>
              <a href="/login" className="continue-btn" style={{ display: "block", textAlign: "center", marginTop: "1rem", textDecoration: "none" }}>
                Go to login
              </a>
            </>
          )}

          {stage === "details" && invitation && (
            <>
              <p className="eyebrow">You&apos;re invited</p>
              <h1 className="auth-title">Hi {invitation.clientName}!</h1>
              <p className="auth-subtitle">
                <strong>{invitation.trainerName}</strong> has invited you to join their training programme on TrainerApp.
              </p>
              {invitation.clientGoal && (
                <div style={{ background: "#1a1a1a", borderRadius: 8, padding: "0.75rem 1rem", margin: "1rem 0" }}>
                  <p className="item-sub" style={{ marginBottom: 2 }}>Your goal</p>
                  <p style={{ color: "#e5e5e5", margin: 0 }}>{invitation.clientGoal}</p>
                </div>
              )}
              <div style={{ background: "#1a1a1a", borderRadius: 8, padding: "0.75rem 1rem", margin: "0.5rem 0 1.25rem" }}>
                <p className="item-sub" style={{ marginBottom: 2 }}>OTP will be sent to</p>
                <p style={{ color: "#6ee7b7", margin: 0, fontWeight: 600 }}>{invitation.clientPhone}</p>
              </div>
              {errorMsg && <p className="auth-alert">{errorMsg}</p>}
              <button className="continue-btn" type="button" onClick={sendOtp} disabled={sending}>
                {sending ? "Sending OTP…" : "Get started — send OTP"}
              </button>
            </>
          )}

          {stage === "otp" && (
            <>
              <p className="eyebrow">Verify</p>
              <h1 className="auth-title">Enter your OTP</h1>
              <p className="auth-subtitle">
                We sent a 6-digit code to {invitation?.clientPhone}. Enter it below to confirm your account.
              </p>
              <div className="auth-form auth-field-stack">
                <label className="auth-label">6-digit OTP</label>
                <input
                  className="auth-input"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="123456"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                />
                {errorMsg && <p className="auth-alert">{errorMsg}</p>}
                <button className="continue-btn" type="button" onClick={verifyOtp} disabled={verifying || otpCode.length < 6}>
                  {verifying ? "Verifying…" : "Verify & join"}
                </button>
                <button
                  type="button"
                  style={{ background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: "0.85rem", marginTop: "0.5rem" }}
                  onClick={sendOtp}
                  disabled={sending}
                >
                  {sending ? "Resending…" : "Resend OTP"}
                </button>
              </div>
            </>
          )}

          {stage === "done" && (
            <>
              <p className="eyebrow">Welcome</p>
              <h1 className="auth-title">You&apos;re all set!</h1>
              <p className="auth-subtitle">Taking you to your portal…</p>
            </>
          )}

        </section>
      </div>
    </main>
  );
}

export default function InvitePageWrapper() {
  return (
    <Suspense fallback={
      <main className="auth-screen">
        <div className="auth-container">
          <p className="auth-subtitle">Loading…</p>
        </div>
      </main>
    }>
      <InvitePage />
    </Suspense>
  );
}
