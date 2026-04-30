import Link from "next/link";
import TrainerShell from "app/_components/TrainerShell";

export default function Page() {
  return (
    <TrainerShell title="Clients" subtitle="Track each client and progress details.">
      <article className="card panel">
        <h2>Client list</h2>
        <ul className="list">
          <li className="list-item">
            <div>
              <p className="item-title">Ananya Rao</p>
              <p className="item-sub">Goal: Lose 5kg in 12 weeks</p>
            </div>
            <Link href="/clients/c1" className="ghost-button">
              Open
            </Link>
          </li>
          <li className="list-item">
            <div>
              <p className="item-title">Rohit Sharma</p>
              <p className="item-sub">Goal: Improve mobility and back health</p>
            </div>
            <Link href="/clients/c2" className="ghost-button">
              Open
            </Link>
          </li>
        </ul>
      </article>
    </TrainerShell>
  );
}
