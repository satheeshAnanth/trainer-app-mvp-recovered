export function parseSessionPayload(raw) {
  if (!raw) return {};
  if (typeof raw === "object") return { ...raw };
  if (typeof raw === "string") {
    try {
      const v = JSON.parse(raw);
      return typeof v === "object" && v !== null ? v : {};
    } catch {
      return {};
    }
  }
  return {};
}

/** Shallow-merge payload patch into existing session payload (nested sections merge). */
export function mergeSessionPayload(existingRaw, patch) {
  const base = parseSessionPayload(existingRaw);
  if (!patch || typeof patch !== "object") {
    return base;
  }
  const next = { ...base, ...patch };
  if (base.sections || patch.sections) {
    next.sections = { ...base.sections, ...patch.sections };
  }
  if (patch.exercises !== undefined) {
    next.exercises = patch.exercises;
  }
  return next;
}
