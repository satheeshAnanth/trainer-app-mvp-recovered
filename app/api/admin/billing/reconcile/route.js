import { adminJson, requireAdmin } from "app/lib/adminApi";
import { reconcileExpiredTrials } from "app/lib/billingGuard";

/** GET /api/admin/billing/reconcile — persist elapsed trials as expired */
export async function GET(request) {
  const { denied, actorEmail } = requireAdmin(request);
  if (denied) return denied;
  const result = await reconcileExpiredTrials({ actor: actorEmail || "admin-reconcile" });
  return adminJson(result);
}

export async function POST(request) {
  return GET(request);
}
