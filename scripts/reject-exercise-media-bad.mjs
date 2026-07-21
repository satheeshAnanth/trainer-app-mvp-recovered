#!/usr/bin/env node
/**
 * Rejects clearly wrong pending exercise_media rows (equipment/movement mismatch,
 * EX#### duplicates, generic video on wrong variant).
 *
 * Usage: DATABASE_URL=... node scripts/reject-exercise-media-bad.mjs
 */
import pg from "pg";

const REJECT_EXERCISE_IDS = [
  "assisted_pull_up_machine_machine",
  "dumbbell_bench_press_flat_flat",
  "dumbbell_shoulder_press_seated_seated",
  "ex0084_goblet_squat_dumbbell_kettlebell_dumbbell_kettlebell",
  "ex0099_hip_thrust_barbell_barbell",
  "ex0124_dead_bug_standard_standard",
  "ex0126_mountain_climber_standard_standard",
  "ex0157_burpee_standard_standard",
  "farmer_grip_hold_static_static",
  "lat_pulldown_close_grip_close_grip",
  "lateral_raise_cable_cable",
  "overhead_press_seated_barbell_seated_barbell",
  "pendlay_row_barbell_barbell",
  "plank_side_side",
  "push_up_decline_decline",
  "push_up_incline_incline",
  "romanian_deadlift_dumbbell_dumbbell",
  "shoulder_press_machine_machine",
  "reverse_lunge_dumbbell_dumbbell",
  "walking_lunge_dumbbell_dumbbell",
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
      UPDATE exercise_media
      SET
        status = 'rejected',
        reviewed_by = 'reject-bad-script',
        reviewed_at = now(),
        updated_at = now(),
        is_primary = false
      WHERE exercise_id = ANY($1::text[])
        AND status = 'pending_review'
      RETURNING id, exercise_id
    `,
    [REJECT_EXERCISE_IDS]
  );

  const { rows: remaining } = await pool.query(
    `
      SELECT m.id, m.exercise_id, e.name
      FROM exercise_media m
      JOIN master_exercises e ON e.id = m.exercise_id
      WHERE m.status = 'pending_review'
      ORDER BY e.name
    `
  );

  console.log(JSON.stringify({ rejected: rows, rejectedCount: rows.length, stillPending: remaining }, null, 2));
  console.error(`Rejected ${rows.length} rows. ${remaining.length} still pending.`);
} catch (e) {
  console.error(e?.message ?? e);
  process.exit(1);
} finally {
  await pool.end();
}
