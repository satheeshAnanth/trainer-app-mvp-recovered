#!/usr/bin/env node
/**
 * Check approved YouTube exercise media for link rot via oEmbed.
 *
 * Usage:
 *   DATABASE_URL=... node scripts/check-exercise-media-links.mjs
 *   DATABASE_URL=... node scripts/check-exercise-media-links.mjs --dry-run
 *   DATABASE_URL=... node scripts/check-exercise-media-links.mjs --mark-broken
 */
import pg from "pg";

const dryRun = process.argv.includes("--dry-run");
const markBroken = process.argv.includes("--mark-broken");

async function checkOEmbed(videoId) {
  const url = `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`;
  const res = await fetch(url, { method: "GET" });
  return { ok: res.ok, status: res.status };
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const { rows } = await client.query(
    `
      SELECT id, exercise_id, youtube_video_id, title, status
      FROM exercise_media
      WHERE media_type = 'youtube_video'
        AND youtube_video_id IS NOT NULL
        AND status IN ('approved', 'pending_review')
      ORDER BY updated_at DESC
      LIMIT 500
    `
  );

  const broken = [];
  const healthy = [];

  for (const row of rows) {
    try {
      const result = await checkOEmbed(row.youtube_video_id);
      if (result.ok) healthy.push(row);
      else broken.push({ ...row, httpStatus: result.status });
    } catch (error) {
      broken.push({ ...row, httpStatus: 0, error: error.message });
    }
  }

  console.log(
    JSON.stringify(
      {
        checked: rows.length,
        healthy: healthy.length,
        broken: broken.length,
        brokenSample: broken.slice(0, 20).map((r) => ({
          id: r.id,
          exercise_id: r.exercise_id,
          youtube_video_id: r.youtube_video_id,
          httpStatus: r.httpStatus,
        })),
        dryRun,
        markBroken,
      },
      null,
      2
    )
  );

  if (markBroken && !dryRun && broken.length) {
    for (const row of broken) {
      await client.query(
        `
          UPDATE exercise_media
          SET status = 'rejected',
              is_primary = false,
              channel_name = COALESCE(channel_name, '') || ' [auto: link-rot]',
              updated_at = now()
          WHERE id = $1
        `,
        [row.id]
      );
    }
    console.log(`Marked ${broken.length} row(s) rejected due to link rot.`);
  }

  await client.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
