import { NextResponse } from "next/server";
import { hasDatabaseUrl, query } from "app/lib/db";
import { readClientSession } from "app/lib/session";

function parseJson(value) {
  if (!value) return {};
  if (typeof value === "object") return value;
  try { return JSON.parse(value); } catch { return {}; }
}

export async function GET(request) {
  const raw = request.cookies.get("client_session")?.value;
  const session = readClientSession(raw);
  const clientId = session?.clientId ?? null;

  if (!clientId) {
    return NextResponse.json({ ok: false, message: "Login required." }, { status: 401 });
  }

  if (!hasDatabaseUrl()) {
    return NextResponse.json({ ok: true, data: { tips: [], source: "mock" } });
  }

  const rows = await query(
    `SELECT id, payload_json, created_at
     FROM audit_events
     WHERE entity_type = 'client_tip' AND entity_id = $1
     ORDER BY created_at DESC LIMIT 100`,
    [clientId]
  );

  const tips = rows.map((row) => {
    const payload = parseJson(row.payload_json);
    return {
      id: row.id,
      text: payload.text ?? "",
      category: payload.category ?? "general",
      created_at: row.created_at,
    };
  });

  return NextResponse.json({ ok: true, data: { tips, source: "database" } });
}
