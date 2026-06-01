import { NextResponse } from "next/server";
import { buildRecoveredPayload } from "app/lib/apiResponse";
import { hasDatabaseUrl, query } from "app/lib/db";
import { readTrainerPhone } from "app/lib/session";
import { requireTrainerOwnsSession } from "app/lib/ownership";

export async function GET(_request, { params }) {
  const payload = await buildRecoveredPayload("api/sessions/[id]/status", params);
  return NextResponse.json({
    ok: true,
    recovered: true,
    route: "api/sessions/[id]/status",
    data: payload,
  });
}

export async function PATCH(request, { params }) {
  const { id } = params;
  const phone = readTrainerPhone(request.cookies.get("trainer_session")?.value);
  if (!phone) return NextResponse.json({ ok: false, message: "Login required." }, { status: 401 });

  const body = await request.json();
  const { status } = body;

  if (!status) {
    return NextResponse.json({ ok: false, message: "status is required." }, { status: 400 });
  }

  if (!hasDatabaseUrl()) {
    return NextResponse.json({
      ok: true,
      recovered: true,
      route: "api/sessions/[id]/status",
      data: { id, status, source: "mock" },
    });
  }

  const owned = await requireTrainerOwnsSession(phone, id);
  if (!owned) return NextResponse.json({ ok: false, message: "Session not found." }, { status: 404 });

  const rows = await query(
    `
      UPDATE sessions
      SET status = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING id, status, updated_at
    `,
    [id, status]
  );

  if (!rows[0]) {
    return NextResponse.json({ ok: false, message: "Session not found." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    recovered: true,
    route: "api/sessions/[id]/status",
    data: rows[0],
  });
}
