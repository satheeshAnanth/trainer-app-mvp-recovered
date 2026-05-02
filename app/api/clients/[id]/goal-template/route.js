import { NextResponse } from "next/server";
import { buildRecoveredPayload } from "app/lib/apiResponse";
import { hasDatabaseUrl, hasTableColumn, query } from "app/lib/db";

function parseJson(value) {
  if (!value) return null;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function normalizePriority(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "optional" ? "optional" : "mandatory";
}

function normalizeFrequency(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return "every_session";
  return normalized;
}

export async function GET(request, { params }) {
  const { id } = params;

  if (!hasDatabaseUrl()) {
    const payload = await buildRecoveredPayload("api/clients/[id]/goal-template", params);
    return NextResponse.json({ ok: true, recovered: true, route: "api/clients/[id]/goal-template", data: payload });
  }

  const hasPriorCondition = await hasTableColumn("clients", "prior_condition");
  const [clientRows, templateRows] = await Promise.all([
    query(`SELECT id, name, goal${hasPriorCondition ? ", prior_condition" : ""} FROM clients WHERE id = $1 LIMIT 1`, [id]),
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
          goal: saved?.goalName ?? clientRows[0].goal ?? "",
          goalName: saved?.goalName ?? clientRows[0].goal ?? "",
          priorCondition: clientRows[0].prior_condition ?? null,
          status: saved?.status ?? "active",
          exercises: Array.isArray(saved?.exercises) ? saved.exercises : [],
        },
      source: "database",
    },
  });
}

export async function POST(request, { params }) {
  const { id } = params;
  const body = await request.json();
  const goalName = String(body?.goalName ?? "").trim();
  const exercises = Array.isArray(body?.exercises) ? body.exercises : [];

  if (!goalName) {
    return NextResponse.json({ ok: false, message: "Goal template name is required." }, { status: 400 });
  }

  if (exercises.length === 0) {
    return NextResponse.json({ ok: false, message: "Add at least one goal exercise." }, { status: 400 });
  }

  const normalizedExercises = exercises.map((ex) => ({
    id: String(ex?.id ?? "").trim() || null,
    masterExerciseId: String(ex?.masterExerciseId ?? "").trim() || null,
    exercise: String(ex?.exercise ?? "").trim(),
    variation: String(ex?.variation ?? "").trim(),
    target: String(ex?.target ?? "").trim(),
    frequency: normalizeFrequency(ex?.frequency),
    priority: normalizePriority(ex?.priority),
    imageUrl: String(ex?.imageUrl ?? "").trim(),
  }));

  for (const ex of normalizedExercises) {
    if (!ex.exercise) {
      return NextResponse.json({ ok: false, message: "Each goal exercise needs a mapped exercise name." }, { status: 400 });
    }
    if (!ex.target) {
      return NextResponse.json({ ok: false, message: "Each goal exercise needs a target progression." }, { status: 400 });
    }
    if (!ex.frequency) {
      return NextResponse.json({ ok: false, message: "Each goal exercise needs a target frequency." }, { status: 400 });
    }
    if (!ex.priority) {
      return NextResponse.json({ ok: false, message: "Each goal exercise needs a priority." }, { status: 400 });
    }
  }

  if (!hasDatabaseUrl()) {
    return NextResponse.json({
      ok: true,
      recovered: true,
      route: "api/clients/[id]/goal-template",
      data: {
        clientId: id,
        goalTemplate: { clientId: id, goalName, status: "active", exercises: normalizedExercises },
        source: "mock",
      },
    });
  }

  const clientRows = await query(`SELECT id FROM clients WHERE id = $1 LIMIT 1`, [id]);
  if (!clientRows[0]) {
    return NextResponse.json({ ok: false, message: "Client not found." }, { status: 404 });
  }

  const trainerPhone = request.cookies.get("trainer_session")?.value ?? "trainer";
  const payload = JSON.stringify({
    goalName,
    status: "active",
    exercises: normalizedExercises,
    actorRole: "trainer",
    actorId: trainerPhone,
  });
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
        'client_goal_template',
        $1,
        'goal_template_saved',
        $2::text,
        NOW()
      )
      RETURNING *
    `,
    [id, payload]
  );

  return NextResponse.json({
    ok: true,
    recovered: true,
    route: "api/clients/[id]/goal-template",
    data: {
      id: rows[0].id,
      clientId: id,
      goalTemplate: { clientId: id, goalName, status: "active", exercises: normalizedExercises },
      source: "database",
    },
  });
}
