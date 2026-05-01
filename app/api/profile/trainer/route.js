import { NextResponse } from "next/server";
import { buildRecoveredPayload } from "app/lib/apiResponse";
import { hasDatabaseUrl, query } from "app/lib/db";

export async function GET() {
  const payload = await buildRecoveredPayload("api/profile/trainer");
  return NextResponse.json({
    ok: true,
    recovered: true,
    route: "api/profile/trainer",
    data: payload,
  });
}

export async function PATCH(request) {
  const body = await request.json();
  const phone = request.cookies.get("trainer_session")?.value ?? null;
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
