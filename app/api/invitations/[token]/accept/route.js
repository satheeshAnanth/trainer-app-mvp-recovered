import { NextResponse } from "next/server";
import { hasDatabaseUrl, query } from "app/lib/db";
import { createClientToken } from "app/lib/session";
import { checkOtpVerifyLimit } from "app/lib/rateLimit";

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  };
}

/**
 * POST /api/invitations/[token]/accept
 * Body: { code: "123456" }
 * Verifies OTP, creates the client record (if not already exists),
 * marks invitation accepted, and sets client_session cookie.
 */
export async function POST(request, { params }) {
  const { token } = params;
  const body = await request.json();
  const code = String(body?.code ?? "").trim();

  if (!code) {
    return NextResponse.json({ ok: false, message: "OTP code is required." }, { status: 400 });
  }

  if (!hasDatabaseUrl()) {
    const response = NextResponse.json({
      ok: true,
      data: { accepted: true, source: "mock" },
    });
    response.cookies.set("client_session", createClientToken("mock-client-id", "+919999999999"), cookieOptions());
    return response;
  }

  // Load invitation
  const invRows = await query(
    `SELECT i.*, t.phone AS trainer_phone_val, t.name AS trainer_name
     FROM invitations i
     JOIN trainer_phones t ON t.phone = i.trainer_phone
     WHERE i.token = $1
     LIMIT 1`,
    [token]
  );
  const inv = invRows[0];
  if (!inv) {
    return NextResponse.json({ ok: false, message: "Invitation not found." }, { status: 404 });
  }
  if (inv.status !== "pending" || new Date(inv.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ ok: false, message: "Invitation is no longer valid." }, { status: 410 });
  }

  const phone = inv.client_phone;

  // Rate limit OTP verify
  const limit = await checkOtpVerifyLimit(phone);
  if (limit.limited) {
    return NextResponse.json(
      { ok: false, message: `Too many attempts. Please wait ${limit.retryAfterSeconds}s.` },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  // Verify OTP
  const otpRows = await query(
    `SELECT id, code, expires_at, attempts, max_attempts
     FROM otp_codes
     WHERE phone = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [phone]
  );
  const otp = otpRows[0];
  if (!otp) {
    return NextResponse.json({ ok: false, message: "No OTP found. Please request a new code." }, { status: 404 });
  }
  const notExpired = otp.expires_at ? new Date(otp.expires_at).getTime() >= Date.now() : true;
  const remaining = (otp.max_attempts ?? 5) - (otp.attempts ?? 0);
  if (!notExpired || remaining <= 0) {
    return NextResponse.json({ ok: false, message: "OTP expired. Please request a new code." }, { status: 400 });
  }
  if (otp.code !== code) {
    await query(`UPDATE otp_codes SET attempts = COALESCE(attempts,0) + 1 WHERE id = $1`, [otp.id]);
    return NextResponse.json({ ok: false, message: "Invalid OTP." }, { status: 401 });
  }
  await query(`UPDATE otp_codes SET verified_at = NOW() WHERE id = $1`, [otp.id]);

  // Create or fetch the client record
  const phoneDigits = phone.replace(/\D/g, "");
  let clientId;

  const existingClient = await query(
    `SELECT id FROM clients
     WHERE regexp_replace(COALESCE(mobile, ''), '[^0-9]', '', 'g') = $1
       AND created_by_trainer = $2
     LIMIT 1`,
    [phoneDigits, inv.trainer_phone]
  );

  if (existingClient[0]) {
    clientId = existingClient[0].id;
  } else {
    const newClient = await query(
      `INSERT INTO clients (id, name, goal, mobile, created_by_trainer, created_at, updated_at)
       VALUES (
         md5(random()::text || clock_timestamp()::text),
         $1, $2, $3, $4, NOW(), NOW()
       )
       RETURNING id`,
      [inv.client_name, inv.client_goal ?? null, phone, inv.trainer_phone]
    );
    clientId = newClient[0].id;
  }

  // Mark invitation accepted
  await query(
    `UPDATE invitations
     SET status = 'accepted', accepted_at = NOW(), client_id = $2
     WHERE token = $1`,
    [token, clientId]
  );

  const response = NextResponse.json({
    ok: true,
    data: { accepted: true, clientId },
  });
  response.cookies.set("client_session", createClientToken(clientId, phone), cookieOptions());
  return response;
}
