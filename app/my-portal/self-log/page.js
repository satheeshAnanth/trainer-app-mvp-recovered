import ClientShell from "app/_components/ClientShell";

export default function Page() {
  return (
    <ClientShell title="Self Log" subtitle="Submit your off-trainer workout for approval.">
      <article className="card panel">
        <h2>Submit session</h2>
        <div className="form-grid">
          <label className="field">
            <span>Workout type *</span>
            <input type="text" defaultValue="Home lower body" />
          </label>
          <label className="field">
            <span>Duration (min) *</span>
            <input type="number" defaultValue="45" />
          </label>
          <label className="field full">
            <span>Workout details *</span>
            <textarea rows={4} defaultValue="Bodyweight squats, lunges, glute bridge, brisk walk warm-up." />
          </label>
          <label className="field full">
            <span>Any pain / discomfort</span>
            <textarea rows={3} defaultValue="Mild lower-back tightness after lunges." />
          </label>
        </div>
        <div className="quick-actions">
          <button className="mint-button" type="button">Submit for trainer review</button>
        </div>
      </article>
    </ClientShell>
  );
}
