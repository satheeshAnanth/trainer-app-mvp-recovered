#!/usr/bin/env node
/**
 * Lists category-anchor exercises that should receive media first.
 *
 * Usage:
 *   DATABASE_URL=... node scripts/list-exercise-media-candidates.mjs
 *   DATABASE_URL=... node scripts/list-exercise-media-candidates.mjs --per-category=3 --write
 */
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const perCategoryArg = args.find((a) => a.startsWith("--per-category="));
const perCategory = Number(perCategoryArg?.split("=")[1] ?? 3);
const shouldWrite = args.includes("--write");

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
      WITH ranked AS (
        SELECT
          id,
          name,
          category,
          equipment,
          form_quality,
          ROW_NUMBER() OVER (
            PARTITION BY COALESCE(NULLIF(TRIM(category), ''), 'Uncategorized')
            ORDER BY
              CASE WHEN LOWER(COALESCE(form_quality, '')) = 'primary' THEN 0 ELSE 1 END,
              name ASC
          ) AS rank_in_category
        FROM master_exercises
        WHERE COALESCE(is_active, 1) = 1
      )
      SELECT
        r.id,
        r.name,
        r.category,
        r.equipment,
        r.form_quality,
        EXISTS (
          SELECT 1 FROM exercise_media m
          WHERE m.exercise_id = r.id AND m.status = 'approved'
        ) AS has_approved_media
      FROM ranked r
      WHERE r.rank_in_category <= $1
      ORDER BY r.category, r.rank_in_category, r.name
    `,
    [Math.min(Math.max(perCategory || 3, 1), 10)]
  );

  const payload = {
    generatedAt: new Date().toISOString(),
    perCategory,
    count: rows.length,
    missingApproved: rows.filter((r) => !r.has_approved_media).length,
    candidates: rows.map((row) => ({
      exerciseId: row.id,
      name: row.name,
      category: row.category,
      equipment: row.equipment,
      formQuality: row.form_quality,
      hasApprovedMedia: Boolean(row.has_approved_media),
    })),
  };

  console.log(JSON.stringify(payload, null, 2));

  if (shouldWrite) {
    const outDir = path.join(__dirname, "data");
    await mkdir(outDir, { recursive: true });
    const outPath = path.join(outDir, "exercise-media-candidates.json");
    await writeFile(outPath, `${JSON.stringify(payload, null, 2)}\n`);
    console.error(`Wrote ${outPath}`);
  }
} catch (e) {
  console.error(e?.message ?? e);
  if (String(e?.message ?? "").includes("exercise_media")) {
    console.error("Hint: run scripts/migrations/001_exercise_media.sql first.");
  }
  process.exit(1);
} finally {
  await pool.end();
}
