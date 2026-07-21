import { NextResponse } from "next/server";
import { buildRecoveredPayload } from "app/lib/apiResponse";
import { hasDatabaseUrl, query } from "app/lib/db";
import { notifyScheduleStatusChange } from "app/lib/pushNotifications";
import { getScheduleViewer, sanitizeScheduleStatus } from "app/lib/schedule";

export async function GET(request, { params }) {
  const payload = await buildRecoveredPayload("api/schedule/events/[id]/status", params);
  return NextResponse.json({
    ok: true,
    recovered: true,
    route: "api/schedule/events/[id]/status",
    data: payload,
  });
}

export async function PATCH(request, { params }) {
  const viewer = getScheduleViewer(request);
  const { id } = params;
  const body = await request.json();
  const status = sanitizeScheduleStatus(body?.status);

  if (!viewer) {
    return NextResponse.json({ ok: false, message: "Login required." }, { status: 401 });
  }

  if (!id) {
    return NextResponse.json({ ok: false, message: "Event id is required." }, { status: 400 });
  }

  if (!status) {
    return NextResponse.json({ ok: false, message: "status is required." }, { status: 400 });
  }

  if (!hasDatabaseUrl()) {
    return NextResponse.json({
      ok: true,
      recovered: true,
      route: "api/schedule/events/[id]/status",
      data: {
        id,
        status,
        updated_at: new Date().toISOString(),
        source: "mock",
      },
    });
  }

  const scopeCol = viewer.role === "trainer" ? "trainer_phone" : "client_id";
  const scopeVal = viewer.role === "trainer" ? viewer.trainerPhone : viewer.clientId;
  const rows = await query(
    `
      UPDATE calendar_events
      SET status = $2, updated_at = NOW()
      WHERE id = $1 AND ${scopeCol} = $3
      RETURNING *
    `,
    [id, status, scopeVal]
  );

  if (!rows[0]) {
    return NextResponse.json({ ok: false, message: "Event not found." }, { status: 404 });
  }

  notifyScheduleStatusChange(rows[0], viewer.role, status).catch(() => {});

  return NextResponse.json({
    ok: true,
    recovered: true,
    route: "api/schedule/events/[id]/status",
    data: rows[0],
  });
}
