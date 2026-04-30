import TrainerShell from "app/_components/TrainerShell";

export default function Page() {
  return (
    <TrainerShell title="Session Details" subtitle="Review captured notes, metrics, and sharing state.">
      <article className="card panel">
        <h2>Session summary</h2>
        <ul className="list">
          <li className="list-item"><span>Client</span><span>Ananya Rao</span></li>
          <li className="list-item"><span>Status</span><span className="status-chip">Completed</span></li>
          <li className="list-item"><span>Duration</span><span>65 min</span></li>
          <li className="list-item"><span>Estimated calories</span><span>420 kcal</span></li>
        </ul>
      </article>

      <article className="card panel">
        <h2>Mandatory sections snapshot</h2>
        <ul className="list">
          <li className="list-item"><span>Warm-up notes</span><span>Done</span></li>
          <li className="list-item"><span>Main work notes</span><span>Done</span></li>
          <li className="list-item"><span>Cool down notes</span><span>Done</span></li>
          <li className="list-item"><span>Goal update</span><span>Done</span></li>
        </ul>
      </article>

      <article className="card panel">
        <h2>Exercise metric review</h2>
        <div className="metric-card">
          <p className="item-title">Treadmill Walk</p>
          <p className="item-sub">Duration 10m | Incline 6% | Distance 1.1km | HR avg 128</p>
        </div>
        <div className="quick-actions">
          <button className="ghost-button" type="button">Edit</button>
          <button className="mint-button" type="button">Share with client</button>
        </div>
      </article>
    </TrainerShell>
  );
}
