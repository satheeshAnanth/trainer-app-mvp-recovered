"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconClients, IconHome, IconLog, IconProfile, IconSchedule } from "app/_components/NavIcons";

const navItems = [
  { href: "/portal", label: "Home", Icon: IconHome },
  { href: "/clients", label: "Clients", Icon: IconClients },
  { href: "/sessions/new", label: "Log", Icon: IconLog },
  { href: "/schedule", label: "Schedule", Icon: IconSchedule },
  { href: "/profile", label: "Profile", Icon: IconProfile },
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
        <header className="trainer-header card surface-elevated">
          <div>
            <p className="eyebrow">Trainer App</p>
            <h1 className="trainer-title">{title}</h1>
            <p className="trainer-subtitle">{subtitle}</p>
          </div>
        </header>

        <nav className="trainer-nav card surface-elevated trainer-nav-desktop" aria-label="Trainer sections">
          {navItems.map((item) => {
            const active = item.href === "/sessions/new"
              ? pathname.startsWith("/sessions")
              : item.href === "/clients"
              ? pathname.startsWith("/clients")
              : pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-pill ${active ? "nav-pill-active" : ""}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <section className="trainer-content">{children}</section>

        <nav className="mobile-tabbar" aria-label="Primary">
          <div className="mobile-tabbar-inner card surface-glass">
            {navItems.map((item) => {
              const active = item.href === "/sessions/new"
                ? pathname.startsWith("/sessions")
                : item.href === "/clients"
                ? pathname.startsWith("/clients")
                : pathname === item.href;
              const Icon = item.Icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`mobile-tab ${active ? "mobile-tab-active" : ""}`}
                >
                  <span className="mobile-tab-icon">
                    <Icon className="mobile-tab-svg" />
                  </span>
                  <span className="mobile-tab-label">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </main>
  );
}
