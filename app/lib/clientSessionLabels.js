/** Client-facing labels for session / exercise status. */

export function friendlySessionStatus(status) {
  const value = String(status ?? "").toLowerCase();
  if (value === "completed" || value === "signed_off") return { label: "Complete", color: "#34d399" };
  if (value === "client_submitted") return { label: "Awaiting coach review", color: "#facc15" };
  if (value === "pending_notes" || value === "trainer_review") return { label: "Coach finishing notes", color: "#facc15" };
  if (value === "draft") return { label: "In progress", color: "#94a3b8" };
  if (value === "needs_work") return { label: "Needs follow-up", color: "#fb923c" };
  return { label: value ? value.replace(/_/g, " ") : "Updated", color: "#94a3b8" };
}

export function friendlyExerciseStatus(status) {
  const value = String(status ?? "").toLowerCase();
  if (value === "completed") return { label: "Completed", color: "#34d399" };
  if (value === "partial") return { label: "Partial", color: "#facc15" };
  if (value === "skipped") return { label: "Skipped", color: "#f87171" };
  if (value === "planned") return { label: "Planned", color: "#94a3b8" };
  return { label: value || "Logged", color: "#94a3b8" };
}

export function isGoalExercise(exercise) {
  const source = String(exercise?.source ?? "").toLowerCase();
  return source === "goal" || source === "goal_template" || Boolean(exercise?.fromGoal);
}

export function describeExerciseDone(exercise) {
  const actual = String(exercise?.actual ?? exercise?.done ?? "").trim();
  if (actual) return actual;
  const metrics = exercise?.metrics && typeof exercise.metrics === "object" ? exercise.metrics : {};
  const sets = Array.isArray(metrics.setsData) ? metrics.setsData : [];
  if (sets.length) return `${sets.length} set${sets.length === 1 ? "" : "s"}`;
  const load = metrics.load ?? metrics.weight;
  const reps = metrics.reps;
  if (load || reps) return [load && `Load ${load}`, reps && `Reps ${reps}`].filter(Boolean).join(" · ");
  return "";
}
