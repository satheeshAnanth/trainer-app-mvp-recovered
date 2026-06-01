import { NextResponse } from "next/server";
import { buildRecoveredPayload } from "app/lib/apiResponse";
import { hasDatabaseUrl, query } from "app/lib/db";
import { readTrainerPhone } from "app/lib/session";

function parseJson(value) {
  if (!value) return {};
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

export async function GET(request, { params }) {
  const { id } = params;
  const phone = readTrainerPhone(request.cookies.get("trainer_session")?.value);
  const { searchParams } = new URL(request.url);
  const status = String(searchParams.get("status") ?? "all").toLowerCase();
  const category = String(searchParams.get("category") ?? "all").toLowerCase();

  if (!hasDatabaseUrl()) {
    const payload = await buildRecoveredPayload("api/clients/[id]/tips", params);
    return NextResponse.json({ ok: true, recovered: true, route: "api/clients/[id]/tips", data: payload });
  }

  if (phone) {
    const clientCheck = await query(`SELECT id FROM clients WHERE id = $1 AND created_by_trainer = $2 LIMIT 1`, [id, phone]);
    if (!clientCheck[0]) return NextResponse.json({ ok: false, message: "Client not found." }, { status: 404 });
  }

  const rows = await query(
    `
      SELECT id, payload_json, created_at
      FROM audit_events
      WHERE entity_type = 'client_tip'
        AND entity_id = $1
      ORDER BY created_at DESC
      LIMIT 300
    `,
    [id]
  );

  let tips = rows.map((row) => {
    const payload = parseJson(row.payload_json);
    return {
      id: row.id,
      text: payload.text ?? "",
      category: payload.category ?? "form",
      read: Boolean(payload.read),
      created_at: row.created_at,
    };
  });

  if (status === "read") tips = tips.filter((t) => t.read);
  if (status === "unread") tips = tips.filter((t) => !t.read);
  if (category !== "all") tips = tips.filter((t) => String(t.category).toLowerCase() === category);

  return NextResponse.json({
    ok: true,
    recovered: true,
    route: "api/clients/[id]/tips",
    data: { tips, source: "database" },
  });
}

export async function POST(request, { params }) {
  const { id } = params;
  const body = await request.json();
  const text = String(body?.text ?? "").trim();
  const category = String(body?.category ?? "form").toLowerCase();

  if (!text) {
    return NextResponse.json({ ok: false, message: "Tip text is required." }, { status: 400 });
  }

  if (!hasDatabaseUrl()) {
    return NextResponse.json({
      ok: true,
      recovered: true,
      route: "api/clients/[id]/tips",
      data: { id: `mock-tip-${Date.now()}`, text, category, read: false, source: "mock" },
    });
  }

  const trainerPhone = readTrainerPhone(request.cookies.get("trainer_session")?.value);
  if (!trainerPhone) return NextResponse.json({ ok: false, message: "Login required." }, { status: 401 });
  const clientCheck = await query(`SELECT id FROM clients WHERE id = $1 AND created_by_trainer = $2 LIMIT 1`, [id, trainerPhone]);
  if (!clientCheck[0]) return NextResponse.json({ ok: false, message: "Client not found." }, { status: 404 });

  const payload = JSON.stringify({
    text,
    category,
    read: false,
    actorRole: "trainer",
    actorId: trainerPhone,
  });
  const rows = await query(
    `
      INSERT INTO audit_events (
        id,
        entity_type,
        entity_id,
        action,
        payload_json,
        created_at
      )
      VALUES (
        md5(random()::text || clock_timestamp()::text),
        'client_tip',
        $1,
        'tip_sent',
        $2::text,
        NOW()
      )
      RETURNING *
    `,
    [id, payload]
  );

  return NextResponse.json(
    {
      ok: true,
      recovered: true,
      route: "api/clients/[id]/tips",
      data: { id: rows[0].id, text, category, read: false, source: "database" },
    },
    { status: 201 }
  );
}
