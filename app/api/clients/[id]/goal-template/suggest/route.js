import { NextResponse } from "next/server";
import { buildExerciseWarnings } from "app/lib/coachSafety";
import { hasDatabaseUrl } from "app/lib/db";
import { searchMasterExercises } from "app/lib/exerciseCatalog";
import { readTrainerPhone } from "app/lib/session";
import { requireTrainerOwnsClient } from "app/lib/ownership";

const OUTCOME_QUERIES = {
  strength: ["Goblet Squat", "Romanian Deadlift", "Bench Press", "Seated Cable Row", "Overhead Press", "Plank"],
  fat_loss: ["Goblet Squat", "Push-up", "Mountain Climber", "Farmer Carry", "Air Bike", "Dead Bug"],
  mobility: ["Cat Cow", "World Greatest Stretch", "Hip Thrust", "Ankle Mobility", "Dead Bug", "Plank"],
  sport: ["Reverse Lunge", "Hip Thrust", "Pull-up", "Farmer Carry", "Medicine Ball", "Plank"],
  rehab: ["Glute Bridge", "Dead Bug", "Side Plank", "Bike", "Face Pull", "Box Squat"],
  general: ["Goblet Squat", "Push-up", "Seated Cable Row", "Hip Thrust", "Plank", "Farmer Carry"],
};

function frequencyFromAvailability(value) {
  const n = Number(value);
  if (n >= 4) return "every_session";
  if (n === 3) return "3x_week";
  if (n === 2) return "2x_week";
  return "1x_week";
}

function targetFromOutcome(outcome) {
  if (outcome === "mobility") return "2-3 sets · controlled range";
  if (outcome === "fat_loss") return "3 × 10-12 progressive effort";
  if (outcome === "rehab") return "2-3 sets · pain-free range";
  return "3 × 8-10 progressive load";
}

async function resolveExercise(name) {
  const rows = await searchMasterExercises(name, 5);
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const needle = String(name).toLowerCase();
  const exact = rows.find((row) => String(row.name || "").toLowerCase().includes(needle));
  return exact || rows[0];
}

async function maybeLlmRefine(payload, fallbackExercises) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { exercises: fallbackExercises, model: "rule-based" };
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_ASSESSMENT_MODEL || "gpt-4o-mini",
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "You are a coaching assistant. Return strict JSON { exercises: [{ masterExerciseId, exercise, target, frequency, priority, rationale }] }. Only use exercise IDs from the provided catalogCandidates. Max 8 exercises. priority is mandatory|optional. Do not invent loads.",
          },
          {
            role: "user",
            content: JSON.stringify({
              questionnaire: payload,
              catalogCandidates: fallbackExercises.map((item) => ({
                masterExerciseId: item.masterExerciseId,
                exercise: item.exercise,
                category: item.category,
              })),
            }),
          },
        ],
      }),
    });
    if (!response.ok) return { exercises: fallbackExercises, model: "rule-based" };
    const json = await response.json();
    const raw = json?.choices?.[0]?.message?.content ?? "";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return { exercises: fallbackExercises, model: "rule-based" };
    const parsed = JSON.parse(match[0]);
    const allowed = new Map(fallbackExercises.map((item) => [String(item.masterExerciseId), item]));
    const refined = (Array.isArray(parsed.exercises) ? parsed.exercises : [])
      .map((item) => {
        const base = allowed.get(String(item.masterExerciseId));
        if (!base) return null;
        return {
          ...base,
          target: String(item.target || base.target),
          frequency: String(item.frequency || base.frequency),
          priority: item.priority === "optional" ? "optional" : "mandatory",
          rationale: String(item.rationale || base.rationale || ""),
        };
      })
      .filter(Boolean)
      .slice(0, 8);
    return { exercises: refined.length ? refined : fallbackExercises, model: "openai" };
  } catch {
    return { exercises: fallbackExercises, model: "rule-based" };
  }
}

export async function POST(request, { params }) {
  const { id } = params;
  const phone = readTrainerPhone(request.cookies.get("trainer_session")?.value);
  if (!phone) {
    return NextResponse.json({ ok: false, message: "Login required." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const outcome = String(body?.outcome || "general").trim().toLowerCase();
  const successTarget = String(body?.successTarget || "").trim();
  const sessionsPerWeek = String(body?.sessionsPerWeek || "3").trim();
  const constraints = String(body?.constraints || "").trim();
  const goalName = String(body?.goalName || successTarget || outcome).trim();

  if (!hasDatabaseUrl()) {
    return NextResponse.json({ ok: false, message: "Database unavailable." }, { status: 503 });
  }

  const owned = await requireTrainerOwnsClient(phone, id);
  if (!owned) {
    return NextResponse.json({ ok: false, message: "Client not found." }, { status: 404 });
  }

  const client = {
    id: owned.id,
    name: owned.name,
    goal: owned.goal,
    prior_condition: owned.prior_condition ?? "",
  };

  const queries = OUTCOME_QUERIES[outcome] || OUTCOME_QUERIES.general;
  const frequency = frequencyFromAvailability(sessionsPerWeek);
  const target = targetFromOutcome(outcome);
  const priorCondition = String(client.prior_condition || constraints || "");

  const resolved = [];
  for (const name of queries) {
    const exercise = await resolveExercise(name);
    if (!exercise) continue;
    if (resolved.some((item) => item.masterExerciseId === exercise.id)) continue;
    resolved.push({
      id: crypto.randomUUID(),
      masterExerciseId: String(exercise.id),
      exercise: String(exercise.name || name),
      variation: "",
      target,
      frequency,
      priority: resolved.length < 4 ? "mandatory" : "optional",
      category: exercise.category || "",
      rationale: `Mapped for ${outcome.replace(/_/g, " ")} focus.`,
      imageUrl: "",
    });
    if (resolved.length >= 8) break;
  }

  const refined = await maybeLlmRefine(
    { outcome, successTarget, sessionsPerWeek, constraints, goalName, priorCondition },
    resolved
  );

  const exercises = refined.exercises.map((item) => ({
    ...item,
    warnings: buildExerciseWarnings({
      exerciseName: item.exercise,
      goalText: goalName || client.goal || "",
      priorCondition,
    }),
  }));

  return NextResponse.json({
    ok: true,
    data: {
      goalName: goalName || client.goal || "Proposed goal template",
      model: refined.model,
      note: "Review each exercise before saving. Warnings are guidance only.",
      exercises,
    },
  });
}
