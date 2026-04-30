import TrainerShell from "app/_components/TrainerShell";

export default function Page() {
  return (
    <TrainerShell title="Schedule" subtitle="Upcoming sessions and status.">
      <article className="card panel">
        <h2>Upcoming</h2>
        <ul className="list">
          <li className="list-item">
            <div>
              <p className="item-title">Ananya - Strength Session</p>
              <p className="item-sub">02 May, 6:00 PM</p>
            </div>
            <span className="status-chip">Scheduled</span>
          </li>
          <li className="list-item">
            <div>
              <p className="item-title">Rohit - Mobility Session</p>
              <p className="item-sub">03 May, 8:00 AM</p>
            </div>
            <span className="status-chip">Confirmed</span>
          </li>
        </ul>
      </article>
    </TrainerShell>
  );
}
