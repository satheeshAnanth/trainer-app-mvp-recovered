"use client";

import { useEffect } from "react";

export default function PushNotificationInit() {
  useEffect(() => {
    let removeRegistration;
    let removeRegistrationError;

    (async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (!Capacitor.isNativePlatform()) return;

        const { PushNotifications } = await import("@capacitor/push-notifications");

        let permStatus = await PushNotifications.checkPermissions();
        if (permStatus.receive === "prompt") {
          permStatus = await PushNotifications.requestPermissions();
        }
        if (permStatus.receive !== "granted") return;

        const registrationListener = await PushNotifications.addListener("registration", async (token) => {
          try {
            await fetch("/api/push/register", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({
                token: token.value,
                platform: Capacitor.getPlatform(),
              }),
            });
          } catch {
            // registration retry happens on next app launch
          }
        });
        removeRegistration = () => registrationListener.remove();

        const errorListener = await PushNotifications.addListener("registrationError", (error) => {
          console.warn("[push] registration error", error?.error ?? error);
        });
        removeRegistrationError = () => errorListener.remove();

        await PushNotifications.register();
      } catch {
        // Push not available (missing google-services.json, web build, etc.)
      }
    })();

    return () => {
      if (removeRegistration) removeRegistration();
      if (removeRegistrationError) removeRegistrationError();
    };
  }, []);

  return null;
}
