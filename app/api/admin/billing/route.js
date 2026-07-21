import { NextResponse } from "next/server";
import { writeAdminAudit } from "app/lib/adminAudit";
import { requireAdmin } from "app/lib/adminApi";
import { deriveEffectiveBillingStatus, getTrainerBillingStatus, reconcileExpiredTrials } from "app/lib/billingGuard";
import { hasDatabaseUrl, query } from "app/lib/db";

function normalizePhone(phone = "") {
  const digits = String(phone).replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `+91${digits}`;
  if (digits.startsWith("91") && digits.length === 12) return `+${digits}`;
  if (String(phone).startsWith("+")) return String(phone);
  return `+${digits}`;
}

const VALID_STATUSES = ["trial", "active", "suspended", "expired", "per_client"];

/** GET /api/admin/billing?phone=<phone> — view trainer billing status */
export async function GET(request) {
  const { denied } = requireAdmin(request);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const phone = normalizePhone(searchParams.get("phone") ?? "");

  if (!phone) {
    return NextResponse.json({ ok: false, message: "phone query param is required." }, { status: 400 });
  }

  if (!hasDatabaseUrl()) {
    return NextResponse.json({ ok: true, data: { phone, billing: { status: "mock" } } });
  }

  await reconcileExpiredTrials({ actor: "admin-billing", phone });

  const billing = await getTrainerBillingStatus(phone);
  const rows = await query(
    `SELECT id, phone, name, billing_status, trial_ends_at, max_clients, updated_at
     FROM trainer_phones
     WHERE regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g')
         = regexp_replace(COALESCE($1, ''), '[^0-9]', '', 'g')
     LIMIT 1`,
    [phone]
  );

  return NextResponse.json({
    ok: true,
    data: { trainer: rows[0] ?? null, billing },
  });
}

/** PATCH /api/admin/billing — update trainer billing status */
export async function PATCH(request) {
  const { denied, actorEmail } = requireAdmin(request);
  if (denied) return denied;

  const body = await request.json();
  const phone = normalizePhone(body?.phone ?? "");
  const newStatus = String(body?.billing_status ?? "").trim().toLowerCase();
  const trialEndsAt = body?.trial_ends_at ?? undefined;
  const maxClients = body?.max_clients != null ? Number(body.max_clients) : null;
  const extendDays = body?.extend_trial_days != null ? Number(body.extend_trial_days) : null;

  if (!phone) {
    return NextResponse.json({ ok: false, message: "phone is required." }, { status: 400 });
  }
  if (!VALID_STATUSES.includes(newStatus)) {
    return NextResponse.json(
      { ok: false, message: `billing_status must be one of: ${VALID_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }

  if (!hasDatabaseUrl()) {
    return NextResponse.json({ ok: true, data: { updated: true, source: "mock" } });
  }

  const existingRows = await query(
    `SELECT id, phone, name, billing_status, trial_ends_at, max_clients
     FROM trainer_phones
     WHERE regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g')
         = regexp_replace(COALESCE($1, ''), '[^0-9]', '', 'g')
     LIMIT 1`,
    [phone]
  );
  const existing = existingRows[0];
  if (!existing) {
    return NextResponse.json({ ok: false, message: "Trainer not found." }, { status: 404 });
  }

  const setClauses = ["billing_status = $2", "updated_at = NOW()"];
  const params = [existing.phone, newStatus];

  let nextTrialEnds = existing.trial_ends_at;
  if (extendDays != null && Number.isFinite(extendDays) && extendDays > 0) {
    const base = existing.trial_ends_at && new Date(existing.trial_ends_at).getTime() > Date.now()
      ? new Date(existing.trial_ends_at)
      : new Date();
    base.setUTCDate(base.getUTCDate() + extendDays);
    nextTrialEnds = base.toISOString();
    params.push(nextTrialEnds);
    setClauses.push(`trial_ends_at = $${params.length}`);
  } else if (trialEndsAt !== undefined) {
    nextTrialEnds = trialEndsAt === "" || trialEndsAt == null ? null : trialEndsAt;
    params.push(nextTrialEnds);
    setClauses.push(`trial_ends_at = $${params.length}`);
  }

  if (maxClients != null && Number.isFinite(maxClients)) {
    params.push(maxClients);
    setClauses.push(`max_clients = $${params.length}`);
  }

  const rows = await query(
    `UPDATE trainer_phones
     SET ${setClauses.join(", ")}
     WHERE phone = $1
     RETURNING id, phone, name, billing_status, trial_ends_at, max_clients, updated_at`,
    params
  );

  await writeAdminAudit({
    entityType: "trainer",
    entityId: existing.id || existing.phone,
    action: "admin_patch_billing",
    actorEmail,
    before: {
      billing_status: existing.billing_status,
      trial_ends_at: existing.trial_ends_at,
      max_clients: existing.max_clients,
    },
    after: {
      billing_status: rows[0].billing_status,
      trial_ends_at: rows[0].trial_ends_at,
      max_clients: rows[0].max_clients,
    },
  });

  return NextResponse.json({
    ok: true,
    data: {
      trainer: rows[0],
      billing: deriveEffectiveBillingStatus(rows[0]),
    },
  });
}
