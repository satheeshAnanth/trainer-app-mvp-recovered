import TrainerShell from "app/_components/TrainerShell";

export default function Page() {
  return (
    <TrainerShell title="Client Tips" subtitle="Reusable coaching tips and actionable reminders.">
      <article className="card panel">
        <h2>Suggested tips</h2>
        <ul className="list">
          <li className="list-item">
            <div>
              <p className="item-title">Hydration checkpoint</p>
              <p className="item-sub">Drink 500ml water 45 mins before training.</p>
            </div>
            <button className="ghost-button" type="button">Send</button>
          </li>
          <li className="list-item">
            <div>
              <p className="item-title">Recovery habit</p>
              <p className="item-sub">Target 7+ hours sleep and 10 min mobility before bed.</p>
            </div>
            <button className="ghost-button" type="button">Send</button>
          </li>
          <li className="list-item">
            <div>
              <p className="item-title">Protein tracking</p>
              <p className="item-sub">Aim for 100g protein and log meal quality daily.</p>
            </div>
            <button className="ghost-button" type="button">Send</button>
          </li>
        </ul>
      </article>
    </TrainerShell>
  );
}
