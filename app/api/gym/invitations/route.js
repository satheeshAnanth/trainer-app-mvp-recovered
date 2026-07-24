import { NextResponse } from "next/server";
import { hasDatabaseUrl, query } from "app/lib/db";
import { requireGymAdmin } from "app/lib/gymAuth";
import {
  assertSeatAvailable,
  generateGymInviteToken,
  normalizePhone,
} from "app/lib/gyms";

async function sendGymInviteSMS(phone, gymName, token) {
  const authKey = process.env.MSG91_AUTH_KEY;
  const templateId = process.env.MSG91_INVITE_TEMPLATE_ID ?? process.env.MSG91_TEMPLATE_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://trainer-app-mvp-recovered.vercel.app";
  const link = `${appUrl}/gym-invite/${token}`;

  if (!authKey || !templateId) {
    console.warn(`[gym-invite] MSG91 keys not set — invite link for ${phone}: ${link}`);
    return { ok: true, skipped: true, link };
  }

  const mobile = phone.replace(/^\+/, "");
  try {
    const res = await fetch("https://control.msg91.com/api/v5/flow/", {
      method: "POST",
      headers: { "Content-Type": "application/json", authkey: authKey },
      body: JSON.stringify({
        template_id: templateId,
        short_url: "0",
        recipients: [{ mobiles: mobile, trainer_name: gymName, invite_link: link }],
      }),
    });
    let data = {};
    try {
      data = await res.json();
    } catch {
      /* ignore */
    }
    if (!res.ok || data.type === "error") {
      return { ok: false, error: data.message ?? `MSG91 HTTP ${res.status}`, link };
    }
    return { ok: true, link };
  } catch (err) {
    return { ok: false, error: err.message, link };
  }
}

/** POST /api/gym/invitations — invite a trainer to this gym */
export async function POST(request) {
  const { error, session } = await requireGymAdmin(request);
  if (error) return error;

  if (!hasDatabaseUrl()) {
    return NextResponse.json({ ok: false, message: "DATABASE_URL required." }, { status: 503 });
  }

  const body = await request.json();
  const trainerPhone = normalizePhone(body?.trainerPhone ?? body?.phone);
  const trainerName = String(body?.trainerName ?? body?.name ?? "").trim() || null;

  if (!trainerPhone) {
    return NextResponse.json({ ok: false, message: "Trainer phone is required." }, { status: 400 });
  }

  const seat = await assertSeatAvailable(session.gymId);
  if (!seat.ok) {
    return NextResponse.json({ ok: false, message: seat.message }, { status: seat.status });
  }

  // Already active member?
  const existingMember = await query(
    `SELECT id, status FROM gym_memberships
     WHERE gym_id = $1
       AND regexp_replace(COALESCE(trainer_phone, ''), '[^0-9]', '', 'g')
         = regexp_replace(COALESCE($2, ''), '[^0-9]', '', 'g')
       AND status IN ('invited', 'active')
     LIMIT 1`,
    [session.gymId, trainerPhone]
  );
  if (existingMember[0]?.status === "active") {
    return NextResponse.json({ ok: false, message: "Trainer is already a member of this gym." }, { status: 409 });
  }

  const token = generateGymInviteToken();

  const invRows = await query(
    `INSERT INTO gym_invitations (id, token, gym_id, trainer_phone, trainer_name, status, expires_at, created_at)
     VALUES (
       md5(random()::text || clock_timestamp()::text),
       $1, $2, $3, $4, 'pending', NOW() + INTERVAL '14 days', NOW()
     )
     RETURNING *`,
    [token, session.gymId, trainerPhone, trainerName]
  );

  if (!existingMember[0]) {
    await query(
      `INSERT INTO gym_memberships (id, gym_id, trainer_phone, status, invited_at, created_at, updated_at)
       VALUES (
         md5(random()::text || clock_timestamp()::text),
         $1, $2, 'invited', NOW(), NOW(), NOW()
       )`,
      [session.gymId, trainerPhone]
    );
  }

  const sms = await sendGymInviteSMS(trainerPhone, session.gymName || "your gym", token);

  return NextResponse.json({
    ok: true,
    data: {
      invitation: invRows[0],
      smsSkipped: Boolean(sms.skipped),
      inviteLink: sms.link,
      smsError: sms.error || null,
    },
  });
}
