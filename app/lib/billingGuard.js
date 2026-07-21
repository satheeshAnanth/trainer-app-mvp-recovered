import { hasDatabaseUrl, query } from "app/lib/db";

/**
 * Possible billing states returned to callers:
 *   active   — trainer is on an active paid plan
 *   trial    — trainer is within their trial window
 *   expired  — trial window has passed and no paid plan is active
 *   suspended — admin has explicitly suspended the account
 *   unknown  — no DB or record not found (fail open in dev)
 */

/** Pure derivation from stored row fields. */
export function deriveEffectiveBillingStatus({
  billing_status,
  trial_ends_at,
  max_clients,
} = {}) {
  const stored = String(billing_status ?? "").toLowerCase();

  if (stored === "suspended") {
    return { status: "suspended", storedStatus: stored, max_clients };
  }

  if (stored === "active" || stored === "per_client") {
    return { status: "active", storedStatus: stored, max_clients };
  }

  if (stored === "expired") {
    return {
      status: "expired",
      storedStatus: stored,
      trialEndedAt: trial_ends_at ?? null,
      max_clients,
    };
  }

  // trial / empty / unknown stored values: expire when trial_ends_at has passed
  if (trial_ends_at) {
    const endMs = new Date(trial_ends_at).getTime();
    if (Number.isFinite(endMs) && endMs < Date.now()) {
      return {
        status: "expired",
        storedStatus: stored || "trial",
        trialEndedAt: trial_ends_at,
        max_clients,
        needsReconcile: stored !== "expired",
      };
    }
  }

  return {
    status: "trial",
    storedStatus: stored || "trial",
    trialEndsAt: trial_ends_at ?? null,
    max_clients,
  };
}

/** SQL CASE for effective billing status (use as SELECT expression). */
export const EFFECTIVE_BILLING_SQL = `
CASE
  WHEN LOWER(COALESCE(billing_status, '')) = 'suspended' THEN 'suspended'
  WHEN LOWER(COALESCE(billing_status, '')) IN ('active', 'per_client') THEN 'active'
  WHEN LOWER(COALESCE(billing_status, '')) = 'expired' THEN 'expired'
  WHEN trial_ends_at IS NOT NULL AND trial_ends_at < NOW() THEN 'expired'
  ELSE 'trial'
END
`.trim();

export async function getTrainerBillingStatus(phone) {
  if (!hasDatabaseUrl() || !phone) return { status: "unknown" };

  const rows = await query(
    `SELECT billing_status, trial_ends_at, max_clients
     FROM trainer_phones
     WHERE regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g')
         = regexp_replace(COALESCE($1, ''), '[^0-9]', '', 'g')
     LIMIT 1`,
    [phone]
  );

  if (!rows[0]) return { status: "unknown" };
  return deriveEffectiveBillingStatus(rows[0]);
}

/** Persist trial → expired when trial_ends_at has elapsed. Returns updated count. */
export async function reconcileExpiredTrials({ actor = "system", limit = 500, phone = null } = {}) {
  if (!hasDatabaseUrl()) return { updated: 0 };

  const params = [];
  let phoneFilter = "";
  if (phone) {
    params.push(phone);
    phoneFilter = `AND regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g')
                 = regexp_replace(COALESCE($${params.length}, ''), '[^0-9]', '', 'g')`;
  }

  params.push(Math.max(1, Number(limit) || 500));
  const rows = await query(
    `
      UPDATE trainer_phones
      SET billing_status = 'expired', updated_at = NOW()
      WHERE id IN (
        SELECT id FROM trainer_phones
        WHERE LOWER(COALESCE(billing_status, '')) = 'trial'
          AND trial_ends_at IS NOT NULL
          AND trial_ends_at < NOW()
          ${phoneFilter}
        LIMIT $${params.length}
      )
      RETURNING id, phone, name, trial_ends_at
    `,
    params
  );

  const updated = Array.isArray(rows) ? rows : [];
  for (const row of updated) {
    try {
      await query(
        `
          INSERT INTO audit_events (id, entity_type, entity_id, action, payload_json, created_at)
          VALUES (
            md5(random()::text || clock_timestamp()::text),
            'trainer',
            $1,
            'billing_reconcile_expired',
            $2,
            NOW()
          )
        `,
        [
          row.id || row.phone,
          JSON.stringify({
            actor,
            phone: row.phone,
            before: { billing_status: "trial", trial_ends_at: row.trial_ends_at },
            after: { billing_status: "expired", trial_ends_at: row.trial_ends_at },
          }),
        ]
      );
    } catch {
      // audit is best-effort
    }
  }

  return { updated: updated.length, trainers: updated };
}

/** Returns true if the trainer may access the app. */
export function billingAllowsAccess(billingResult) {
  return billingResult.status === "active" ||
    billingResult.status === "trial" ||
    billingResult.status === "unknown";
}
