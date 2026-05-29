"use client";

import { useEffect } from "react";

// Initialises Capacitor native plugins on app mount.
// Runs only inside the Android/iOS WebView — all imports are conditional
// so the web browser build is unaffected.
export default function CapacitorInit() {
  useEffect(() => {
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

        // Expose keyboard height as a CSS custom property so modals can
        // adjust their max-height when the soft keyboard opens.
        Keyboard.addListener("keyboardWillShow", (info) => {
          document.documentElement.style.setProperty(
            "--keyboard-height",
            `${info.keyboardHeight}px`
          );
        });
        Keyboard.addListener("keyboardWillHide", () => {
          document.documentElement.style.setProperty("--keyboard-height", "0px");
        });
      } catch {
        // Not in a Capacitor context — ignore silently.
      }
    })();
  }, []);

  return null;
}
