import { NextResponse } from "next/server";
import { hasDatabaseUrl, query } from "app/lib/db";
import { requireAdminSecret } from "app/lib/adminAuth";
import { getTrainerBillingStatus } from "app/lib/billingGuard";

function normalizePhone(phone = "") {
  const digits = String(phone).replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `+91${digits}`;
  if (digits.startsWith("91") && digits.length === 12) return `+${digits}`;
  if (String(phone).startsWith("+")) return String(phone);
  return `+${digits}`;
}

const VALID_STATUSES = ["trial", "active", "suspended", "per_client"];

/** GET /api/admin/billing?phone=<phone> — view trainer billing status */
export async function GET(request) {
  const denied = requireAdminSecret(request);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const phone = normalizePhone(searchParams.get("phone") ?? "");

  if (!phone) {
    return NextResponse.json({ ok: false, message: "phone query param is required." }, { status: 400 });
  }

  if (!hasDatabaseUrl()) {
    return NextResponse.json({ ok: true, data: { phone, billing: { status: "mock" } } });
  }

  const billing = await getTrainerBillingStatus(phone);
  const rows = await query(
    `SELECT phone, name, billing_status, trial_ends_at, max_clients FROM trainer_phones WHERE phone = $1 LIMIT 1`,
    [phone]
  );

  return NextResponse.json({
    ok: true,
    data: { trainer: rows[0] ?? null, billing },
  });
}

/** PATCH /api/admin/billing — update trainer billing status */
export async function PATCH(request) {
  const denied = requireAdminSecret(request);
  if (denied) return denied;

  const body = await request.json();
  const phone = normalizePhone(body?.phone ?? "");
  const newStatus = String(body?.billing_status ?? "").trim().toLowerCase();
  const trialEndsAt = body?.trial_ends_at ?? null;
  const maxClients = body?.max_clients != null ? Number(body.max_clients) : null;

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

  const setClauses = ["billing_status = $2", "updated_at = NOW()"];
  const params = [phone, newStatus];

  if (trialEndsAt) {
    params.push(trialEndsAt);
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
     RETURNING phone, name, billing_status, trial_ends_at, max_clients`,
    params
  );

  if (!rows[0]) {
    return NextResponse.json({ ok: false, message: "Trainer not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, data: { trainer: rows[0] } });
}
