import { NextResponse } from "next/server";
import { buildRecoveredPayload } from "app/lib/apiResponse";
import { hasDatabaseUrl, query } from "app/lib/db";

export async function GET(_request, { params }) {
  const payload = await buildRecoveredPayload("api/sessions/[id]/complete", params);
  return NextResponse.json({
    ok: true,
    recovered: true,
    route: "api/sessions/[id]/complete",
    data: payload,
  });
}

export async function PATCH(request, { params }) {
  const { id } = params;
  const body = await request.json();
  const reviewer = body?.reviewer ?? "trainer";

  if (!id) {
    return NextResponse.json({ ok: false, message: "Session id is required." }, { status: 400 });
  }

  if (!hasDatabaseUrl()) {
    return NextResponse.json({
      ok: true,
      recovered: true,
      route: "api/sessions/[id]/complete",
      data: { id, status: "completed", reviewer, source: "mock" },
    });
  }

  const rows = await query(
    `
      UPDATE sessions
      SET
        status = 'completed',
        payload_json = COALESCE(payload_json, '{}')::jsonb || $2::jsonb,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [
      id,
      JSON.stringify({
        reviewed_by: reviewer,
        reviewed_at: new Date().toISOString(),
      }),
    ]
  );

  if (!rows[0]) {
    return NextResponse.json({ ok: false, message: "Session not found." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    recovered: true,
    route: "api/sessions/[id]/complete",
    data: rows[0],
  });
}
