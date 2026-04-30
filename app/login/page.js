export default function Page() {
  return (
    <main className="auth-screen">
      <div className="auth-container">
        <section className="card auth-card">
          <div className="auth-progress">
            <div className="auth-progress-meta">
              <span>Step 1 of 4</span>
              <span>Phone</span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: "25%" }} />
            </div>
          </div>

          <p className="eyebrow">Welcome</p>
          <h1 className="auth-title">Sign In</h1>
          <p className="auth-subtitle">Enter your mobile number to get started</p>

          <div className="auth-form">
            <label className="auth-label" htmlFor="mobile">
              Mobile number
            </label>
            <div className="phone-input-shell">
              <span className="country-code">+91</span>
              <input
                id="mobile"
                type="tel"
                placeholder="98765 43210"
                className="phone-input"
                autoComplete="tel"
              />
            </div>

            <button type="button" className="continue-btn" disabled>
              Continue
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
