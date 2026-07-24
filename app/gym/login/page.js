"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

/** Legacy gym login URL — roles are record-based; always use unified /login. */
function Redirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const next = searchParams.get("next") || "/gym";
    router.replace(`/login?next=${encodeURIComponent(next)}`);
  }, [router, searchParams]);

  return (
    <main className="auth-screen">
      <div className="auth-container">
        <p className="auth-subtitle">Redirecting to sign in…</p>
      </div>
    </main>
  );
}

export default function GymLoginRedirectPage() {
  return (
    <Suspense fallback={<main className="auth-screen" />}>
      <Redirect />
    </Suspense>
  );
}
