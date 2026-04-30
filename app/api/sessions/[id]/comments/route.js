import { NextResponse } from "next/server";
import { buildRecoveredPayload } from "app/lib/apiResponse";
import { hasDatabaseUrl, query } from "app/lib/db";

export async function GET(_request, { params }) {
  if (hasDatabaseUrl()) {
    const rows = await query(
      `
        SELECT id, entity_id, payload_json, created_at
        FROM audit_events
        WHERE entity_type = 'session_comment' AND entity_id = $1
        ORDER BY created_at DESC
        LIMIT 200
      `,
      [params.id]
    );

    const comments = rows.map((row) => {
      let payload = {};
      try {
        payload = row.payload_json ? JSON.parse(row.payload_json) : {};
      } catch (_error) {
        payload = {};
      }
      return {
        id: row.id,
        session_id: row.entity_id,
        text: payload.text ?? "",
        author_role: payload.authorRole ?? "trainer",
        author_name: payload.authorName ?? "Trainer",
        created_at: row.created_at,
      };
    });

    return NextResponse.json({
      ok: true,
      recovered: true,
      route: "api/sessions/[id]/comments",
      data: { id: params.id, comments, source: "database" },
    });
  }

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
