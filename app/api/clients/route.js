import { NextResponse } from "next/server";
import { buildRecoveredPayload } from "app/lib/apiResponse";
import { hasDatabaseUrl, query } from "app/lib/db";

function normalizePhone(phone = "") {
  const digits = String(phone).replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `+91${digits}`;
  if (digits.startsWith("91") && digits.length === 12) return `+${digits}`;
  if (String(phone).startsWith("+")) return String(phone);
  return `+${digits}`;
}

export async function GET() {
  const payload = await buildRecoveredPayload("api/clients");
  return NextResponse.json({
    ok: true,
    recovered: true,
    route: "api/clients",
    data: payload,
  });
}

export async function POST(request) {
  const body = await request.json();
  const name = String(body?.name ?? "").trim();
  const goal = String(body?.goal ?? "").trim();
  const mobile = normalizePhone(body?.mobile);
  const age = body?.age ? Number(body.age) : null;
  const weightKg = body?.weightKg ? Number(body.weightKg) : null;
  const heightCm = body?.heightCm ? Number(body.heightCm) : null;
  const gender = String(body?.gender ?? "").trim() || null;
  const activityLevel = String(body?.activityLevel ?? "").trim() || null;
  const trainerPhone = request.cookies.get("trainer_session")?.value ?? null;

  if (!name || !mobile) {
    return NextResponse.json({ ok: false, message: "Name and mobile are required." }, { status: 400 });
  }

  if (!hasDatabaseUrl()) {
    return NextResponse.json(
      {
        ok: true,
        recovered: true,
        route: "api/clients",
        data: {
          id: `mock-client-${Date.now()}`,
          name,
          goal,
          mobile,
          age,
          weight_kg: weightKg,
          height_cm: heightCm,
          gender,
          activity_level: activityLevel,
          source: "mock",
        },
      },
      { status: 201 }
    );
  }

  const rows = await query(
    `
      INSERT INTO clients (
        id,
        name,
        goal,
        mobile,
        age,
        weight_kg,
        height_cm,
        gender,
        activity_level,
        created_by_trainer,
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
        $7,
        $8,
        $9,
        NOW(),
        NOW()
      )
      RETURNING *
    `,
    [
      name,
      goal || null,
      mobile,
      Number.isFinite(age) ? age : null,
      Number.isFinite(weightKg) ? weightKg : null,
      Number.isFinite(heightCm) ? heightCm : null,
      gender,
      activityLevel,
      trainerPhone,
    ]
  );

  return NextResponse.json(
    {
      ok: true,
      recovered: true,
      route: "api/clients",
      data: rows[0],
    },
    { status: 201 }
  );
}
