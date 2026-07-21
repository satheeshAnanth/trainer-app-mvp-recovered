"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PendingNotesRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/sessions/needs-work");
  }, [router]);
  return null;
}
