import { NextResponse } from "next/server";
import { buildRecoveredPayload } from "app/lib/apiResponse";
import { hasDatabaseUrl, query } from "app/lib/db";

export async function GET(_request, { params }) {
  const payload = await buildRecoveredPayload("api/schedule/events/[id]", params);
  return NextResponse.json({
    ok: true,
    recovered: true,
    route: "api/schedule/events/[id]",
    data: payload,
  });
}

export async function PATCH(request, { params }) {
  const { id } = params;
  const body = await request.json();
  const scheduledDate = body?.scheduledDate ?? null;
  const scheduledTime = body?.scheduledTime ?? null;
  const clientId = body?.clientId ?? null;
  const clientName = body?.clientName ?? null;
  const notes = body?.notes ?? null;

  if (!id) {
    return NextResponse.json({ ok: false, message: "Event id is required." }, { status: 400 });
  }

  if (!hasDatabaseUrl()) {
    return NextResponse.json({
      ok: true,
      recovered: true,
      route: "api/schedule/events/[id]",
      data: {
        id,
        scheduled_date: scheduledDate,
        scheduled_time: scheduledTime,
        client_id: clientId,
        client_name: clientName,
        notes,
        source: "mock",
      },
    });
  }

  const rows = await query(
    `
      UPDATE calendar_events
      SET
        scheduled_date = COALESCE($2, scheduled_date),
        scheduled_time = COALESCE($3, scheduled_time),
        client_id = COALESCE($4, client_id),
        client_name = COALESCE($5, client_name),
        notes = COALESCE($6, notes),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id, scheduledDate, scheduledTime, clientId, clientName, notes]
  );

  if (!rows[0]) {
    return NextResponse.json({ ok: false, message: "Event not found." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    recovered: true,
    route: "api/schedule/events/[id]",
    data: rows[0],
  });
}
