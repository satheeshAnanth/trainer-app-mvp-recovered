import { NextResponse } from "next/server";
import { buildRecoveredPayload } from "app/lib/apiResponse";
import { hasDatabaseUrl, query } from "app/lib/db";

export async function GET() {
  const payload = await buildRecoveredPayload("api/auth/check-phone");
  return NextResponse.json({
    ok: true,
    recovered: true,
    route: "api/auth/check-phone",
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
      route: "api/auth/check-phone",
      data: { exists: true, phone, source: "mock" },
    });
  }

  const digits = phone.replace(/\D/g, "");
  const rows = await query(
    `
      SELECT id, phone, name
      FROM trainer_phones
      WHERE regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') = $1
      LIMIT 1
    `,
    [digits]
  );
  return NextResponse.json({
    ok: true,
    recovered: true,
    route: "api/auth/check-phone",
    data: { exists: rows.length > 0, trainer: rows[0] ?? null, phone, source: "database" },
  });
}
