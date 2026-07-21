import { NextResponse } from "next/server";
import { buildRecoveredPayload } from "app/lib/apiResponse";
import { hasDatabaseUrl, query } from "app/lib/db";
import { notifySessionPublished } from "app/lib/pushNotifications";
import { readTrainerPhone } from "app/lib/session";
import { requireTrainerOwnsSession } from "app/lib/ownership";

export async function GET(_request, { params }) {
  const payload = await buildRecoveredPayload("api/sessions/[id]/share", params);
  return NextResponse.json({
    ok: true,
    recovered: true,
    route: "api/sessions/[id]/share",
    data: payload,
  });
}

export async function POST(request, { params }) {
  const { id } = params;
  const phone = readTrainerPhone(request.cookies.get("trainer_session")?.value);
  if (!phone) return NextResponse.json({ ok: false, message: "Login required." }, { status: 401 });

  if (!id) {
    return NextResponse.json({ ok: false, message: "Session id is required." }, { status: 400 });
  }

  if (!hasDatabaseUrl()) {
    return NextResponse.json({
      ok: true,
      recovered: true,
      route: "api/sessions/[id]/share",
      data: { id, shared: true, source: "mock" },
    });
  }

  const owned = await requireTrainerOwnsSession(phone, id);
  if (!owned) return NextResponse.json({ ok: false, message: "Session not found." }, { status: 404 });

  const rows = await query(
    `
      INSERT INTO session_shares (
        id,
        session_id,
        client_id,
        shared_by_trainer,
        shared_at,
        created_at
      )
      SELECT
        md5(random()::text || clock_timestamp()::text),
        s.id,
        s.client_id,
        true,
        NOW(),
        NOW()
      FROM sessions s
      WHERE s.id = $1
      RETURNING *
    `,
    [id]
  );

  if (!rows[0]) {
    return NextResponse.json({ ok: false, message: "Session not found." }, { status: 404 });
  }

  const sessionMeta = await query(
    `SELECT session_title, client_id FROM sessions WHERE id = $1 LIMIT 1`,
    [id]
  );
  const meta = sessionMeta[0] ?? {};
  notifySessionPublished({
    sessionId: id,
    clientId: meta.client_id ?? rows[0].client_id,
    sessionTitle: meta.session_title,
  }).catch(() => {});

  return NextResponse.json({
    ok: true,
    recovered: true,
    route: "api/sessions/[id]/share",
    data: rows[0],
  });
}
