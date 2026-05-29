import { NextResponse } from "next/server";
import { hasDatabaseUrl, query } from "app/lib/db";
import { readClientSession } from "app/lib/session";

function clientId(request) {
  const raw = request.cookies.get("client_session")?.value;
  return readClientSession(raw)?.clientId ?? null;
}

export async function GET(request) {
  const id = clientId(request);
  if (!id) {
    return NextResponse.json({ ok: false, message: "Login required." }, { status: 401 });
  }

  if (!hasDatabaseUrl()) {
    return NextResponse.json({ ok: true, data: { profile: null, source: "mock" } });
  }

  const rows = await query(
    `SELECT id, name, mobile, goal, age, weight_kg, height_cm, gender, activity_level, prior_condition
     FROM clients WHERE id = $1 LIMIT 1`,
    [id]
  );
  return NextResponse.json({ ok: true, data: { profile: rows[0] ?? null, source: "database" } });
}

export async function PATCH(request) {
  const id = clientId(request);
  if (!id) {
    return NextResponse.json({ ok: false, message: "Login required." }, { status: 401 });
  }

  if (!hasDatabaseUrl()) {
    return NextResponse.json({ ok: true, data: { updated: true, source: "mock" } });
  }

  const body = await request.json();
  const weightKg = body?.weight_kg != null ? Number(body.weight_kg) || null : null;
  const heightCm = body?.height_cm != null ? Number(body.height_cm) || null : null;
  const activityLevel = body?.activity_level != null ? String(body.activity_level).trim() || null : null;
  const goal = body?.goal != null ? String(body.goal).trim() || null : null;

  const rows = await query(
    `UPDATE clients
     SET weight_kg      = COALESCE($2, weight_kg),
         height_cm      = COALESCE($3, height_cm),
         activity_level = COALESCE($4, activity_level),
         goal           = COALESCE($5, goal),
         updated_at     = NOW()
     WHERE id = $1
     RETURNING id, name, mobile, goal, age, weight_kg, height_cm, gender, activity_level`,
    [id, weightKg, heightCm, activityLevel, goal]
  );

  if (!rows[0]) {
    return NextResponse.json({ ok: false, message: "Profile not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, data: { profile: rows[0], source: "database" } });
}
