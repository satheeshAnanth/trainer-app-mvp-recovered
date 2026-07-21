import { randomUUID } from "crypto";
import { hasDatabaseUrl, query } from "app/lib/db";

const SENSITIVE_KEYS = new Set([
  "password",
  "password_hash",
  "code",
  "otp",
  "token",
  "admin_secret",
  "session",
  "upi",
  "upiId",
  "upi_id",
]);

function redactValue(key, value) {
  if (SENSITIVE_KEYS.has(String(key))) return "[redacted]";
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return redactObject(value);
  }
  if (Array.isArray(value)) {
    return value.map((item, idx) => redactValue(String(idx), item));
  }
  return value;
}

export function redactObject(input) {
  if (!input || typeof input !== "object") return input;
  const out = {};
  for (const [key, value] of Object.entries(input)) {
    out[key] = redactValue(key, value);
  }
  return out;
}

export async function writeAdminAudit({
  entityType,
  entityId,
  action,
  actorEmail = "admin",
  before = null,
  after = null,
  meta = null,
} = {}) {
  if (!hasDatabaseUrl() || !entityType || !entityId || !action) return null;

  try {
    const id = randomUUID();
    const payload = redactObject({
      actorEmail,
      before,
      after,
      meta,
    });
    await query(
      `
        INSERT INTO audit_events (id, entity_type, entity_id, action, payload_json, created_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
      `,
      [id, String(entityType), String(entityId), String(action), JSON.stringify(payload)]
    );
    return id;
  } catch {
    return null;
  }
}
