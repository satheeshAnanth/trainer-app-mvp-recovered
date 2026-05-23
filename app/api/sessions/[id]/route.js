import { NextResponse } from "next/server";
import { buildRecoveredPayload } from "app/lib/apiResponse";
import { hasDatabaseUrl, query } from "app/lib/db";
import { mergeSessionPayload } from "app/lib/payloadMerge";
import { requiresFullTrainerPayload, validateTrainerSessionBody } from "app/lib/sessionValidation";
import { readTrainerPhone } from "app/lib/session";
import { requireTrainerOwnsSession } from "app/lib/ownership";

export async function GET(request, { params }) {
  const { id } = params;
  const phone = readTrainerPhone(request.cookies.get("trainer_session")?.value);

  if (!phone || !hasDatabaseUrl()) {
    const payload = await buildRecoveredPayload("api/sessions/[id]", params);
    return NextResponse.json({ ok: true, recovered: true, route: "api/sessions/[id]", data: payload });
  }

  const session = await requireTrainerOwnsSession(phone, id);
  if (!session) {
    return NextResponse.json({ ok: false, message: "Session not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, data: { session } });
}

export async function PATCH(request, { params }) {
  const { id } = params;
  const phone = readTrainerPhone(request.cookies.get("trainer_session")?.value);
  if (!phone) {
    return NextResponse.json({ ok: false, message: "Login required." }, { status: 401 });
  }

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
    // ownership: session must belong to a client owned by this trainer
    const existingRows = await query(
      `SELECT s.id, s.status, s.payload_json
       FROM sessions s
       JOIN clients c ON c.id = s.client_id
       WHERE s.id = $1 AND c.created_by_trainer = $2
       LIMIT 1`,
      [id, phone]
    );
    existingRow = existingRows[0] ?? null;
    if (!existingRow) {
      return NextResponse.json({ ok: false, message: "Session not found." }, { status: 404 });
    }
  }

  const existingStatus = String(existingRow?.status ?? "").toLowerCase();
  const requestedStatus = String(status ?? "").toLowerCase();
  const finalizedStatuses = new Set(["completed", "signed_off"]);
  const isFinalized = finalizedStatuses.has(existingStatus);
  const isReopenRequest = requestedStatus === "reopened" || requestedStatus === "draft";
  if (isFinalized && payload !== undefined && !isReopenRequest) {
    return NextResponse.json(
      {
        ok: false,
        message: "This session is finalized. Reopen the session before editing structured exercise data.",
      },
      { status: 409 }
    );
  }

  const finalStatus = status ?? existingRow?.status ?? "draft";
  const mergedPayload = mergeSessionPayload(existingRow?.payload_json, payload);

  if (requiresFullTrainerPayload(finalStatus)) {
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
