import { NextResponse } from "next/server";
import { hasDatabaseUrl, query } from "app/lib/db";
import { requireGymAdmin, createGymSessionCookie, clearGymSessionCookie } from "app/lib/gymAuth";
import { getGymAdminByPhone, normalizePhone } from "app/lib/gyms";
import { checkOtpVerifyLimit } from "app/lib/rateLimit";

/** GET /api/gym/session */
export async function GET(request) {
  const { error, session } = await requireGymAdmin(request);
  if (error) {
    return NextResponse.json({ ok: true, data: { authenticated: false } });
  }
  return NextResponse.json({
    ok: true,
    data: {
      authenticated: true,
      phone: session.phone,
      gymId: session.gymId,
      gymName: session.gymName,
      name: session.name,
      role: session.role,
    },
  });
}

/** POST /api/gym/session — verify OTP and set gym_session (body: { phone, code }) */
export async function POST(request) {
  const body = await request.json();
  const phone = normalizePhone(body?.phone);
  const code = String(body?.code ?? "").trim();

  if (!phone || !code) {
    return NextResponse.json({ ok: false, message: "phone and code are required." }, { status: 400 });
  }

  if (!hasDatabaseUrl()) {
    return NextResponse.json({ ok: false, message: "DATABASE_URL required." }, { status: 503 });
  }

  const admin = await getGymAdminByPhone(phone);
  if (!admin) {
    return NextResponse.json({ ok: false, message: "No gym admin account for this phone." }, { status: 404 });
  }
  if (admin.gym_status !== "active") {
    return NextResponse.json({ ok: false, message: "Gym is suspended." }, { status: 403 });
  }

  const limit = await checkOtpVerifyLimit(phone);
  if (limit.limited) {
    return NextResponse.json(
      { ok: false, message: `Too many attempts. Please wait ${limit.retryAfterSeconds}s.` },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
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

  const cookie = createGymSessionCookie(phone, admin.gym_id);
  const response = NextResponse.json({
    ok: true,
    data: {
      authenticated: true,
      gymId: admin.gym_id,
      gymName: admin.gym_name,
      name: admin.name,
    },
  });
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}

/** DELETE /api/gym/session — logout */
export async function DELETE() {
  const cookie = clearGymSessionCookie();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}
