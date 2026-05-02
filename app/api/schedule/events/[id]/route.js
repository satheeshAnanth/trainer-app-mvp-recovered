import { NextResponse } from "next/server";
import { buildRecoveredPayload } from "app/lib/apiResponse";
import { hasDatabaseUrl, query } from "app/lib/db";
import { mockData } from "app/lib/mockData";
import {
  filterVisibleScheduleEvents,
  getScheduleViewer,
  normalizeScheduleDate,
  normalizeScheduleTime,
} from "app/lib/schedule";

function sliceTime(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  return text.slice(0, 5);
}

export async function GET(request, { params }) {
  const viewer = getScheduleViewer(request);
  const { id } = params;

  if (!id) {
    return NextResponse.json({ ok: false, message: "Event id is required." }, { status: 400 });
  }

  if (!viewer || !hasDatabaseUrl()) {
    const payload = await buildRecoveredPayload("api/schedule/events/[id]", params);
    return NextResponse.json({
      ok: true,
      recovered: true,
      route: "api/schedule/events/[id]",
      data: payload,
    });
  }

  const rows = await query(
    `
      SELECT
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
      FROM calendar_events
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  if (!rows[0]) {
    return NextResponse.json({ ok: false, message: "Event not found." }, { status: 404 });
  }

  const event = rows[0];
  const isClient = viewer.role === "client";
  const isTrainer = viewer.role === "trainer";
  const isVisible =
    (isClient && String(event.client_id ?? "") === String(viewer.clientId ?? "")) ||
    (isTrainer && (String(event.trainer_phone ?? "") === String(viewer.trainerPhone ?? "") || event.created_by_role === "client"));

  if (!isVisible) {
    return NextResponse.json({ ok: false, message: "Event not found." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    recovered: true,
    route: "api/schedule/events/[id]",
    data: { event },
  });
}

export async function PATCH(request, { params }) {
  const viewer = getScheduleViewer(request);
  const { id } = params;

  if (!viewer) {
    return NextResponse.json({ ok: false, message: "Login required." }, { status: 401 });
  }
  if (!id) {
    return NextResponse.json({ ok: false, message: "Event id is required." }, { status: 400 });
  }

  const body = await request.json();
  const hasNotes = Object.prototype.hasOwnProperty.call(body ?? {}, "notes");
  const notesRaw = hasNotes ? String(body?.notes ?? "").trim() || null : undefined;

  const scheduledDateIn = normalizeScheduleDate(body?.scheduledDate ?? body?.date);
  const scheduledTimeIn = normalizeScheduleTime(body?.scheduledTime ?? body?.time);
  const clientIdIn = String(body?.clientId ?? "").trim() || null;
  const clientNameIn = String(body?.clientName ?? "").trim() || null;

  if (!hasDatabaseUrl()) {
    const idx = mockData.scheduleEvents.findIndex((e) => String(e.id) === String(id));
    if (idx < 0) {
      return NextResponse.json({ ok: false, message: "Event not found." }, { status: 404 });
    }
    const existing = mockData.scheduleEvents[idx];
    if (!filterVisibleScheduleEvents([existing], viewer).length) {
      return NextResponse.json({ ok: false, message: "Event not found." }, { status: 404 });
    }

    const nextDate = scheduledDateIn ?? existing.scheduled_date;
    const nextTime = scheduledTimeIn ?? sliceTime(existing.scheduled_time);
    const nextClientId = clientIdIn ?? existing.client_id;
    const nextClientName = clientNameIn ?? existing.client_name;
    const nextNotes = hasNotes ? notesRaw : existing.notes ?? null;

    const timeChanged =
      String(nextDate ?? "") !== String(existing.scheduled_date ?? "") ||
      sliceTime(nextTime) !== sliceTime(existing.scheduled_time);

    const nextStatus = timeChanged ? "pending" : existing.status;

    const trainer_phone =
      viewer.role === "trainer" ? viewer.trainerPhone ?? existing.trainer_phone : existing.trainer_phone;

    const updated = {
      ...existing,
      trainer_phone,
      scheduled_date: nextDate,
      scheduled_time: nextTime || null,
      client_id: nextClientId,
      client_name: nextClientName,
      notes: nextNotes,
      status: nextStatus,
      updated_at: new Date().toISOString(),
    };
    mockData.scheduleEvents[idx] = updated;

    return NextResponse.json({
      ok: true,
      recovered: true,
      route: "api/schedule/events/[id]",
      data: updated,
    });
  }

  const existingRows = await query(
    `
      SELECT
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
      FROM calendar_events
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  const existing = existingRows[0];
  if (!existing) {
    return NextResponse.json({ ok: false, message: "Event not found." }, { status: 404 });
  }

  const isClient = viewer.role === "client";
  const isTrainer = viewer.role === "trainer";
  const isVisible =
    (isClient && String(existing.client_id ?? "") === String(viewer.clientId ?? "")) ||
    (isTrainer &&
      (String(existing.trainer_phone ?? "") === String(viewer.trainerPhone ?? "") || existing.created_by_role === "client"));

  if (!isVisible) {
    return NextResponse.json({ ok: false, message: "Event not found." }, { status: 404 });
  }

  const nextDate = scheduledDateIn ?? existing.scheduled_date;
  const nextTime = scheduledTimeIn ?? existing.scheduled_time;
  const nextClientId = clientIdIn ?? existing.client_id;
  const nextClientName = clientNameIn ?? existing.client_name;
  const nextNotes = hasNotes ? notesRaw : existing.notes;

  const timeChanged =
    String(nextDate ?? "") !== String(existing.scheduled_date ?? "") ||
    sliceTime(nextTime) !== sliceTime(existing.scheduled_time);

  const nextStatus = timeChanged ? "pending" : existing.status;

  const rows = await query(
    `
      UPDATE calendar_events
      SET
        scheduled_date = $2,
        scheduled_time = $3,
        client_id = $4,
        client_name = $5,
        notes = $6,
        status = $7,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id, nextDate, nextTime, nextClientId, nextClientName, nextNotes, nextStatus]
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
