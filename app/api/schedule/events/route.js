import { NextResponse } from "next/server";
import { buildRecoveredPayload } from "app/lib/apiResponse";
import { hasDatabaseUrl, query } from "app/lib/db";

function normalizeDate(value = "") {
  const text = String(value).trim();
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const ddmmyyyy = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (ddmmyyyy) {
    const [, dd, mm, yyyy] = ddmmyyyy;
    return `${yyyy}-${mm}-${dd}`;
  }
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

export async function GET() {
  const payload = await buildRecoveredPayload("api/schedule/events");
  return NextResponse.json({
    ok: true,
    recovered: true,
    route: "api/schedule/events",
    data: payload,
  });
}

export async function POST(request) {
  const body = await request.json();
  const trainerPhone = request.cookies.get("trainer_session")?.value ?? null;

  const scheduledDate = normalizeDate(body?.scheduledDate ?? body?.date);
  const scheduledTime = String(body?.scheduledTime ?? body?.time ?? "").trim() || null;
  const clientId = String(body?.clientId ?? "").trim() || null;
  const clientName = String(body?.clientName ?? "").trim() || null;
  const notes = String(body?.notes ?? "").trim() || null;

  if (!scheduledDate) {
    return NextResponse.json({ ok: false, message: "Date is required." }, { status: 400 });
  }

  if (!hasDatabaseUrl()) {
    return NextResponse.json(
      {
        ok: true,
        recovered: true,
        route: "api/schedule/events",
        data: {
          id: `mock-event-${Date.now()}`,
          scheduled_date: scheduledDate,
          scheduled_time: scheduledTime,
          client_id: clientId,
          client_name: clientName ?? "Personal appointment",
          notes,
          status: "accepted",
          created_by_role: "trainer",
          created_by_name: "Trainer",
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
        'accepted',
        'trainer',
        'trainer',
        NOW(),
        NOW()
      )
      RETURNING *
    `,
    [trainerPhone, clientId, clientName ?? "Personal appointment", scheduledDate, scheduledTime, notes]
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
