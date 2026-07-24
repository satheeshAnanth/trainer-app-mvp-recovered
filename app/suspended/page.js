"use client";

export default function SuspendedPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#0f0f0f",
        color: "#e5e5e5",
        padding: "2rem",
        textAlign: "center",
        fontFamily: "var(--font-inter, sans-serif)",
      }}
    >
      <div style={{ maxWidth: 480 }}>
        <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>⏸</div>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.75rem", color: "#fff" }}>
          Account Suspended
        </h1>
        <p style={{ color: "#aaa", lineHeight: 1.6, marginBottom: "1.5rem" }}>
          Your Cadence account is currently suspended or your free trial has ended.
          Please contact us to reactivate your account.
        </p>
        <p style={{ color: "#6ee7b7", fontSize: "0.9rem" }}>
          Reach out at{" "}
          <a href="mailto:support@raak-advisory.co.in" style={{ color: "#6ee7b7" }}>
            support@raak-advisory.co.in
          </a>
        </p>
        <a
          href="/login"
          style={{
            display: "inline-block",
            marginTop: "2rem",
            padding: "0.6rem 1.5rem",
            borderRadius: "9999px",
            border: "1px solid #333",
            color: "#aaa",
            textDecoration: "none",
            fontSize: "0.875rem",
          }}
        >
          Back to login
        </a>
      </div>
    </main>
  );
}
