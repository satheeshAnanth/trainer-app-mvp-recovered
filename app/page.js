import Link from "next/link";

const routes = [
  "/login",
  "/portal",
  "/clients",
  "/schedule",
  "/sessions/new",
  "/sessions/pending-notes",
  "/client-login",
  "/client-onboard",
  "/my-portal",
  "/profile",
];

export default function HomePage() {
  return (
    <main>
      <h1>Trainer App (Recovered)</h1>
      <p>
        Phase 2 reconstruction is now in progress. API routes return structured recovery data
        and pages provide usable navigation shells.
      </p>

      <h2>Recovered routes</h2>
      <ul>
        {routes.map((route) => (
          <li key={route}>
            <Link href={route}>{route}</Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
