"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function ClientOnboardInner() {
  const searchParams = useSearchParams();
  const phone = searchParams.get("phone");

  return (
    <main className="auth-screen">
      <div className="auth-container">
        <section className="card auth-card">
          <p className="eyebrow">Client onboarding</p>
          <h1 className="auth-title">Talk to your trainer</h1>
          <p className="auth-subtitle">
            Your number is not active in the app yet. Ask your trainer to add you as a client first.
          </p>
          {phone ? <p className="auth-subtitle">Tried mobile: {phone}</p> : null}
          <div className="quick-actions" style={{ marginTop: "1rem" }}>
            <Link href="/client-login" className="mint-button">
              Back to client login
            </Link>
            <Link href="/login" className="ghost-button">
              Trainer login
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

export default function ClientOnboardPage() {
  return (
    <Suspense
      fallback={
        <main className="auth-screen">
          <div className="auth-container">
            <p className="auth-subtitle">Loading…</p>
          </div>
        </main>
      }
    >
      <ClientOnboardInner />
    </Suspense>
  );
}
