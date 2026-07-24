"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconHome, IconLog, IconPayments, IconProfile, IconSchedule } from "app/_components/NavIcons";

const navItems = [
  { href: "/my-portal", label: "Home", Icon: IconHome },
  { href: "/my-portal/schedule", label: "Schedule", Icon: IconSchedule },
  { href: "/my-portal/self-log", label: "Log", Icon: IconLog },
  { href: "/my-portal/payments", label: "Payments", Icon: IconPayments },
  { href: "/my-portal/profile", label: "Profile", Icon: IconProfile },
];

export default function ClientShell({ title, subtitle, children }) {
  const pathname = usePathname();

  async function signOut() {
    await fetch("/api/client-auth/session", { method: "DELETE" });
    window.location.href = "/login";
  }

  return (
    <main className="trainer-screen client-screen">
      <div className="trainer-container">
        <header className="trainer-header card surface-elevated">
          <div className="trainer-header-row">
            <img src="/cadence-mark.svg" alt="" width={28} height={28} className="trainer-brand-mark" />
            <div>
              <h1 className="trainer-title">{title}</h1>
              {subtitle ? <p className="trainer-subtitle">{subtitle}</p> : null}
            </div>
          </div>
        </header>

        <nav className="trainer-nav card surface-elevated trainer-nav-desktop" aria-label="Client sections">
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

        <nav className="mobile-tabbar" aria-label="Primary">
          <div className="mobile-tabbar-inner card surface-glass">
            {navItems.map((item) => {
              const active = item.href === "/my-portal"
                ? pathname === "/my-portal"
                : pathname.startsWith(item.href);
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
