import { hasDatabaseUrl, query } from "./db";

function safeParseJsonArray(text) {
  if (!text || typeof text !== "string") return [];
  try {
    const v = JSON.parse(text);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/** Primary logging fields from sheet import (metric_value = Primary). */
export async function fetchPrimaryMetricLabels(exerciseId) {
  if (!hasDatabaseUrl() || !exerciseId) return [];
  const rows = await query(
    `
      SELECT DISTINCT metric_key
      FROM master_exercise_metrics
      WHERE exercise_id = $1
        AND LOWER(TRIM(metric_value)) = 'primary'
      ORDER BY metric_key
    `,
    [exerciseId]
  );
  return rows.map((r) => r.metric_key).filter(Boolean);
}

/** Machine-readable keys from exercise row (e.g. durationSecondsPerSet). */
export async function fetchImportantFieldKeys(exerciseId) {
  if (!hasDatabaseUrl() || !exerciseId) return [];
  const rows = await query(
    `
      SELECT important_input_fields_json
      FROM master_exercises
      WHERE id = $1
      LIMIT 1
    `,
    [exerciseId]
  );
  if (!rows[0]) return [];
  return safeParseJsonArray(rows[0].important_input_fields_json).filter((k) => typeof k === "string");
}

export async function getRequiredLoggingKeys(exerciseId) {
  const [primaryLabels, important] = await Promise.all([
    fetchPrimaryMetricLabels(exerciseId),
    fetchImportantFieldKeys(exerciseId),
  ]);
  const merged = [...important, ...primaryLabels];
  return [...new Set(merged)];
}

export async function getExerciseById(exerciseId) {
  if (!hasDatabaseUrl() || !exerciseId) return null;
  const rows = await query(
    `
      SELECT
        id,
        name,
        category,
        equipment,
        variation,
        important_input_fields_json,
        tracking_json
      FROM master_exercises
      WHERE id = $1
      LIMIT 1
    `,
    [exerciseId]
  );
  return rows[0] ?? null;
}

export async function searchMasterExercises(searchText, limit = 25) {
  const q = (searchText ?? "").trim();
  if (!hasDatabaseUrl()) {
    return [];
  }
  if (!q) {
    const rows = await query(
      `
        SELECT
          id,
          name,
          category,
          equipment,
          important_input_fields_json,
          tracking_json
        FROM master_exercises
        WHERE COALESCE(is_active, 1) = 1
        ORDER BY name
        LIMIT $1
      `,
      [limit]
    );
    return rows;
  }
  const rows = await query(
    `
      SELECT
        id,
        name,
        category,
        equipment,
        important_input_fields_json,
        tracking_json
      FROM master_exercises
      WHERE COALESCE(is_active, 1) = 1
        AND name ILIKE '%' || $1 || '%'
      ORDER BY name
      LIMIT $2
    `,
    [q, limit]
  );
  return rows;
}
