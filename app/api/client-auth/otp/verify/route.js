import { NextResponse } from "next/server";
import { hasDatabaseUrl, query } from "app/lib/db";
import { mockData } from "app/lib/mockData";

const COOKIE = "client_session";

function normalizePhone(phone = "") {
  const digits = String(phone).replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `+91${digits}`;
  if (digits.startsWith("91") && digits.length === 12) return `+${digits}`;
  if (String(phone).startsWith("+")) return String(phone);
  return `+${digits}`;
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

function talkToTrainerResponse(phone, status = 403) {
  return NextResponse.json(
    {
      ok: false,
      message: "This mobile number is not registered yet. Please talk to your trainer before accessing the app.",
      data: { exists: false, phone },
    },
    { status }
  );
}

export async function POST(request) {
  const body = await request.json();
  const phone = normalizePhone(body?.phone);
  const code = String(body?.code ?? "");
  if (!phone || !code) {
    return NextResponse.json({ ok: false, message: "phone and code are required." }, { status: 400 });
  }

  if (!hasDatabaseUrl()) {
    const client = mockData.clients.find((c) => normalizePhone(c.mobile ?? c.phone) === phone);
    if (!client) {
      return talkToTrainerResponse(phone);
    }
    if (code !== "123456") {
      return NextResponse.json({ ok: false, message: "Invalid OTP." }, { status: 401 });
    }
    const response = NextResponse.json({
      ok: true,
      recovered: true,
      route: "api/client-auth/otp/verify",
      data: { verified: true, client, source: "mock" },
    });
    response.cookies.set(COOKIE, JSON.stringify({ clientId: client.id, phone }), cookieOptions());
    return response;
  }

  const clientRows = await query(
    `SELECT id, name, mobile FROM clients WHERE mobile = $1 LIMIT 1`,
    [phone]
  );
  const client = clientRows[0];
  if (!client) {
    return talkToTrainerResponse(phone);
  }

  const rows = await query(
    `
      SELECT id, code, expires_at, attempts, max_attempts
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
    route: "api/client-auth/otp/verify",
    data: { verified: true, client, source: "database" },
  });
  response.cookies.set(COOKIE, JSON.stringify({ clientId: client.id, phone }), cookieOptions());
  return response;
}
