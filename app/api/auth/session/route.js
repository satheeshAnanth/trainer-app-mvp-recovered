import { NextResponse } from "next/server";
import { buildRecoveredPayload } from "app/lib/apiResponse";
import { hasDatabaseUrl, query } from "app/lib/db";

export async function GET(request) {
  const phone = request.cookies.get("trainer_session")?.value;
  if (!phone) {
    return NextResponse.json({
      ok: true,
      recovered: true,
      route: "api/auth/session",
      data: { authenticated: false, source: "cookie" },
    });
  }

  if (!hasDatabaseUrl()) {
    return NextResponse.json({
      ok: true,
      recovered: true,
      route: "api/auth/session",
      data: {
        authenticated: true,
        user: { phone, role: "trainer" },
        source: "mock",
      },
    });
  }

  const rows = await query(`SELECT id, phone, name FROM trainer_phones WHERE phone = $1 LIMIT 1`, [phone]);
  return NextResponse.json({
    ok: true,
    recovered: true,
    route: "api/auth/session",
    data: {
      authenticated: rows.length > 0,
      user: rows[0] ?? null,
      source: "database",
    },
  });
}

export async function DELETE() {
  const response = NextResponse.json({
    ok: true,
    recovered: true,
    route: "api/auth/session",
    data: { loggedOut: true },
  });
  response.cookies.set("trainer_session", "", { maxAge: 0, path: "/" });
  return response;
}
