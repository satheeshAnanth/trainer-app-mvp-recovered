import { NextResponse } from "next/server";
import { buildRecoveredPayload } from "app/lib/apiResponse";
import { hasDatabaseUrl, query } from "app/lib/db";

export async function GET(_request, { params }) {
  const payload = await buildRecoveredPayload("api/sessions/[id]", params);
  return NextResponse.json({
    ok: true,
    recovered: true,
    route: "api/sessions/[id]",
    data: payload,
  });
}

export async function PATCH(request, { params }) {
  const { id } = params;
  const body = await request.json();
  const {
    sessionTitle,
    rawNotes,
    summary,
    status,
    payload,
    estimatedCalories,
    durationMinutes,
  } = body;

  if (!id) {
    return NextResponse.json({ ok: false, message: "Session id is required." }, { status: 400 });
  }

  if (!hasDatabaseUrl()) {
    return NextResponse.json({
      ok: true,
      recovered: true,
      route: "api/sessions/[id]",
      data: {
        id,
        session_title: sessionTitle ?? null,
        raw_notes: rawNotes ?? null,
        summary: summary ?? null,
        status: status ?? null,
        payload_json: payload ?? null,
        estimated_calories: estimatedCalories ?? null,
        duration_minutes: durationMinutes ?? null,
        source: "mock",
      },
    });
  }

  const rows = await query(
    `
      UPDATE sessions
      SET
        session_title = COALESCE($2, session_title),
        raw_notes = COALESCE($3, raw_notes),
        summary = COALESCE($4, summary),
        status = COALESCE($5, status),
        payload_json = COALESCE($6::text, payload_json),
        estimated_calories = COALESCE($7, estimated_calories),
        duration_minutes = COALESCE($8, duration_minutes),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [
      id,
      sessionTitle ?? null,
      rawNotes ?? null,
      summary ?? null,
      status ?? null,
      payload ? JSON.stringify(payload) : null,
      estimatedCalories ?? null,
      durationMinutes ?? null,
    ]
  );

  if (!rows[0]) {
    return NextResponse.json({ ok: false, message: "Session not found." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    recovered: true,
    route: "api/sessions/[id]",
    data: rows[0],
  });
}
