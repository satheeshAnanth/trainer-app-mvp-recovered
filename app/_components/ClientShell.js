import Link from "next/link";

const navItems = [
  { href: "/my-portal", label: "Home" },
  { href: "/my-portal/profile", label: "Profile" },
  { href: "/my-portal/schedule", label: "Schedule" },
  { href: "/my-portal/self-log", label: "Self Log" },
  { href: "/my-portal/tips", label: "Tips" },
];

export default function ClientShell({ title, subtitle, children }) {
  return (
    <main className="trainer-screen">
      <div className="trainer-container">
        <header className="trainer-header card">
          <div>
            <p className="eyebrow">Client Portal</p>
            <h1 className="trainer-title">{title}</h1>
            <p className="trainer-subtitle">{subtitle}</p>
          </div>
          <Link className="ghost-button" href="/client-login">
            Sign Out
          </Link>
        </header>

        <nav className="trainer-nav card">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="nav-pill">
              {item.label}
            </Link>
          ))}
        </nav>

        <section className="trainer-content">{children}</section>
      </div>
    </main>
  );
}
