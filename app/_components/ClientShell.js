"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/my-portal", label: "Home" },
  { href: "/my-portal/profile", label: "Profile" },
  { href: "/my-portal/schedule", label: "Schedule" },
  { href: "/my-portal/self-log", label: "Self Log" },
  { href: "/my-portal/tips", label: "Tips" },
];

export default function ClientShell({ title, subtitle, children }) {
  const pathname = usePathname();

  async function signOut() {
    await fetch("/api/client-auth/session", { method: "DELETE" });
    window.location.href = "/client-login";
  }

  return (
    <main className="trainer-screen">
      <div className="trainer-container">
        <header className="trainer-header card">
          <div>
            <p className="eyebrow">Client Portal</p>
            <h1 className="trainer-title">{title}</h1>
            <p className="trainer-subtitle">{subtitle}</p>
          </div>
          <button type="button" className="ghost-button" onClick={signOut}>
            Sign Out
          </button>
        </header>

        <nav className="trainer-nav card">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-pill ${pathname === item.href ? "nav-pill-active" : ""}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <section className="trainer-content">{children}</section>

        <nav className="mobile-tabbar card">
          {navItems.slice(0, 4).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`mobile-tab ${pathname === item.href ? "mobile-tab-active" : ""}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </main>
  );
}
