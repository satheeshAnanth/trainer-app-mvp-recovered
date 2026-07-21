import { NextResponse } from "next/server";
import { hasDatabaseUrl, query } from "app/lib/db";
import { readTrainerPhone } from "app/lib/session";

function genReferralCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

async function ensureReferralCode(phone) {
  const rows = await query(
    `SELECT referral_code FROM trainer_phones
     WHERE regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') = regexp_replace(COALESCE($1, ''), '[^0-9]', '', 'g')
     LIMIT 1`,
    [phone]
  );
  const existing = rows[0]?.referral_code ?? null;
  if (existing) return existing;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = genReferralCode();
    try {
      const updated = await query(
        `UPDATE trainer_phones
         SET referral_code = $2, updated_at = NOW()
         WHERE regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') = regexp_replace(COALESCE($1, ''), '[^0-9]', '', 'g')
           AND referral_code IS NULL
         RETURNING referral_code`,
        [phone, code]
      );
      if (updated[0]?.referral_code) return updated[0].referral_code;

      const again = await query(
        `SELECT referral_code FROM trainer_phones
         WHERE regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') = regexp_replace(COALESCE($1, ''), '[^0-9]', '', 'g')
         LIMIT 1`,
        [phone]
      );
      if (again[0]?.referral_code) return again[0].referral_code;
    } catch {
      // unique collision — retry
    }
  }
  return null;
}

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
    const referralCode = await ensureReferralCode(phone);

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
