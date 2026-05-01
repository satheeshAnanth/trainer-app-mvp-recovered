import { NextResponse } from "next/server";
import { buildRecoveredPayload } from "app/lib/apiResponse";
import { hasDatabaseUrl, query } from "app/lib/db";
import { shouldValidateTrainerSession, validateTrainerSessionBody } from "app/lib/sessionValidation";

export async function GET() {
  const payload = await buildRecoveredPayload("api/sessions");
  return NextResponse.json({
    ok: true,
    recovered: true,
    route: "api/sessions",
    data: payload,
  });
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
