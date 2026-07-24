import { NextResponse } from "next/server";
import { readFile, access } from "node:fs/promises";
import path from "node:path";
import {
  extractWorkoutxIdFromGifUrl,
  getWorkoutxApiKey,
  workoutxRequest,
} from "app/lib/workoutx";
import { hasDatabaseUrl, query } from "app/lib/db";

export const runtime = "nodejs";

const CACHE_HEADERS = {
  "Content-Type": "image/gif",
  "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
  "X-Content-Type-Options": "nosniff",
};

async function lookupCachedUrl(wxId) {
  if (!hasDatabaseUrl()) return null;
  try {
    const rows = await query(
      `
        SELECT cached_image_url
        FROM exercise_media
        WHERE media_type = 'image'
          AND image_url = $1
          AND cached_image_url IS NOT NULL
          AND cached_image_url <> ''
        ORDER BY updated_at DESC
        LIMIT 1
      `,
      [`/api/workoutx/gif/${wxId}`]
    );
    return rows[0]?.cached_image_url ?? null;
  } catch {
    return null;
  }
}

async function readLocalGif(wxId) {
  const filePath = path.join(process.cwd(), "storage", "workoutx-gifs", `${wxId}.gif`);
  try {
    await access(filePath);
    return await readFile(filePath);
  } catch {
    return null;
  }
}

/**
 * Serves WorkoutX GIFs for testing:
 * 1) Redirect to Vercel Blob / remote cached_image_url when present
 * 2) Local storage/workoutx-gifs cache
 * 3) Live WorkoutX API proxy (uses quota)
 */
export async function GET(_request, context) {
  const rawId = context?.params?.id ?? "";
  const id = extractWorkoutxIdFromGifUrl(String(Array.isArray(rawId) ? rawId[0] : rawId));
  if (!id || !/^[a-zA-Z0-9_-]{1,32}$/.test(id)) {
    return NextResponse.json({ ok: false, message: "Invalid gif id." }, { status: 400 });
  }

  const cachedUrl = await lookupCachedUrl(id);
  if (cachedUrl && /^https?:\/\//i.test(cachedUrl)) {
    return NextResponse.redirect(cachedUrl, 302);
  }

  const local = await readLocalGif(id);
  if (local) {
    return new NextResponse(local, {
      status: 200,
      headers: { ...CACHE_HEADERS, "X-WorkoutX-Cache": "local" },
    });
  }

  if (!getWorkoutxApiKey()) {
    return NextResponse.json({ ok: false, message: "WorkoutX is not configured." }, { status: 503 });
  }

  try {
    const { res } = await workoutxRequest(`/gifs/${id}.gif`);
    if (!res.ok) {
      const message = await res.text().catch(() => "");
      return NextResponse.json(
        { ok: false, message: message || `WorkoutX gif HTTP ${res.status}` },
        { status: res.status === 401 ? 502 : res.status }
      );
    }

    const bytes = await res.arrayBuffer();
    return new NextResponse(bytes, {
      status: 200,
      headers: { ...CACHE_HEADERS, "X-WorkoutX-Cache": "upstream" },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error?.message ?? "Unable to load gif." },
      { status: 502 }
    );
  }
}
