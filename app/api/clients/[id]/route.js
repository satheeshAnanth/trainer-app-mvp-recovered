import { NextResponse } from "next/server";
import { buildRecoveredPayload } from "app/lib/apiResponse";
import { hasDatabaseUrl, query } from "app/lib/db";
import { readTrainerPhone } from "app/lib/session";
import { requireTrainerOwnsClient } from "app/lib/ownership";

const ALLOWED_ACTIVITY_LEVELS = ["sedentary", "light", "moderate", "active", "very_active"];

function normalizeActivityLevel(value) {
  const v = String(value ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  return ALLOWED_ACTIVITY_LEVELS.includes(v) ? v : null;
}

function trainerPhone(request) {
  return readTrainerPhone(request.cookies.get("trainer_session")?.value) ?? null;
}

export async function GET(request, { params }) {
  const phone = trainerPhone(request);
  const { id } = params;

  if (!phone || !hasDatabaseUrl()) {
    const payload = await buildRecoveredPayload("api/clients/[id]", params);
    return NextResponse.json({ ok: true, recovered: true, route: "api/clients/[id]", data: payload });
  }

  const client = await requireTrainerOwnsClient(phone, id);
  if (!client) {
    return NextResponse.json({ ok: false, message: "Client not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, data: { client } });
}

export async function PATCH(request, { params }) {
  const phone = trainerPhone(request);
  if (!phone) {
    return NextResponse.json({ ok: false, message: "Login required." }, { status: 401 });
  }

  const { id } = params;
  const body = await request.json();

  if (!hasDatabaseUrl()) {
    return NextResponse.json({ ok: true, data: { id, updated: true, source: "mock" } });
  }

  const existing = await requireTrainerOwnsClient(phone, id);
  if (!existing) {
    return NextResponse.json({ ok: false, message: "Client not found." }, { status: 404 });
  }

  const name = body?.name != null ? String(body.name).trim() || null : null;
  const goal = body?.goal != null ? String(body.goal).trim() || null : null;
  const age = body?.age != null ? Number(body.age) || null : null;
  const weightKg = body?.weight_kg != null ? Number(body.weight_kg) || null : null;
  const heightCm = body?.height_cm != null ? Number(body.height_cm) || null : null;
  const gender = body?.gender != null ? String(body.gender).trim().toLowerCase() || null : null;
  const activityLevel =
    body?.activity_level != null ? normalizeActivityLevel(body.activity_level) : null;

  const rows = await query(
    `UPDATE clients
     SET
       name            = COALESCE($2, name),
       goal            = COALESCE($3, goal),
       age             = COALESCE($4, age),
       weight_kg       = COALESCE($5, weight_kg),
       height_cm       = COALESCE($6, height_cm),
       gender          = COALESCE($7, gender),
       activity_level  = COALESCE($8, activity_level),
       updated_at      = NOW()
     WHERE id = $1 AND created_by_trainer = $9
     RETURNING *`,
    [id, name, goal, age, weightKg, heightCm, gender, activityLevel, phone]
  );

  if (!rows[0]) {
    return NextResponse.json({ ok: false, message: "Client not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, data: { client: rows[0] } });
}
