import { NextResponse } from "next/server";
import { buildRecoveredPayload } from "app/lib/apiResponse";
import { hasDatabaseUrl, query } from "app/lib/db";
import { checkOtpVerifyLimit } from "app/lib/rateLimit";
import { createTrainerToken } from "app/lib/session";

export async function GET() {
  const payload = await buildRecoveredPayload("api/auth/otp/verify");
  return NextResponse.json({
    ok: true,
    recovered: true,
    route: "api/auth/otp/verify",
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
  const code = String(body?.code ?? "");

  if (!phone || !code) {
    return NextResponse.json({ ok: false, message: "phone and code are required." }, { status: 400 });
  }

  const limit = await checkOtpVerifyLimit(phone);
  if (limit.limited) {
    return NextResponse.json(
      { ok: false, message: `Too many verification attempts. Please wait ${limit.retryAfterSeconds}s.` },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  if (!hasDatabaseUrl()) {
    const response = NextResponse.json({
      ok: true,
      recovered: true,
      route: "api/auth/otp/verify",
      data: { verified: code === "123456", token: "mock-trainer-session", source: "mock" },
    });
    if (code === "123456") {
      response.cookies.set("trainer_session", createTrainerToken(phone), {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 7,
        path: "/",
      });
    }
    return response;
  }

  const rows = await query(
    `
      SELECT id, code, expires_at, verified_at, attempts, max_attempts
      FROM otp_codes
      WHERE phone = $1
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [phone]
  );

  const latest = rows[0];
  if (!latest) {
    return NextResponse.json({ ok: false, message: "No OTP found for phone." }, { status: 404 });
  }

  const notExpired = latest.expires_at ? new Date(latest.expires_at).getTime() >= Date.now() : true;
  const remainingAttempts = (latest.max_attempts ?? 5) - (latest.attempts ?? 0);
  if (!notExpired || remainingAttempts <= 0) {
    return NextResponse.json({ ok: false, message: "OTP expired. Request a new code." }, { status: 400 });
  }

  if (latest.code !== code) {
    await query(`UPDATE otp_codes SET attempts = COALESCE(attempts,0) + 1 WHERE id = $1`, [latest.id]);
    return NextResponse.json({ ok: false, message: "Invalid OTP." }, { status: 401 });
  }

  await query(`UPDATE otp_codes SET verified_at = NOW() WHERE id = $1`, [latest.id]);

  const response = NextResponse.json({
    ok: true,
    recovered: true,
    route: "api/auth/otp/verify",
    data: { verified: true, token: "trainer-session", source: "database" },
  });
  response.cookies.set("trainer_session", createTrainerToken(phone), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
  return response;
}
