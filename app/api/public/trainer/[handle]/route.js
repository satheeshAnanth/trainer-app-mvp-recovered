import { NextResponse } from "next/server";
import { hasDatabaseUrl, query } from "app/lib/db";

export async function GET(request, { params }) {
  const handle = String(params?.handle ?? "").toUpperCase().trim();
  if (!handle || handle.length > 20) {
    return NextResponse.json({ ok: false, message: "Invalid profile handle." }, { status: 400 });
  }

  if (!hasDatabaseUrl()) {
    return NextResponse.json({
      ok: true,
      data: {
        trainer: {
          name: "Demo Trainer",
          specialization: "Strength Training, General Fitness",
          gym_name: null,
          location: null,
          handle,
        },
        source: "mock",
      },
    });
  }

  try {
    const rows = await query(
      `SELECT name, specialization, gym_name, location, referral_code AS handle
       FROM trainer_phones
       WHERE UPPER(referral_code) = $1 AND COALESCE(is_active, 1) = 1
       LIMIT 1`,
      [handle]
    );
    if (!rows[0]) {
      return NextResponse.json({ ok: false, message: "Trainer profile not found." }, { status: 404 });
    }
    return NextResponse.json({
      ok: true,
      data: { trainer: rows[0] },
    });
  } catch {
    return NextResponse.json({ ok: false, message: "Unable to load profile." }, { status: 500 });
  }
}
