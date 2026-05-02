import { buildGoalProgressSnapshot, normalizeClientSession } from "app/lib/clientDashboard";

const ACTIVE_STATUSES = new Set(["completed", "client_submitted", "pending_notes", "scheduled"]);

function toDateKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function parseSortTime(session) {
  const raw = session?.sessionDate ?? session?.updated_at ?? session?.created_at ?? session?.date;
  const time = new Date(raw).getTime();
  return Number.isFinite(time) ? time : 0;
}

function formatDayLabel(date) {
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function countCurrentStreak(normalized) {
  const byDay = new Set(
    normalized
      .filter((session) => ACTIVE_STATUSES.has(session.status))
      .map((session) => toDateKey(session.sessionDate ?? session.updated_at ?? session.created_at))
      .filter(Boolean)
  );

  let streak = 0;
  const probe = new Date();
  for (let i = 0; i < 60; i += 1) {
    const key = toDateKey(probe);
    if (!key || !byDay.has(key)) break;
    streak += 1;
    probe.setDate(probe.getDate() - 1);
  }
  return streak;
}

export function buildClientProgressSnapshot(sessions, profileGoalText = "") {
  const normalized = (Array.isArray(sessions) ? sessions : []).map(normalizeClientSession).filter(Boolean);
  const sorted = [...normalized].sort((a, b) => parseSortTime(b) - parseSortTime(a));
  const latestSession = sorted[0] ?? null;

  const daily = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - offset);
    const key = toDateKey(date);
    const items = normalized.filter((session) => {
      if (!ACTIVE_STATUSES.has(session.status)) return false;
      return toDateKey(session.sessionDate ?? session.updated_at ?? session.created_at) === key;
    });

    daily.push({
      key,
      label: date.toLocaleDateString(undefined, { weekday: "short" }),
      fullLabel: formatDayLabel(date),
      value: items.length,
      items: items.slice(0, 2).map((item) => ({
        id: item.id,
        title: item.sessionTitle,
        dateLabel: item.sessionDate ? formatDayLabel(new Date(item.sessionDate)) : "",
        status: item.status,
      })),
    });
  }

  const totalSessions = normalized.length;
  const completedSessions = normalized.filter((session) => session.status === "completed").length;
  const submittedSessions = normalized.filter((session) => session.status === "client_submitted").length;
  const reviewQueue = normalized.filter(
    (session) => session.status === "client_submitted" || session.status === "pending_notes"
  ).length;
  const activeDays = daily.filter((day) => day.value > 0).length;
  const completionRate = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;
  const streakDays = countCurrentStreak(normalized);
  const goalSnapshot = buildGoalProgressSnapshot(normalized, profileGoalText);

  return {
    latestSession,
    totalSessions,
    completedSessions,
    submittedSessions,
    reviewQueue,
    activeDays,
    streakDays,
    completionRate,
    daily,
    goalSnapshot,
  };
}
