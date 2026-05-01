import { NextResponse } from "next/server";
import { getRequiredLoggingKeys, searchMasterExercises } from "app/lib/exerciseCatalog";
import { hasDatabaseUrl } from "app/lib/db";

const MOCK_ITEMS = [
  { id: "mock_treadmill", name: "Treadmill Walk", category: "Cardio", requiredKeys: ["duration_minutes", "incline_percent", "distance_km"] },
  { id: "mock_squat", name: "Goblet Squat", category: "Strength", requiredKeys: ["sets", "reps", "load"] },
];

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  const withKeys = searchParams.get("withKeys") === "1";

  if (!hasDatabaseUrl()) {
    const filtered = q
      ? MOCK_ITEMS.filter((item) => item.name.toLowerCase().includes(q.toLowerCase()))
      : MOCK_ITEMS;
    return NextResponse.json({
      ok: true,
      recovered: true,
      route: "api/exercises/master/search",
      data: { exercises: filtered, source: "mock" },
    });
  }

  const rows = await searchMasterExercises(q, 30);
  let exercises = rows.map((row) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    equipment: row.equipment,
    importantInputFields: safeParseArray(row.important_input_fields_json),
    imageUrl: extractImageUrl(row.tracking_json),
  }));

  if (withKeys && exercises.length > 0) {
    exercises = await Promise.all(
      exercises.map(async (ex) => ({
        ...ex,
        requiredKeys: await getRequiredLoggingKeys(ex.id),
      }))
    );
  }

  return NextResponse.json({
    ok: true,
    recovered: true,
    route: "api/exercises/master/search",
    data: { exercises, source: "database" },
  });
}

function safeParseArray(text) {
  if (!text || typeof text !== "string") return [];
  try {
    const v = JSON.parse(text);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function safeParseObject(text) {
  if (!text || typeof text !== "string") return null;
  try {
    const value = JSON.parse(text);
    return value && typeof value === "object" ? value : null;
  } catch {
    return null;
  }
}

function extractImageUrl(trackingJson) {
  const obj = safeParseObject(trackingJson);
  if (!obj) return "";
  const keys = ["imageUrl", "image_url", "thumbnailUrl", "thumbnail_url", "image", "thumbnail"];
  for (const key of keys) {
    const value = String(obj[key] ?? "").trim();
    if (value && /^https?:\/\//i.test(value)) return value;
  }
  return deepFindImageUrl(obj);
}

function deepFindImageUrl(value) {
  if (!value) return "";
  if (typeof value === "string") {
    const text = value.trim();
    if (/^https?:\/\//i.test(text) && /\.(png|jpe?g|webp|gif|avif)(\?.*)?$/i.test(text)) return text;
    return "";
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = deepFindImageUrl(item);
      if (found) return found;
    }
    return "";
  }
  if (typeof value === "object") {
    for (const key of Object.keys(value)) {
      const found = deepFindImageUrl(value[key]);
      if (found) return found;
    }
  }
  return "";
}
