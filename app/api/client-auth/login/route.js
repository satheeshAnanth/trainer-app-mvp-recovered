import { NextResponse } from "next/server";
import { hasDatabaseUrl, query } from "app/lib/db";
import { mockData } from "app/lib/mockData";

const COOKIE = "client_session";
const MAX_AGE = 60 * 60 * 24 * 7;

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: MAX_AGE,
    path: "/",
  };
}

export async function POST(request) {
  const body = await request.json();
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");

  if (!email) {
    return NextResponse.json({ ok: false, message: "Email is required." }, { status: 400 });
  }

  if (!hasDatabaseUrl()) {
    const clientId = mockData.clients[0]?.id ?? "c1";
    const response = NextResponse.json({
      ok: true,
      recovered: true,
      route: "api/client-auth/login",
      data: { clientId, email, source: "mock" },
    });
    response.cookies.set(COOKIE, clientId, cookieOptions());
    return response;
  }

  const rows = await query(
    `
      SELECT id, email, name, client_id, password_hash
      FROM client_users
      WHERE LOWER(TRIM(email)) = $1
        AND COALESCE(is_active, 1) = 1
      LIMIT 1
    `,
    [email]
  );

  const row = rows[0];
  if (!row?.client_id) {
    return NextResponse.json({ ok: false, message: "Client account not found." }, { status: 401 });
  }

  const hash = row.password_hash;
  if (hash && String(hash).startsWith("$2")) {
    return NextResponse.json(
      {
        ok: false,
        message: "Password sign-in uses a legacy hash format; use trainer-assisted onboarding for now.",
      },
      { status: 501 }
    );
  }

  if (hash && String(hash).length > 0 && password !== hash) {
    return NextResponse.json({ ok: false, message: "Invalid credentials." }, { status: 401 });
  }

  const payload = JSON.stringify({
    clientUserId: row.id,
    clientId: row.client_id,
    email: row.email,
    name: row.name,
  });

  const response = NextResponse.json({
    ok: true,
    recovered: true,
    route: "api/client-auth/login",
    data: { clientId: row.client_id, email: row.email, name: row.name, source: "database" },
  });
  response.cookies.set(COOKIE, payload, cookieOptions());
  return response;
}
