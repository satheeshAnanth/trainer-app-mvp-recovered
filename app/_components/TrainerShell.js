import Link from "next/link";

const navItems = [
  { href: "/portal", label: "Portal" },
  { href: "/clients", label: "Clients" },
  { href: "/schedule", label: "Schedule" },
  { href: "/sessions/pending-notes", label: "Pending Notes" },
  { href: "/profile", label: "Profile" },
];

export default function TrainerShell({ title, subtitle, children }) {
  return (
    <main className="trainer-screen">
      <div className="trainer-container">
        <header className="trainer-header card">
          <div>
            <p className="eyebrow">Trainer App</p>
            <h1 className="trainer-title">{title}</h1>
            <p className="trainer-subtitle">{subtitle}</p>
          </div>
          <Link className="ghost-button" href="/login">
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
