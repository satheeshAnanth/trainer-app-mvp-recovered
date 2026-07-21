import { adminJson, parsePagination, requireAdmin } from "app/lib/adminApi";
import { EFFECTIVE_BILLING_SQL, reconcileExpiredTrials } from "app/lib/billingGuard";
import { hasDatabaseUrl, query } from "app/lib/db";

export async function GET(request) {
  const { denied } = requireAdmin(request);
  if (denied) return denied;

  if (!hasDatabaseUrl()) {
    return adminJson({ source: "mock", items: [], total: 0, page: 1, limit: 25 });
  }

  await reconcileExpiredTrials({ actor: "admin-list" });

  const { searchParams } = new URL(request.url);
  const { page, limit, offset } = parsePagination(searchParams);
  const q = String(searchParams.get("q") ?? "").trim();
  const status = String(searchParams.get("status") ?? "all").toLowerCase();
  const archived = String(searchParams.get("archived") ?? "active").toLowerCase();

  const where = [];
  const params = [];

  if (q) {
    params.push(`%${q}%`);
    where.push(`(name ILIKE $${params.length} OR phone ILIKE $${params.length} OR location ILIKE $${params.length} OR gym_name ILIKE $${params.length})`);
  }

  if (status !== "all") {
    params.push(status);
    where.push(`(${EFFECTIVE_BILLING_SQL}) = $${params.length}`);
  }

  if (archived === "active") {
    where.push(`COALESCE(is_active, 1) = 1`);
  } else if (archived === "archived") {
    where.push(`COALESCE(is_active, 1) = 0`);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const countRows = await query(
    `SELECT COUNT(*)::int AS total FROM trainer_phones ${whereSql}`,
    params
  );

  params.push(limit);
  params.push(offset);
  const rows = await query(
    `
      SELECT
        id,
        phone,
        name,
        gym_name,
        specialization,
        location,
        billing_status,
        trial_ends_at,
        max_clients,
        is_active,
        referral_code,
        referred_by,
        created_at,
        updated_at,
        (${EFFECTIVE_BILLING_SQL}) AS effective_status,
        (
          SELECT COUNT(*)::int FROM clients c
          WHERE regexp_replace(COALESCE(c.created_by_trainer, ''), '[^0-9]', '', 'g')
              = regexp_replace(COALESCE(trainer_phones.phone, ''), '[^0-9]', '', 'g')
            AND c.archived_at IS NULL
        ) AS client_count
      FROM trainer_phones
      ${whereSql}
      ORDER BY created_at DESC NULLS LAST
      LIMIT $${params.length - 1}
      OFFSET $${params.length}
    `,
    params
  );

  return adminJson({
    source: "database",
    items: rows,
    total: countRows[0]?.total ?? 0,
    page,
    limit,
  });
}
