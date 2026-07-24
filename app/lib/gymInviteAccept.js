import { NextResponse } from "next/server";
import { hasDatabaseUrl, query } from "app/lib/db";
import { activateGymMembership, normalizePhone } from "app/lib/gyms";
import { createTrainerToken } from "app/lib/session";
import { checkOtpVerifyLimit } from "app/lib/rateLimit";
import { PRICING_MODEL } from "app/lib/pricingModel";

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  };
}

function genReferralCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

/** Verify OTP and activate gym membership for invitation token. */
export async function acceptGymInvitation(request, token) {
  const body = await request.json();
  const code = String(body?.code ?? "").trim();
  const nameOverride = String(body?.name ?? "").trim();

  if (!code) {
    return NextResponse.json({ ok: false, message: "OTP code is required." }, { status: 400 });
  }
  if (!hasDatabaseUrl()) {
    return NextResponse.json({ ok: false, message: "DATABASE_URL required." }, { status: 503 });
  }

  const invRows = await query(
    `SELECT i.*, g.name AS gym_name, g.status AS gym_status
     FROM gym_invitations i
     JOIN gyms g ON g.id = i.gym_id
     WHERE i.token = $1
     LIMIT 1`,
    [token]
  );
  const inv = invRows[0];
  if (!inv) {
    return NextResponse.json({ ok: false, message: "Invitation not found." }, { status: 404 });
  }
  if (inv.gym_status !== "active") {
    return NextResponse.json({ ok: false, message: "Gym is suspended." }, { status: 403 });
  }
  if (inv.status !== "pending" || new Date(inv.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ ok: false, message: "Invitation is no longer valid." }, { status: 410 });
  }

  const phone = normalizePhone(inv.trainer_phone);
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

  const existing = await query(
    `SELECT phone, name FROM trainer_phones
     WHERE regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g')
         = regexp_replace(COALESCE($1, ''), '[^0-9]', '', 'g')
     LIMIT 1`,
    [phone]
  );

  const displayName = nameOverride || inv.trainer_name || existing[0]?.name || "Trainer";

  if (!existing[0]) {
    await query(
      `INSERT INTO trainer_phones (
         id, phone, name, is_active,
         gym_name, billing_status, trial_ends_at, max_clients,
         created_at, updated_at
       )
       VALUES (
         md5(random()::text || clock_timestamp()::text),
         $1, $2, 1,
         $3, 'active', NOW() + INTERVAL '14 days', $4,
         NOW(), NOW()
       )
       ON CONFLICT (phone) DO NOTHING`,
      [phone, displayName, inv.gym_name, PRICING_MODEL.perClient.clientLimit]
    );
    await query(
      `UPDATE trainer_phones
       SET referral_code = COALESCE(referral_code, $2), updated_at = NOW()
       WHERE regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g')
           = regexp_replace(COALESCE($1, ''), '[^0-9]', '', 'g')`,
      [phone, genReferralCode()]
    ).catch(() => null);
  }

  const activated = await activateGymMembership({
    gymId: inv.gym_id,
    trainerPhone: phone,
    trainerName: inv.gym_name,
  });
  if (!activated.ok) {
    return NextResponse.json({ ok: false, message: activated.message }, { status: activated.status || 409 });
  }

  await query(
    `UPDATE gym_invitations
     SET status = 'accepted', accepted_at = NOW()
     WHERE token = $1`,
    [token]
  );

  const response = NextResponse.json({
    ok: true,
    data: {
      accepted: true,
      gymName: inv.gym_name,
      note: "You can invite and coach clients as usual. Gym only manages your seat.",
    },
  });
  response.cookies.set("trainer_session", createTrainerToken(phone), cookieOptions());
  return response;
}
