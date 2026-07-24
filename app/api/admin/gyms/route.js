import { NextResponse } from "next/server";
import { requireAdminSecret } from "app/lib/adminAuth";
import { hasDatabaseUrl, query } from "app/lib/db";
import { normalizePhone, slugifyGymName } from "app/lib/gyms";

/** GET /api/admin/gyms — list gyms */
export async function GET(request) {
  const denied = requireAdminSecret(request);
  if (denied) return denied;

  if (!hasDatabaseUrl()) {
    return NextResponse.json({ ok: true, data: { gyms: [], note: "DATABASE_URL not configured." } });
  }

  try {
    const gyms = await query(
      `SELECT g.*,
              (SELECT COUNT(*)::int FROM gym_memberships m
               WHERE m.gym_id = g.id AND m.status IN ('invited', 'active')) AS seats_used,
              (SELECT COUNT(*)::int FROM gym_admins a WHERE a.gym_id = g.id) AS admin_count
       FROM gyms g
       ORDER BY g.created_at DESC
       LIMIT 200`
    );
    return NextResponse.json({ ok: true, data: { gyms } });
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: err.message?.includes("gyms") ? "Run db migration 005_gyms.sql first." : err.message },
      { status: 500 }
    );
  }
}

/** POST /api/admin/gyms — create gym + first admin */
export async function POST(request) {
  const denied = requireAdminSecret(request);
  if (denied) return denied;

  if (!hasDatabaseUrl()) {
    return NextResponse.json({ ok: false, message: "DATABASE_URL required." }, { status: 503 });
  }

  const body = await request.json();
  const name = String(body?.name ?? "").trim();
  const city = String(body?.city ?? "").trim() || null;
  const phone = normalizePhone(body?.phone) || null;
  const seatLimit = Math.max(1, Number(body?.seatLimit) || 5);
  const adminPhone = normalizePhone(body?.adminPhone);
  const adminName = String(body?.adminName ?? "").trim() || null;
  let slug = String(body?.slug ?? "").trim().toLowerCase() || slugifyGymName(name);

  if (!name) {
    return NextResponse.json({ ok: false, message: "Gym name is required." }, { status: 400 });
  }
  if (!adminPhone) {
    return NextResponse.json({ ok: false, message: "First gym admin phone is required." }, { status: 400 });
  }

  // Ensure unique slug
  const existingSlug = await query(`SELECT id FROM gyms WHERE slug = $1 LIMIT 1`, [slug]).catch(() => []);
  if (existingSlug[0]) {
    slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
  }

  try {
    const gymRows = await query(
      `INSERT INTO gyms (id, name, slug, city, phone, status, seat_limit, billing_status, created_at, updated_at)
       VALUES (
         md5(random()::text || clock_timestamp()::text),
         $1, $2, $3, $4, 'active', $5, 'active', NOW(), NOW()
       )
       RETURNING *`,
      [name, slug, city, phone, seatLimit]
    );
    const gym = gymRows[0];

    await query(
      `INSERT INTO gym_admins (id, gym_id, phone, name, role, created_at)
       VALUES (
         md5(random()::text || clock_timestamp()::text),
         $1, $2, $3, 'owner', NOW()
       )
       ON CONFLICT (gym_id, phone) DO UPDATE SET name = EXCLUDED.name`,
      [gym.id, adminPhone, adminName]
    );

    return NextResponse.json({ ok: true, data: { gym, adminPhone } });
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: err.message?.includes("gyms") ? "Run db migration 005_gyms.sql first." : err.message },
      { status: 500 }
    );
  }
}
