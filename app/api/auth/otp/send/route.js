import { NextResponse } from "next/server";
import { hasDatabaseUrl, query } from "app/lib/db";
import { generateOtpCode, sendOtpViaMSG91 } from "app/lib/msg91";
import { checkOtpSendLimit } from "app/lib/rateLimit";

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

  if (!phone) {
    return NextResponse.json({ ok: false, message: "phone is required." }, { status: 400 });
  }

  if (!hasDatabaseUrl()) {
    // Dev-only: no DB, skip everything
    return NextResponse.json({ ok: true, data: { sent: true, phone, source: "mock" } });
  }

  const limit = await checkOtpSendLimit(phone);
  if (limit.limited) {
    return NextResponse.json(
      { ok: false, message: `Too many OTP requests. Please wait ${limit.retryAfterSeconds}s before trying again.` },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  const digits = phone.replace(/\D/g, "");
  const trainerRows = await query(
    `SELECT id FROM trainer_phones
     WHERE regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') = $1
     LIMIT 1`,
    [digits]
  );
  if (!trainerRows[0]) {
    return NextResponse.json(
      { ok: false, message: "Trainer not found. Please complete trainer onboarding first." },
      { status: 404 }
    );
  }

  const isTestPhone = phone.startsWith("+919900000");
  const code = isTestPhone ? "123456" : generateOtpCode();
  const expiry = isTestPhone ? "INTERVAL '10 years'" : "INTERVAL '10 minutes'";

  await query(
    `INSERT INTO otp_codes (id, phone, code, attempts, max_attempts, expires_at, created_at)
     VALUES (
       md5(random()::text || clock_timestamp()::text),
       $1, $2, 0, 99,
       NOW() + ${expiry},
       NOW()
     )`,
    [phone, code]
  );

  const sms = await sendOtpViaMSG91(phone, code);
  if (!sms.ok) {
    return NextResponse.json(
      { ok: false, message: "Failed to send OTP. Please try again." },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, data: { sent: true, phone } });
}
