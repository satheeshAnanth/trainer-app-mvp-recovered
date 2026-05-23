import { hasDatabaseUrl, query } from "app/lib/db";

/**
 * Possible billing states returned to callers:
 *   active   — trainer is on an active paid plan
 *   trial    — trainer is within their trial window
 *   expired  — trial window has passed and no paid plan is active
 *   suspended — admin has explicitly suspended the account
 *   unknown  — no DB or record not found (fail open in dev)
 */

export async function getTrainerBillingStatus(phone) {
  if (!hasDatabaseUrl() || !phone) return { status: "unknown" };

  const rows = await query(
    `SELECT billing_status, trial_ends_at, max_clients
     FROM trainer_phones
     WHERE phone = $1
     LIMIT 1`,
    [phone]
  );

  if (!rows[0]) return { status: "unknown" };

  const { billing_status, trial_ends_at, max_clients } = rows[0];

  if (billing_status === "suspended") {
    return { status: "suspended" };
  }

  if (billing_status === "active" || billing_status === "per_client") {
    return { status: "active", max_clients };
  }

  // Trial: check expiry
  if (trial_ends_at) {
    const expired = new Date(trial_ends_at).getTime() < Date.now();
    if (expired) return { status: "expired", trialEndedAt: trial_ends_at };
  }

  return { status: "trial", trialEndsAt: trial_ends_at, max_clients };
}

/** Returns true if the trainer may access the app. */
export function billingAllowsAccess(billingResult) {
  return billingResult.status === "active" ||
    billingResult.status === "trial" ||
    billingResult.status === "unknown";
}
