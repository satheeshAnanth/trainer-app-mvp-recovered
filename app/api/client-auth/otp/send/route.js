import { NextResponse } from "next/server";
import { hasDatabaseUrl, query } from "app/lib/db";
import { mockData } from "app/lib/mockData";
import { generateOtpCode, sendOtpViaMSG91 } from "app/lib/msg91";
import { checkOtpSendLimit } from "app/lib/rateLimit";
import { fixedOtpCode, isFixedOtpPhone, normalizeIndiaPhone } from "app/lib/fixedOtp";

function normalizePhone(phone = "") {
  return normalizeIndiaPhone(phone);
}

function talkToTrainerResponse(phone, status = 403) {
  return NextResponse.json(
    {
      ok: false,
      message: "This mobile number is not registered yet. Please talk to your trainer before accessing the app.",
      data: { exists: false, phone },
    },
    { status }
  );
}

export async function POST(request) {
  const body = await request.json();
  const phone = normalizePhone(body?.phone);

  if (!phone) {
    return NextResponse.json({ ok: false, message: "phone is required." }, { status: 400 });
  }

  if (!hasDatabaseUrl()) {
    const exists = mockData.clients.some((c) => normalizePhone(c.mobile ?? c.phone) === phone);
    if (!exists) return talkToTrainerResponse(phone);
    return NextResponse.json({ ok: true, data: { sent: true, phone, source: "mock" } });
  }

  const limit = await checkOtpSendLimit(phone);
  if (limit.limited) {
    return NextResponse.json(
      { ok: false, message: `Too many OTP requests. Please wait ${limit.retryAfterSeconds}s before trying again.` },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  const phoneDigits = phone.replace(/\D/g, "");
  const clientRows = await query(
    `SELECT id FROM clients
     WHERE regexp_replace(COALESCE(mobile, ''), '[^0-9]', '', 'g') = $1
     LIMIT 1`,
    [phoneDigits]
  );
  if (!clientRows[0]) {
    return talkToTrainerResponse(phone);
  }

  const isTestPhone = isFixedOtpPhone(phone);
  const code = isTestPhone ? fixedOtpCode() : generateOtpCode();
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

  if (isTestPhone) {
    console.warn(`[otp] Fixed test OTP for ${phone}: ${code}`);
    return NextResponse.json({ ok: true, data: { sent: true, phone, fixedOtp: true } });
  }

  const sms = await sendOtpViaMSG91(phone, code);
  if (!sms.ok) {
    return NextResponse.json(
      { ok: false, message: "Failed to send OTP. Please try again." },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, data: { sent: true, phone } });
}
