import { NextResponse } from "next/server";
import { requireAdminSecret } from "app/lib/adminAuth";
import { hasDatabaseUrl, query } from "app/lib/db";
import {
  getGymById,
  getGymOpsSnapshot,
  listGymInvitations,
  listGymMemberships,
  normalizePhone,
} from "app/lib/gyms";

/** GET /api/admin/gyms/[id] */
export async function GET(request, { params }) {
  const denied = requireAdminSecret(request);
  if (denied) return denied;

  if (!hasDatabaseUrl()) {
    return NextResponse.json({ ok: false, message: "DATABASE_URL required." }, { status: 503 });
  }

  const gym = await getGymById(params.id);
  if (!gym) {
    return NextResponse.json({ ok: false, message: "Gym not found." }, { status: 404 });
  }

  const [ops, memberships, invitations, admins] = await Promise.all([
    getGymOpsSnapshot(gym.id),
    listGymMemberships(gym.id),
    listGymInvitations(gym.id),
    query(`SELECT id, phone, name, role, created_at FROM gym_admins WHERE gym_id = $1 ORDER BY created_at`, [gym.id]),
  ]);

  return NextResponse.json({
    ok: true,
    data: { gym, ops, memberships, invitations, admins },
  });
}

/** PATCH /api/admin/gyms/[id] — update seats / status / billing */
export async function PATCH(request, { params }) {
  const denied = requireAdminSecret(request);
  if (denied) return denied;

  if (!hasDatabaseUrl()) {
    return NextResponse.json({ ok: false, message: "DATABASE_URL required." }, { status: 503 });
  }

  const body = await request.json();
  const fields = [];
  const values = [];

  if (body?.name != null) {
    values.push(String(body.name).trim());
    fields.push(`name = $${values.length}`);
  }
  if (body?.city != null) {
    values.push(String(body.city).trim() || null);
    fields.push(`city = $${values.length}`);
  }
  if (body?.phone != null) {
    values.push(normalizePhone(body.phone) || null);
    fields.push(`phone = $${values.length}`);
  }
  if (body?.seatLimit != null) {
    values.push(Math.max(1, Number(body.seatLimit) || 1));
    fields.push(`seat_limit = $${values.length}`);
  }
  if (body?.status != null && ["active", "suspended"].includes(body.status)) {
    values.push(body.status);
    fields.push(`status = $${values.length}`);
  }
  if (body?.billingStatus != null && ["trial", "active", "expired", "suspended"].includes(body.billingStatus)) {
    values.push(body.billingStatus);
    fields.push(`billing_status = $${values.length}`);
  }
  if (body?.adminPhone && body?.adminName !== undefined) {
    // optional: add another admin
  }

  if (fields.length === 0 && !body?.adminPhone) {
    return NextResponse.json({ ok: false, message: "No updates provided." }, { status: 400 });
  }

  let gym = null;
  if (fields.length > 0) {
    fields.push("updated_at = NOW()");
    values.push(params.id);
    const rows = await query(
      `UPDATE gyms SET ${fields.join(", ")} WHERE id = $${values.length} RETURNING *`,
      values
    );
    gym = rows[0];
    if (!gym) {
      return NextResponse.json({ ok: false, message: "Gym not found." }, { status: 404 });
    }
  } else {
    gym = await getGymById(params.id);
    if (!gym) {
      return NextResponse.json({ ok: false, message: "Gym not found." }, { status: 404 });
    }
  }

  if (body?.adminPhone) {
    const adminPhone = normalizePhone(body.adminPhone);
    const adminName = String(body.adminName ?? "").trim() || null;
    const role = body.adminRole === "manager" ? "manager" : "owner";
    await query(
      `INSERT INTO gym_admins (id, gym_id, phone, name, role, created_at)
       VALUES (md5(random()::text || clock_timestamp()::text), $1, $2, $3, $4, NOW())
       ON CONFLICT (gym_id, phone) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role`,
      [gym.id, adminPhone, adminName, role]
    );
  }

  return NextResponse.json({ ok: true, data: { gym } });
}
