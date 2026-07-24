"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const NAV = [
  { href: "/gym", label: "Overview", exact: true },
  { href: "/gym/trainers", label: "Trainers" },
];

export default function GymShell({ title, children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/gym/session", { credentials: "include" });
        const json = await res.json();
        if (cancelled) return;
        if (json?.data?.authenticated) {
          setSession(json.data);
        } else {
          setSession(null);
          if (pathname !== "/gym/login") {
            router.replace(`/login?next=${encodeURIComponent(pathname)}`);
          }
        }
      } catch {
        if (!cancelled) setSession(null);
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  async function logout() {
    await fetch("/api/gym/session", { method: "DELETE", credentials: "include" });
    router.replace("/login");
  }

  if (pathname === "/gym/login") {
    return <>{children}</>;
  }

  if (checking) {
    return (
      <main style={{ minHeight: "100vh", background: "#0b1220", color: "#e2e8f0", padding: 24 }}>
        <p style={{ color: "#94a3b8" }}>Loading gym portal…</p>
      </main>
    );
  }

  if (!session) return null;

  return (
    <main style={{ minHeight: "100vh", background: "#0b1220", color: "#e2e8f0" }}>
      <header
        style={{
          borderBottom: "1px solid #1e293b",
          padding: "14px 20px",
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div>
          <p style={{ margin: 0, fontSize: 11, letterSpacing: "0.08em", color: "#64748b", textTransform: "uppercase" }}>
            Gym portal
          </p>
          <h1 style={{ margin: "2px 0 0", fontSize: 18 }}>{title || session.gymName || "Gym"}</h1>
        </div>
        <nav style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {NAV.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  textDecoration: "none",
                  fontSize: 13,
                  color: active ? "#0b1220" : "#cbd5e1",
                  background: active ? "#34d399" : "transparent",
                  border: active ? "none" : "1px solid #334155",
                }}
              >
                {item.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={logout}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              fontSize: 13,
              color: "#94a3b8",
              background: "transparent",
              border: "1px solid #334155",
              cursor: "pointer",
            }}
          >
            Sign out
          </button>
        </nav>
      </header>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "20px 16px 48px" }}>{children}</div>
    </main>
  );
}
