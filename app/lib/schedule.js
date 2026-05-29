export const SCHEDULE_STATUSES = ["pending", "accepted", "declined", "cancelled", "completed"];
export const SCHEDULE_REMINDER_WINDOWS = [24, 1];

export function normalizeScheduleDate(value = "") {
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const ddmmyyyy = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (ddmmyyyy) {
    const [, dd, mm, yyyy] = ddmmyyyy;
    return `${yyyy}-${mm}-${dd}`;
  }
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

export function normalizeScheduleTime(value = "") {
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (/^\d{2}:\d{2}/.test(text)) return text.slice(0, 5);
  return text;
}

export function parseClientSession(raw) {
  if (!raw) return null;
  const { readClientSession } = require("app/lib/session");
  return readClientSession(raw) ?? null;
}

export function parseTrainerSession(raw) {
  if (!raw) return null;
  const { readTrainerPhone } = require("app/lib/session");
  return readTrainerPhone(raw) ?? null;
}

export function getScheduleViewer(request) {
  const trainerPhone = parseTrainerSession(request.cookies.get("trainer_session")?.value);
  if (trainerPhone) {
    return { role: "trainer", trainerPhone };
  }

  const clientSession = parseClientSession(request.cookies.get("client_session")?.value);
  if (clientSession?.clientId) {
    return {
      role: "client",
      clientId: clientSession.clientId,
      clientName: clientSession.name ?? null,
    };
  }

  return null;
}

export function sanitizeScheduleStatus(status = "") {
  const value = String(status ?? "").trim().toLowerCase();
  return SCHEDULE_STATUSES.includes(value) ? value : null;
}

export function formatScheduleDateLabel(value) {
  if (!value) return "Unscheduled";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatScheduleTimeLabel(value) {
  if (!value) return "Any time";
  if (/^\d{2}:\d{2}$/.test(value)) {
    const [hours, minutes] = value.split(":");
    const hour = Number(hours);
    const suffix = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${suffix}`;
  }
  if (/^\d{2}:\d{2}/.test(value)) {
    return formatScheduleTimeLabel(value.slice(0, 5));
  }
  return value;
}

export function buildScheduleTimestamp(event) {
  if (!event?.scheduled_date) return null;
  const time = event.scheduled_time ? event.scheduled_time.slice(0, 5) : "00:00";
  const stamp = new Date(`${event.scheduled_date}T${time}:00`);
  return Number.isNaN(stamp.getTime()) ? null : stamp;
}

export function isUpcomingEvent(event, now = Date.now()) {
  const stamp = buildScheduleTimestamp(event);
  if (!stamp) return false;
  const delta = stamp.getTime() - now;
  return delta >= 0 && delta <= 1000 * 60 * 60 * 24;
}

export function sortScheduleEvents(events = []) {
  return [...events].sort((a, b) => {
    const aStamp = buildScheduleTimestamp(a)?.getTime() ?? 0;
    const bStamp = buildScheduleTimestamp(b)?.getTime() ?? 0;
    return bStamp - aStamp;
  });
}

export function filterVisibleScheduleEvents(events = [], viewer = null) {
  if (!viewer) return [];
  if (viewer.role === "client") {
    return events.filter((event) => String(event.client_id ?? "") === String(viewer.clientId ?? ""));
  }
  if (viewer.role === "trainer") {
    const trainerPhone = String(viewer.trainerPhone ?? "");
    if (!trainerPhone) return [];
    return events.filter((event) => event && String(event.trainer_phone ?? "") === trainerPhone);
  }
  return [];
}

export function buildScheduleActionLabel(status = "") {
  const value = String(status ?? "").toLowerCase();
  if (value === "pending") return "Awaiting confirmation";
  if (value === "accepted") return "Confirmed";
  if (value === "declined") return "Declined";
  if (value === "cancelled") return "Cancelled";
  if (value === "completed") return "Completed";
  return "Scheduled";
}

export function buildScheduleReminderText(event, reminderHours = null) {
  const date = formatScheduleDateLabel(event?.scheduled_date);
  const time = formatScheduleTimeLabel(event?.scheduled_time);
  const name = event?.client_name || event?.trainer_name || "Appointment";
  const prefix = reminderHours ? `${reminderHours}h reminder` : "Schedule reminder";
  return `${prefix}: ${name} · ${date} at ${time}`;
}

export function buildScheduleReminderWindows(event, now = Date.now()) {
  const stamp = buildScheduleTimestamp(event);
  if (!stamp) return [];

  const status = String(event?.status ?? "").toLowerCase();
  if (["declined", "cancelled", "completed"].includes(status)) return [];

  return SCHEDULE_REMINDER_WINDOWS.map((hours) => {
    const fireAt = stamp.getTime() - hours * 60 * 60 * 1000;
    return {
      eventId: String(event?.id ?? ""),
      hours,
      fireAt,
      delayMs: fireAt - now,
      marker: `${event?.id ?? ""}:${event?.updated_at ?? event?.scheduled_date ?? ""}:${event?.scheduled_time ?? ""}:${hours}`,
    };
  }).filter((window) => Number.isFinite(window.delayMs));
}

export function getNextScheduleReminderSummary(event, now = Date.now()) {
  const stamp = buildScheduleTimestamp(event);
  if (!stamp) return null;

  const status = String(event?.status ?? "").toLowerCase();
  if (["declined", "cancelled", "completed"].includes(status)) return null;

  const delta = stamp.getTime() - now;
  if (delta <= 0) return "Starts now";
  if (delta > 1000 * 60 * 60 * 24) return "Next reminder: 24h before";
  if (delta > 1000 * 60 * 60) return "Next reminder: 1h before";
  return "1h reminder due now";
}
