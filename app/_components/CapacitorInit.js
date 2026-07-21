"use client";

import { useEffect } from "react";

// Initialises Capacitor native plugins on app mount.
// Runs only inside the Android/iOS WebView — all imports are conditional
// so the web browser build is unaffected.
export default function CapacitorInit() {
  useEffect(() => {
    // Keep --keyboard-height in sync for components that need it.
    // Prefer visualViewport so we don't fight Capacitor's body resize.
    const syncViewport = () => {
      const vv = window.visualViewport;
      if (!vv) {
        document.documentElement.style.setProperty("--keyboard-height", "0px");
        return;
      }
      const keyboard = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      // Only publish a keyboard inset when the viewport actually shrank;
      // with Keyboard.resize=body the layout viewport already accounts for it,
      // so leave 0 to avoid double-shrinking full-screen sheets.
      document.documentElement.style.setProperty("--keyboard-height", "0px");
      document.documentElement.style.setProperty("--vv-height", `${Math.round(vv.height)}px`);
      document.documentElement.style.setProperty("--vv-offset-top", `${Math.round(vv.offsetTop)}px`);
      document.documentElement.dataset.keyboardOpen = keyboard > 80 ? "1" : "0";
    };

    syncViewport();
    window.visualViewport?.addEventListener("resize", syncViewport);
    window.visualViewport?.addEventListener("scroll", syncViewport);
    window.addEventListener("resize", syncViewport);

    (async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (!Capacitor.isNativePlatform()) return;

        const [{ StatusBar, Style }, { SplashScreen }, { Keyboard }] = await Promise.all([
          import("@capacitor/status-bar"),
          import("@capacitor/splash-screen"),
          import("@capacitor/keyboard"),
        ]);

        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: "#020617" });

        await SplashScreen.hide();

        // With resize: 'body', the WebView already shrinks. Do not also set
        // --keyboard-height from plugin events or full-screen pickers collapse.
        Keyboard.addListener("keyboardWillShow", () => {
          document.documentElement.dataset.keyboardOpen = "1";
          window.scrollTo(0, 0);
        });
        Keyboard.addListener("keyboardDidShow", () => {
          document.documentElement.dataset.keyboardOpen = "1";
          window.scrollTo(0, 0);
        });
        Keyboard.addListener("keyboardWillHide", () => {
          document.documentElement.dataset.keyboardOpen = "0";
        });
        Keyboard.addListener("keyboardDidHide", () => {
          document.documentElement.dataset.keyboardOpen = "0";
        });
      } catch {
        // Not in a Capacitor context — ignore silently.
      }
    })();

    return () => {
      window.visualViewport?.removeEventListener("resize", syncViewport);
      window.visualViewport?.removeEventListener("scroll", syncViewport);
      window.removeEventListener("resize", syncViewport);
    };
  }, []);

  return null;
}
