#!/usr/bin/env node
/**
 * Approves a conservative first subset of seeded exercise media.
 * Skips ambiguous matches, equipment mismatches, and EX#### duplicate rows.
 *
 * Usage:
 *   DATABASE_URL=... node scripts/approve-exercise-media-subset.mjs
 *   DATABASE_URL=... node scripts/approve-exercise-media-subset.mjs --dry-run
 */
import pg from "pg";

const dryRun = process.argv.includes("--dry-run");

/** exercise_id allowlist — one canonical row per movement family */
const SAFE_EXERCISE_IDS = [
  "goblet_squat_dumbbell_kettlebell_dumbbell_kettlebell",
  "romanian_deadlift_barbell_barbell",
  "bench_press_flat_barbell_flat_barbell",
  "pull_up_overhand_overhand",
  "lat_pulldown_wide_grip_wide_grip",
  "overhead_press_standing_barbell_standing_barbell",
  "lateral_raise_dumbbell_dumbbell",
  "plank_front_front",
  "dead_bug_standard_standard",
  "mountain_climber_standard_standard",
  "burpee_standard_standard",
  "hip_thrust_barbell_barbell",
  "farmer_carry_dumbbells_dumbbells",
];

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

try {
  const { rows } = await pool.query(
    `
      SELECT m.id, m.exercise_id, m.status, e.name, e.category
      FROM exercise_media m
      JOIN master_exercises e ON e.id = m.exercise_id
      WHERE m.exercise_id = ANY($1::text[])
        AND m.status = 'pending_review'
    `,
    [SAFE_EXERCISE_IDS]
  );

  const summary = { dryRun, approved: [], skipped: [], missing: [] };
  const foundIds = new Set(rows.map((r) => r.exercise_id));

  for (const exerciseId of SAFE_EXERCISE_IDS) {
    if (!foundIds.has(exerciseId)) summary.missing.push(exerciseId);
  }

  for (const row of rows) {
    if (dryRun) {
      summary.approved.push({ id: row.id, exerciseId: row.exercise_id, name: row.name, category: row.category });
      continue;
    }
    await pool.query(
      `
        UPDATE exercise_media
        SET is_primary = false, updated_at = now()
        WHERE exercise_id = $1 AND status = 'approved' AND is_primary = true
      `,
      [row.exercise_id]
    );
    await pool.query(
      `
        UPDATE exercise_media
        SET
          status = 'approved',
          is_primary = true,
          reviewed_by = 'approve-subset-script',
          reviewed_at = now(),
          updated_at = now()
        WHERE id = $1
      `,
      [row.id]
    );
    summary.approved.push({ id: row.id, exerciseId: row.exercise_id, name: row.name, category: row.category });
  }

  console.log(JSON.stringify(summary, null, 2));
  console.error(
    dryRun
      ? `Dry run: would approve ${summary.approved.length} rows.`
      : `Approved ${summary.approved.length} rows as primary. ${SAFE_EXERCISE_IDS.length - summary.approved.length - summary.missing.length} allowlisted ids were not pending.`
  );
} catch (e) {
  console.error(e?.message ?? e);
  process.exit(1);
} finally {
  await pool.end();
}
