import { NextResponse } from "next/server";
import { buildRecoveredPayload } from "app/lib/apiResponse";
import { hasDatabaseUrl, query } from "app/lib/db";
import { getScheduleViewer } from "app/lib/schedule";

export async function GET(_request, { params }) {
  const payload = await buildRecoveredPayload("api/schedule/events/[id]/notes", params);
  return NextResponse.json({
    ok: true,
    recovered: true,
    route: "api/schedule/events/[id]/notes",
    data: payload,
  });
}

export async function POST(request, { params }) {
  const viewer = getScheduleViewer(request);
  if (!viewer) return NextResponse.json({ ok: false, message: "Login required." }, { status: 401 });

  const { id } = params;
  const body = await request.json();
  const { message, authorRole = "trainer", authorName = "Trainer" } = body;

  if (!message) {
    return NextResponse.json({ ok: false, message: "message is required." }, { status: 400 });
  }

  if (!hasDatabaseUrl()) {
    return NextResponse.json(
      {
        ok: true,
        recovered: true,
        route: "api/schedule/events/[id]/notes",
        data: {
          id: `mock-note-${Date.now()}`,
          event_id: id,
          message,
          author_role: authorRole,
          author_name: authorName,
          source: "mock",
        },
      },
      { status: 201 }
    );
  }

  const scopeCol = viewer.role === "trainer" ? "trainer_phone" : "client_id";
  const scopeVal = viewer.role === "trainer" ? viewer.trainerPhone : viewer.clientId;
  const eventCheck = await query(`SELECT id FROM calendar_events WHERE id = $1 AND ${scopeCol} = $2 LIMIT 1`, [id, scopeVal]);
  if (!eventCheck[0]) return NextResponse.json({ ok: false, message: "Event not found." }, { status: 404 });

  const rows = await query(
    `
      INSERT INTO calendar_event_notes (
        id,
        event_id,
        author_role,
        author_name,
        message,
        created_at
      )
      VALUES (
        md5(random()::text || clock_timestamp()::text),
        $1,
        $2,
        $3,
        $4,
        NOW()
      )
      RETURNING *
    `,
    [id, authorRole, authorName, message]
  );

  return NextResponse.json(
    {
      ok: true,
      recovered: true,
      route: "api/schedule/events/[id]/notes",
      data: rows[0],
    },
    { status: 201 }
  );
}
