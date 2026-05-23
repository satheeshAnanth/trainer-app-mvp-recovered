import { NextResponse } from "next/server";
import { buildRecoveredPayload } from "app/lib/apiResponse";
import { hasDatabaseUrl, query } from "app/lib/db";
import { readTrainerPhone } from "app/lib/session";
import { shouldValidateTrainerSession, validateTrainerSessionBody } from "app/lib/sessionValidation";
import { cookies } from "next/headers";

export async function GET(request) {
  const cookieStore = cookies();
  const trainerPhone = readTrainerPhone(cookieStore.get("trainer_session")?.value);

  const { searchParams } = new URL(request.url);
  const q = String(searchParams.get("q") ?? "").trim();

  if (!trainerPhone) {
    const payload = await buildRecoveredPayload("api/sessions");
    return NextResponse.json({ ok: true, recovered: true, route: "api/sessions", data: payload });
  }

  if (!hasDatabaseUrl()) {
    const payload = await buildRecoveredPayload("api/sessions");
    return NextResponse.json({ ok: true, recovered: true, route: "api/sessions", data: payload });
  }

  let rows;
  if (q) {
    rows = await query(
      `SELECT s.id, s.client_id, s.client_name_snapshot, s.session_date, s.session_title,
              s.raw_notes, s.summary, s.status, s.duration_minutes, s.payload_json,
              s.created_at, s.updated_at
       FROM sessions s
       JOIN clients c ON c.id = s.client_id
       WHERE c.created_by_trainer = $1
         AND (
           s.session_title ILIKE $2
           OR s.client_name_snapshot ILIKE $2
           OR s.raw_notes ILIKE $2
         )
       ORDER BY s.session_date DESC, s.created_at DESC
       LIMIT 100`,
      [trainerPhone, `%${q}%`]
    );
  } else {
    rows = await query(
      `SELECT s.id, s.client_id, s.client_name_snapshot, s.session_date, s.session_title,
              s.raw_notes, s.summary, s.status, s.duration_minutes, s.payload_json,
              s.created_at, s.updated_at
       FROM sessions s
       JOIN clients c ON c.id = s.client_id
       WHERE c.created_by_trainer = $1
       ORDER BY s.session_date DESC, s.created_at DESC
       LIMIT 200`,
      [trainerPhone]
    );
  }

  const response = NextResponse.json({ ok: true, data: { sessions: rows } });
  response.headers.set("Cache-Control", "private, no-cache, stale-while-revalidate=30");
  return response;
}

export async function POST(request) {
  const body = await request.json();
  const {
    clientId,
    clientName,
    sessionDate,
    sessionTitle,
    rawNotes = "",
    summary = "",
    status = "draft",
    payload = {},
    estimatedCalories = null,
    durationMinutes = null,
  } = body;

  if (!clientId || !sessionTitle) {
    return NextResponse.json(
      { ok: false, message: "clientId and sessionTitle are required." },
      { status: 400 }
    );
  }

  if (shouldValidateTrainerSession({ status, payload })) {
    const check = await validateTrainerSessionBody(
      { status, payload },
      { skipDb: !hasDatabaseUrl() }
    );
    if (!check.ok) {
      return NextResponse.json(
        { ok: false, message: check.message, details: check.details },
        { status: 400 }
      );
    }
  }

  if (!hasDatabaseUrl()) {
    return NextResponse.json(
      {
        ok: true,
        recovered: true,
        route: "api/sessions",
        data: {
          id: `mock-session-${Date.now()}`,
          client_id: clientId,
          client_name_snapshot: clientName ?? "Unknown client",
          session_date: sessionDate ?? null,
          session_title: sessionTitle,
          raw_notes: rawNotes,
          summary,
          status,
          payload_json: payload,
          estimated_calories: estimatedCalories,
          duration_minutes: durationMinutes,
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
        estimated_calories,
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
        $7,
        $8::text,
        $9,
        $10,
        NOW(),
        NOW()
      )
      RETURNING *
    `,
    [
      clientId,
      clientName ?? "Unknown client",
      sessionDate ?? null,
      sessionTitle,
      rawNotes,
      summary,
      status,
      JSON.stringify(payload ?? {}),
      estimatedCalories,
      durationMinutes,
    ]
  );

  return NextResponse.json(
    {
      ok: true,
      recovered: true,
      route: "api/sessions",
      data: rows[0],
    },
    { status: 201 }
  );
}
