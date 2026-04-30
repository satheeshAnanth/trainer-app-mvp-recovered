import TrainerShell from "app/_components/TrainerShell";

export default function Page() {
  return (
    <TrainerShell
      title="Portal"
      subtitle="Session capture and client management overview."
    >
      <div className="stats-grid">
        <article className="card panel">
          <p className="panel-label">Today sessions</p>
          <p className="panel-value">8</p>
        </article>
        <article className="card panel">
          <p className="panel-label">Pending notes</p>
          <p className="panel-value">3</p>
        </article>
        <article className="card panel">
          <p className="panel-label">Active clients</p>
          <p className="panel-value">24</p>
        </article>
      </div>

      <article className="card panel">
        <h2>Quick actions</h2>
        <div className="quick-actions">
          <a href="/sessions/new" className="mint-button">
            New session
          </a>
          <a href="/clients" className="ghost-button">
            Open clients
          </a>
          <a href="/schedule" className="ghost-button">
            View schedule
          </a>
        </div>
      </article>
    </TrainerShell>
  );
}
