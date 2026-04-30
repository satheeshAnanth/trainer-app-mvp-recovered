import ClientShell from "app/_components/ClientShell";

export default function Page() {
  return (
    <ClientShell title="My Profile" subtitle="Keep your baseline and activity data updated.">
      <article className="card panel">
        <h2>Health profile</h2>
        <div className="form-grid">
          <label className="field">
            <span>Weight (kg)</span>
            <input type="number" step="0.1" defaultValue="67.2" />
          </label>
          <label className="field">
            <span>Height (cm)</span>
            <input type="number" defaultValue="166" />
          </label>
          <label className="field">
            <span>Activity level</span>
            <input type="text" defaultValue="Moderate" />
          </label>
          <label className="field">
            <span>Primary goal</span>
            <input type="text" defaultValue="Lose 5kg in 12 weeks" />
          </label>
        </div>
      </article>
    </ClientShell>
  );
}
