import { query } from "app/lib/db";

/**
 * Verifies that the given client belongs to the given trainer.
 * Returns the client row on success, null on failure.
 */
export async function requireTrainerOwnsClient(trainerPhone, clientId) {
  if (!trainerPhone || !clientId) return null;
  const rows = await query(
    `SELECT id, name, mobile, goal, age, weight_kg, height_cm, gender, activity_level, created_by_trainer, created_at, updated_at
     FROM clients
     WHERE id = $1 AND created_by_trainer = $2
     LIMIT 1`,
    [clientId, trainerPhone]
  );
  return rows[0] ?? null;
}

/**
 * Verifies that the given session belongs to a client owned by the given trainer.
 * Returns the session row on success, null on failure.
 */
export async function requireTrainerOwnsSession(trainerPhone, sessionId) {
  if (!trainerPhone || !sessionId) return null;
  const rows = await query(
    `SELECT s.*
     FROM sessions s
     JOIN clients c ON c.id = s.client_id
     WHERE s.id = $1 AND c.created_by_trainer = $2
     LIMIT 1`,
    [sessionId, trainerPhone]
  );
  return rows[0] ?? null;
}
