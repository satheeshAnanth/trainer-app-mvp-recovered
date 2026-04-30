import Link from "next/link";
import TrainerShell from "app/_components/TrainerShell";

export default function Page() {
  return (
    <TrainerShell title="Pending Notes" subtitle="Sessions waiting for mandatory sections completion.">
      <article className="card panel">
        <h2>Action required</h2>
        <ul className="list">
          <li className="list-item">
            <div>
              <p className="item-title">Rohit Sharma - Mobility Session</p>
              <p className="item-sub">Missing: Goal update, Cool down notes</p>
            </div>
            <Link href="/sessions/s2" className="mint-button">Complete</Link>
          </li>
          <li className="list-item">
            <div>
              <p className="item-title">Ananya Rao - Strength Session</p>
              <p className="item-sub">Missing: Exercise custom metrics</p>
            </div>
            <Link href="/sessions/s1" className="mint-button">Complete</Link>
          </li>
        </ul>
      </article>
    </TrainerShell>
  );
}
