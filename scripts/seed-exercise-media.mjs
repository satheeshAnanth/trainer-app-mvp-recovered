#!/usr/bin/env node
/**
 * Seeds pending_review (default) exercise_media rows by matching catalog names.
 *
 * Usage:
 *   DATABASE_URL=... node scripts/seed-exercise-media.mjs
 *   DATABASE_URL=... SEED_APPROVE=true node scripts/seed-exercise-media.mjs
 *   DATABASE_URL=... node scripts/seed-exercise-media.mjs --dry-run
 *
 * Reads: scripts/data/exercise-media-seed.json
 * Requires: scripts/migrations/001_exercise_media.sql applied
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dryRun = process.argv.includes("--dry-run");
const autoApprove = process.env.SEED_APPROVE === "true";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

function extractYoutubeVideoId(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/^[a-zA-Z0-9_-]{11}$/.test(raw)) return raw;
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0] ?? "";
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : "";
    }
    const v = url.searchParams.get("v");
    if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
  } catch {
    return "";
  }
  return "";
}

const seedPath = path.join(__dirname, "data", "exercise-media-seed.json");
const seed = JSON.parse(await readFile(seedPath, "utf8"));
if (!Array.isArray(seed) || seed.length === 0) {
  console.error("Seed file is empty.");
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const summary = {
  dryRun,
  autoApprove,
  matched: 0,
  inserted: 0,
  skippedExisting: 0,
  unmatched: [],
  insertedRows: [],
};

try {
  const { rows: exercises } = await pool.query(
    `
      SELECT id, name, category
      FROM master_exercises
      WHERE COALESCE(is_active, 1) = 1
    `
  );

  for (const entry of seed) {
    const needle = String(entry.nameContains ?? "").trim().toLowerCase();
    const youtubeVideoId = extractYoutubeVideoId(entry.youtubeVideoId ?? entry.youtubeUrl ?? "");
    if (!needle || !youtubeVideoId) {
      summary.unmatched.push({ reason: "invalid_seed_entry", entry });
      continue;
    }

    const matches = exercises.filter((ex) => String(ex.name ?? "").toLowerCase().includes(needle));
    if (matches.length === 0) {
      summary.unmatched.push({ reason: "no_catalog_match", nameContains: entry.nameContains });
      continue;
    }

    // Prefer shortest name match to avoid overly broad hits (e.g. "Row").
    matches.sort((a, b) => String(a.name).length - String(b.name).length);
    const chosen = matches.slice(0, Math.min(2, matches.length));

    for (const exercise of chosen) {
      summary.matched += 1;
      const existing = await pool.query(
        `
          SELECT id FROM exercise_media
          WHERE exercise_id = $1
            AND media_type = 'youtube_video'
            AND youtube_video_id = $2
          LIMIT 1
        `,
        [exercise.id, youtubeVideoId]
      );
      if (existing.rows[0]) {
        summary.skippedExisting += 1;
        continue;
      }

      const row = {
        id: randomUUID(),
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        category: exercise.category,
        youtubeVideoId,
        title: entry.title ?? `${exercise.name} form demo`,
        channelName: entry.channelName ?? "Seed curation",
        status: autoApprove ? "approved" : "pending_review",
      };

      if (dryRun) {
        summary.insertedRows.push(row);
        summary.inserted += 1;
        continue;
      }

      await pool.query(
        `
          INSERT INTO exercise_media (
            id, exercise_id, media_type, youtube_video_id, title, channel_name,
            status, submitted_by, is_primary
          ) VALUES ($1, $2, 'youtube_video', $3, $4, $5, $6, 'seed-script', $7)
        `,
        [
          row.id,
          row.exerciseId,
          row.youtubeVideoId,
          row.title,
          row.channelName,
          row.status,
          autoApprove,
        ]
      );
      summary.insertedRows.push(row);
      summary.inserted += 1;
    }
  }

  console.log(JSON.stringify(summary, null, 2));
  console.error(
    dryRun
      ? `Dry run complete: ${summary.inserted} would insert, ${summary.skippedExisting} already exist.`
      : `Seed complete: ${summary.inserted} inserted as ${autoApprove ? "approved" : "pending_review"}, ${summary.skippedExisting} skipped.`
  );
} catch (e) {
  console.error(e?.message ?? e);
  if (String(e?.message ?? "").includes("exercise_media")) {
    console.error("Hint: run scripts/migrations/001_exercise_media.sql first.");
  }
  process.exit(1);
} finally {
  await pool.end();
}
