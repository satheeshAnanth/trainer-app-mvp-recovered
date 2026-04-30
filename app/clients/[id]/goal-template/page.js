import TrainerShell from "app/_components/TrainerShell";

export default function Page() {
  return (
    <TrainerShell title="Goal Template" subtitle="Mandatory per-session goal tracking fields.">
      <article className="card panel">
        <h2>Required updates every session</h2>
        <div className="form-grid">
          <label className="field">
            <span>Bodyweight (kg) *</span>
            <input type="number" step="0.1" defaultValue="67.2" />
          </label>
          <label className="field">
            <span>Energy score (1-10) *</span>
            <input type="number" min="1" max="10" defaultValue="8" />
          </label>
          <label className="field">
            <span>Pain/discomfort note *</span>
            <input type="text" defaultValue="No knee pain this week." />
          </label>
          <label className="field full">
            <span>Trainer progress assessment *</span>
            <textarea rows={4} defaultValue="Strength progression on lower body lifts is consistent. Continue gradual overload." />
          </label>
        </div>
        <div className="quick-actions">
          <button className="mint-button" type="button">Save template update</button>
        </div>
      </article>
    </TrainerShell>
  );
}
