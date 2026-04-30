import ClientShell from "app/_components/ClientShell";

export default function Page() {
  return (
    <ClientShell title="My Portal" subtitle="Track personal sessions and coach updates.">
      <article className="card panel">
        <h2>Weekly summary</h2>
        <div className="stats-grid">
          <div className="metric-card">
            <p className="panel-label">Completed sessions</p>
            <p className="panel-value">4</p>
          </div>
          <div className="metric-card">
            <p className="panel-label">Self-logged workouts</p>
            <p className="panel-value">2</p>
          </div>
          <div className="metric-card">
            <p className="panel-label">Coach feedback pending</p>
            <p className="panel-value">1</p>
          </div>
        </div>
      </article>
    </ClientShell>
  );
}
