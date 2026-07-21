#!/usr/bin/env node
/**
 * Match master_exercises → WorkoutX catalog and seed exercise_media image rows.
 *
 * GIFs require the API key, so image_url is stored as our proxy path:
 *   /api/workoutx/gif/{id}
 *
 * Usage:
 *   node --env-file=.env.local scripts/seed-workoutx-media.mjs --dry-run
 *   node --env-file=.env.local scripts/seed-workoutx-media.mjs
 *   node --env-file=.env.local scripts/seed-workoutx-media.mjs --approve-high
 *   node --env-file=.env.local scripts/seed-workoutx-media.mjs --refresh-catalog
 *
 * Env:
 *   DATABASE_URL, WORKOUTX_API_KEY
 *   WORKOUTX_MIN_SCORE (default 78)
 *   WORKOUTX_APPROVE_SCORE (default 90) — used with --approve-high
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import pg from "pg";
import {
  extractWorkoutxIdFromGifUrl,
  fetchAllWorkoutxExercises,
  findBestWorkoutxMatch,
  workoutxGifProxyPath,
} from "../app/lib/workoutx.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const catalogPath = path.join(__dirname, "data", "workoutx-catalog.json");
const dryRun = process.argv.includes("--dry-run");
const refreshCatalog = process.argv.includes("--refresh-catalog");
const approveHigh = process.argv.includes("--approve-high");
const minScore = Number(process.env.WORKOUTX_MIN_SCORE ?? 78);
const approveScore = Number(process.env.WORKOUTX_APPROVE_SCORE ?? 90);

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}
if (!process.env.WORKOUTX_API_KEY) {
  console.error("WORKOUTX_API_KEY is required.");
  process.exit(1);
}

async function loadCatalog() {
  if (!refreshCatalog) {
    try {
      const raw = await readFile(catalogPath, "utf8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.exercises) && parsed.exercises.length) {
        console.log(`Loaded cached catalog: ${parsed.exercises.length} exercises (${catalogPath})`);
        return parsed.exercises;
      }
    } catch {
      // fall through to refresh
    }
  }

  console.log("Fetching WorkoutX catalog (paginated, free plan page size ≈ 10)…");
  const exercises = await fetchAllWorkoutxExercises({
    pageSize: 10,
    onPage: ({ page, totalSoFar, total, quotaRemaining }) => {
      if (page % 10 === 0 || totalSoFar === total) {
        console.log(`  page ${page + 1}: ${totalSoFar}/${total ?? "?"} (quota left: ${quotaRemaining ?? "?"})`);
      }
    },
  });

  await mkdir(path.dirname(catalogPath), { recursive: true });
  await writeFile(
    catalogPath,
    JSON.stringify(
      {
        fetchedAt: new Date().toISOString(),
        count: exercises.length,
        exercises: exercises.map((ex) => ({
          id: ex.id,
          name: ex.name,
          bodyPart: ex.bodyPart,
          equipment: ex.equipment,
          target: ex.target,
          gifUrl: ex.gifUrl,
        })),
      },
      null,
      2
    )
  );
  console.log(`Cached catalog → ${catalogPath}`);
  return exercises;
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const summary = {
  dryRun,
  approveHigh,
  minScore,
  approveScore,
  catalogSize: 0,
  considered: 0,
  matched: 0,
  inserted: 0,
  skippedExisting: 0,
  skippedLowScore: 0,
  skippedHasPrimary: 0,
  approved: 0,
  pending: 0,
  unmatchedSample: [],
};

try {
  const workoutxExercises = await loadCatalog();
  summary.catalogSize = workoutxExercises.length;

  const { rows: catalog } = await pool.query(
    `
      SELECT id, name, category, equipment
      FROM master_exercises
      WHERE COALESCE(is_active, 1) = 1
      ORDER BY name ASC
    `
  );

  for (const exercise of catalog) {
    summary.considered += 1;
    const best = findBestWorkoutxMatch(exercise, workoutxExercises);
    if (!best || best.score < minScore) {
      summary.skippedLowScore += 1;
      if (summary.unmatchedSample.length < 15) {
        summary.unmatchedSample.push({
          id: exercise.id,
          name: exercise.name,
          bestScore: best?.score ?? 0,
          bestName: best?.wx?.name ?? null,
        });
      }
      continue;
    }

    const wxId = extractWorkoutxIdFromGifUrl(best.wx.gifUrl) || String(best.wx.id ?? "");
    const proxyPath = workoutxGifProxyPath(wxId);
    if (!proxyPath) {
      summary.skippedLowScore += 1;
      continue;
    }

    summary.matched += 1;

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
    const shouldApprove = approveHigh && best.score >= approveScore;
    const makePrimary = shouldApprove && !hasPrimary;
    if (hasPrimary && shouldApprove) summary.skippedHasPrimary += 1;

    const status = shouldApprove ? "approved" : "pending_review";
    if (status === "approved") summary.approved += 1;
    else summary.pending += 1;

    const row = {
      id: randomUUID(),
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      score: best.score,
      reason: best.reason,
      wxId,
      wxName: best.wx.name,
      status,
      isPrimary: makePrimary,
      imageUrl: proxyPath,
    };

    if (dryRun) {
      summary.inserted += 1;
      if (summary.inserted <= 8) console.log("dry-run would insert", row);
      continue;
    }

    await pool.query(
      `
        INSERT INTO exercise_media (
          id, exercise_id, media_type, title, channel_name,
          image_url, image_attribution, status, submitted_by, is_primary
        ) VALUES (
          $1, $2, 'image', $3, $4,
          $5, $6, $7, $8, $9
        )
      `,
      [
        row.id,
        row.exerciseId,
        `${best.wx.name} (WorkoutX)`,
        "WorkoutX",
        row.imageUrl,
        "Animation via WorkoutX API · https://workoutxapp.com",
        status,
        "workoutx-seed",
        makePrimary,
      ]
    );
    summary.inserted += 1;
  }

  console.log(JSON.stringify(summary, null, 2));
} finally {
  await pool.end();
}
