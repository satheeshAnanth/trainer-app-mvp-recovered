import { NextResponse } from "next/server";
import {
  extractWorkoutxIdFromGifUrl,
  getWorkoutxApiKey,
  workoutxRequest,
} from "app/lib/workoutx";

export const runtime = "nodejs";

/**
 * Proxies WorkoutX GIFs so the API key never ships to the client.
 * Cached at the edge/CDN when possible to protect monthly quota.
 */
export async function GET(_request, context) {
  const rawId = context?.params?.id ?? "";
  const id = extractWorkoutxIdFromGifUrl(String(Array.isArray(rawId) ? rawId[0] : rawId));
  if (!id || !/^[a-zA-Z0-9_-]{1,32}$/.test(id)) {
    return NextResponse.json({ ok: false, message: "Invalid gif id." }, { status: 400 });
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
      headers: {
        "Content-Type": res.headers.get("content-type") || "image/gif",
        "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error?.message ?? "Unable to load gif." },
      { status: 502 }
    );
  }
}
