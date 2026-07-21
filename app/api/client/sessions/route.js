import { NextResponse } from "next/server";
import { buildRecoveredPayload } from "app/lib/apiResponse";
import { hasDatabaseUrl, query } from "app/lib/db";
import { notifyClientSelfLogSubmitted } from "app/lib/pushNotifications";
import { readClientSession } from "app/lib/session";

export async function GET(request) {
  const sessionClientId = readClientSession(request.cookies.get("client_session")?.value)?.clientId ?? null;

  if (!hasDatabaseUrl() || !sessionClientId) {
    const payload = await buildRecoveredPayload("api/client/sessions");
    return NextResponse.json({
      ok: true,
      recovered: true,
      route: "api/client/sessions",
      data: payload,
    });
  }

  const rows = await query(
    `
      SELECT id, session_title, session_date, status, summary, raw_notes, payload_json, updated_at
      FROM sessions
      WHERE client_id = $1
      ORDER BY COALESCE(session_date, updated_at) DESC, updated_at DESC
      LIMIT 30
    `,
    [sessionClientId]
  );

  const parsed = rows.map((row) => ({
    id: row.id,
    sessionTitle: row.session_title,
    sessionDate: row.session_date,
    status: row.status,
    summary: row.summary,
    rawNotes: row.raw_notes,
    payload: safeParsePayload(row.payload_json),
  }));

  const sessions = parsed.map((session, idx) => ({
    ...session,
    goalRows: buildGoalRows(session.payload, parsed[idx + 1]?.payload),
  }));

  return NextResponse.json({
    ok: true,
    recovered: true,
    route: "api/client/sessions",
    data: { sessions, source: "database" },
  });
}

export async function POST(request) {
  const sessionClientId = readClientSession(request.cookies.get("client_session")?.value)?.clientId ?? null;

  const body = await request.json();
  const clientId = String(body?.clientId ?? "").trim();
  const clientName = String(body?.clientName ?? "Client").trim() || "Client";
  const sessionDate = body?.sessionDate ?? null;
  const sessionTitle = String(body?.sessionTitle ?? body?.workoutTitle ?? "").trim();
  const details = String(body?.details ?? body?.workoutSummary ?? "").trim();
  const discomfort = String(body?.discomfort ?? body?.payload?.discomfort ?? "").trim();
  const durationMinutes = body?.durationMinutes ?? body?.payload?.durationMinutes ?? null;
  const payload = buildStructuredPayload(body, {
    clientId,
    clientName,
    sessionDate,
    sessionTitle,
    details,
    discomfort,
    durationMinutes,
  });

  if (!clientId || !sessionTitle || !details) {
    return NextResponse.json(
      { ok: false, message: "clientId, sessionTitle, and details are required." },
      { status: 400 }
    );
  }

  if (sessionClientId && sessionClientId !== clientId) {
    return NextResponse.json(
      { ok: false, message: "You can only submit logs for your own client account." },
      { status: 403 }
    );
  }

  if (!hasDatabaseUrl()) {
    return NextResponse.json(
      {
        ok: true,
        recovered: true,
        route: "api/client/sessions",
        data: {
          id: `client-self-${Date.now()}`,
          client_id: clientId,
          session_title: sessionTitle,
          status: "client_submitted",
          payload_json: payload,
          source: "mock",
        },
      },
      { status: 201 }
    );
  }

  const rows = await query(
    `
      INSERT INTO sessions (
        id,
        client_id,
        client_name_snapshot,
        session_date,
        session_title,
        raw_notes,
        summary,
        status,
        payload_json,
        duration_minutes,
        created_at,
        updated_at
      )
      VALUES (
        md5(random()::text || clock_timestamp()::text),
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        'client_submitted',
        $7::text,
        $8,
        NOW(),
        NOW()
      )
      RETURNING *
    `,
    [
      clientId,
      clientName,
      sessionDate ?? null,
      sessionTitle,
      details,
      discomfort,
      JSON.stringify(payload),
      durationMinutes,
    ]
  );

  notifyClientSelfLogSubmitted({
    sessionId: rows[0]?.id,
    clientId,
    clientName,
    sessionTitle,
  }).catch(() => {});

  return NextResponse.json(
    {
      ok: true,
      recovered: true,
      route: "api/client/sessions",
      data: rows[0],
    },
    { status: 201 }
  );
}

function safeParsePayload(payload) {
  if (!payload) return {};
  if (typeof payload === "object") return payload;
  try {
    return JSON.parse(payload);
  } catch {
    return {};
  }
}

function buildGoalRows(currentPayload, previousPayload) {
  const currentExercises = Array.isArray(currentPayload?.exercises) ? currentPayload.exercises : [];
  const previousExercises = Array.isArray(previousPayload?.exercises) ? previousPayload.exercises : [];
  const previousByGoal = new Map(
    previousExercises
      .filter((ex) => ex?.source === "goal")
      .map((ex) => [String(ex?.goalExerciseId ?? ex?.name ?? ""), ex])
  );

  return currentExercises
    .filter((exercise) => exercise?.source === "goal")
    .map((exercise) => {
      const doneText = summarizeDone(exercise?.metrics);
      const key = String(exercise?.goalExerciseId ?? exercise?.name ?? "");
      const previous = previousByGoal.get(key);
      const currentLoad = extractLoad(exercise?.metrics);
      const previousLoad = extractLoad(previous?.metrics);
      let progress = "same";
      if (Number.isFinite(currentLoad) && Number.isFinite(previousLoad)) {
        if (currentLoad > previousLoad) progress = "up";
        else if (currentLoad < previousLoad) progress = "down";
      }
      return {
        name: exercise?.name ?? "Exercise",
        target: String(exercise?.target ?? "").trim(),
        done: doneText,
        completionStatus: String(exercise?.completionStatus ?? ""),
        skipReason: String(exercise?.skipReason ?? ""),
        progress,
      };
    });
}

function summarizeDone(metrics) {
  const setRows = Array.isArray(metrics?.setsData) ? metrics.setsData : [];
  if (setRows.length === 0) return "Not logged";
  const first = setRows[0] ?? {};
  const reps = first?.reps ?? "";
  const load = first?.load ?? "";
  const duration = first?.durationSecondsPerSet ?? first?.duration_seconds ?? "";
  if (reps && load) return `${setRows.length} sets x ${reps} @ ${load} kg`;
  if (duration) return `${setRows.length} sets x ${duration}s`;
  return `${setRows.length} sets logged`;
}

function extractLoad(metrics) {
  const setRows = Array.isArray(metrics?.setsData) ? metrics.setsData : [];
  const load = Number(setRows?.[0]?.load);
  return Number.isFinite(load) ? load : null;
}

function buildStructuredPayload(body, fallback) {
  const sourcePayload = body?.payload && typeof body.payload === "object" ? body.payload : {};
  const exercisesSource = Array.isArray(sourcePayload.exercises)
    ? sourcePayload.exercises
    : Array.isArray(body?.exercises)
      ? body.exercises
      : [];

  const exercises = exercisesSource
    .map((exercise, index) => normalizeExercise(exercise, index))
    .filter((exercise) => exercise.name || exercise.actual || exercise.notes || exercise.target);

  return {
    source: String(sourcePayload.source ?? body?.source ?? "client_self_log"),
    workoutTitle: String(sourcePayload.workoutTitle ?? fallback.sessionTitle ?? "").trim(),
    sessionDate: sourcePayload.sessionDate ?? fallback.sessionDate ?? null,
    durationMinutes: normalizeNumber(sourcePayload.durationMinutes ?? fallback.durationMinutes),
    workoutSummary: String(sourcePayload.workoutSummary ?? body?.workoutSummary ?? "").trim(),
    wins: String(sourcePayload.wins ?? body?.wins ?? "").trim(),
    challenges: String(sourcePayload.challenges ?? body?.challenges ?? "").trim(),
    discomfort: String(sourcePayload.discomfort ?? fallback.discomfort ?? "").trim(),
    goalTemplateName: String(sourcePayload.goalTemplateName ?? body?.goalTemplateName ?? "").trim(),
    exercises,
    details: fallback.details,
    clientId: fallback.clientId,
    clientName: fallback.clientName,
  };
}

function normalizeExercise(exercise, index) {
  const masterExerciseId = String(exercise?.masterExerciseId ?? exercise?.exerciseId ?? "").trim();
  return {
    id: String(exercise?.id ?? `exercise-${index}`),
    masterExerciseId: masterExerciseId || null,
    exerciseId: masterExerciseId || null,
    name: String(exercise?.name ?? exercise?.exercise ?? `Exercise ${index + 1}`).trim(),
    target: String(exercise?.target ?? "").trim(),
    actual: String(exercise?.actual ?? exercise?.done ?? "").trim(),
    notes: String(exercise?.notes ?? exercise?.variation ?? "").trim(),
    effort: String(exercise?.effort ?? "").trim(),
    completionStatus: String(exercise?.completionStatus ?? "planned").trim() || "planned",
    source: String(exercise?.source ?? "client_log"),
  };
}

function normalizeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}
