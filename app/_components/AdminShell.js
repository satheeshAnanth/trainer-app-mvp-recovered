"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NAV = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/trainers", label: "Trainers" },
  { href: "/admin/exercise-media", label: "Media" },
  { href: "/admin/ux-prototypes/exercise-add", label: "UX Lab" },
];

export default function AdminShell({ title, children }) {
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function refreshSession() {
    setChecking(true);
    setError("");
    try {
      const res = await fetch("/api/admin/session", { credentials: "include" });
      const json = await res.json();
      if (json?.data?.authenticated) {
        setAuthenticated(true);
        setAdminEmail(json.data.email || "");
      } else {
        setAuthenticated(false);
        setAdminEmail("");
        if (json?.data?.loginConfigured === false) {
          setError("Admin login is not configured (ADMIN_EMAIL / ADMIN_PASSWORD).");
        }
      }
    } catch {
      setAuthenticated(false);
      setError("Unable to check admin session.");
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    refreshSession();
  }, []);

  async function login(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.message ?? "Login failed.");
      setPassword("");
      setAuthenticated(true);
      setAdminEmail(json?.data?.email || email);
    } catch (err) {
      setAuthenticated(false);
      setError(err.message ?? "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST", credentials: "include" });
    setAuthenticated(false);
    setAdminEmail("");
    setEmail("");
    setPassword("");
    window.location.href = "/admin/login";
  }

  if (checking) {
    return (
      <main style={shellStyle}>
        <p style={eyebrowStyle}>{title || "TRAINER APP — ADMIN"}</p>
        <p style={{ color: "#94a3b8", fontSize: 13 }}>Checking session…</p>
      </main>
    );
  }

  if (!authenticated) {
    if (typeof window !== "undefined") {
      const next = encodeURIComponent(pathname || "/admin");
      window.location.replace(`/admin/login?next=${next}`);
    }
    return (
      <main style={shellStyle}>
        <p style={eyebrowStyle}>{title || "TRAINER APP — ADMIN"}</p>
        <p style={{ color: "#94a3b8", fontSize: 13 }}>Redirecting to sign in…</p>
      </main>
    );
  }

  return (
    <main style={shellStyle}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div>
          <p style={{ ...eyebrowStyle, margin: 0 }}>{title || "TRAINER APP — ADMIN"}</p>
          <nav style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            {NAV.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    ...navLinkStyle,
                    background: active ? "#134e4a" : "#111827",
                    color: active ? "#6ee7b7" : "#94a3b8",
                  }}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ color: "#64748b", fontSize: 12 }}>{adminEmail}</span>
          <button type="button" onClick={logout} style={{ ...buttonStyle, background: "#111827", color: "#94a3b8" }}>
            Sign out
          </button>
        </div>
      </header>
      <div style={{ marginTop: 20 }}>{children}</div>
    </main>
  );
}

export function StatusBadge({ status }) {
  const value = String(status || "unknown").toLowerCase();
  const tone = STATUS_TONES[value] || STATUS_TONES.unknown;
  return (
    <span style={{
      fontSize: 11,
      padding: "2px 8px",
      borderRadius: 999,
      border: `1px solid ${tone.border}`,
      color: tone.color,
      whiteSpace: "nowrap",
    }}
    >
      {value}
    </span>
  );
}

export function Kpi({ label, value, color }) {
  return (
    <div style={{ background: "#111827", borderRadius: 8, padding: "14px 18px", border: "1px solid rgba(255,255,255,0.06)" }}>
      <p style={{ color: "#94a3b8", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 4px" }}>{label}</p>
      <p style={{ color: color ?? "#e2e8f0", fontSize: 28, fontWeight: 700, margin: 0 }}>{value ?? "—"}</p>
    </div>
  );
}

export function Panel({ title, action, children }) {
  return (
    <section style={{ marginTop: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 10 }}>
        <p style={{ color: "#64748b", fontSize: 11, margin: 0, letterSpacing: "0.06em" }}>{title}</p>
        {action || null}
      </div>
      {children}
    </section>
  );
}

export function Field({ label, children }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ color: "#64748b", fontSize: 11 }}>{label}</span>
      {children}
    </label>
  );
}

export const adminInputStyle = {
  width: "100%",
  background: "#0f172a",
  border: "1px solid #334155",
  borderRadius: 6,
  padding: "8px 12px",
  color: "#e2e8f0",
  fontFamily: "monospace",
  boxSizing: "border-box",
};

export const adminButtonStyle = {
  background: "#134e4a",
  border: "none",
  borderRadius: 6,
  padding: "8px 14px",
  color: "#6ee7b7",
  fontFamily: "monospace",
  cursor: "pointer",
  fontSize: 12,
};

export const adminGhostButtonStyle = {
  ...adminButtonStyle,
  background: "#111827",
  color: "#94a3b8",
  border: "1px solid #334155",
};

export const adminCardStyle = {
  background: "#111827",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 8,
  padding: 14,
};

const STATUS_TONES = {
  active: { color: "#34d399", border: "rgba(52,211,153,0.35)" },
  trial: { color: "#facc15", border: "rgba(250,204,21,0.35)" },
  expired: { color: "#fb923c", border: "rgba(251,146,60,0.35)" },
  suspended: { color: "#f87171", border: "rgba(248,113,113,0.35)" },
  pending: { color: "#facc15", border: "rgba(250,204,21,0.35)" },
  pending_review: { color: "#facc15", border: "rgba(250,204,21,0.35)" },
  approved: { color: "#34d399", border: "rgba(52,211,153,0.35)" },
  rejected: { color: "#f87171", border: "rgba(248,113,113,0.35)" },
  completed: { color: "#60a5fa", border: "rgba(96,165,250,0.35)" },
  draft: { color: "#94a3b8", border: "rgba(148,163,184,0.35)" },
  unknown: { color: "#94a3b8", border: "rgba(148,163,184,0.35)" },
};

const shellStyle = {
  padding: 24,
  maxWidth: 1100,
  margin: "0 auto",
  fontFamily: "monospace",
};

const eyebrowStyle = {
  color: "#6ee7b7",
  fontSize: 13,
  letterSpacing: "0.04em",
};

const inputStyle = adminInputStyle;
const buttonStyle = adminButtonStyle;

const navLinkStyle = {
  textDecoration: "none",
  borderRadius: 6,
  padding: "6px 10px",
  fontSize: 12,
};
