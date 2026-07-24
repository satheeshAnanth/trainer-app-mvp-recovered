import { NextResponse } from "next/server";
import { hasDatabaseUrl, query } from "app/lib/db";
import {
  createAdminSessionCookie,
} from "app/lib/adminAuth";
import {
  fixedOtpCode,
  isFixedOtpPhone,
  isPlatformAdminPhone,
  normalizeIndiaPhone,
} from "app/lib/fixedOtp";
import { checkOtpVerifyLimit } from "app/lib/rateLimit";

/**
 * POST /api/admin/otp/verify
 * Body: { phone, code } — verifies OTP for a platform-admin phone and sets admin_session.
 */
export async function POST(request) {
  const body = await request.json();
  const phone = normalizeIndiaPhone(body?.phone);
  const code = String(body?.code ?? "").trim();

  if (!phone || !code) {
    return NextResponse.json({ ok: false, message: "phone and code are required." }, { status: 400 });
  }

  if (!isPlatformAdminPhone(phone)) {
    return NextResponse.json({ ok: false, message: "Not a platform admin phone." }, { status: 403 });
  }

  if (!hasDatabaseUrl()) {
    if (code !== fixedOtpCode()) {
      return NextResponse.json({ ok: false, message: "Invalid OTP." }, { status: 401 });
    }
    const cookie = createAdminSessionCookie(phone);
    const response = NextResponse.json({
      ok: true,
      data: { verified: true, authenticated: true, role: "admin", phone },
    });
    response.cookies.set(cookie.name, cookie.value, cookie.options);
    return response;
  }

  const limit = await checkOtpVerifyLimit(phone);
  if (limit.limited) {
    return NextResponse.json(
      { ok: false, message: `Too many attempts. Please wait ${limit.retryAfterSeconds}s.` },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  // Fixed-OTP phones may verify 123456 even if send was skipped / SMS failed
  if (isFixedOtpPhone(phone) && code === fixedOtpCode()) {
    await query(
      `INSERT INTO otp_codes (id, phone, code, attempts, max_attempts, expires_at, verified_at, created_at)
       VALUES (
         md5(random()::text || clock_timestamp()::text),
         $1, $2, 0, 99, NOW() + INTERVAL '10 years', NOW(), NOW()
       )`,
      [phone, fixedOtpCode()]
    ).catch(() => null);

    const cookie = createAdminSessionCookie(phone);
    const response = NextResponse.json({
      ok: true,
      data: { verified: true, authenticated: true, role: "admin", phone },
    });
    response.cookies.set(cookie.name, cookie.value, cookie.options);
    return response;
  }

  const otpRows = await query(
    `SELECT id, code, expires_at, attempts, max_attempts
     FROM otp_codes WHERE phone = $1 ORDER BY created_at DESC LIMIT 1`,
    [phone]
  );
  const otp = otpRows[0];
  if (!otp) {
    return NextResponse.json({ ok: false, message: "No OTP found. Request a new code." }, { status: 404 });
  }
  const notExpired = otp.expires_at ? new Date(otp.expires_at).getTime() >= Date.now() : true;
  const remaining = (otp.max_attempts ?? 5) - (otp.attempts ?? 0);
  if (!notExpired || remaining <= 0) {
    return NextResponse.json({ ok: false, message: "OTP expired." }, { status: 400 });
  }
  if (otp.code !== code) {
    await query(`UPDATE otp_codes SET attempts = COALESCE(attempts,0) + 1 WHERE id = $1`, [otp.id]);
    return NextResponse.json({ ok: false, message: "Invalid OTP." }, { status: 401 });
  }
  await query(`UPDATE otp_codes SET verified_at = NOW() WHERE id = $1`, [otp.id]);

  const cookie = createAdminSessionCookie(phone);
  const response = NextResponse.json({
    ok: true,
    data: { verified: true, authenticated: true, role: "admin", phone },
  });
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}
