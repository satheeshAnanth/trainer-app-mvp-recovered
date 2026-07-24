import { NextResponse } from "next/server";
import { hasDatabaseUrl, query } from "app/lib/db";

/** GET /api/gym-invitations/[token] — public invite preview */
export async function GET(_request, { params }) {
  if (!hasDatabaseUrl()) {
    return NextResponse.json({ ok: false, message: "DATABASE_URL required." }, { status: 503 });
  }

  const rows = await query(
    `SELECT i.token, i.trainer_phone, i.trainer_name, i.status, i.expires_at,
            g.id AS gym_id, g.name AS gym_name, g.city AS gym_city, g.slug AS gym_slug
     FROM gym_invitations i
     JOIN gyms g ON g.id = i.gym_id
     WHERE i.token = $1
     LIMIT 1`,
    [params.token]
  );
  const inv = rows[0];
  if (!inv) {
    return NextResponse.json({ ok: false, message: "Invitation not found." }, { status: 404 });
  }

  const expired = inv.status !== "pending" || new Date(inv.expires_at).getTime() < Date.now();
  return NextResponse.json({
    ok: true,
    data: {
      gymName: inv.gym_name,
      gymCity: inv.gym_city,
      trainerName: inv.trainer_name,
      trainerPhone: inv.trainer_phone,
      status: expired && inv.status === "pending" ? "expired" : inv.status,
      expiresAt: inv.expires_at,
    },
  });
}
