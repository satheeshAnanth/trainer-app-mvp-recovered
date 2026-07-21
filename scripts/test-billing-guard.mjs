/**
 * Lightweight unit checks for billing derivation (no DB).
 * Run: node scripts/test-billing-guard.mjs
 */

function deriveEffectiveBillingStatus({ billing_status, trial_ends_at, max_clients } = {}) {
  const stored = String(billing_status ?? "").toLowerCase();
  if (stored === "suspended") return { status: "suspended", storedStatus: stored, max_clients };
  if (stored === "active" || stored === "per_client") return { status: "active", storedStatus: stored, max_clients };
  if (stored === "expired") {
    return { status: "expired", storedStatus: stored, trialEndedAt: trial_ends_at ?? null, max_clients };
  }
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
  return { status: "trial", storedStatus: stored || "trial", trialEndsAt: trial_ends_at ?? null, max_clients };
}

function billingAllowsAccess(billingResult) {
  return billingResult.status === "active" || billingResult.status === "trial" || billingResult.status === "unknown";
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const past = new Date(Date.now() - 86400000).toISOString();
const future = new Date(Date.now() + 86400000).toISOString();

assert(deriveEffectiveBillingStatus({ billing_status: "suspended", trial_ends_at: past }).status === "suspended", "suspended wins");
assert(deriveEffectiveBillingStatus({ billing_status: "active", trial_ends_at: past }).status === "active", "active wins");
assert(deriveEffectiveBillingStatus({ billing_status: "per_client" }).status === "active", "per_client maps to active");
assert(deriveEffectiveBillingStatus({ billing_status: "expired" }).status === "expired", "stored expired");
assert(deriveEffectiveBillingStatus({ billing_status: "trial", trial_ends_at: past }).status === "expired", "elapsed trial is expired");
assert(deriveEffectiveBillingStatus({ billing_status: "trial", trial_ends_at: past }).needsReconcile === true, "needs reconcile");
assert(deriveEffectiveBillingStatus({ billing_status: "trial", trial_ends_at: future }).status === "trial", "open trial");
assert(billingAllowsAccess({ status: "trial" }) === true, "trial access");
assert(billingAllowsAccess({ status: "expired" }) === false, "expired blocked");
assert(billingAllowsAccess({ status: "suspended" }) === false, "suspended blocked");

console.log("billingGuard checks passed");
