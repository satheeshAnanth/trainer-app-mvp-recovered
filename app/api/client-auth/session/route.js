import { NextResponse } from "next/server";
import { hasDatabaseUrl, query } from "app/lib/db";
import { mockData } from "app/lib/mockData";
import { readClientSession } from "app/lib/session";

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
  const parsed = readClientSession(raw) ?? parseCookie(raw);

  if (!parsed?.clientId) {
    return NextResponse.json({
      ok: true,
      recovered: true,
      route: "api/client-auth/session",
      data: { authenticated: false, source: "cookie" },
    });
  }

  if (!hasDatabaseUrl()) {
    const client = mockData.clients.find((item) => item.id === parsed.clientId) ?? null;
    return NextResponse.json({
      ok: true,
      recovered: true,
      route: "api/client-auth/session",
      data: {
        authenticated: Boolean(client),
        user: {
          role: "client",
          clientId: client?.id ?? parsed.clientId,
          name: client?.name ?? null,
          mobile: client?.mobile ?? client?.phone ?? null,
        },
        source: "mock",
      },
    });
  }

  const rows = await query(
    `
      SELECT id, name, mobile
      FROM clients
      WHERE id = $1
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
        clientId: rows[0].id,
        name: rows[0].name,
        mobile: rows[0].mobile,
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
