import TrainerShell from "app/_components/TrainerShell";

export default function Page() {
  return (
    <TrainerShell title="New Session" subtitle="Capture workout details with mandatory sections.">
      <article className="card panel">
        <h2>Session details</h2>
        <div className="form-grid">
          <label className="field">
            <span>Client</span>
            <input type="text" defaultValue="Ananya Rao" />
          </label>
          <label className="field">
            <span>Date</span>
            <input type="date" />
          </label>
          <label className="field">
            <span>Session title</span>
            <input type="text" defaultValue="Strength + treadmill conditioning" />
          </label>
        </div>
      </article>

      <article className="card panel">
        <h2>Mandatory note sections</h2>
        <div className="form-grid">
          <label className="field full">
            <span>Warm-up notes *</span>
            <textarea rows={3} defaultValue="Treadmill walk 10 mins, dynamic mobility." />
          </label>
          <label className="field full">
            <span>Main work notes *</span>
            <textarea rows={4} defaultValue="Lower body compounds, tempo sets, posture cues." />
          </label>
          <label className="field full">
            <span>Cool down and recovery *</span>
            <textarea rows={3} defaultValue="Stretching and breath work, RPE settled to 4/10." />
          </label>
          <label className="field full">
            <span>Goal progress update *</span>
            <textarea rows={3} defaultValue="Bodyweight stable, stamina improved, better squat depth." />
          </label>
        </div>
      </article>

      <article className="card panel">
        <h2>Exercise metrics</h2>
        <div className="metric-card">
          <p className="item-title">Treadmill Walk (Warm-up)</p>
          <div className="form-grid">
            <label className="field">
              <span>Duration (min) *</span>
              <input type="number" defaultValue="10" />
            </label>
            <label className="field">
              <span>Incline (%) *</span>
              <input type="number" defaultValue="6" />
            </label>
            <label className="field">
              <span>Distance (km) *</span>
              <input type="number" step="0.01" defaultValue="1.10" />
            </label>
            <label className="field">
              <span>Custom metric: HR avg</span>
              <input type="number" defaultValue="128" />
            </label>
          </div>
        </div>
        <div className="quick-actions">
          <button className="ghost-button" type="button">Add exercise</button>
          <button className="mint-button" type="button">Save session</button>
        </div>
      </article>
    </TrainerShell>
  );
}
