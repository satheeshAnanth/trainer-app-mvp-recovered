import { randomBytes } from "crypto";
import { hasDatabaseUrl, query } from "app/lib/db";

export function normalizePhone(phone = "") {
  const digits = String(phone).replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `+91${digits}`;
  if (digits.startsWith("91") && digits.length === 12) return `+${digits}`;
  if (String(phone).startsWith("+")) return String(phone);
  return `+${digits}`;
}

export function slugifyGymName(name = "") {
  const base = String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base || `gym-${Date.now().toString(36)}`;
}

export function generateGymInviteToken() {
  return randomBytes(20).toString("base64url");
}

export async function getGymById(gymId) {
  if (!hasDatabaseUrl() || !gymId) return null;
  const rows = await query(`SELECT * FROM gyms WHERE id = $1 LIMIT 1`, [gymId]);
  return rows[0] ?? null;
}

export async function getGymAdminByPhone(phone) {
  if (!hasDatabaseUrl() || !phone) return null;
  const rows = await query(
    `SELECT a.*, g.name AS gym_name, g.slug AS gym_slug, g.status AS gym_status,
            g.seat_limit, g.billing_status AS gym_billing_status
     FROM gym_admins a
     JOIN gyms g ON g.id = a.gym_id
     WHERE regexp_replace(COALESCE(a.phone, ''), '[^0-9]', '', 'g')
         = regexp_replace(COALESCE($1, ''), '[^0-9]', '', 'g')
     ORDER BY a.created_at ASC
     LIMIT 1`,
    [phone]
  );
  return rows[0] ?? null;
}

/** Seats that count against the limit: invited + active. */
export async function countUsedSeats(gymId) {
  if (!hasDatabaseUrl() || !gymId) return 0;
  const rows = await query(
    `SELECT COUNT(*)::int AS n
     FROM gym_memberships
     WHERE gym_id = $1 AND status IN ('invited', 'active')`,
    [gymId]
  );
  return rows[0]?.n ?? 0;
}

export async function assertSeatAvailable(gymId) {
  const gym = await getGymById(gymId);
  if (!gym) {
    return { ok: false, status: 404, message: "Gym not found." };
  }
  if (gym.status !== "active") {
    return { ok: false, status: 403, message: "Gym is suspended." };
  }
  const used = await countUsedSeats(gymId);
  if (used >= Number(gym.seat_limit)) {
    return {
      ok: false,
      status: 409,
      message: `Seat limit reached (${used}/${gym.seat_limit}).`,
      used,
      seatLimit: gym.seat_limit,
    };
  }
  return { ok: true, gym, used, seatLimit: gym.seat_limit };
}

/**
 * Aggregate metrics only — never returns session payloads or client PII.
 */
export async function getGymOpsSnapshot(gymId) {
  if (!hasDatabaseUrl() || !gymId) {
    return {
      seatsUsed: 0,
      seatLimit: 0,
      trainersActive: 0,
      trainersInvited: 0,
      sessionsLast7Days: 0,
      clientsTotal: 0,
    };
  }

  const gym = await getGymById(gymId);
  const [seatRows, sessionRows, clientRows] = await Promise.all([
    query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'active')::int AS active,
         COUNT(*) FILTER (WHERE status = 'invited')::int AS invited,
         COUNT(*) FILTER (WHERE status IN ('invited', 'active'))::int AS used
       FROM gym_memberships
       WHERE gym_id = $1`,
      [gymId]
    ),
    query(
      `SELECT COUNT(*)::int AS n
       FROM sessions s
       JOIN clients c ON c.id = s.client_id
       JOIN gym_memberships m
         ON regexp_replace(COALESCE(m.trainer_phone, ''), '[^0-9]', '', 'g')
          = regexp_replace(COALESCE(c.created_by_trainer, ''), '[^0-9]', '', 'g')
       WHERE m.gym_id = $1
         AND m.status = 'active'
         AND s.created_at >= NOW() - INTERVAL '7 days'`,
      [gymId]
    ).catch(() => [{ n: 0 }]),
    query(
      `SELECT COUNT(*)::int AS n
       FROM clients c
       JOIN gym_memberships m
         ON regexp_replace(COALESCE(m.trainer_phone, ''), '[^0-9]', '', 'g')
          = regexp_replace(COALESCE(c.created_by_trainer, ''), '[^0-9]', '', 'g')
       WHERE m.gym_id = $1
         AND m.status = 'active'
         AND c.archived_at IS NULL`,
      [gymId]
    ).catch(() => [{ n: 0 }]),
  ]);

  return {
    seatsUsed: seatRows[0]?.used ?? 0,
    seatLimit: gym?.seat_limit ?? 0,
    trainersActive: seatRows[0]?.active ?? 0,
    trainersInvited: seatRows[0]?.invited ?? 0,
    sessionsLast7Days: sessionRows[0]?.n ?? 0,
    clientsTotal: clientRows[0]?.n ?? 0,
    gymName: gym?.name ?? "",
    gymStatus: gym?.status ?? "",
    billingStatus: gym?.billing_status ?? "",
  };
}

export async function listGymMemberships(gymId) {
  if (!hasDatabaseUrl() || !gymId) return [];
  return query(
    `SELECT m.id, m.gym_id, m.trainer_phone, m.status, m.invited_at, m.joined_at, m.removed_at,
            t.name AS trainer_name, t.billing_status
     FROM gym_memberships m
     LEFT JOIN trainer_phones t
       ON regexp_replace(COALESCE(t.phone, ''), '[^0-9]', '', 'g')
        = regexp_replace(COALESCE(m.trainer_phone, ''), '[^0-9]', '', 'g')
     WHERE m.gym_id = $1
       AND m.status IN ('invited', 'active', 'removed')
     ORDER BY
       CASE m.status WHEN 'active' THEN 0 WHEN 'invited' THEN 1 ELSE 2 END,
       m.joined_at DESC NULLS LAST,
       m.invited_at DESC
     LIMIT 200`,
    [gymId]
  );
}

export async function listGymInvitations(gymId) {
  if (!hasDatabaseUrl() || !gymId) return [];
  return query(
    `SELECT id, token, gym_id, trainer_phone, trainer_name, status, expires_at, accepted_at, created_at
     FROM gym_invitations
     WHERE gym_id = $1
     ORDER BY created_at DESC
     LIMIT 100`,
    [gymId]
  );
}

export async function activateGymMembership({ gymId, trainerPhone, trainerName = null }) {
  const phone = normalizePhone(trainerPhone);
  const seat = await assertSeatAvailable(gymId);
  if (!seat.ok) return seat;

  // Prefer upgrading an existing invited row for this gym
  const existing = await query(
    `SELECT id, status FROM gym_memberships
     WHERE gym_id = $1
       AND regexp_replace(COALESCE(trainer_phone, ''), '[^0-9]', '', 'g')
         = regexp_replace(COALESCE($2, ''), '[^0-9]', '', 'g')
     ORDER BY created_at DESC
     LIMIT 1`,
    [gymId, phone]
  );

  if (existing[0]?.status === "active") {
    await query(
      `UPDATE trainer_phones SET gym_id = $1, updated_at = NOW()
       WHERE regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g')
           = regexp_replace(COALESCE($2, ''), '[^0-9]', '', 'g')`,
      [gymId, phone]
    ).catch(() => null);
    return { ok: true, membershipId: existing[0].id, alreadyActive: true };
  }

  let membershipId;
  if (existing[0]) {
    const rows = await query(
      `UPDATE gym_memberships
       SET status = 'active', joined_at = COALESCE(joined_at, NOW()), removed_at = NULL, updated_at = NOW()
       WHERE id = $1
       RETURNING id`,
      [existing[0].id]
    );
    membershipId = rows[0]?.id;
  } else {
    const rows = await query(
      `INSERT INTO gym_memberships (id, gym_id, trainer_phone, status, invited_at, joined_at, created_at, updated_at)
       VALUES (
         md5(random()::text || clock_timestamp()::text),
         $1, $2, 'active', NOW(), NOW(), NOW(), NOW()
       )
       RETURNING id`,
      [gymId, phone]
    );
    membershipId = rows[0]?.id;
  }

  await query(
    `UPDATE trainer_phones
     SET gym_id = $1,
         gym_name = COALESCE(gym_name, $3),
         billing_status = CASE
           WHEN LOWER(COALESCE(billing_status, '')) = 'suspended' THEN billing_status
           ELSE 'active'
         END,
         updated_at = NOW()
     WHERE regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g')
         = regexp_replace(COALESCE($2, ''), '[^0-9]', '', 'g')`,
    [gymId, phone, trainerName]
  ).catch(() => null);

  return { ok: true, membershipId };
}

export async function removeGymMembership({ gymId, membershipId }) {
  const rows = await query(
    `UPDATE gym_memberships
     SET status = 'removed', removed_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND gym_id = $2
     RETURNING trainer_phone`,
    [membershipId, gymId]
  );
  const phone = rows[0]?.trainer_phone;
  if (phone) {
    await query(
      `UPDATE trainer_phones
       SET gym_id = NULL, updated_at = NOW()
       WHERE regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g')
           = regexp_replace(COALESCE($1, ''), '[^0-9]', '', 'g')
         AND gym_id = $2`,
      [phone, gymId]
    ).catch(() => null);
  }
  return { ok: Boolean(rows[0]), trainerPhone: phone ?? null };
}

/** True when trainer is covered by an active gym membership (solo trainers: false). */
export async function isTrainerGymCovered(phone) {
  if (!hasDatabaseUrl() || !phone) return false;
  const rows = await query(
    `SELECT 1
     FROM gym_memberships m
     JOIN gyms g ON g.id = m.gym_id
     WHERE regexp_replace(COALESCE(m.trainer_phone, ''), '[^0-9]', '', 'g')
         = regexp_replace(COALESCE($1, ''), '[^0-9]', '', 'g')
       AND m.status = 'active'
       AND g.status = 'active'
       AND LOWER(COALESCE(g.billing_status, '')) IN ('active', 'trial')
     LIMIT 1`,
    [phone]
  );
  return Boolean(rows[0]);
}
