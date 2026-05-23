import { NextResponse } from "next/server";
import { hasDatabaseUrl, query } from "app/lib/db";
import { readTrainerPhone } from "app/lib/session";
import { mockData } from "app/lib/mockData";

export async function GET(request) {
  if (!hasDatabaseUrl()) {
    return NextResponse.json({
      ok: true,
      data: { trainer: mockData.trainerProfile ?? null, source: "mock" },
    });
  }

  const phone = readTrainerPhone(request.cookies.get("trainer_session")?.value) ?? null;

  try {
    const rows = await query(
      `SELECT id, phone, name, gym_name, specialization, years_experience, location,
              pricing_tier, billing_status, trial_ends_at, max_clients, is_active,
              referral_code, referred_by, created_at, updated_at
       FROM trainer_phones
       WHERE regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') = regexp_replace(COALESCE($1, ''), '[^0-9]', '', 'g')
       LIMIT 1`,
      [phone]
    );
    return NextResponse.json({
      ok: true,
      data: { trainer: rows[0] ?? null, source: "database" },
    });
  } catch {
    return NextResponse.json({
      ok: true,
      data: { trainer: null, source: "database-error" },
    });
  }
}

export async function PATCH(request) {
  const body = await request.json();
  const phone = readTrainerPhone(request.cookies.get("trainer_session")?.value) ?? null;
  const name = String(body?.name ?? "").trim();
  const specialization = String(body?.specialization ?? "").trim() || null;

  if (!phone) {
    return NextResponse.json({ ok: false, message: "Login required." }, { status: 401 });
  }

  if (!name) {
    return NextResponse.json({ ok: false, message: "Name is required." }, { status: 400 });
  }

  if (!hasDatabaseUrl()) {
    return NextResponse.json({
      ok: true,
      recovered: true,
      route: "api/profile/trainer",
      data: { phone, name, specialization, source: "mock" },
    });
  }

  const rows = await query(
    `
      UPDATE trainer_phones
      SET
        name = $2,
        specialization = $3,
        updated_at = NOW()
      WHERE regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') = regexp_replace(COALESCE($1, ''), '[^0-9]', '', 'g')
      RETURNING id, phone, name, specialization, updated_at
    `,
    [phone, name, specialization]
  );

  if (!rows[0]) {
    return NextResponse.json({ ok: false, message: "Trainer profile not found." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    recovered: true,
    route: "api/profile/trainer",
    data: rows[0],
  });
}
