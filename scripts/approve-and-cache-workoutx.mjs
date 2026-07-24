#!/usr/bin/env node
/**
 * Testing mode: approve all WorkoutX-linked exercise_media rows and cache GIF bytes.
 *
 * - Approves pending WorkoutX image rows
 * - Sets is_primary when the exercise has no other approved primary
 * - Downloads each GIF once via WorkoutX API and stores:
 *     1) Vercel Blob (if BLOB_READ_WRITE_TOKEN is set) → cached_image_url
 *     2) else local storage/workoutx-gifs/{id}.gif (gitignored)
 *
 * Subscription / permanent licensing still deferred for production.
 *
 * Usage:
 *   node --env-file=.env.local scripts/approve-and-cache-workoutx.mjs
 *   node --env-file=.env.local scripts/approve-and-cache-workoutx.mjs --approve-only
 *   node --env-file=.env.local scripts/approve-and-cache-workoutx.mjs --limit=20
 */
import { mkdir, writeFile, access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { put } from "@vercel/blob";
import { extractWorkoutxIdFromGifUrl, workoutxRequest } from "../app/lib/workoutx.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const cacheDir = path.join(root, "storage", "workoutx-gifs");
const approveOnly = process.argv.includes("--approve-only");
const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const limit = limitArg ? Math.max(1, Number(limitArg.split("=")[1]) || 0) : 0;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}
if (!approveOnly && !process.env.WORKOUTX_API_KEY) {
  console.error("WORKOUTX_API_KEY is required unless --approve-only.");
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const hasBlob = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

async function ensureCacheSchema() {
  await pool.query(`ALTER TABLE exercise_media ADD COLUMN IF NOT EXISTS cached_image_url TEXT`);
}

async function approveAllWorkoutx() {
  const approved = await pool.query(
    `
      UPDATE exercise_media
      SET status = 'approved',
          reviewed_by = COALESCE(reviewed_by, 'workoutx-testing-approve'),
          reviewed_at = COALESCE(reviewed_at, NOW()),
          updated_at = NOW()
      WHERE media_type = 'image'
        AND (
          image_url LIKE '/api/workoutx/gif/%'
          OR channel_name ILIKE '%workoutx%'
          OR submitted_by = 'workoutx-seed'
        )
        AND status <> 'approved'
      RETURNING id, exercise_id, image_url
    `
  );

  // Promote WorkoutX to primary only when exercise has no approved primary yet
  const promoted = await pool.query(
    `
      UPDATE exercise_media m
      SET is_primary = true, updated_at = NOW()
      WHERE m.media_type = 'image'
        AND m.status = 'approved'
        AND m.is_primary = false
        AND (
          m.image_url LIKE '/api/workoutx/gif/%'
          OR m.channel_name ILIKE '%workoutx%'
          OR m.submitted_by = 'workoutx-seed'
        )
        AND NOT EXISTS (
          SELECT 1 FROM exercise_media o
          WHERE o.exercise_id = m.exercise_id
            AND o.status = 'approved'
            AND o.is_primary = true
            AND o.id <> m.id
        )
      RETURNING id, exercise_id
    `
  );

  return { newlyApproved: approved.rowCount, promotedPrimary: promoted.rowCount };
}

async function listWorkoutxRows() {
  const { rows } = await pool.query(
    `
      SELECT id, exercise_id, image_url, cached_image_url, status, is_primary, title
      FROM exercise_media
      WHERE media_type = 'image'
        AND image_url LIKE '/api/workoutx/gif/%'
      ORDER BY created_at ASC
    `
  );
  return limit > 0 ? rows.slice(0, limit) : rows;
}

async function downloadGif(wxId) {
  const { res } = await workoutxRequest(`/gifs/${wxId}.gif`);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GIF ${wxId} HTTP ${res.status}: ${text.slice(0, 120)}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get("content-type") || "image/gif";
  return { buf, contentType };
}

async function cacheOne(row) {
  const wxId = extractWorkoutxIdFromGifUrl(row.image_url);
  if (!wxId) return { ok: false, reason: "bad-id" };
  if (row.cached_image_url && String(row.cached_image_url).startsWith("http")) {
    return { ok: true, skipped: true, wxId, url: row.cached_image_url };
  }

  const localPath = path.join(cacheDir, `${wxId}.gif`);
  let buf = null;
  let contentType = "image/gif";
  let fromUpstream = false;

  try {
    await access(localPath);
    buf = await readFile(localPath);
  } catch {
    // need download
  }

  if (!buf) {
    const downloaded = await downloadGif(wxId);
    buf = downloaded.buf;
    contentType = downloaded.contentType;
    await mkdir(cacheDir, { recursive: true });
    await writeFile(localPath, buf);
    fromUpstream = true;
  }

  let cachedUrl = `/api/workoutx/gif/${wxId}`;
  if (hasBlob) {
    const blob = await put(`workoutx-gifs/${wxId}.gif`, buf, {
      access: "public",
      contentType,
      token: process.env.BLOB_READ_WRITE_TOKEN,
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    cachedUrl = blob.url;
  }

  await pool.query(
    `UPDATE exercise_media
     SET cached_image_url = $2,
         image_attribution = COALESCE(image_attribution, 'Animation via WorkoutX API · testing cache'),
         updated_at = NOW()
     WHERE id = $1`,
    [row.id, cachedUrl]
  );

  return { ok: true, wxId, bytes: buf.length, cachedUrl, blob: hasBlob, fromUpstream };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const summary = {
  approveOnly,
  hasBlob,
  newlyApproved: 0,
  promotedPrimary: 0,
  cached: 0,
  skipped: 0,
  failed: 0,
  errors: [],
};

try {
  await ensureCacheSchema();
  const approveResult = await approveAllWorkoutx();
  summary.newlyApproved = approveResult.newlyApproved;
  summary.promotedPrimary = approveResult.promotedPrimary;
  console.log(`Approved ${summary.newlyApproved} row(s); promoted ${summary.promotedPrimary} to primary.`);

  if (approveOnly) {
    console.log(JSON.stringify(summary, null, 2));
    process.exit(0);
  }

  const rows = await listWorkoutxRows();
  console.log(`Caching ${rows.length} WorkoutX GIF(s)${hasBlob ? " → Vercel Blob" : " → storage/workoutx-gifs"}…`);

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    try {
      const result = await cacheOne(row);
      if (result.skipped) summary.skipped += 1;
      else summary.cached += 1;
      if ((i + 1) % 10 === 0 || i === rows.length - 1) {
        console.log(`  ${i + 1}/${rows.length} (cached=${summary.cached}, skipped=${summary.skipped}, failed=${summary.failed})`);
      }
      // Pace only when we hit WorkoutX upstream
      if (!result.skipped && result.fromUpstream) await sleep(2200);
      else if (!result.skipped) await sleep(150);
    } catch (err) {
      summary.failed += 1;
      if (summary.errors.length < 12) {
        summary.errors.push({ id: row.id, url: row.image_url, error: err.message });
      }
      console.warn(`  fail ${row.image_url}: ${err.message}`);
      await sleep(3000);
    }
  }

  console.log(JSON.stringify(summary, null, 2));
} finally {
  await pool.end();
}
