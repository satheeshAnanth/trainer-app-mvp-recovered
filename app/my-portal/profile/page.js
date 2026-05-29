"use client";

import ClientShell from "app/_components/ClientShell";

export default function Page() {
  async function signOut() {
    await fetch("/api/client-auth/session", { method: "DELETE" });
    window.location.href = "/login";
  }

  return (
    <ClientShell title="My Profile" subtitle="Keep your baseline and activity data updated.">
      <article className="card panel">
        <h2>Health profile</h2>
        <div className="form-grid">
          <label className="field">
            <span>Weight (kg)</span>
            <input type="number" step="0.1" inputMode="decimal" defaultValue="67.2" />
          </label>
          <label className="field">
            <span>Height (cm)</span>
            <input type="number" inputMode="decimal" defaultValue="166" />
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

      <article className="card panel">
        <h2>Session</h2>
        <button
          type="button"
          className="ghost-button"
          style={{ width: "100%", borderColor: "#7f1d1d", color: "#fca5a5" }}
          onClick={signOut}
        >
          Sign Out
        </button>
      </article>
    </ClientShell>
  );
}
