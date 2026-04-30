import TrainerShell from "app/_components/TrainerShell";

export default function Page() {
  return (
    <TrainerShell title="Client Profile" subtitle="Single client snapshot and session readiness.">
      <article className="card panel">
        <h2>Ananya Rao</h2>
        <ul className="list">
          <li className="list-item"><span>Phone</span><span>+91-9876543210</span></li>
          <li className="list-item"><span>Current goal</span><span>Lose 5kg in 12 weeks</span></li>
          <li className="list-item"><span>Age / Gender</span><span>31 / Female</span></li>
          <li className="list-item"><span>Activity level</span><span>Moderate</span></li>
        </ul>
      </article>

      <article className="card panel">
        <h2>Session readiness checks</h2>
        <ul className="list">
          <li className="list-item"><span>Goal-template update due</span><span className="status-chip">Yes</span></li>
          <li className="list-item"><span>Client off-session pending</span><span>1 item</span></li>
          <li className="list-item"><span>Last session shared</span><span>2 days ago</span></li>
        </ul>
      </article>
    </TrainerShell>
  );
}
