"use client";

/**
 * Schedule reminder helpers for web + Capacitor Android.
 *
 * Priority:
 * 1) Native Capacitor LocalNotifications (timed local alerts — works offline)
 * 2) Browser Notification / SW (web only; unreliable in Android WebView)
 *
 * Remote event pushes (session publish, schedule request, etc.) use FCM via
 * PushNotificationInit + server `pushNotifications.js` — not this module.
 */

import {
  buildScheduleReminderText,
  buildScheduleReminderWindows,
} from "app/lib/schedule";

const EXCLUDED = new Set(["declined", "cancelled", "completed"]);

export async function isNativeApp() {
  try {
    const { Capacitor } = await import("@capacitor/core");
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export function browserNotificationsAvailable() {
  return typeof window !== "undefined" && "Notification" in window;
}

/**
 * Request permission and persist opt-in.
 * @returns {{ ok: boolean, channel: 'native'|'browser'|null, message: string }}
 */
export async function enableScheduleReminders({ storageKey }) {
  if (typeof window === "undefined") {
    return { ok: false, channel: null, message: "Reminders are only available in the app." };
  }

  if (await isNativeApp()) {
    try {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      let perm = await LocalNotifications.checkPermissions();
      if (perm.display !== "granted") {
        perm = await LocalNotifications.requestPermissions();
      }
      if (perm.display !== "granted") {
        return {
          ok: false,
          channel: "native",
          message: "Notifications are off. Enable them in system settings, or use the schedule tab as your reminder list.",
        };
      }
      try {
        await LocalNotifications.createChannel({
          id: "schedule",
          name: "Schedule reminders",
          description: "24h and 1h alerts for upcoming sessions",
          importance: 4,
          visibility: 1,
        });
      } catch {
        // channel may already exist
      }
      window.localStorage.setItem(storageKey, "1");
      return { ok: true, channel: "native", message: "Reminders enabled." };
    } catch (error) {
      return {
        ok: false,
        channel: "native",
        message: error?.message ?? "Unable to enable reminders on this device.",
      };
    }
  }

  if (!browserNotificationsAvailable()) {
    return {
      ok: false,
      channel: null,
      message: "This browser does not support notifications.",
    };
  }

  try {
    const permission =
      Notification.permission === "granted"
        ? "granted"
        : await Notification.requestPermission();
    if (permission !== "granted") {
      return {
        ok: false,
        channel: "browser",
        message: "Notifications are off. You can still use the schedule tab as your reminder list.",
      };
    }
    window.localStorage.setItem(storageKey, "1");
    return { ok: true, channel: "browser", message: "Browser reminders enabled." };
  } catch {
    return {
      ok: false,
      channel: "browser",
      message: "Unable to enable browser notifications.",
    };
  }
}

function reminderId(eventId, hours) {
  // Capacitor expects int32-ish ids; hash to stable positive int
  const raw = `${eventId}:${hours}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) {
    hash = (hash * 31 + raw.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) || 1;
}

/**
 * Schedule or fire reminders for upcoming events (native local notifications or browser).
 */
export async function syncScheduleReminders({
  events = [],
  notifiedKeyPrefix,
  tagPrefix = "schedule",
} = {}) {
  if (typeof window === "undefined") return;

  const now = Date.now();
  const upcoming = (events ?? []).filter((event) => {
    const status = String(event?.status || "").toLowerCase();
    return !EXCLUDED.has(status);
  });

  if (await isNativeApp()) {
    try {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      const pending = await LocalNotifications.getPending();
      const pendingIds = (pending?.notifications ?? [])
        .map((n) => n.id)
        .filter((id) => typeof id === "number");
      if (pendingIds.length) {
        await LocalNotifications.cancel({ notifications: pendingIds.map((id) => ({ id })) });
      }

      const notifications = [];
      for (const event of upcoming.slice(0, 20)) {
        for (const window of buildScheduleReminderWindows(event, now)) {
          // Schedule future windows; also fire soon if within 2 minutes
          if (window.delayMs < -60_000) continue;
          const at = new Date(Math.max(now + 1500, window.fireAt));
          notifications.push({
            id: reminderId(window.eventId, window.hours),
            title: "Schedule reminder",
            body: buildScheduleReminderText(event, window.hours),
            schedule: { at },
            channelId: "schedule",
            extra: { eventId: window.eventId, hours: window.hours },
          });
        }
      }
      if (notifications.length) {
        await LocalNotifications.schedule({ notifications });
      }
    } catch {
      // ignore — permission revoked mid-session, etc.
    }
    return;
  }

  if (!browserNotificationsAvailable() || Notification.permission !== "granted") return;

  for (const event of upcoming.slice(0, 5)) {
    for (const reminder of buildScheduleReminderWindows(event, now)) {
      if (reminder.delayMs > 60_000 || reminder.delayMs < -60_000) continue;
      const storageKey = `${notifiedKeyPrefix}:${reminder.marker}`;
      if (window.localStorage.getItem(storageKey)) continue;
      window.localStorage.setItem(storageKey, "1");
      try {
        // Prefer service worker on mobile browsers; fall back to constructor on desktop.
        if (navigator.serviceWorker?.ready) {
          const reg = await navigator.serviceWorker.ready;
          if (reg?.showNotification) {
            await reg.showNotification("Schedule reminder", {
              body: buildScheduleReminderText(event, reminder.hours),
              tag: `${tagPrefix}-${event.id}-${reminder.hours}`,
            });
            continue;
          }
        }
        // eslint-disable-next-line no-new
        new Notification("Schedule reminder", {
          body: buildScheduleReminderText(event, reminder.hours),
          tag: `${tagPrefix}-${event.id}-${reminder.hours}`,
        });
      } catch {
        // Android browsers reject Notification constructor
      }
    }
  }
}

export function remindersButtonLabel({ enabled, native }) {
  if (enabled) return "Reminders enabled";
  return native ? "Enable reminders" : "Enable browser reminders";
}
