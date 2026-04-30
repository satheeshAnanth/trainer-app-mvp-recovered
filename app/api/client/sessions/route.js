import { NextResponse } from "next/server";
import { buildRecoveredPayload } from "app/lib/apiResponse";
import { hasDatabaseUrl, query } from "app/lib/db";

export async function GET() {
  const payload = await buildRecoveredPayload("api/client/sessions");
  return NextResponse.json({
    ok: true,
    recovered: true,
    route: "api/client/sessions",
    data: payload,
  });
}

export async function POST(request) {
  const body = await request.json();
  const {
    clientId,
    clientName,
    sessionDate,
    sessionTitle,
    details,
    discomfort = "",
    durationMinutes = null,
  } = body;

  if (!clientId || !sessionTitle || !details) {
    return NextResponse.json(
      { ok: false, message: "clientId, sessionTitle, and details are required." },
      { status: 400 }
    );
  }

  const payload = {
    source: "client_self_log",
    details,
    discomfort,
  };

  if (!hasDatabaseUrl()) {
    return NextResponse.json(
      {
        ok: true,
        recovered: true,
        route: "api/client/sessions",
        data: {
          id: `client-self-${Date.now()}`,
          client_id: clientId,
          session_title: sessionTitle,
          status: "client_submitted",
          payload_json: payload,
          source: "mock",
        },
      },
      { status: 201 }
    );
  }

  const rows = await query(
    `
      INSERT INTO sessions (
        id,
        client_id,
        client_name_snapshot,
        session_date,
        session_title,
        raw_notes,
        summary,
        status,
        payload_json,
        duration_minutes,
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
        'client_submitted',
        $7::text,
        $8,
        NOW(),
        NOW()
      )
      RETURNING *
    `,
    [
      clientId,
      clientName ?? "Client",
      sessionDate ?? null,
      sessionTitle,
      details,
      discomfort,
      JSON.stringify(payload),
      durationMinutes,
    ]
  );

  return NextResponse.json(
    {
      ok: true,
      recovered: true,
      route: "api/client/sessions",
      data: rows[0],
    },
    { status: 201 }
  );
}
