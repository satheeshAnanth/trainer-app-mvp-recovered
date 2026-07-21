import { writeAdminAudit } from "app/lib/adminAudit";
import { adminError, adminJson, requireAdmin } from "app/lib/adminApi";
import { hasDatabaseUrl, query } from "app/lib/db";

async function findClient(id) {
  const rows = await query(
    `
      SELECT
        id, name, mobile, goal, age, gender, weight_kg, height_cm, activity_level,
        created_by_trainer, archived_at, created_at, updated_at
      FROM clients
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );
  return rows[0] ?? null;
}

export async function GET(request, context) {
  const { denied } = requireAdmin(request);
  if (denied) return denied;
  if (!hasDatabaseUrl()) return adminJson({ source: "mock", client: null });

  const id = context?.params?.id;
  const client = await findClient(id);
  if (!client) return adminError("Client not found.", 404);

  const trainerDigits = String(client.created_by_trainer || "").replace(/\D/g, "");

  const [trainer, sessions, events, invitations, messages] = await Promise.all([
    trainerDigits
      ? query(
          `
            SELECT id, phone, name, billing_status, trial_ends_at
            FROM trainer_phones
            WHERE regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') = $1
            LIMIT 1
          `,
          [trainerDigits]
        ).then((rows) => rows[0] ?? null)
      : Promise.resolve(null),
    query(
      `
        SELECT id, session_date, session_title, status, estimated_calories,
               duration_minutes, archived_at, created_at, updated_at
        FROM sessions
        WHERE client_id = $1
        ORDER BY created_at DESC NULLS LAST
        LIMIT 50
      `,
      [id]
    ).catch(() => []),
    query(
      `
        SELECT id, scheduled_date, scheduled_time, status, notes, created_at
        FROM calendar_events
        WHERE client_id = $1
        ORDER BY scheduled_date DESC NULLS LAST
        LIMIT 40
      `,
      [id]
    ).catch(() => []),
    query(
      `
        SELECT id, client_name, client_phone, status, expires_at, accepted_at, created_at
        FROM invitations
        WHERE client_id = $1
           OR regexp_replace(COALESCE(client_phone, ''), '[^0-9]', '', 'g')
            = regexp_replace(COALESCE($2, ''), '[^0-9]', '', 'g')
        ORDER BY created_at DESC NULLS LAST
        LIMIT 20
      `,
      [id, client.mobile]
    ).catch(() => []),
    query(
      `
        SELECT id, sender_role, body, created_at, read_at
        FROM client_messages
        WHERE client_id = $1
        ORDER BY created_at DESC NULLS LAST
        LIMIT 40
      `,
      [id]
    ).catch(() => []),
  ]);

  return adminJson({
    source: "database",
    client,
    trainer,
    sessions,
    events,
    invitations,
    messages,
  });
}

const CLIENT_PATCH_FIELDS = new Set([
  "name",
  "goal",
  "age",
  "gender",
  "weight_kg",
  "height_cm",
  "activity_level",
  "mobile",
]);

export async function PATCH(request, context) {
  const { denied, actorEmail } = requireAdmin(request);
  if (denied) return denied;
  if (!hasDatabaseUrl()) return adminError("DATABASE_URL not configured.", 503);

  const id = context?.params?.id;
  const client = await findClient(id);
  if (!client) return adminError("Client not found.", 404);

  let body;
  try {
    body = await request.json();
  } catch {
    return adminError("Invalid JSON body.");
  }

  if (body?.action === "archive") {
    const rows = await query(
      `
        UPDATE clients
        SET archived_at = NOW(), updated_at = NOW()
        WHERE id = $1
        RETURNING id, name, mobile, goal, age, gender, weight_kg, height_cm, activity_level,
                  created_by_trainer, archived_at, created_at, updated_at
      `,
      [id]
    );
    await writeAdminAudit({
      entityType: "client",
      entityId: id,
      action: "admin_archive_client",
      actorEmail,
      before: { archived_at: client.archived_at },
      after: { archived_at: rows[0]?.archived_at },
    });
    return adminJson({ client: rows[0] });
  }

  if (body?.action === "restore") {
    const rows = await query(
      `
        UPDATE clients
        SET archived_at = NULL, updated_at = NOW()
        WHERE id = $1
        RETURNING id, name, mobile, goal, age, gender, weight_kg, height_cm, activity_level,
                  created_by_trainer, archived_at, created_at, updated_at
      `,
      [id]
    );
    await writeAdminAudit({
      entityType: "client",
      entityId: id,
      action: "admin_restore_client",
      actorEmail,
      before: { archived_at: client.archived_at },
      after: { archived_at: null },
    });
    return adminJson({ client: rows[0] });
  }

  const expectedUpdatedAt = body?.updated_at ? String(body.updated_at) : null;
  if (expectedUpdatedAt && String(client.updated_at) !== expectedUpdatedAt) {
    return adminError("Client was modified elsewhere. Refresh and try again.", 409);
  }

  const setClauses = [];
  const params = [];
  const before = {};
  const after = {};

  for (const key of CLIENT_PATCH_FIELDS) {
    if (!(key in body)) continue;
    let value = body[key];
    if (key === "age" || key === "weight_kg" || key === "height_cm") {
      value = value == null || value === "" ? null : Number(value);
      if (value != null && !Number.isFinite(value)) return adminError(`${key} must be a number.`);
    }
    if (key === "gender" || key === "activity_level") {
      value = value == null || value === "" ? null : String(value).trim().toLowerCase();
    }
    if (key === "name" || key === "goal" || key === "mobile") {
      value = value == null ? null : String(value).trim() || null;
    }
    before[key] = client[key];
    after[key] = value;
    params.push(value);
    setClauses.push(`${key} = $${params.length}`);
  }

  if (!setClauses.length) return adminError("No editable fields provided.");

  params.push(id);
  setClauses.push("updated_at = NOW()");

  const rows = await query(
    `
      UPDATE clients
      SET ${setClauses.join(", ")}
      WHERE id = $${params.length}
      RETURNING id, name, mobile, goal, age, gender, weight_kg, height_cm, activity_level,
                created_by_trainer, archived_at, created_at, updated_at
    `,
    params
  );

  await writeAdminAudit({
    entityType: "client",
    entityId: id,
    action: "admin_patch_client",
    actorEmail,
    before,
    after,
  });

  return adminJson({ client: rows[0] });
}
