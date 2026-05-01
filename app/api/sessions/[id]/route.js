import { NextResponse } from "next/server";
import { buildRecoveredPayload } from "app/lib/apiResponse";
import { hasDatabaseUrl, query } from "app/lib/db";
import { mergeSessionPayload } from "app/lib/payloadMerge";
import { isNonDraftTrainerStatus, validateTrainerSessionBody } from "app/lib/sessionValidation";

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

  let existingRow = null;
  if (hasDatabaseUrl()) {
    const existingRows = await query(
      `SELECT status, payload_json FROM sessions WHERE id = $1 LIMIT 1`,
      [id]
    );
    existingRow = existingRows[0] ?? null;
    if (!existingRow) {
      return NextResponse.json({ ok: false, message: "Session not found." }, { status: 404 });
    }
  }

  const finalStatus = status ?? existingRow?.status ?? "draft";
  const mergedPayload = mergeSessionPayload(existingRow?.payload_json, payload);

  if (isNonDraftTrainerStatus(finalStatus)) {
    const check = await validateTrainerSessionBody(
      { status: finalStatus, payload: mergedPayload },
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
    return NextResponse.json({
      ok: true,
      recovered: true,
      route: "api/sessions/[id]",
      data: {
        id,
        session_title: sessionTitle ?? null,
        raw_notes: rawNotes ?? null,
        summary: summary ?? null,
        status: finalStatus,
        payload_json: mergedPayload,
        estimated_calories: estimatedCalories ?? null,
        duration_minutes: durationMinutes ?? null,
        source: "mock",
      },
    });
  }

  const payloadToStore = payload !== undefined ? mergedPayload : undefined;
  const rows = await query(
    `
      UPDATE sessions
      SET
        session_title = COALESCE($2, session_title),
        raw_notes = COALESCE($3, raw_notes),
        summary = COALESCE($4, summary),
        status = COALESCE($5, status),
        payload_json = CASE WHEN $6::boolean THEN $7::text ELSE payload_json END,
        estimated_calories = COALESCE($8, estimated_calories),
        duration_minutes = COALESCE($9, duration_minutes),
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
      payload !== undefined,
      payloadToStore !== undefined ? JSON.stringify(payloadToStore) : null,
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
