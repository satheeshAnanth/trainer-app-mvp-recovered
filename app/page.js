"use client";

import Link from "next/link";

export default function HomePage() {
  return (
    <main className="auth-screen">
      <div className="auth-container">
        <section className="card auth-card">
          <p className="eyebrow">Welcome</p>
          <h1 className="auth-title">Who are you?</h1>
          <p className="auth-subtitle">Choose your role to continue.</p>

          <div className="quick-actions" style={{ marginTop: "1.25rem" }}>
            <Link href="/login" className="mint-button">
              I am a Trainer
            </Link>
            <Link href="/client-login" className="ghost-button">
              I am a Client
            </Link>
          </div>

          <article className="card panel" style={{ marginTop: "1rem" }}>
            <h2>New trainer?</h2>
            <p className="item-sub">
              Complete onboarding with profile, pricing, and a 3-step walkthrough before entering the app.
            </p>
            <Link href="/onboard/trainer" className="mint-button">
              Start trainer onboarding
            </Link>
          </article>
        </section>
      </div>
    </main>
  );
}
