"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/portal", label: "Portal" },
  { href: "/clients", label: "Clients" },
  { href: "/schedule", label: "Schedule" },
  { href: "/sessions/pending-notes", label: "Pending Notes" },
  { href: "/profile", label: "Profile" },
];

export default function TrainerShell({ title, subtitle, children }) {
  const pathname = usePathname();

  async function signOut() {
    await fetch("/api/auth/session", { method: "DELETE" });
    window.location.href = "/login";
  }

  return (
    <main className="trainer-screen">
      <div className="trainer-container">
        <header className="trainer-header card">
          <div>
            <p className="eyebrow">Trainer App</p>
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
