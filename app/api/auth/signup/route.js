import { NextResponse } from "next/server";
import { hasDatabaseUrl, query } from "app/lib/db";
import { normalizeBillingModel, PRICING_MODEL } from "app/lib/pricingModel";
import { createTrainerToken } from "app/lib/session";

function normalizePhone(phone = "") {
  const digits = String(phone).replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `+91${digits}`;
  if (digits.startsWith("91") && digits.length === 12) return `+${digits}`;
  if (String(phone).startsWith("+")) return String(phone);
  return `+${digits}`;
}

function genReferralCode() {
  // Avoids visually ambiguous chars (0/O, 1/I/l)
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  };
}

// Public endpoint — no ADMIN_SECRET required.
// Creates a trainer account on the trial plan, sets session cookie.
export async function POST(request) {
  const body = await request.json();

  const phone = normalizePhone(body?.phone);
  const name = String(body?.name ?? "").trim();
  const gymName = String(body?.gymName ?? "").trim();
  const specialization = String(body?.specialization ?? "").trim();
  const yearsExperience = Number(body?.yearsExperience ?? 0);
  const location = String(body?.location ?? "").trim();
  const pricingTier = String(body?.pricingTier ?? "starter").trim();
  const billingModel = normalizeBillingModel(body?.billingModel ?? "trial");
  const referredBy = String(body?.referredBy ?? "").trim().toUpperCase() || null;

  if (!phone || !name) {
    return NextResponse.json({ ok: false, message: "name and phone are required." }, { status: 400 });
  }

  if (!hasDatabaseUrl()) {
    const response = NextResponse.json({
      ok: true,
      data: {
        id: `mock-trainer-${Date.now()}`,
        phone,
        name,
        billing_status: "trial",
        referral_code: genReferralCode(),
        source: "mock",
      },
    });
    response.cookies.set("trainer_session", createTrainerToken(phone), cookieOptions());
    return response;
  }

  const phoneDigits = phone.replace(/\D/g, "");

  // Block if this number is already registered as a client
  const clientConflict = await query(
    `SELECT id FROM clients
     WHERE regexp_replace(COALESCE(mobile, ''), '[^0-9]', '', 'g') = $1
     LIMIT 1`,
    [phoneDigits]
  );
  if (clientConflict[0]) {
    return NextResponse.json(
      { ok: false, message: "This number is already registered as a client and cannot be used as a trainer." },
      { status: 409 }
    );
  }

  const maxClients = billingModel === "trial"
    ? PRICING_MODEL.trial.clientLimit
    : PRICING_MODEL.perClient.clientLimit;

  const rows = await query(
    `INSERT INTO trainer_phones (
       id, phone, name, is_active,
       gym_name, specialization, years_experience, location,
       pricing_tier, billing_status, trial_ends_at, max_clients,
       created_at, updated_at
     )
     VALUES (
       md5(random()::text || clock_timestamp()::text),
       $1, $2, 1,
       $3, $4, $5, $6,
       $7, $8,
       NOW() + INTERVAL '14 days',
       $9,
       NOW(), NOW()
     )
     ON CONFLICT (phone) DO UPDATE SET
       name            = EXCLUDED.name,
       gym_name        = EXCLUDED.gym_name,
       specialization  = EXCLUDED.specialization,
       years_experience = EXCLUDED.years_experience,
       location        = EXCLUDED.location,
       updated_at      = NOW()
     RETURNING *`,
    [
      phone, name,
      gymName || null,
      specialization || null,
      Number.isFinite(yearsExperience) && yearsExperience > 0 ? yearsExperience : null,
      location || null,
      pricingTier || "starter",
      billingModel,
      maxClients,
    ]
  );

  // Seed initial billing record for this month
  const monthYear = new Date().toISOString().slice(0, 7);
  await query(
    `INSERT INTO billing_records (id, trainer_phone, month_year, active_clients, amount_inr, status, created_at)
     VALUES (md5(random()::text || clock_timestamp()::text), $1, $2, 0, 0, 'trial', NOW())
     ON CONFLICT (trainer_phone, month_year) DO NOTHING`,
    [phone, monthYear]
  ).catch(() => null);

  // Generate referral code (migration 004 required); ignore if column not yet added
  const referralCode = genReferralCode();
  await query(
    `UPDATE trainer_phones
     SET referral_code = COALESCE(referral_code, $2),
         referred_by   = COALESCE(referred_by,   $3),
         updated_at    = NOW()
     WHERE regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') = regexp_replace(COALESCE($1, ''), '[^0-9]', '', 'g')`,
    [phone, referralCode, referredBy]
  ).catch(() => null);

  const response = NextResponse.json({ ok: true, data: { trainer: rows[0] } });
  response.cookies.set("trainer_session", createTrainerToken(phone), cookieOptions());
  return response;
}
