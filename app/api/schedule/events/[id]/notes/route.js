import { NextResponse } from "next/server";
import { buildRecoveredPayload } from "app/lib/apiResponse";
import { hasDatabaseUrl, query } from "app/lib/db";

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
