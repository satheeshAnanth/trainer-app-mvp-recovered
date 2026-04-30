import { NextResponse } from "next/server";
import { buildRecoveredPayload } from "app/lib/apiResponse";
import { hasDatabaseUrl, query } from "app/lib/db";

export async function GET() {
  const payload = await buildRecoveredPayload("api/auth/otp/send");
  return NextResponse.json({
    ok: true,
    recovered: true,
    route: "api/auth/otp/send",
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

  if (!phone) {
    return NextResponse.json({ ok: false, message: "phone is required." }, { status: 400 });
  }

  if (!hasDatabaseUrl()) {
    return NextResponse.json({
      ok: true,
      recovered: true,
      route: "api/auth/otp/send",
      data: { sent: true, phone, code: "123456", source: "mock" },
    });
  }

  const code = "123456";
  const rows = await query(
    `
      INSERT INTO otp_codes (id, phone, code, attempts, max_attempts, expires_at, created_at)
      VALUES (
        md5(random()::text || clock_timestamp()::text),
        $1,
        $2,
        0,
        5,
        NOW() + INTERVAL '10 minutes',
        NOW()
      )
      RETURNING id, phone, expires_at
    `,
    [phone, code]
  );

  return NextResponse.json({
    ok: true,
    recovered: true,
    route: "api/auth/otp/send",
    data: { sent: true, otp: rows[0], code, source: "database" },
  });
}
