#!/usr/bin/env node
/**
 * Seed curated WorkoutX GIF mappings (human shortlist — not auto-matcher).
 *
 * Usage:
 *   node --env-file=.env.local scripts/seed-workoutx-curated.mjs --dry-run
 *   node --env-file=.env.local scripts/seed-workoutx-curated.mjs
 *   node --env-file=.env.local scripts/seed-workoutx-curated.mjs --approve
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { workoutxGifProxyPath } from "../app/lib/workoutx.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const catalogPath = path.join(__dirname, "data", "workoutx-catalog.json");
const dryRun = process.argv.includes("--dry-run");
const approve = process.argv.includes("--approve");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

/** master_exercises.name → WorkoutX gif id */
const CURATED = [
  // 5202 Front Plank often 503 (watermark unavailable); use weighted variant
  ["Plank (Front)", "2135"],
  ["Push-up (Standard)", "0662"],
  ["Pull-up (Overhand)", "0652"],
  ["Chin-up (Underhand)", "1326"],
  ["Barbell Curl (Straight bar)", "0031"],
  ["Cable Curl (Straight bar)", "0868"],
  ["Dumbbell Fly (Flat)", "0308"],
  ["Shrug (Dumbbell)", "0406"],
  ["Walking Lunge (Dumbbell)", "0336"],
  ["Reverse Lunge (Dumbbell)", "0381"],
  ["Mountain Climber (Standard)", "0630"],
  ["Reverse Crunch (Standard)", "0872"],
  ["Russian Twist (Bodyweight)", "0687"],
  ["Dead Bug (Standard)", "0276"],
  ["Ab Wheel Rollout (Kneeling)", "0857"],
  ["Inverted Row (Smith/bar)", "0499"],
  ["Kettlebell Swing (Russian)", "0549"],
  ["Kettlebell Swing (American)", "0549"],
  ["Burpee (Standard)", "1160"],
  ["Back Squat (High bar)", "1436"],
  ["Back Squat (Low bar)", "1435"],
  ["Deadlift (Sumo)", "0117"],
  ["Deadlift (Conventional)", "0032"],
  ["Lying Leg Curl (Machine)", "0586"],
  ["Seated Leg Curl (Machine)", "0599"],
  ["Standing Leg Curl (Machine)", "0795"],
  ["Leg Extension (Machine)", "0585"],
  ["Leg Press (Standard)", "0739"],
  ["Dip (Chest focus)", "0251"],
  ["Bench Dip (Bodyweight)", "0129"],
  ["Skull Crusher (EZ bar)", "0060"],
  ["Farmer Carry (Dumbbells)", "2133"],
  ["Kettlebell Snatch (Single arm)", "0542"],
  ["Kettlebell Turkish Get-up (Standard)", "0551"],
  ["Bear Crawl (Forward)", "3360"],
  ["Tire Flip (Standard)", "2459"],
  ["Jump Rope (Basic bounce)", "2612"],
  ["Air Bike (Intervals)", "0003"],
  ["Incline Chest Press (Machine)", "1299"],
  ["Smith Machine Squat (Smith machine)", "0770"],
  ["Standing Calf Raise (Machine)", "0605"],
  ["Seated Calf Raise (Machine)", "0594"],
  ["Single-leg Calf Raise (Bodyweight)", "0409"],
  ["Hanging Knee Raise (Bent knee)", "0011"],
  ["Pallof Press (Cable/band)", "0979"],
  ["Medicine Ball Slam (Standard)", "1354"],
  ["Hip Mobility (World greatest stretch)", "1604"],
  ["Lat Pulldown (Wide grip)", "0197"],
  ["Lat Pulldown (Close grip)", "2616"],
];

const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
const byId = new Map((catalog.exercises || []).map((ex) => [String(ex.id), ex]));

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const summary = {
  dryRun,
  approve,
  mapped: CURATED.length,
  inserted: 0,
  skippedExisting: 0,
  skippedMissingMaster: 0,
  skippedMissingWx: 0,
  promotedPrimary: 0,
  rows: [],
};

try {
  for (const [masterName, wxId] of CURATED) {
    const wx = byId.get(String(wxId));
    if (!wx) {
      summary.skippedMissingWx += 1;
      console.warn(`WorkoutX id missing from catalog: ${wxId} (${masterName})`);
      continue;
    }

    const { rows: masters } = await pool.query(
      `
        SELECT id, name
        FROM master_exercises
        WHERE name = $1 AND COALESCE(is_active, 1) = 1
        LIMIT 1
      `,
      [masterName]
    );
    const exercise = masters[0];
    if (!exercise) {
      summary.skippedMissingMaster += 1;
      console.warn(`Master exercise not found: ${masterName}`);
      continue;
    }

    const proxyPath = workoutxGifProxyPath(wxId);
    const existing = await pool.query(
      `
        SELECT id, status, is_primary
        FROM exercise_media
        WHERE exercise_id = $1
          AND media_type = 'image'
          AND image_url = $2
        LIMIT 1
      `,
      [exercise.id, proxyPath]
    );
    if (existing.rows[0]) {
      summary.skippedExisting += 1;
      continue;
    }

    const primaryRows = await pool.query(
      `
        SELECT id FROM exercise_media
        WHERE exercise_id = $1 AND status = 'approved' AND is_primary = true
        LIMIT 1
      `,
      [exercise.id]
    );
    const hasPrimary = Boolean(primaryRows.rows[0]);
    const status = approve ? "approved" : "pending_review";
    const makePrimary = approve && !hasPrimary;
    if (makePrimary) summary.promotedPrimary += 1;

    const row = {
      master: masterName,
      wxId,
      wxName: wx.name,
      status,
      isPrimary: makePrimary,
      imageUrl: proxyPath,
    };
    summary.rows.push(row);

    if (dryRun) {
      summary.inserted += 1;
      console.log("dry-run", row);
      continue;
    }

    await pool.query(
      `
        INSERT INTO exercise_media (
          id, exercise_id, media_type, title, channel_name,
          image_url, image_attribution, status, submitted_by, is_primary,
          reviewed_by, reviewed_at
        ) VALUES (
          $1, $2, 'image', $3, $4,
          $5, $6, $7, $8, $9,
          $10, $11
        )
      `,
      [
        randomUUID(),
        exercise.id,
        `${wx.name} (WorkoutX)`,
        "WorkoutX",
        proxyPath,
        "Animation via WorkoutX API · https://workoutxapp.com",
        status,
        "workoutx-curated-seed",
        makePrimary,
        approve ? "workoutx-curated-seed" : null,
        approve ? new Date() : null,
      ]
    );
    summary.inserted += 1;
  }

  console.log(JSON.stringify({ ...summary, rows: summary.rows.length }, null, 2));
  if (!dryRun && summary.rows.length) {
    console.log("\nSeeded:");
    for (const r of summary.rows) {
      console.log(`  ${r.master} ← ${r.wxName} [${r.wxId}] (${r.status}${r.isPrimary ? ", primary" : ""})`);
    }
  }
} finally {
  await pool.end();
}
