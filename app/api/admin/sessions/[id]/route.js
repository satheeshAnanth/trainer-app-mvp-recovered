import { writeAdminAudit } from "app/lib/adminAudit";
import { adminError, adminJson, requireAdmin } from "app/lib/adminApi";
import { hasDatabaseUrl, query } from "app/lib/db";

async function findSession(id) {
  const rows = await query(
    `
      SELECT
        s.id, s.client_id, s.client_name_snapshot, s.session_date, s.session_title,
        s.status, s.summary, s.raw_notes, s.estimated_calories, s.duration_minutes,
        s.payload_json, s.archived_at, s.created_at, s.updated_at,
        c.name AS client_name, c.mobile AS client_mobile, c.created_by_trainer
      FROM sessions s
      LEFT JOIN clients c ON c.id = s.client_id
      WHERE s.id = $1
      LIMIT 1
    `,
    [id]
  );
  return rows[0] ?? null;
}

export async function GET(request, context) {
  const { denied } = requireAdmin(request);
  if (denied) return denied;
  if (!hasDatabaseUrl()) return adminJson({ source: "mock", session: null });

  const id = context?.params?.id;
  const session = await findSession(id);
  if (!session) return adminError("Session not found.", 404);

  const [shares, payments, audits] = await Promise.all([
    query(
      `
        SELECT id, session_id, client_id, shared_at, created_at
        FROM session_shares
        WHERE session_id = $1
        ORDER BY created_at DESC NULLS LAST
        LIMIT 20
      `,
      [id]
    ).catch(() => []),
    query(
      `
        SELECT id, action, payload_json, created_at
        FROM audit_events
        WHERE (entity_type = 'session_payment' OR (entity_type = 'session' AND action ILIKE '%payment%'))
          AND entity_id = $1
        ORDER BY created_at DESC NULLS LAST
        LIMIT 20
      `,
      [id]
    ).catch(() => []),
    query(
      `
        SELECT id, action, payload_json, created_at
        FROM audit_events
        WHERE entity_type IN ('session', 'session_payment') AND entity_id = $1
        ORDER BY created_at DESC NULLS LAST
        LIMIT 30
      `,
      [id]
    ).catch(() => []),
  ]);

  return adminJson({
    source: "database",
    session,
    shares,
    payments,
    audits,
  });
}

export async function PATCH(request, context) {
  const { denied, actorEmail } = requireAdmin(request);
  if (denied) return denied;
  if (!hasDatabaseUrl()) return adminError("DATABASE_URL not configured.", 503);

  const id = context?.params?.id;
  const session = await findSession(id);
  if (!session) return adminError("Session not found.", 404);

  let body;
  try {
    body = await request.json();
  } catch {
    return adminError("Invalid JSON body.");
  }

  if (body?.action === "archive") {
    const rows = await query(
      `
        UPDATE sessions
        SET archived_at = NOW(), updated_at = NOW()
        WHERE id = $1
        RETURNING id, client_id, session_title, status, archived_at, updated_at
      `,
      [id]
    );
    await writeAdminAudit({
      entityType: "session",
      entityId: id,
      action: "admin_archive_session",
      actorEmail,
      before: { archived_at: session.archived_at },
      after: { archived_at: rows[0]?.archived_at },
    });
    return adminJson({ session: rows[0] });
  }

  if (body?.action === "restore") {
    const rows = await query(
      `
        UPDATE sessions
        SET archived_at = NULL, updated_at = NOW()
        WHERE id = $1
        RETURNING id, client_id, session_title, status, archived_at, updated_at
      `,
      [id]
    );
    await writeAdminAudit({
      entityType: "session",
      entityId: id,
      action: "admin_restore_session",
      actorEmail,
      before: { archived_at: session.archived_at },
      after: { archived_at: null },
    });
    return adminJson({ session: rows[0] });
  }

  const allowed = new Set(["session_title", "status", "summary", "raw_notes", "estimated_calories", "duration_minutes", "session_date"]);
  const setClauses = [];
  const params = [];
  const before = {};
  const after = {};

  for (const key of allowed) {
    if (!(key in body)) continue;
    let value = body[key];
    if (key === "estimated_calories" || key === "duration_minutes") {
      value = value == null || value === "" ? null : Number(value);
      if (value != null && !Number.isFinite(value)) return adminError(`${key} must be a number.`);
    }
    if (key === "status") value = String(value || "").trim().toLowerCase() || null;
    before[key] = session[key];
    after[key] = value;
    params.push(value);
    setClauses.push(`${key} = $${params.length}`);
  }

  if (!setClauses.length) return adminError("No editable fields provided.");

  params.push(id);
  setClauses.push("updated_at = NOW()");

  const rows = await query(
    `
      UPDATE sessions
      SET ${setClauses.join(", ")}
      WHERE id = $${params.length}
      RETURNING id, client_id, client_name_snapshot, session_date, session_title, status,
                summary, raw_notes, estimated_calories, duration_minutes, archived_at, created_at, updated_at
    `,
    params
  );

  await writeAdminAudit({
    entityType: "session",
    entityId: id,
    action: "admin_patch_session",
    actorEmail,
    before,
    after,
  });

  return adminJson({ session: rows[0] });
}
