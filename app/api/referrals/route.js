import { NextResponse } from "next/server";
import { hasDatabaseUrl, query } from "app/lib/db";
import { readTrainerPhone } from "app/lib/session";

export async function GET(request) {
  const phone = readTrainerPhone(request.cookies.get("trainer_session")?.value) ?? null;
  if (!phone) {
    return NextResponse.json({ ok: false, message: "Login required." }, { status: 401 });
  }

  if (!hasDatabaseUrl()) {
    return NextResponse.json({
      ok: true,
      data: { referralCode: "MOCK01", referredCount: 0, source: "mock" },
    });
  }

  try {
    const rows = await query(
      `SELECT referral_code, referred_by FROM trainer_phones
       WHERE regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') = regexp_replace(COALESCE($1, ''), '[^0-9]', '', 'g')
       LIMIT 1`,
      [phone]
    );
    const trainer = rows[0] ?? null;
    const referralCode = trainer?.referral_code ?? null;

    let referredCount = 0;
    if (referralCode) {
      const countRows = await query(
        `SELECT COUNT(*)::int AS count FROM trainer_phones WHERE referred_by = $1`,
        [referralCode]
      );
      referredCount = Number(countRows[0]?.count ?? 0);
    }

    return NextResponse.json({
      ok: true,
      data: { referralCode, referredCount },
    });
  } catch {
    return NextResponse.json({ ok: true, data: { referralCode: null, referredCount: 0 } });
  }
}
