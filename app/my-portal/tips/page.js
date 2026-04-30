import ClientShell from "app/_components/ClientShell";

export default function Page() {
  return (
    <ClientShell title="Coach Tips" subtitle="Daily action points curated by your trainer.">
      <article className="card panel">
        <h2>This week</h2>
        <ul className="list">
          <li className="list-item">
            <div>
              <p className="item-title">Hydration target</p>
              <p className="item-sub">At least 2.5L water per day.</p>
            </div>
          </li>
          <li className="list-item">
            <div>
              <p className="item-title">Protein reminder</p>
              <p className="item-sub">Add a protein source in each meal.</p>
            </div>
          </li>
          <li className="list-item">
            <div>
              <p className="item-title">Sleep consistency</p>
              <p className="item-sub">Sleep before 11 PM for recovery quality.</p>
            </div>
          </li>
        </ul>
      </article>
    </ClientShell>
  );
}
