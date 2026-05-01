/** Normalize metric / field labels for comparison (handles "Duration", "duration_minutes", etc.). */
export function normalizeMetricKey(key) {
  return String(key ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

const SYNONYM_GROUPS = [
  ["duration", "durationminutes", "durationseconds", "durationsecondsperset", "durationminutesper", "durationmin", "durationsec", "time", "elapsed"],
  ["incline", "inclinepercent", "inclinepct", "incline_percent", "grade"],
  ["distance", "distancekm", "distancemiles", "distance_km", "dist"],
  ["sets", "set", "numsets"],
  ["reps", "repsperset", "repetitions", "rep"],
  ["load", "weight", "resistance", "loadkg", "kg", "lbs"],
  ["tempo", "cadence"],
  ["rpe", "effort", "intensity"],
  ["rest", "resttime", "restseconds"],
  ["heartrate", "heartrateavg", "hr", "customhravg"],
  ["calories", "kcal"],
  ["rpm", "speed", "pace", "speedpacerpm"],
  ["rom", "rangeofmotion"],
  ["notes", "note"],
];

const CANONICAL = new Map();
for (const group of SYNONYM_GROUPS) {
  const canonical = group[0];
  for (const term of group) {
    CANONICAL.set(term, canonical);
  }
}

export function canonicalMetricKey(key) {
  const n = normalizeMetricKey(key);
  return CANONICAL.get(n) ?? n;
}

export function metricValuePresent(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "boolean") return true;
  if (typeof value === "string") return value.trim().length > 0;
  return false;
}

/** True if metrics object satisfies every required key (after canonicalization). */
export function metricsSatisfyRequired(metrics, requiredKeys) {
  const provided = new Set();
  for (const mk of Object.keys(metrics ?? {})) {
    if (metricValuePresent(metrics[mk])) {
      provided.add(canonicalMetricKey(mk));
    }
  }
  const missing = [];
  for (const req of requiredKeys) {
    const c = canonicalMetricKey(req);
    if (!provided.has(c)) {
      missing.push(req);
    }
  }
  return { ok: missing.length === 0, missing };
}
