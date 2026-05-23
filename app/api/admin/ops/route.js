import { NextResponse } from "next/server";
import { requireAdminSecret } from "app/lib/adminAuth";
import { hasDatabaseUrl, query } from "app/lib/db";

export async function GET(request) {
  const denied = requireAdminSecret(request);
  if (denied) return denied;

  if (!hasDatabaseUrl()) {
    return NextResponse.json({
      ok: true,
      data: { source: "mock", note: "DATABASE_URL not configured — connect a Neon database to see live metrics." },
    });
  }

  const [trainerRows, clientRows, sessionRows, recentTrainers, inviteRows] = await Promise.all([
    query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE billing_status = 'trial')::int AS on_trial,
        COUNT(*) FILTER (WHERE billing_status = 'active')::int AS active,
        COUNT(*) FILTER (WHERE billing_status IN ('suspended','expired'))::int AS churned,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::int AS signups_30d
      FROM trainer_phones
    `),
    query(`SELECT COUNT(*)::int AS total FROM clients`),
    query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int AS last_7_days,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::int AS last_30_days,
        COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
        COUNT(*) FILTER (WHERE status IN ('draft','pending_notes'))::int AS in_progress
      FROM sessions
    `),
    query(`
      SELECT phone, name, billing_status, trial_ends_at, created_at
      FROM trainer_phones
      ORDER BY created_at DESC
      LIMIT 15
    `),
    query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'accepted')::int AS accepted,
        COUNT(*) FILTER (WHERE status = 'pending')::int AS pending
      FROM invitations
    `).catch(() => [{ total: 0, accepted: 0, pending: 0 }]),
  ]);

  return NextResponse.json({
    ok: true,
    data: {
      trainers: trainerRows[0],
      clients: clientRows[0],
      sessions: sessionRows[0],
      invitations: inviteRows[0],
      recentTrainers,
    },
  });
}
