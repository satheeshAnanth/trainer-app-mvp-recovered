import ClientShell from "app/_components/ClientShell";

export default function Page() {
  return (
    <ClientShell title="My Schedule" subtitle="Upcoming trainer sessions and reminders.">
      <article className="card panel">
        <h2>Upcoming</h2>
        <ul className="list">
          <li className="list-item">
            <div>
              <p className="item-title">Strength Session</p>
              <p className="item-sub">Saturday, 6:00 PM</p>
            </div>
            <span className="status-chip">Scheduled</span>
          </li>
          <li className="list-item">
            <div>
              <p className="item-title">Mobility Session</p>
              <p className="item-sub">Tuesday, 7:30 AM</p>
            </div>
            <span className="status-chip">Scheduled</span>
          </li>
        </ul>
      </article>
    </ClientShell>
  );
}
