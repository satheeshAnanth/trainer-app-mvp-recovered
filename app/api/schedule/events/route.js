import { NextResponse } from "next/server";
import { buildRecoveredPayload } from "app/lib/apiResponse";
import { hasDatabaseUrl, query } from "app/lib/db";
import {
  buildScheduleReminderText,
  filterVisibleScheduleEvents,
  getScheduleViewer,
  normalizeScheduleDate,
  normalizeScheduleTime,
  sortScheduleEvents,
} from "app/lib/schedule";
import { mockData } from "app/lib/mockData";

function normalizeCreatedByName(value, fallback) {
  const text = String(value ?? "").trim();
  return text || fallback;
}

export async function GET(request) {
  const viewer = getScheduleViewer(request);
  if (!viewer) {
    const payload = await buildRecoveredPayload("api/schedule/events");
    return NextResponse.json({
      ok: true,
      recovered: true,
      route: "api/schedule/events",
      data: payload,
    });
  }

  if (!hasDatabaseUrl()) {
    const visible = filterVisibleScheduleEvents(mockData.scheduleEvents, viewer);
    return NextResponse.json({
      ok: true,
      recovered: true,
      route: "api/schedule/events",
      data: {
        events: sortScheduleEvents(visible),
        source: "mock",
        viewer,
        reminderPreview: visible.slice(0, 3).map((event) => buildScheduleReminderText(event)),
      },
    });
  }

  let rows;
  if (viewer.role === "trainer") {
    rows = await query(
      `SELECT id, trainer_phone, client_id, client_name, scheduled_date, scheduled_time,
              notes, status, created_by_role, created_by_name, created_at, updated_at
       FROM calendar_events WHERE trainer_phone = $1
       ORDER BY scheduled_date DESC, scheduled_time DESC, updated_at DESC LIMIT 200`,
      [viewer.trainerPhone]
    );
  } else if (viewer.role === "client") {
    rows = await query(
      `SELECT id, trainer_phone, client_id, client_name, scheduled_date, scheduled_time,
              notes, status, created_by_role, created_by_name, created_at, updated_at
       FROM calendar_events WHERE client_id = $1
       ORDER BY scheduled_date DESC, scheduled_time DESC, updated_at DESC LIMIT 200`,
      [viewer.clientId]
    );
  } else {
    rows = [];
  }

  const visible = filterVisibleScheduleEvents(rows, viewer);
  return NextResponse.json({
    ok: true,
    recovered: true,
    route: "api/schedule/events",
    data: {
      events: sortScheduleEvents(visible),
      source: "database",
      viewer,
      reminderPreview: visible.slice(0, 3).map((event) => buildScheduleReminderText(event)),
    },
  });
}

export async function POST(request) {
  const viewer = getScheduleViewer(request);
  if (!viewer) {
    return NextResponse.json({ ok: false, message: "Login required." }, { status: 401 });
  }

  const body = await request.json();
  const scheduledDate = normalizeScheduleDate(body?.scheduledDate ?? body?.date);
  const scheduledTime = normalizeScheduleTime(body?.scheduledTime ?? body?.time);
  const notes = String(body?.notes ?? "").trim() || null;
  const createdByName = normalizeCreatedByName(body?.createdByName, viewer.role === "client" ? viewer.clientName ?? "Client" : "Trainer");

  const clientId = String(body?.clientId ?? viewer.clientId ?? "").trim() || null;
  const clientName = String(body?.clientName ?? "").trim() || null;

  if (!scheduledDate) {
    return NextResponse.json({ ok: false, message: "Date is required." }, { status: 400 });
  }

  if (!clientId) {
    return NextResponse.json({ ok: false, message: "Client is required." }, { status: 400 });
  }

  const trainerPhone = viewer.role === "trainer" ? viewer.trainerPhone : null;
  const createdByRole = viewer.role;
  const nextStatus = "pending";

  if (!hasDatabaseUrl()) {
    return NextResponse.json(
      {
        ok: true,
        recovered: true,
        route: "api/schedule/events",
        data: {
          id: `mock-event-${Date.now()}`,
          trainer_phone: trainerPhone,
          client_id: clientId,
          client_name: clientName,
          scheduled_date: scheduledDate,
          scheduled_time: scheduledTime,
          notes,
          status: nextStatus,
          created_by_role: createdByRole,
          created_by_name: createdByName,
          source: "mock",
        },
      },
      { status: 201 }
    );
  }

  const rows = await query(
    `
      INSERT INTO calendar_events (
        id,
        trainer_phone,
        client_id,
        client_name,
        scheduled_date,
        scheduled_time,
        notes,
        status,
        created_by_role,
        created_by_name,
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
        $8,
        $9,
        NOW(),
        NOW()
      )
      RETURNING *
    `,
    [trainerPhone, clientId, clientName, scheduledDate, scheduledTime, notes, nextStatus, createdByRole, createdByName]
  );

  return NextResponse.json(
    {
      ok: true,
      recovered: true,
      route: "api/schedule/events",
      data: rows[0],
    },
    { status: 201 }
  );
}
