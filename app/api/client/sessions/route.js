import { NextResponse } from "next/server";
import { buildRecoveredPayload } from "app/lib/apiResponse";
import { hasDatabaseUrl, query } from "app/lib/db";

export async function GET(request) {
  const sessionRaw = request.cookies.get("client_session")?.value;
  let sessionClientId = null;
  try {
    sessionClientId = JSON.parse(sessionRaw ?? "{}")?.clientId ?? null;
  } catch {
    sessionClientId = sessionRaw ?? null;
  }

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
  const sessionRaw = request.cookies.get("client_session")?.value;
  let sessionClientId = null;
  try {
    sessionClientId = JSON.parse(sessionRaw ?? "{}")?.clientId ?? null;
  } catch {
    sessionClientId = sessionRaw ?? null;
  }

  const body = await request.json();
  const {
    clientId,
    clientName,
    sessionDate,
    sessionTitle,
    details,
    discomfort = "",
    durationMinutes = null,
  } = body;

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

  const payload = {
    source: "client_self_log",
    details,
    discomfort,
  };

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
      clientName ?? "Client",
      sessionDate ?? null,
      sessionTitle,
      details,
      discomfort,
      JSON.stringify(payload),
      durationMinutes,
    ]
  );

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
