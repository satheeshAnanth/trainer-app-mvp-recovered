import TrainerShell from "app/_components/TrainerShell";

export default function Page() {
  return (
    <TrainerShell title="Trainer Profile" subtitle="Billing and coaching identity settings.">
      <article className="card panel">
        <h2>Profile</h2>
        <div className="form-grid">
          <label className="field">
            <span>Name</span>
            <input type="text" defaultValue="Coach Sat" />
          </label>
          <label className="field">
            <span>Specialization</span>
            <input type="text" defaultValue="Strength and mobility" />
          </label>
          <label className="field">
            <span>Location</span>
            <input type="text" defaultValue="Bengaluru" />
          </label>
          <label className="field">
            <span>Pricing tier</span>
            <input type="text" defaultValue="Pro" />
          </label>
        </div>
      </article>
    </TrainerShell>
  );
}
