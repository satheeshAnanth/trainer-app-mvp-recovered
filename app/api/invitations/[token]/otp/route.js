import { NextResponse } from "next/server";
import { hasDatabaseUrl, query } from "app/lib/db";
import { generateOtpCode, sendOtpViaMSG91 } from "app/lib/msg91";
import { checkOtpSendLimit } from "app/lib/rateLimit";

/** POST /api/invitations/[token]/otp — send OTP to the client's phone from the invitation */
export async function POST(_request, { params }) {
  const { token } = params;

  if (!hasDatabaseUrl()) {
    return NextResponse.json({ ok: true, data: { sent: true, source: "mock" } });
  }

  const rows = await query(
    `SELECT client_phone, status, expires_at
     FROM invitations
     WHERE token = $1
     LIMIT 1`,
    [token]
  );

  const inv = rows[0];
  if (!inv) {
    return NextResponse.json({ ok: false, message: "Invitation not found." }, { status: 404 });
  }
  if (inv.status !== "pending" || new Date(inv.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ ok: false, message: "Invitation is no longer valid." }, { status: 410 });
  }

  const phone = inv.client_phone;

  const limit = await checkOtpSendLimit(phone);
  if (limit.limited) {
    return NextResponse.json(
      { ok: false, message: `Too many OTP requests. Please wait ${limit.retryAfterSeconds}s.` },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  const code = generateOtpCode();

  await query(
    `INSERT INTO otp_codes (id, phone, code, attempts, max_attempts, expires_at, created_at)
     VALUES (
       md5(random()::text || clock_timestamp()::text),
       $1, $2, 0, 5,
       NOW() + INTERVAL '10 minutes',
       NOW()
     )`,
    [phone, code]
  );

  const sms = await sendOtpViaMSG91(phone, code);
  if (!sms.ok) {
    return NextResponse.json({ ok: false, message: "Failed to send OTP. Please try again." }, { status: 502 });
  }

  return NextResponse.json({ ok: true, data: { sent: true, phone } });
}
