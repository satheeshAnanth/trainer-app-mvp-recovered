import { NextResponse } from "next/server";
import { hasDatabaseUrl, query } from "app/lib/db";
import { generateOtpCode, sendOtpViaMSG91 } from "app/lib/msg91";
import { checkOtpSendLimit } from "app/lib/rateLimit";
import {
  fixedOtpCode,
  isFixedOtpPhone,
  isPlatformAdminPhone,
  normalizeIndiaPhone,
} from "app/lib/fixedOtp";
import { getGymAdminByPhone } from "app/lib/gyms";

export async function POST(request) {
  const body = await request.json();
  const phone = normalizeIndiaPhone(body?.phone);

  if (!phone) {
    return NextResponse.json({ ok: false, message: "phone is required." }, { status: 400 });
  }

  if (!hasDatabaseUrl()) {
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
  const isPlatformAdmin = isPlatformAdminPhone(phone);
  const gymAdmin = await getGymAdminByPhone(phone);
  const isGymAdmin = Boolean(gymAdmin && gymAdmin.gym_status === "active");
  const trainerRows = await query(
    `SELECT id FROM trainer_phones
     WHERE regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') = $1
     LIMIT 1`,
    [digits]
  );

  if (!trainerRows[0] && !isPlatformAdmin && !isGymAdmin) {
    return NextResponse.json(
      { ok: false, message: "No account found for this number. Complete onboarding or ask your admin." },
      { status: 404 }
    );
  }

  const useFixed = isFixedOtpPhone(phone);
  const code = useFixed ? fixedOtpCode() : generateOtpCode();
  const expiry = useFixed ? "INTERVAL '10 years'" : "INTERVAL '10 minutes'";

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

  if (useFixed) {
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
