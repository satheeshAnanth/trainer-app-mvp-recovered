import { NextResponse } from "next/server";
import { buildRecoveredPayload } from "app/lib/apiResponse";
import { hasDatabaseUrl, query } from "app/lib/db";

export async function GET() {
  const payload = await buildRecoveredPayload("api/admin/register-trainer");
  return NextResponse.json({
    ok: true,
    recovered: true,
    route: "api/admin/register-trainer",
    data: payload,
  });
}

function normalizePhone(phone = "") {
  const digits = String(phone).replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `+91${digits}`;
  if (digits.startsWith("91") && digits.length === 12) return `+${digits}`;
  if (String(phone).startsWith("+")) return String(phone);
  return `+${digits}`;
}

export async function POST(request) {
  const body = await request.json();
  const phone = normalizePhone(body?.phone);
  const name = String(body?.name ?? "").trim();
  const gymName = String(body?.gymName ?? "").trim();
  const specialization = String(body?.specialization ?? "").trim();
  const yearsExperience = Number(body?.yearsExperience ?? 0);
  const location = String(body?.location ?? "").trim();
  const pricingTier = String(body?.pricingTier ?? "starter").trim();

  if (!phone || !name) {
    return NextResponse.json({ ok: false, message: "name and phone are required." }, { status: 400 });
  }

  if (!hasDatabaseUrl()) {
    const response = NextResponse.json({
      ok: true,
      recovered: true,
      route: "api/admin/register-trainer",
      data: {
        id: `mock-trainer-${Date.now()}`,
        phone,
        name,
        gym_name: gymName || null,
        specialization: specialization || null,
        years_experience: yearsExperience || null,
        location: location || null,
        pricing_tier: pricingTier,
        source: "mock",
      },
    });
    response.cookies.set("trainer_session", phone, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24,
      path: "/",
    });
    return response;
  }

  const rows = await query(
    `
      INSERT INTO trainer_phones (
        id,
        phone,
        name,
        is_active,
        gym_name,
        specialization,
        years_experience,
        location,
        pricing_tier,
        billing_status,
        trial_ends_at,
        max_clients,
        created_at,
        updated_at
      )
      VALUES (
        md5(random()::text || clock_timestamp()::text),
        $1,
        $2,
        1,
        $3,
        $4,
        $5,
        $6,
        $7,
        'trial',
        NOW() + INTERVAL '14 days',
        50,
        NOW(),
        NOW()
      )
      ON CONFLICT (phone) DO UPDATE SET
        name = EXCLUDED.name,
        gym_name = EXCLUDED.gym_name,
        specialization = EXCLUDED.specialization,
        years_experience = EXCLUDED.years_experience,
        location = EXCLUDED.location,
        pricing_tier = EXCLUDED.pricing_tier,
        updated_at = NOW()
      RETURNING *
    `,
    [
      phone,
      name,
      gymName || null,
      specialization || null,
      Number.isFinite(yearsExperience) && yearsExperience > 0 ? yearsExperience : null,
      location || null,
      pricingTier || "starter",
    ]
  );

  const monthYear = new Date().toISOString().slice(0, 7);
  await query(
    `
      INSERT INTO billing_records (
        id,
        trainer_phone,
        month_year,
        active_clients,
        amount_inr,
        status,
        created_at
      )
      VALUES (
        md5(random()::text || clock_timestamp()::text),
        $1,
        $2,
        0,
        0,
        'trial',
        NOW()
      )
      ON CONFLICT (trainer_phone, month_year) DO NOTHING
    `,
    [phone, monthYear]
  ).catch(() => null);

  const response = NextResponse.json({
    ok: true,
    recovered: true,
    route: "api/admin/register-trainer",
    data: { trainer: rows[0], source: "database" },
  });
  response.cookies.set("trainer_session", phone, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24,
    path: "/",
  });
  return response;
}
