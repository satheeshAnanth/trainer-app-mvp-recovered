import { NextResponse } from "next/server";
import { hasDatabaseUrl, query } from "app/lib/db";

/** GET /api/invitations/validate?token=XXX — public; returns invitation details */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const token = String(searchParams.get("token") ?? "").trim();

  if (!token) {
    return NextResponse.json({ ok: false, message: "token is required." }, { status: 400 });
  }

  if (!hasDatabaseUrl()) {
    return NextResponse.json({
      ok: true,
      data: {
        invitation: {
          token,
          clientName: "Demo Client",
          clientPhone: "+919999999999",
          clientGoal: "Build strength",
          trainerName: "Demo Trainer",
          status: "pending",
        },
        source: "mock",
      },
    });
  }

  const rows = await query(
    `SELECT i.token, i.client_name, i.client_phone, i.client_goal,
            i.status, i.expires_at, i.accepted_at,
            t.name AS trainer_name
     FROM invitations i
     JOIN trainer_phones t ON t.phone = i.trainer_phone
     WHERE i.token = $1
     LIMIT 1`,
    [token]
  );

  if (!rows[0]) {
    return NextResponse.json({ ok: false, message: "Invitation not found." }, { status: 404 });
  }

  const inv = rows[0];

  if (inv.status === "accepted") {
    return NextResponse.json({ ok: false, message: "This invitation has already been accepted.", data: { status: "accepted" } }, { status: 410 });
  }

  if (inv.status === "expired" || new Date(inv.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ ok: false, message: "This invitation link has expired. Please ask your trainer to send a new one.", data: { status: "expired" } }, { status: 410 });
  }

  return NextResponse.json({ ok: true, data: { invitation: inv } });
}
