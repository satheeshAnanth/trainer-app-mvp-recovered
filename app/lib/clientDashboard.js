import {
  buildScheduleActionLabel,
  buildScheduleTimestamp,
  formatScheduleDateLabel,
  formatScheduleTimeLabel,
} from "app/lib/schedule";

/** Normalize API/database/mock session shapes for dashboard use. */
export function normalizeClientSession(raw) {
  if (!raw || typeof raw !== "object") return null;
  const sessionTitle = String(raw.sessionTitle ?? raw.title ?? raw.session_title ?? "Session").trim() || "Session";
  const sessionDate = raw.sessionDate ?? raw.date ?? raw.session_date ?? null;
  const status = String(raw.status ?? "").toLowerCase();
  const payload =
    raw.payload && typeof raw.payload === "object" ? raw.payload : safeParseMaybeJson(raw.payload_json);
  let goalRows = Array.isArray(raw.goalRows) ? raw.goalRows : [];
  if (goalRows.length === 0 && payload) {
    goalRows = deriveGoalRowsFromPayload(payload);
  }
  return {
    ...raw,
    sessionTitle,
    sessionDate,
    status,
    payload,
    goalRows,
    amount: raw.amount ?? payload?.amountInr ?? payload?.payment?.amount ?? null,
    paid: raw.paid ?? payload?.paid ?? payload?.paymentStatus === "paid",
  };
}

function safeParseMaybeJson(value) {
  if (!value || typeof value === "object") return {};
  try {
    const o = JSON.parse(value);
    return o && typeof o === "object" ? o : {};
  } catch {
    return {};
  }
}

function deriveGoalRowsFromPayload(payload) {
  const exercises = Array.isArray(payload?.exercises) ? payload.exercises : [];
  return exercises
    .filter((ex) => {
      const source = String(ex?.source ?? "").toLowerCase();
      return source === "goal" || source === "goal_template" || Boolean(ex?.fromGoal);
    })
    .map((exercise) => ({
      name: exercise?.name ?? "Exercise",
      target: String(exercise?.target ?? "").trim(),
      done: String(exercise?.actual ?? exercise?.done ?? "").trim(),
      completionStatus: String(exercise?.completionStatus ?? ""),
      skipReason: String(exercise?.skipReason ?? ""),
      progress: "same",
    }));
}

const FEEDBACK_STATUSES = new Set(["client_submitted", "pending_notes"]);

/** Sessions waiting on trainer review / feedback (client-visible). */
export function listSessionsAwaitingTrainerFeedback(sessions) {
  return sessions
    .map(normalizeClientSession)
    .filter(Boolean)
    .filter((s) => FEEDBACK_STATUSES.has(s.status));
}

/** Outstanding payment lines from session list + payload hints (mock uses amount/paid). */
export function listOutstandingPayments(sessions) {
  const lines = [];
  for (const raw of sessions) {
    const s = normalizeClientSession(raw);
    if (!s?.id) continue;
    const amount = Number(s.amount);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    if (s.paid === true) continue;
    lines.push({
      sessionId: s.id,
      title: s.sessionTitle,
      amountInr: amount,
    });
  }
  return lines;
}

export function sumPayments(lines) {
  return lines.reduce((acc, row) => acc + (Number(row.amountInr) || 0), 0);
}

/** Next upcoming calendar item (pending or accepted with future timestamp). */
export function pickNextScheduleItem(events, now = Date.now()) {
  const list = Array.isArray(events) ? events : [];
  const upcoming = list
    .map((event) => {
      const status = String(event?.status ?? "").toLowerCase();
      if (status === "declined" || status === "cancelled" || status === "completed") return null;
      const ts = buildScheduleTimestamp(event)?.getTime();
      if (!Number.isFinite(ts)) return null;
      return { event, ts };
    })
    .filter(Boolean)
    .filter(({ ts }) => ts >= now - 60 * 1000)
    .sort((a, b) => a.ts - b.ts);
  return upcoming[0]?.event ?? null;
}

export function countPendingScheduleConfirmations(events) {
  return (Array.isArray(events) ? events : []).filter(
    (e) => String(e?.status ?? "").toLowerCase() === "pending"
  ).length;
}

/**
 * Goal snapshot from latest session that has goal-linked rows (payload / goalRows).
 */
export function buildGoalProgressSnapshot(sessions, profileGoalText = "") {
  const normalized = sessions.map(normalizeClientSession).filter(Boolean);
  const dated = [...normalized].sort((a, b) => {
    const ta = parseSessionSortTime(a);
    const tb = parseSessionSortTime(b);
    return tb - ta;
  });

  const withGoals = dated.find((s) => Array.isArray(s.goalRows) && s.goalRows.length > 0);
  if (!withGoals) {
    return {
      primaryGoal: String(profileGoalText ?? "").trim(),
      sessionTitle: null,
      sessionDate: null,
      total: 0,
      completed: 0,
      partial: 0,
      skipped: 0,
      unresolved: 0,
      sampleRows: [],
    };
  }

  const rows = withGoals.goalRows;
  let completed = 0;
  let partial = 0;
  let skipped = 0;
  let unresolved = 0;
  for (const row of rows) {
    const st = String(row.completionStatus ?? "").toLowerCase();
    if (st === "completed") completed += 1;
    else if (st === "partial") partial += 1;
    else if (st === "skipped") skipped += 1;
    else unresolved += 1;
  }

  return {
    primaryGoal: String(profileGoalText ?? "").trim(),
    sessionTitle: withGoals.sessionTitle,
    sessionDate: withGoals.sessionDate,
    total: rows.length,
    completed,
    partial,
    skipped,
    unresolved,
    sampleRows: rows.slice(0, 4),
  };
}

function parseSessionSortTime(session) {
  const raw = session.sessionDate ?? session.updated_at ?? session.created_at ?? session.date;
  if (!raw) return 0;
  const t = new Date(raw).getTime();
  return Number.isFinite(t) ? t : 0;
}

export function formatSessionDateShort(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/** Merged recent activity for dashboard feed. */
export function buildRecentActivity(sessions, scheduleEvents, { limit = 8 } = {}) {
  const items = [];

  for (const raw of sessions) {
    const s = normalizeClientSession(raw);
    if (!s) continue;
    const t = parseSessionSortTime(s);
    const status = s.status;
    let label = "Session updated";
    if (status === "completed") label = "Session completed";
    else if (status === "client_submitted") label = "Workout submitted for coach review";
    else if (status === "pending_notes") label = "Coach finishing session notes";
    else if (status === "scheduled") label = "Session scheduled";
    items.push({
      id: `session-${s.id}`,
      kind: "session",
      sortKey: t,
      title: label,
      detail: s.sessionTitle,
      meta: formatSessionDateShort(s.sessionDate) || undefined,
    });
  }

  for (const ev of scheduleEvents || []) {
    const ts = buildScheduleTimestamp(ev)?.getTime() ?? 0;
    const status = String(ev?.status ?? "").toLowerCase();
    const action = buildScheduleActionLabel(status);
    items.push({
      id: `schedule-${ev.id}`,
      kind: "schedule",
      sortKey: ts || parseSessionSortTime({ sessionDate: ev.scheduled_date }),
      title: `Schedule · ${action}`,
      detail: `${formatScheduleDateLabel(ev.scheduled_date)} · ${formatScheduleTimeLabel(ev.scheduled_time)}`,
      meta: ev.notes ? String(ev.notes).slice(0, 56) : undefined,
    });
  }

  items.sort((a, b) => b.sortKey - a.sortKey);
  return items.slice(0, limit);
}

/**
 * Hero title + subtitle lines for ClientShell / hero strip.
 */
export function deriveHeroCopy({
  clientName,
  pendingConfirmCount,
  paymentTotalInr,
  feedbackSessions,
  nextEvent,
}) {
  const first = String(clientName ?? "")
    .trim()
    .split(/\s+/)[0];
  const welcomeTitle = first ? `Welcome back, ${first}` : "Welcome back";

  let subtitle = "Here's what's happening in your coaching journey.";

  if (pendingConfirmCount > 0) {
    subtitle =
      pendingConfirmCount === 1
        ? "One schedule request needs your confirmation."
        : `${pendingConfirmCount} schedule requests need your confirmation.`;
  } else if (paymentTotalInr > 0) {
    subtitle = `You have ₹${Math.round(paymentTotalInr)} in pending session fees.`;
  } else if (feedbackSessions.length > 0) {
    subtitle =
      feedbackSessions.length === 1
        ? "Your coach is reviewing a workout you submitted."
        : `${feedbackSessions.length} workouts are awaiting coach feedback.`;
  } else if (nextEvent) {
    subtitle = `Next on your calendar: ${formatScheduleDateLabel(nextEvent.scheduled_date)} · ${formatScheduleTimeLabel(
      nextEvent.scheduled_time
    )}.`;
  } else {
    subtitle = "You're caught up — log a workout or plan your next session.";
  }

  return { welcomeTitle, subtitle };
}

export function describeScheduleCard(event) {
  if (!event) return null;
  const status = String(event.status ?? "").toLowerCase();
  return {
    id: event.id,
    dateLabel: formatScheduleDateLabel(event.scheduled_date),
    timeLabel: formatScheduleTimeLabel(event.scheduled_time),
    statusLabel: buildScheduleActionLabel(status),
    notes: String(event.notes ?? "").trim(),
    rawStatus: status,
  };
}
