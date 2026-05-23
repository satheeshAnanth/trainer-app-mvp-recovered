"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function JoinRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const ref = searchParams.get("ref") ?? "";
    const dest = ref
      ? `/onboard/trainer?ref=${encodeURIComponent(ref)}`
      : "/onboard/trainer";
    router.replace(dest);
  }, [router, searchParams]);

  return (
    <main style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#0f1117" }}>
      <p style={{ color: "#94a3b8", fontFamily: "sans-serif" }}>Redirecting…</p>
    </main>
  );
}

export default function JoinPage() {
  return (
    <Suspense>
      <JoinRedirect />
    </Suspense>
  );
}
