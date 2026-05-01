import { NextResponse } from "next/server";
import { buildRecoveredPayload } from "app/lib/apiResponse";
import { hasDatabaseUrl, query } from "app/lib/db";

function parseJson(value) {
  if (!value) return null;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export async function GET(request, { params }) {
  const { id } = params;

  if (!hasDatabaseUrl()) {
    const payload = await buildRecoveredPayload("api/clients/[id]/goal-template", params);
    return NextResponse.json({ ok: true, recovered: true, route: "api/clients/[id]/goal-template", data: payload });
  }

  const [clientRows, templateRows] = await Promise.all([
    query(`SELECT id, name, goal FROM clients WHERE id = $1 LIMIT 1`, [id]),
    query(
      `
        SELECT payload_json, created_at
        FROM audit_events
        WHERE entity_type = 'client_goal_template' AND entity_id = $1
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [id]
    ),
  ]);

  if (!clientRows[0]) {
    return NextResponse.json({ ok: false, message: "Client not found." }, { status: 404 });
  }

  const saved = parseJson(templateRows[0]?.payload_json) ?? null;
  return NextResponse.json({
    ok: true,
    recovered: true,
    route: "api/clients/[id]/goal-template",
    data: {
      goalTemplate: {
        clientId: clientRows[0].id,
        name: clientRows[0].name,
        goal: clientRows[0].goal,
        exercises: saved?.exercises ?? [],
      },
      source: "database",
    },
  });
}

export async function POST(request, { params }) {
  const { id } = params;
  const body = await request.json();
  const exercises = Array.isArray(body?.exercises) ? body.exercises : [];

  if (exercises.length === 0) {
    return NextResponse.json({ ok: false, message: "Add at least one goal exercise." }, { status: 400 });
  }

  for (const ex of exercises) {
    if (!String(ex?.exercise ?? "").trim()) {
      return NextResponse.json({ ok: false, message: "Each goal exercise needs a name." }, { status: 400 });
    }
    const rows = Array.isArray(ex?.metrics) ? ex.metrics : [];
    if (rows.length === 0) {
      return NextResponse.json({ ok: false, message: "Each goal exercise needs at least one metric row." }, { status: 400 });
    }
    for (const row of rows) {
      if (!String(row?.measurement ?? "").trim() || !String(row?.metricName ?? "").trim() || !String(row?.metricValue ?? "").trim()) {
        return NextResponse.json(
          { ok: false, message: "Each measurement row must include measurement name, metric name, and metric value." },
          { status: 400 }
        );
      }
    }
  }

  if (!hasDatabaseUrl()) {
    return NextResponse.json({
      ok: true,
      recovered: true,
      route: "api/clients/[id]/goal-template",
      data: { clientId: id, exercises, source: "mock" },
    });
  }

  const clientRows = await query(`SELECT id FROM clients WHERE id = $1 LIMIT 1`, [id]);
  if (!clientRows[0]) {
    return NextResponse.json({ ok: false, message: "Client not found." }, { status: 404 });
  }

  const trainerPhone = request.cookies.get("trainer_session")?.value ?? "trainer";
  const payload = JSON.stringify({ exercises });
  const rows = await query(
    `
      INSERT INTO audit_events (
        id,
        entity_type,
        entity_id,
        action,
        payload_json,
        created_at,
        actor_role,
        actor_id
      )
      VALUES (
        md5(random()::text || clock_timestamp()::text),
        'client_goal_template',
        $1,
        'goal_template_saved',
        $2::text,
        NOW(),
        'trainer',
        $3
      )
      RETURNING *
    `,
    [id, payload, trainerPhone]
  );

  return NextResponse.json({
    ok: true,
    recovered: true,
    route: "api/clients/[id]/goal-template",
    data: { id: rows[0].id, clientId: id, exercises, source: "database" },
  });
}
