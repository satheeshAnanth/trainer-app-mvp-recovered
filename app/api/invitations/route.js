import { NextResponse } from "next/server";
import { hasDatabaseUrl, query } from "app/lib/db";
import { readTrainerPhone } from "app/lib/session";
import { randomBytes } from "crypto";

function normalizePhone(phone = "") {
  const digits = String(phone).replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `+91${digits}`;
  if (digits.startsWith("91") && digits.length === 12) return `+${digits}`;
  if (String(phone).startsWith("+")) return String(phone);
  return `+${digits}`;
}

function trainerPhone(request) {
  return readTrainerPhone(request.cookies.get("trainer_session")?.value) ?? null;
}

function generateToken() {
  return randomBytes(20).toString("base64url");
}

async function sendInviteSMS(phone, trainerName, token) {
  const authKey = process.env.MSG91_AUTH_KEY;
  const templateId = process.env.MSG91_INVITE_TEMPLATE_ID ?? process.env.MSG91_TEMPLATE_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://your-app.vercel.app";

  if (!authKey || !templateId) {
    console.warn(`[invite] MSG91 keys not set — invite link for ${phone}: ${appUrl}/invite/${token}`);
    return { ok: true, skipped: true };
  }

  const mobile = phone.replace(/^\+/, "");
  const link = `${appUrl}/invite/${token}`;

  let res;
  try {
    res = await fetch("https://control.msg91.com/api/v5/flow/", {
      method: "POST",
      headers: { "Content-Type": "application/json", authkey: authKey },
      body: JSON.stringify({
        template_id: templateId,
        short_url: "0",
        recipients: [{ mobiles: mobile, trainer_name: trainerName, invite_link: link }],
      }),
    });
  } catch (err) {
    return { ok: false, error: `MSG91 network error: ${err.message}` };
  }

  let data = {};
  try { data = await res.json(); } catch { /* ignore */ }
  if (!res.ok || data.type === "error") {
    return { ok: false, error: data.message ?? `MSG91 HTTP ${res.status}` };
  }
  return { ok: true };
}

/** GET /api/invitations — list all invitations created by this trainer */
export async function GET(request) {
  const phone = trainerPhone(request);
  if (!phone) {
    return NextResponse.json({ ok: false, message: "Login required." }, { status: 401 });
  }

  if (!hasDatabaseUrl()) {
    return NextResponse.json({ ok: true, data: { invitations: [], source: "mock" } });
  }

  const rows = await query(
    `SELECT id, token, client_name, client_phone, client_goal, status, expires_at, accepted_at, client_id, created_at
     FROM invitations
     WHERE trainer_phone = $1
     ORDER BY created_at DESC
     LIMIT 100`,
    [phone]
  );

  return NextResponse.json({ ok: true, data: { invitations: rows } });
}

/** POST /api/invitations — trainer creates an invitation and sends SMS to client */
export async function POST(request) {
  const phone = trainerPhone(request);
  if (!phone) {
    return NextResponse.json({ ok: false, message: "Login required." }, { status: 401 });
  }

  const body = await request.json();
  const clientPhone = normalizePhone(body?.clientPhone ?? body?.phone ?? "");
  const clientName = String(body?.clientName ?? body?.name ?? "").trim();
  const clientGoal = String(body?.clientGoal ?? body?.goal ?? "").trim() || null;

  if (!clientPhone || !clientName) {
    return NextResponse.json({ ok: false, message: "clientName and clientPhone are required." }, { status: 400 });
  }

  if (clientPhone === phone) {
    return NextResponse.json({ ok: false, message: "You cannot invite yourself." }, { status: 400 });
  }

  if (!hasDatabaseUrl()) {
    const token = generateToken();
    return NextResponse.json({
      ok: true,
      data: { invitation: { token, clientName, clientPhone, status: "pending", source: "mock" } },
    });
  }

  // Expire any existing pending invitation for this client from this trainer
  await query(
    `UPDATE invitations SET status = 'expired'
     WHERE trainer_phone = $1 AND client_phone = $2 AND status = 'pending'`,
    [phone, clientPhone]
  );

  const token = generateToken();

  // Fetch trainer name for the SMS
  const trainerRows = await query(
    `SELECT name FROM trainer_phones WHERE phone = $1 LIMIT 1`,
    [phone]
  );
  const trainerName = trainerRows[0]?.name ?? "Your trainer";

  const rows = await query(
    `INSERT INTO invitations (token, trainer_phone, client_name, client_phone, client_goal)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, token, client_name, client_phone, client_goal, status, expires_at, created_at`,
    [token, phone, clientName, clientPhone, clientGoal]
  );
  const invitation = rows[0];

  const sms = await sendInviteSMS(clientPhone, trainerName, token);
  if (!sms.ok && !sms.skipped) {
    console.error("[invite] SMS failed:", sms.error);
  }

  return NextResponse.json({
    ok: true,
    data: { invitation, smsSent: sms.ok },
  }, { status: 201 });
}
