import { NextResponse } from "next/server";
import { requireAdminSecret } from "app/lib/adminAuth";
import { EFFECTIVE_BILLING_SQL, reconcileExpiredTrials } from "app/lib/billingGuard";
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

  const reconcile = await reconcileExpiredTrials({ actor: "admin-ops" });

  const [trainerRows, clientRows, sessionRows, recentTrainers, inviteRows, expiringSoon, failedPushes] = await Promise.all([
    query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE (${EFFECTIVE_BILLING_SQL}) = 'trial')::int AS on_trial,
        COUNT(*) FILTER (WHERE (${EFFECTIVE_BILLING_SQL}) = 'active')::int AS active,
        COUNT(*) FILTER (WHERE (${EFFECTIVE_BILLING_SQL}) IN ('suspended','expired'))::int AS churned,
        COUNT(*) FILTER (WHERE (${EFFECTIVE_BILLING_SQL}) = 'expired')::int AS expired,
        COUNT(*) FILTER (WHERE (${EFFECTIVE_BILLING_SQL}) = 'suspended')::int AS suspended,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::int AS signups_30d,
        COUNT(*) FILTER (WHERE COALESCE(is_active, 1) = 0)::int AS archived
      FROM trainer_phones
    `),
    query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE archived_at IS NULL)::int AS active,
        COUNT(*) FILTER (WHERE archived_at IS NOT NULL)::int AS archived
      FROM clients
    `).catch(() => [{ total: 0, active: 0, archived: 0 }]),
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
      SELECT
        id, phone, name, billing_status, trial_ends_at, created_at,
        (${EFFECTIVE_BILLING_SQL}) AS effective_status
      FROM trainer_phones
      ORDER BY created_at DESC NULLS LAST
      LIMIT 15
    `),
    query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'accepted')::int AS accepted,
        COUNT(*) FILTER (WHERE status = 'pending')::int AS pending
      FROM invitations
    `).catch(() => [{ total: 0, accepted: 0, pending: 0 }]),
    query(`
      SELECT id, phone, name, trial_ends_at, (${EFFECTIVE_BILLING_SQL}) AS effective_status
      FROM trainer_phones
      WHERE (${EFFECTIVE_BILLING_SQL}) = 'trial'
        AND trial_ends_at IS NOT NULL
        AND trial_ends_at <= NOW() + INTERVAL '7 days'
      ORDER BY trial_ends_at ASC
      LIMIT 10
    `).catch(() => []),
    query(`
      SELECT id, title, error_message, created_at, user_role, user_key
      FROM push_notification_log
      WHERE COALESCE(success_count, 0) = 0
        AND created_at >= NOW() - INTERVAL '14 days'
      ORDER BY created_at DESC
      LIMIT 10
    `).catch(() => []),
  ]);

  return NextResponse.json({
    ok: true,
    data: {
      trainers: trainerRows[0],
      clients: clientRows[0],
      sessions: sessionRows[0],
      invitations: inviteRows[0],
      recentTrainers,
      expiringSoon,
      failedPushes,
      reconcile,
    },
  });
}
