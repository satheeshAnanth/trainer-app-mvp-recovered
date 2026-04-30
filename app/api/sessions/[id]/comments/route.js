import { NextResponse } from "next/server";
import { buildRecoveredPayload } from "app/lib/apiResponse";
import { hasDatabaseUrl, query } from "app/lib/db";

export async function GET(_request, { params }) {
  const payload = await buildRecoveredPayload("api/sessions/[id]/comments", params);
  return NextResponse.json({
    ok: true,
    recovered: true,
    route: "api/sessions/[id]/comments",
    data: payload,
  });
}

export async function POST(request, { params }) {
  const { id } = params;
  const body = await request.json();
  const { text, authorRole = "trainer", authorName = "Trainer" } = body;

  if (!text) {
    return NextResponse.json({ ok: false, message: "Comment text is required." }, { status: 400 });
  }

  if (!hasDatabaseUrl()) {
    return NextResponse.json(
      {
        ok: true,
        recovered: true,
        route: "api/sessions/[id]/comments",
        data: {
          id: `mock-comment-${Date.now()}`,
          session_id: id,
          text,
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
      INSERT INTO audit_events (
        id,
        entity_type,
        entity_id,
        action,
        payload_json,
        created_at
      )
      VALUES (
        md5(random()::text || clock_timestamp()::text),
        'session_comment',
        $1,
        'comment_added',
        $2::text,
        NOW()
      )
      RETURNING *
    `,
    [
      id,
      JSON.stringify({
        text,
        authorRole,
        authorName,
      }),
    ]
  );

  return NextResponse.json(
    {
      ok: true,
      recovered: true,
      route: "api/sessions/[id]/comments",
      data: rows[0],
    },
    { status: 201 }
  );
}
