/**
 * WorkoutX exercise API client (server / scripts only).
 * Docs: https://www.workoutxapp.com/docs.html
 * Auth header: X-WorkoutX-Key
 */

const BASE = "https://api.workoutxapp.com/v1";

export function getWorkoutxApiKey() {
  return String(process.env.WORKOUTX_API_KEY ?? "").trim();
}

export function isWorkoutxConfigured() {
  return Boolean(getWorkoutxApiKey());
}

export async function workoutxRequest(pathWithQuery, { method = "GET" } = {}) {
  const key = getWorkoutxApiKey();
  if (!key) throw new Error("WORKOUTX_API_KEY is not configured.");

  const url = pathWithQuery.startsWith("http")
    ? pathWithQuery
    : `${BASE}${pathWithQuery.startsWith("/") ? "" : "/"}${pathWithQuery}`;

  const res = await fetch(url, {
    method,
    headers: { "X-WorkoutX-Key": key, Accept: "application/json, image/gif, */*" },
  });

  const quotaRemaining = res.headers.get("x-quota-remaining");
  const quotaLimit = res.headers.get("x-quota-limit");

  return { res, quotaRemaining, quotaLimit };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function workoutxJson(pathWithQuery, { retries = 4 } = {}) {
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const { res, quotaRemaining, quotaLimit } = await workoutxRequest(pathWithQuery);
    const body = await res.json().catch(() => null);

    if (res.status === 429) {
      const retryAfterSec = Number(body?.retryAfter ?? res.headers.get("retry-after") ?? 60);
      const waitMs = Math.max(1, retryAfterSec) * 1000 + 500;
      lastError = new Error(body?.message || "WorkoutX rate limit");
      lastError.status = 429;
      lastError.body = body;
      if (attempt === retries) throw lastError;
      await sleep(waitMs);
      continue;
    }

    if (!res.ok) {
      const message = body?.message || body?.error || `WorkoutX HTTP ${res.status}`;
      const err = new Error(message);
      err.status = res.status;
      err.body = body;
      err.quotaRemaining = quotaRemaining;
      throw err;
    }
    return { body, quotaRemaining, quotaLimit };
  }
  throw lastError || new Error("WorkoutX request failed.");
}

/** Free plan currently caps page size at 10 and ~30 req/min; paginate with pacing. */
export async function fetchAllWorkoutxExercises({
  pageSize = 10,
  maxPages = 200,
  minIntervalMs = 2200,
  onPage,
} = {}) {
  const all = [];
  let offset = 0;
  let total = null;
  let lastAt = 0;

  for (let page = 0; page < maxPages; page += 1) {
    const elapsed = Date.now() - lastAt;
    if (lastAt && elapsed < minIntervalMs) {
      await sleep(minIntervalMs - elapsed);
    }
    lastAt = Date.now();

    const { body, quotaRemaining } = await workoutxJson(
      `/exercises?limit=${pageSize}&offset=${offset}`
    );
    const batch = Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : [];
    if (typeof body?.total === "number") total = body.total;
    all.push(...batch);
    if (typeof onPage === "function") {
      onPage({ page, offset, fetched: batch.length, totalSoFar: all.length, total, quotaRemaining });
    }
    if (batch.length === 0) break;
    offset += batch.length;
    if (total != null && all.length >= total) break;
    if (batch.length < pageSize) break;
  }

  return all;
}

export function workoutxGifProxyPath(workoutxId) {
  const id = String(workoutxId ?? "").replace(/\.gif$/i, "").trim();
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) return "";
  return `/api/workoutx/gif/${encodeURIComponent(id)}`;
}

export function extractWorkoutxIdFromGifUrl(gifUrl) {
  const raw = String(gifUrl ?? "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    const parts = url.pathname.split("/").filter(Boolean);
    const last = parts[parts.length - 1] ?? "";
    return last.replace(/\.gif$/i, "");
  } catch {
    return String(raw).replace(/\.gif$/i, "").split("/").pop() ?? "";
  }
}

export function normalizeExerciseName(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[()[\]{}]/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(the|a|an|and|with|for|of|to)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenizeEquipment(value) {
  return new Set(
    String(value ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2)
  );
}

/**
 * Score a catalog exercise against a WorkoutX row.
 * Returns { score, reason } where score is 0..100.
 */
export function scoreWorkoutxMatch(catalog, wx) {
  const a = normalizeExerciseName(catalog?.name);
  const b = normalizeExerciseName(wx?.name);
  if (!a || !b) return { score: 0, reason: "empty" };

  if (a === b) {
    const eqBonus = equipmentOverlapBonus(catalog?.equipment, wx?.equipment);
    return { score: Math.min(100, 92 + eqBonus), reason: "exact_name" };
  }

  if (a.includes(b) || b.includes(a)) {
    const shorter = Math.min(a.length, b.length);
    const longer = Math.max(a.length, b.length);
    const ratio = shorter / longer;
    if (ratio >= 0.72) {
      return {
        score: Math.min(95, Math.round(70 + ratio * 20) + equipmentOverlapBonus(catalog?.equipment, wx?.equipment)),
        reason: "contains",
      };
    }
  }

  const ta = new Set(a.split(" ").filter(Boolean));
  const tb = new Set(b.split(" ").filter(Boolean));
  if (!ta.size || !tb.size) return { score: 0, reason: "no_tokens" };
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  const union = new Set([...ta, ...tb]).size;
  const jaccard = inter / union;
  const eqBonus = equipmentOverlapBonus(catalog?.equipment, wx?.equipment);
  // Variant mismatches (incline/decline/close-grip) often share 2 tokens with a generic move —
  // require stronger overlap before accepting.
  if (jaccard >= 0.72 && inter >= 3) {
    return {
      score: Math.min(90, Math.round(58 + jaccard * 30) + eqBonus),
      reason: "token_overlap",
    };
  }
  if (jaccard >= 0.8 && inter >= 2 && eqBonus > 0) {
    return {
      score: Math.min(86, Math.round(60 + jaccard * 25) + eqBonus),
      reason: "token_equipment",
    };
  }

  return { score: 0, reason: "no_match" };
}

function equipmentOverlapBonus(catalogEq, wxEq) {
  const a = tokenizeEquipment(catalogEq);
  const b = tokenizeEquipment(wxEq);
  if (!a.size || !b.size) return 0;
  let hit = 0;
  for (const t of a) if (b.has(t)) hit += 1;
  return hit > 0 ? 4 : -2;
}

export function findBestWorkoutxMatch(catalogExercise, workoutxExercises) {
  let best = null;
  for (const wx of workoutxExercises) {
    const scored = scoreWorkoutxMatch(catalogExercise, wx);
    if (scored.score <= 0) continue;
    if (!best || scored.score > best.score) {
      best = { wx, ...scored };
    }
  }
  return best;
}
