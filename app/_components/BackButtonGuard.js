"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { closeTopModal } from "app/lib/modalStack";

const ROOT_TABS = new Set(["/portal", "/clients", "/sessions/new", "/schedule", "/profile", "/my-portal"]);

export default function BackButtonGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const lastBackRef = useRef(0);

  useEffect(() => {
    let removeListener;

    (async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (!Capacitor.isNativePlatform()) return;

        const { App } = await import("@capacitor/app");
        const handle = await App.addListener("backButton", () => {
          if (closeTopModal()) return;

          if (typeof window !== "undefined" && window.history.length > 1) {
            router.back();
            return;
          }

          if (ROOT_TABS.has(pathname)) {
            const now = Date.now();
            if (now - lastBackRef.current < 2000) {
              App.exitApp();
              return;
            }
            lastBackRef.current = now;
            return;
          }

          router.back();
        });
        removeListener = () => handle.remove();
      } catch {
        // not in Capacitor
      }
    })();

    return () => {
      if (removeListener) removeListener();
    };
  }, [pathname, router]);

  return null;
}
