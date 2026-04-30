import { NextResponse } from "next/server";
import { buildRecoveredPayload } from "app/lib/apiResponse";
import { hasDatabaseUrl, query } from "app/lib/db";

export async function GET(_request, { params }) {
  const payload = await buildRecoveredPayload("api/schedule/events/[id]/status", params);
  return NextResponse.json({
    ok: true,
    recovered: true,
    route: "api/schedule/events/[id]/status",
    data: payload,
  });
}

export async function PATCH(request, { params }) {
  const { id } = params;
  const body = await request.json();
  const { status } = body;

  if (!status) {
    return NextResponse.json({ ok: false, message: "status is required." }, { status: 400 });
  }

  if (!hasDatabaseUrl()) {
    return NextResponse.json({
      ok: true,
      recovered: true,
      route: "api/schedule/events/[id]/status",
      data: { id, status, source: "mock" },
    });
  }

  const rows = await query(
    `
      UPDATE calendar_events
      SET status = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id, status]
  );

  if (!rows[0]) {
    return NextResponse.json({ ok: false, message: "Event not found." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    recovered: true,
    route: "api/schedule/events/[id]/status",
    data: rows[0],
  });
}
