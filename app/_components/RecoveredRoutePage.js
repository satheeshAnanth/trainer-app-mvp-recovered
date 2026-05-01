import Link from "next/link";

const navLinks = [
  { href: "/login", label: "Common Login" },
  { href: "/portal", label: "Trainer Portal" },
  { href: "/clients", label: "Clients" },
  { href: "/schedule", label: "Schedule" },
  { href: "/sessions/new", label: "New Session" },
  { href: "/my-portal", label: "Client Portal" },
];

export default function RecoveredRoutePage({ title, description, routeKey }) {
  return (
    <main>
      <h1>{title}</h1>
      <p>{description}</p>
      <p>
        Recovery route key: <code>{routeKey}</code>
      </p>

      <section>
        <h2>Quick navigation</h2>
        <ul>
          {navLinks.map((link) => (
            <li key={link.href}>
              <Link href={link.href}>{link.label}</Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
