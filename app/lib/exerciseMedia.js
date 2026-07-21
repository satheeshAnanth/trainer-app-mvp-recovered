import { randomUUID } from "crypto";
import { hasDatabaseUrl, query } from "./db";

function mapMediaRow(row) {
  if (!row) return null;
  if (row.media_type === "youtube_video") {
    return {
      type: "youtube_video",
      youtubeVideoId: row.youtube_video_id,
      title: row.title ?? "",
      channelName: row.channel_name ?? "",
      thumbnailUrl: row.youtube_video_id
        ? `https://i.ytimg.com/vi/${row.youtube_video_id}/hqdefault.jpg`
        : "",
    };
  }
  if (row.media_type === "image") {
    return {
      type: "image",
      imageUrl: row.image_url ?? "",
      title: row.title ?? "",
      attribution: row.image_attribution ?? "",
      channelName: row.channel_name ?? "",
    };
  }
  return null;
}

export function extractYoutubeVideoId(value) {
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
    if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
      const v = url.searchParams.get("v");
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
      const parts = url.pathname.split("/").filter(Boolean);
      const embedIndex = parts.findIndex((p) => p === "embed" || p === "shorts" || p === "live");
      if (embedIndex >= 0) {
        const id = parts[embedIndex + 1] ?? "";
        return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : "";
      }
    }
  } catch {
    return "";
  }
  return "";
}

export async function fetchPrimaryMediaForExercises(exerciseIds) {
  const ids = [...new Set((exerciseIds ?? []).filter(Boolean))];
  if (!ids.length || !hasDatabaseUrl()) return new Map();

  try {
    const rows = await query(
      `
        SELECT DISTINCT ON (exercise_id)
          exercise_id, media_type, youtube_video_id, title, channel_name,
          image_url, image_attribution, is_primary
        FROM exercise_media
        WHERE exercise_id = ANY($1::text[])
          AND status = 'approved'
        ORDER BY exercise_id, is_primary DESC, updated_at DESC
      `,
      [ids]
    );
    const map = new Map();
    for (const row of rows) {
      map.set(row.exercise_id, mapMediaRow(row));
    }
    return map;
  } catch {
    return new Map();
  }
}

export async function fetchWorkoutxMediaForExercises(exerciseIds) {
  const ids = [...new Set((exerciseIds ?? []).filter(Boolean))];
  if (!ids.length || !hasDatabaseUrl()) return new Map();

  try {
    const rows = await query(
      `
        SELECT DISTINCT ON (exercise_id)
          exercise_id, media_type, youtube_video_id, title, channel_name,
          image_url, image_attribution, is_primary
        FROM exercise_media
        WHERE exercise_id = ANY($1::text[])
          AND status = 'approved'
          AND media_type = 'image'
          AND image_url LIKE '/api/workoutx/gif/%'
        ORDER BY exercise_id, is_primary DESC, updated_at DESC
      `,
      [ids]
    );
    const map = new Map();
    for (const row of rows) map.set(row.exercise_id, mapMediaRow(row));
    return map;
  } catch {
    return new Map();
  }
}

export async function fetchApprovedMediaForExercise(exerciseId) {
  if (!exerciseId || !hasDatabaseUrl()) return [];

  try {
    const rows = await query(
      `
        SELECT id, media_type, youtube_video_id, title, channel_name,
               image_url, image_attribution, is_primary
        FROM exercise_media
        WHERE exercise_id = $1 AND status = 'approved'
        ORDER BY is_primary DESC, updated_at DESC
      `,
      [exerciseId]
    );
    return rows.map((row) => ({ id: row.id, ...mapMediaRow(row), isPrimary: row.is_primary }));
  } catch {
    return [];
  }
}

export function buildMediaSummary(primaryMedia, totalCount) {
  return {
    primaryMedia: primaryMedia ?? null,
    hasMore: totalCount > 1,
  };
}

export async function listExerciseMediaAdmin({ status = "pending_review", limit = 50 } = {}) {
  if (!hasDatabaseUrl()) return { items: [], source: "mock" };

  const allowed = new Set(["pending_review", "approved", "rejected", "all"]);
  const statusFilter = allowed.has(status) ? status : "pending_review";
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);

  const rows = await query(
    `
      SELECT
        m.id,
        m.exercise_id,
        m.media_type,
        m.youtube_video_id,
        m.title,
        m.channel_name,
        m.image_url,
        m.image_attribution,
        m.status,
        m.is_primary,
        m.submitted_by,
        m.reviewed_by,
        m.reviewed_at,
        m.created_at,
        m.updated_at,
        e.name AS exercise_name,
        e.category AS exercise_category,
        e.equipment AS exercise_equipment
      FROM exercise_media m
      LEFT JOIN master_exercises e ON e.id = m.exercise_id
      WHERE ($1::text = 'all' OR m.status = $1)
      ORDER BY
        CASE m.status
          WHEN 'pending_review' THEN 0
          WHEN 'approved' THEN 1
          ELSE 2
        END,
        m.updated_at DESC
      LIMIT $2
    `,
    [statusFilter, safeLimit]
  );

  return {
    source: "database",
    items: rows.map((row) => ({
      id: row.id,
      exerciseId: row.exercise_id,
      exerciseName: row.exercise_name ?? row.exercise_id,
      category: row.exercise_category ?? "",
      equipment: row.exercise_equipment ?? "",
      status: row.status,
      isPrimary: Boolean(row.is_primary),
      submittedBy: row.submitted_by ?? "",
      reviewedBy: row.reviewed_by ?? "",
      reviewedAt: row.reviewed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      media: mapMediaRow(row),
    })),
  };
}

export async function submitExerciseMedia({
  exerciseId,
  youtubeUrlOrId = "",
  imageUrl = "",
  title = "",
  channelName = "",
  imageAttribution = "",
  submittedBy = "admin",
  status = "pending_review",
  isPrimary = false,
} = {}) {
  if (!hasDatabaseUrl()) {
    throw new Error("DATABASE_URL is required to submit exercise media.");
  }

  const id = randomUUID();
  const youtubeVideoId = extractYoutubeVideoId(youtubeUrlOrId);
  const cleanImageUrl = String(imageUrl ?? "").trim();

  let mediaType = "";
  if (youtubeVideoId) mediaType = "youtube_video";
  else if (cleanImageUrl && /^https?:\/\//i.test(cleanImageUrl)) mediaType = "image";
  else throw new Error("Provide a valid YouTube URL/ID or image URL.");

  if (isPrimary && status === "approved") {
    await query(
      `
        UPDATE exercise_media
        SET is_primary = false, updated_at = now()
        WHERE exercise_id = $1 AND status = 'approved' AND is_primary = true
      `,
      [exerciseId]
    );
  }

  const rows = await query(
    `
      INSERT INTO exercise_media (
        id, exercise_id, media_type, youtube_video_id, title, channel_name,
        image_url, image_attribution, status, submitted_by, is_primary
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id, exercise_id, media_type, youtube_video_id, title, channel_name,
                image_url, image_attribution, status, is_primary, created_at
    `,
    [
      id,
      exerciseId,
      mediaType,
      mediaType === "youtube_video" ? youtubeVideoId : null,
      title || null,
      channelName || null,
      mediaType === "image" ? cleanImageUrl : null,
      mediaType === "image" ? imageAttribution || null : null,
      status,
      submittedBy || null,
      Boolean(isPrimary),
    ]
  );

  return rows[0];
}

export async function reviewExerciseMedia({
  id,
  action,
  isPrimary = false,
  reviewedBy = "admin",
} = {}) {
  if (!hasDatabaseUrl()) {
    throw new Error("DATABASE_URL is required to review exercise media.");
  }

  const nextStatus = action === "approve" ? "approved" : action === "reject" ? "rejected" : "";
  if (!nextStatus) throw new Error("action must be approve or reject.");

  const existing = await query(
    `
      SELECT id, exercise_id, status
      FROM exercise_media
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );
  if (!existing[0]) throw new Error("Media row not found.");

  if (nextStatus === "approved" && isPrimary) {
    await query(
      `
        UPDATE exercise_media
        SET is_primary = false, updated_at = now()
        WHERE exercise_id = $1 AND status = 'approved' AND is_primary = true AND id <> $2
      `,
      [existing[0].exercise_id, id]
    );
  }

  const rows = await query(
    `
      UPDATE exercise_media
      SET
        status = $2,
        is_primary = CASE WHEN $2 = 'approved' THEN $3 ELSE false END,
        reviewed_by = $4,
        reviewed_at = now(),
        updated_at = now()
      WHERE id = $1
      RETURNING id, exercise_id, status, is_primary, reviewed_by, reviewed_at
    `,
    [id, nextStatus, Boolean(isPrimary), reviewedBy || null]
  );

  return rows[0];
}

export async function fetchCategoryAnchorExercises({ perCategory = 3 } = {}) {
  if (!hasDatabaseUrl()) return [];

  const rows = await query(
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
      SELECT id, name, category, equipment, form_quality
      FROM ranked
      WHERE rank_in_category <= $1
      ORDER BY category, rank_in_category, name
    `,
    [Math.min(Math.max(Number(perCategory) || 3, 1), 10)]
  );
  return rows;
}
