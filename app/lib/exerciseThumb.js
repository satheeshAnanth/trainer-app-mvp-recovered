/** Category short labels + SVG glyph keys for exercise list affordances. */

const CATEGORY_META = {
  Legs: { short: "LG", hue: "#34d399" },
  Back: { short: "BK", hue: "#60a5fa" },
  Core: { short: "CR", hue: "#fbbf24" },
  Chest: { short: "CH", hue: "#f87171" },
  Functional: { short: "FN", hue: "#a78bfa" },
  Outdoor: { short: "OD", hue: "#4ade80" },
  Arms: { short: "AR", hue: "#fb923c" },
  "Mobility/Warm-up": { short: "MB", hue: "#2dd4bf" },
  Shoulders: { short: "SH", hue: "#38bdf8" },
  Cardio: { short: "CD", hue: "#e879f9" },
  "Bodyweight/Calisthenics": { short: "BW", hue: "#94a3b8" },
};

export function getCategoryMeta(category) {
  const key = String(category ?? "").trim();
  return CATEGORY_META[key] ?? { short: "EX", hue: "#64748b" };
}

export function resolveExerciseThumb(exercise) {
  const media = exercise?.media?.primaryMedia ?? null;
  if (media?.type === "youtube_video") {
    const url = media.thumbnailUrl
      || (media.youtubeVideoId ? `https://i.ytimg.com/vi/${media.youtubeVideoId}/hqdefault.jpg` : "");
    if (url) return { kind: "image", src: url, alt: media.title || exercise?.name || "Exercise" };
  }
  if (media?.type === "image" && media.imageUrl) {
    return { kind: "image", src: media.imageUrl, alt: media.title || exercise?.name || "Exercise" };
  }
  const meta = getCategoryMeta(exercise?.category);
  return { kind: "category", short: meta.short, hue: meta.hue, label: exercise?.category || "Exercise" };
}
