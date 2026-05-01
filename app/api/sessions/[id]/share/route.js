import { NextResponse } from "next/server";
import { buildRecoveredPayload } from "app/lib/apiResponse";
import { hasDatabaseUrl, query } from "app/lib/db";

export async function GET(_request, { params }) {
  const payload = await buildRecoveredPayload("api/sessions/[id]/share", params);
  return NextResponse.json({
    ok: true,
    recovered: true,
    route: "api/sessions/[id]/share",
    data: payload,
  });
}

export async function POST(_request, { params }) {
  const { id } = params;
  if (!id) {
    return NextResponse.json({ ok: false, message: "Session id is required." }, { status: 400 });
  }

  if (!hasDatabaseUrl()) {
    return NextResponse.json({
      ok: true,
      recovered: true,
      route: "api/sessions/[id]/share",
      data: { id, shared: true, source: "mock" },
    });
  }

  const rows = await query(
    `
      INSERT INTO session_shares (
        id,
        session_id,
        client_id,
        shared_by_trainer,
        shared_at,
        created_at
      )
      SELECT
        md5(random()::text || clock_timestamp()::text),
        s.id,
        s.client_id,
        true,
        NOW(),
        NOW()
      FROM sessions s
      WHERE s.id = $1
      RETURNING *
    `,
    [id]
  );

  if (!rows[0]) {
    return NextResponse.json({ ok: false, message: "Session not found." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    recovered: true,
    route: "api/sessions/[id]/share",
    data: rows[0],
  });
}
