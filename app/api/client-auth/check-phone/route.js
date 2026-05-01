import { NextResponse } from "next/server";
import { hasDatabaseUrl, query } from "app/lib/db";
import { mockData } from "app/lib/mockData";

function normalizePhone(phone = "") {
  const digits = String(phone).replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `+91${digits}`;
  if (digits.startsWith("91") && digits.length === 12) return `+${digits}`;
  if (String(phone).startsWith("+")) return String(phone);
  return `+${digits}`;
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

  if (!phone) {
    return NextResponse.json({ ok: false, message: "phone is required." }, { status: 400 });
  }

  if (!hasDatabaseUrl()) {
    const exists = mockData.clients.some((c) => normalizePhone(c.mobile ?? c.phone) === phone);
    if (!exists) {
      return talkToTrainerResponse(phone);
    }
    return NextResponse.json({
      ok: true,
      recovered: true,
      route: "api/client-auth/check-phone",
      data: { exists: true, phone, source: "mock" },
    });
  }

  const phoneDigits = phone.replace(/\D/g, "");
  const rows = await query(
    `
      SELECT id, name, mobile
      FROM clients
      WHERE regexp_replace(COALESCE(mobile, ''), '[^0-9]', '', 'g') = $1
      LIMIT 1
    `,
    [phoneDigits]
  );
  if (!rows[0]) {
    return talkToTrainerResponse(phone);
  }

  return NextResponse.json({
    ok: true,
    recovered: true,
    route: "api/client-auth/check-phone",
    data: { exists: true, client: rows[0], phone, source: "database" },
  });
}
