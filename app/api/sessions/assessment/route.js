import { NextResponse } from "next/server";

function buildRuleBasedAssessment(entries, goalEntries) {
  const totalGoals = goalEntries.length;
  const completedGoals = goalEntries.filter((e) => e.completionStatus === "completed").length;
  const partialGoals = goalEntries.filter((e) => e.completionStatus === "partial").length;
  const skippedGoals = goalEntries.filter((e) => e.completionStatus === "skipped").length;
  const unresolvedGoals = goalEntries.filter((e) => !e.completionStatus).length;
  const populatedSets = entries.reduce(
    (acc, entry) =>
      acc +
      (entry.setLogs ?? []).filter((setRow) =>
        Object.values(setRow ?? {}).some((v) => String(v ?? "").trim() !== "")
      ).length,
    0
  );
  const adhocCount = entries.filter((e) => e.source === "adhoc").length;

  let score = 3;
  if (totalGoals > 0) {
    const completionRatio = (completedGoals + partialGoals * 0.5) / totalGoals;
    if (completionRatio >= 0.9) score = 5;
    else if (completionRatio >= 0.7) score = 4;
    else if (completionRatio >= 0.4) score = 3;
    else score = 2;
  }
  if (unresolvedGoals > 0) score = Math.max(1, score - 1);
  if (populatedSets >= 8) score = Math.min(5, score + 1);

  const wentWell = [
    totalGoals > 0
      ? `${completedGoals}/${totalGoals} goal exercises completed${partialGoals ? `, with ${partialGoals} partial completions` : ""}.`
      : "Session captured with non-goal exercise focus.",
    `${populatedSets} sets logged with measurable data.`,
  ];
  if (adhocCount > 0) wentWell.push(`${adhocCount} ad-hoc exercise(s) were captured with context.`);

  const improve = [];
  if (skippedGoals > 0) improve.push(`Plan alternatives for ${skippedGoals} skipped goal exercise(s).`);
  if (unresolvedGoals > 0) improve.push(`Mark completion status for ${unresolvedGoals} pending goal exercise(s).`);
  if (populatedSets < 4) improve.push("Capture more set-level metrics for trend quality.");
  if (improve.length === 0) improve.push("Continue progressive overload with recovery checks next session.");

  return {
    score,
    wentWell: wentWell.slice(0, 3),
    improve: improve.slice(0, 3),
    model: "rule-based",
  };
}

async function maybeGenerateLlmAssessment(entries, goalEntries, fallback) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return fallback;
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
              "You are a fitness coaching QA assistant. Return strict JSON with keys score (1-5 int), wentWell (array of max 3 short bullets), improve (array of max 3 short bullets).",
          },
          {
            role: "user",
            content: JSON.stringify({ entries, goalEntries }),
          },
        ],
      }),
    });
    if (!response.ok) return fallback;
    const json = await response.json();
    const raw = json?.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(raw);
    const score = Math.max(1, Math.min(5, Number(parsed?.score || fallback.score)));
    return {
      score,
      wentWell: Array.isArray(parsed?.wentWell) ? parsed.wentWell.slice(0, 3) : fallback.wentWell,
      improve: Array.isArray(parsed?.improve) ? parsed.improve.slice(0, 3) : fallback.improve,
      model: "llm",
    };
  } catch {
    return fallback;
  }
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const entries = Array.isArray(body?.entries) ? body.entries : [];
  const goalEntries = Array.isArray(body?.goalEntries) ? body.goalEntries : [];
  const fallback = buildRuleBasedAssessment(entries, goalEntries);
  const assessment = await maybeGenerateLlmAssessment(entries, goalEntries, fallback);
  return NextResponse.json({ ok: true, data: { assessment } });
}
