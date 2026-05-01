import { NextResponse } from "next/server";
import { hasDatabaseUrl, query } from "app/lib/db";

const COOKIE = "client_session";

function parseCookie(raw) {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    if (v && typeof v === "object" && v.clientId) return v;
  } catch {
    /* plain client id */
  }
  if (typeof raw === "string" && raw.length > 0) {
    return { clientId: raw, clientUserId: null, email: null, name: null };
  }
  return null;
}

export async function GET(request) {
  const raw = request.cookies.get(COOKIE)?.value;
  const parsed = parseCookie(raw);

  if (!parsed?.clientId) {
    return NextResponse.json({
      ok: true,
      recovered: true,
      route: "api/client-auth/session",
      data: { authenticated: false, source: "cookie" },
    });
  }

  if (!hasDatabaseUrl()) {
    return NextResponse.json({
      ok: true,
      recovered: true,
      route: "api/client-auth/session",
      data: {
        authenticated: true,
        user: {
          role: "client",
          clientId: parsed.clientId,
          email: parsed.email,
          name: parsed.name,
        },
        source: "mock",
      },
    });
  }

  const rows = parsed.clientUserId
    ? await query(
        `
          SELECT cu.id, cu.email, cu.name, cu.client_id, c.name AS client_name
          FROM client_users cu
          LEFT JOIN clients c ON c.id = cu.client_id
          WHERE cu.id = $1
            AND COALESCE(cu.is_active, 1) = 1
          LIMIT 1
        `,
        [parsed.clientUserId]
      )
    : await query(
        `
          SELECT cu.id, cu.email, cu.name, cu.client_id, c.name AS client_name
          FROM client_users cu
          LEFT JOIN clients c ON c.id = cu.client_id
          WHERE cu.client_id = $1
            AND COALESCE(cu.is_active, 1) = 1
          LIMIT 1
        `,
        [parsed.clientId]
      );

  if (!rows[0]) {
    return NextResponse.json({
      ok: true,
      recovered: true,
      route: "api/client-auth/session",
      data: { authenticated: false, source: "database" },
    });
  }

  return NextResponse.json({
    ok: true,
    recovered: true,
    route: "api/client-auth/session",
    data: {
      authenticated: true,
      user: {
        role: "client",
        clientUserId: rows[0].id,
        clientId: rows[0].client_id,
        email: rows[0].email,
        name: rows[0].name,
        clientName: rows[0].client_name,
      },
      source: "database",
    },
  });
}

export async function DELETE() {
  const response = NextResponse.json({
    ok: true,
    recovered: true,
    route: "api/client-auth/session",
    data: { loggedOut: true },
  });
  response.cookies.set(COOKIE, "", { maxAge: 0, path: "/" });
  return response;
}
