import { getRequiredLoggingKeys } from "./exerciseCatalog";
import { metricsSatisfyRequired } from "./metricKeys";

const SECTION_KEYS = ["warmup", "mainWork", "cooldown", "goalUpdate"];

/** Statuses where mandatory sections + exercise metrics must pass API validation. */
export function requiresFullTrainerPayload(status) {
  const s = (status ?? "").toLowerCase();
  return s === "completed" || s === "signed_off" || s === "trainer_review";
}

function sectionsComplete(sections) {
  const missing = [];
  for (const key of SECTION_KEYS) {
    const v = sections?.[key];
    if (typeof v !== "string" || v.trim().length === 0) {
      missing.push(key);
    }
  }
  return { ok: missing.length === 0, missing };
}

function exercisesShapeOk(exercises) {
  if (!Array.isArray(exercises)) {
    return { ok: false, message: "payload.exercises must be an array." };
  }
  if (exercises.length === 0) {
    return { ok: false, message: "At least one exercise is required for a completed session." };
  }
  return { ok: true };
}

/**
 * Validates trainer session body for non-draft saves.
 * @param {object} body - request JSON (expects payload, status)
 * @param {{ skipDb?: boolean }} options - when true, do not resolve exerciseId requirements from DB (mock / tests)
 */
export async function validateTrainerSessionBody(body, options = {}) {
  const status = body?.status ?? "draft";
  if (!requiresFullTrainerPayload(status)) {
    return { ok: true };
  }

  const payload = body?.payload && typeof body.payload === "object" ? body.payload : {};
  const sections = payload.sections && typeof payload.sections === "object" ? payload.sections : {};

  const sec = sectionsComplete(sections);
  if (!sec.ok) {
    return {
      ok: false,
      message: "Mandatory note sections are incomplete.",
      details: { missingSections: sec.missing },
    };
  }

  const exercises = payload.exercises;
  const exCheck = exercisesShapeOk(exercises);
  if (!exCheck.ok) {
    return { ok: false, message: exCheck.message, details: { exercises: exercises } };
  }

  const skipDb = options.skipDb === true;
  for (let i = 0; i < exercises.length; i += 1) {
    const ex = exercises[i];
    const metrics = ex?.metrics && typeof ex.metrics === "object" ? ex.metrics : {};
    let required = Array.isArray(ex?.metricRequired) ? [...ex.metricRequired] : [];

    if (ex?.exerciseId && !skipDb) {
      const fromDb = await getRequiredLoggingKeys(ex.exerciseId);
      required = [...new Set([...required, ...fromDb])];
    }

    if (required.length === 0) {
      const label = ex?.name || ex?.exerciseId || `exercise[${i}]`;
      return {
        ok: false,
        message: `Exercise "${label}" has no required metrics defined; add exerciseId or metricRequired.`,
        details: { index: i, exercise: ex },
      };
    }

    const m = metricsSatisfyRequired(metrics, required);
    if (!m.ok) {
      const label = ex?.name || ex?.exerciseId || `exercise[${i}]`;
      return {
        ok: false,
        message: `Missing or empty metrics for "${label}": ${m.missing.join(", ")}`,
        details: { index: i, missingMetrics: m.missing },
      };
    }
  }

  return { ok: true };
}

export function shouldValidateTrainerSession(body) {
  return requiresFullTrainerPayload(body?.status);
}
