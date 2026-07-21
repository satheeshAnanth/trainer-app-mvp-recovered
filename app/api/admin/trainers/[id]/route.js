import { writeAdminAudit } from "app/lib/adminAudit";
import { adminError, adminJson, requireAdmin } from "app/lib/adminApi";
import { deriveEffectiveBillingStatus, EFFECTIVE_BILLING_SQL, reconcileExpiredTrials } from "app/lib/billingGuard";
import { hasDatabaseUrl, query } from "app/lib/db";

async function findTrainer(idOrPhone) {
  const key = String(idOrPhone ?? "").trim();
  if (!key) return null;
  const rows = await query(
    `
      SELECT
        id, phone, name, gym_name, specialization, years_experience, location,
        pricing_tier, billing_status, trial_ends_at, max_clients, is_active,
        referral_code, referred_by, created_at, updated_at,
        (${EFFECTIVE_BILLING_SQL}) AS effective_status
      FROM trainer_phones
      WHERE id = $1
         OR regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g')
          = regexp_replace(COALESCE($1, ''), '[^0-9]', '', 'g')
      LIMIT 1
    `,
    [key]
  );
  return rows[0] ?? null;
}

export async function GET(_request, context) {
  const { denied } = requireAdmin(_request);
  if (denied) return denied;
  if (!hasDatabaseUrl()) return adminJson({ source: "mock", trainer: null });

  await reconcileExpiredTrials({ actor: "admin-detail" });

  const id = context?.params?.id;
  const trainer = await findTrainer(id);
  if (!trainer) return adminError("Trainer not found.", 404);

  const phoneDigits = String(trainer.phone || "").replace(/\D/g, "");

  const [clients, sessions, events, invitations, billingRecords, audits, pushLogs] = await Promise.all([
    query(
      `
        SELECT id, name, mobile, goal, age, gender, archived_at, created_at, updated_at
        FROM clients
        WHERE regexp_replace(COALESCE(created_by_trainer, ''), '[^0-9]', '', 'g') = $1
        ORDER BY created_at DESC NULLS LAST
        LIMIT 100
      `,
      [phoneDigits]
    ),
    query(
      `
        SELECT s.id, s.client_id, s.client_name_snapshot, s.session_date, s.session_title,
               s.status, s.estimated_calories, s.duration_minutes, s.archived_at, s.created_at
        FROM sessions s
        JOIN clients c ON c.id = s.client_id
        WHERE regexp_replace(COALESCE(c.created_by_trainer, ''), '[^0-9]', '', 'g') = $1
        ORDER BY s.created_at DESC NULLS LAST
        LIMIT 50
      `,
      [phoneDigits]
    ).catch(() => []),
    query(
      `
        SELECT id, client_id, client_name, scheduled_date, scheduled_time, status, notes, created_at
        FROM calendar_events
        WHERE regexp_replace(COALESCE(trainer_phone, ''), '[^0-9]', '', 'g') = $1
        ORDER BY scheduled_date DESC NULLS LAST, scheduled_time DESC NULLS LAST
        LIMIT 50
      `,
      [phoneDigits]
    ).catch(() => []),
    query(
      `
        SELECT id, client_name, client_phone, client_goal, status, expires_at, accepted_at, created_at, client_id
        FROM invitations
        WHERE regexp_replace(COALESCE(trainer_phone, ''), '[^0-9]', '', 'g') = $1
        ORDER BY created_at DESC NULLS LAST
        LIMIT 50
      `,
      [phoneDigits]
    ).catch(() => []),
    query(
      `
        SELECT id, month_year, active_clients, amount_inr, status, paid_at, created_at
        FROM billing_records
        WHERE regexp_replace(COALESCE(trainer_phone, ''), '[^0-9]', '', 'g') = $1
        ORDER BY created_at DESC NULLS LAST
        LIMIT 24
      `,
      [phoneDigits]
    ).catch(() => []),
    query(
      `
        SELECT id, entity_type, entity_id, action, payload_json, created_at
        FROM audit_events
        WHERE entity_type = 'trainer' AND (entity_id = $1 OR entity_id = $2)
        ORDER BY created_at DESC NULLS LAST
        LIMIT 40
      `,
      [trainer.id, trainer.phone]
    ).catch(() => []),
    query(
      `
        SELECT id, title, body, success_count, token_count, error_message, created_at
        FROM push_notification_log
        WHERE user_role = 'trainer'
          AND regexp_replace(COALESCE(user_key, ''), '[^0-9]', '', 'g') = $1
        ORDER BY created_at DESC NULLS LAST
        LIMIT 20
      `,
      [phoneDigits]
    ).catch(() => []),
  ]);

  const billing = deriveEffectiveBillingStatus(trainer);

  return adminJson({
    source: "database",
    trainer,
    billing,
    clients,
    sessions,
    events,
    invitations,
    billingRecords,
    audits,
    pushLogs,
  });
}

const TRAINER_PATCH_FIELDS = new Set([
  "name",
  "gym_name",
  "specialization",
  "years_experience",
  "location",
  "max_clients",
  "is_active",
  "billing_status",
  "trial_ends_at",
  "pricing_tier",
]);

export async function PATCH(request, context) {
  const { denied, actorEmail } = requireAdmin(request);
  if (denied) return denied;
  if (!hasDatabaseUrl()) return adminError("DATABASE_URL not configured.", 503);

  const id = context?.params?.id;
  const trainer = await findTrainer(id);
  if (!trainer) return adminError("Trainer not found.", 404);

  let body;
  try {
    body = await request.json();
  } catch {
    return adminError("Invalid JSON body.");
  }

  const expectedUpdatedAt = body?.updated_at ? String(body.updated_at) : null;
  if (expectedUpdatedAt && String(trainer.updated_at) !== expectedUpdatedAt) {
    return adminError("Trainer was modified elsewhere. Refresh and try again.", 409);
  }

  const setClauses = [];
  const params = [];
  const before = {};
  const after = {};

  for (const key of TRAINER_PATCH_FIELDS) {
    if (!(key in body)) continue;
    let value = body[key];
    if (key === "is_active") value = value ? 1 : 0;
    if (key === "years_experience" || key === "max_clients") {
      value = value == null || value === "" ? null : Number(value);
      if (value != null && !Number.isFinite(value)) return adminError(`${key} must be a number.`);
    }
    if (key === "billing_status") {
      const allowed = new Set(["trial", "active", "suspended", "expired", "per_client"]);
      value = String(value || "").toLowerCase();
      if (!allowed.has(value)) return adminError("Invalid billing_status.");
    }
    if (key === "trial_ends_at" && value === "") value = null;

    before[key] = trainer[key];
    after[key] = value;
    params.push(value);
    setClauses.push(`${key} = $${params.length}`);
  }

  if (!setClauses.length) return adminError("No editable fields provided.");

  params.push(trainer.id);
  setClauses.push("updated_at = NOW()");

  const rows = await query(
    `
      UPDATE trainer_phones
      SET ${setClauses.join(", ")}
      WHERE id = $${params.length}
      RETURNING
        id, phone, name, gym_name, specialization, years_experience, location,
        pricing_tier, billing_status, trial_ends_at, max_clients, is_active,
        referral_code, referred_by, created_at, updated_at,
        (${EFFECTIVE_BILLING_SQL}) AS effective_status
    `,
    params
  );

  await writeAdminAudit({
    entityType: "trainer",
    entityId: trainer.id,
    action: "admin_patch_trainer",
    actorEmail,
    before,
    after,
  });

  return adminJson({ trainer: rows[0], billing: deriveEffectiveBillingStatus(rows[0]) });
}
