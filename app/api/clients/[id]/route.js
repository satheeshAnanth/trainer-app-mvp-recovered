import { NextResponse } from "next/server";
import { buildRecoveredPayload } from "app/lib/apiResponse";
import { hasDatabaseUrl, hasTableColumn, query } from "app/lib/db";
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
  const hasPriorCondition = await hasTableColumn("clients", "prior_condition");

  const updates = [];
  const values = [];
  const setField = (column, value) => {
    values.push(value);
    updates.push(`${column} = $${values.length}`);
  };
  const nullableNumber = (value, label) => {
    if (value === "" || value == null) return null;
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) throw new Error(`${label} must be a valid number.`);
    return number;
  };

  try {
    if ("name" in body) {
      const name = String(body.name ?? "").trim();
      if (!name) return NextResponse.json({ ok: false, message: "Name is required." }, { status: 400 });
      setField("name", name);
    }
    if ("goal" in body) setField("goal", String(body.goal ?? "").trim() || null);
    if ("age" in body) setField("age", nullableNumber(body.age, "Age"));
    if ("weight_kg" in body) setField("weight_kg", nullableNumber(body.weight_kg, "Weight"));
    if ("height_cm" in body) setField("height_cm", nullableNumber(body.height_cm, "Height"));
    if ("gender" in body) {
      const gender = String(body.gender ?? "").trim().toLowerCase();
      if (gender && !["female", "male", "other"].includes(gender)) {
        return NextResponse.json({ ok: false, message: "Invalid gender." }, { status: 400 });
      }
      setField("gender", gender || null);
    }
    if ("activity_level" in body) {
      const raw = String(body.activity_level ?? "").trim();
      const activityLevel = raw ? normalizeActivityLevel(raw) : null;
      if (raw && !activityLevel) {
        return NextResponse.json({ ok: false, message: "Invalid activity level." }, { status: 400 });
      }
      setField("activity_level", activityLevel);
    }
    if (hasPriorCondition && "prior_condition" in body) {
      setField("prior_condition", String(body.prior_condition ?? "").trim() || null);
    }
  } catch (error) {
    return NextResponse.json({ ok: false, message: error?.message ?? "Invalid client details." }, { status: 400 });
  }

  if (!updates.length) {
    return NextResponse.json({ ok: false, message: "No editable fields provided." }, { status: 400 });
  }

  values.push(id, phone);
  const rows = await query(
    `UPDATE clients
     SET ${updates.join(", ")}, updated_at = NOW()
     WHERE id = $${values.length - 1}
       AND regexp_replace(COALESCE(created_by_trainer, ''), '[^0-9]', '', 'g')
         = regexp_replace(COALESCE($${values.length}, ''), '[^0-9]', '', 'g')
     RETURNING *`,
    values
  );

  if (!rows[0]) {
    return NextResponse.json({ ok: false, message: "Client not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, data: { client: rows[0] } });
}
