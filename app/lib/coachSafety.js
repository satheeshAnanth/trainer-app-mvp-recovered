const CONDITION_RULES = [
  {
    key: "lower_back",
    label: "Lower back",
    triggers: [/lower\s*back/i, /lumbar/i, /back pain/i, /sciatica/i, /disc/i],
    avoid: [
      /deadlift/i,
      /romanian deadlift/i,
      /rdl/i,
      /good morning/i,
      /back squat/i,
      /barbell row/i,
      /bent over row/i,
      /upright row/i,
      /heavy carry/i,
    ],
    alternatives: ["Glute bridge", "Split squat", "Supported row", "Dead bug"],
    routineBlocks: [
      { title: "Warm-up", text: "5-8 minutes of breathing, cat-cow, hip hinges, and gentle trunk rotations." },
      { title: "Main work", text: "Supported lower-body strength, core stability, and controlled tempo movements." },
      { title: "Conditioning", text: "Low-impact cardio such as bike, walk, or sled work instead of spinal loading." },
      { title: "Cool-down", text: "Breathing reset, hamstring/hip flexor mobility, and pain-free range checks." },
    ],
    warning: "Keep the spine unloaded or lightly loaded until the back is calm and pain-free ranges are clear.",
  },
  {
    key: "knee",
    label: "Knee",
    triggers: [/knee/i, /patella/i, /acl/i, /meniscus/i, /osteoarthritis/i],
    avoid: [
      /deep squat/i,
      /back squat/i,
      /front squat/i,
      /jump/i,
      /plyo/i,
      /running/i,
      /lunge/i,
      /split squat/i,
      /step down/i,
      /leg extension/i,
    ],
    alternatives: ["Box squat", "Glute bridge", "Hamstring curl", "Bike"],
    routineBlocks: [
      { title: "Warm-up", text: "Bike or brisk walk, ankle mobility, and glute activation for 5-8 minutes." },
      { title: "Main work", text: "Hip-dominant lower body work with controlled range and support as needed." },
      { title: "Conditioning", text: "Low-impact intervals on bike/rower instead of jumps or runs." },
      { title: "Cool-down", text: "Gentle knee flexion/extension and quad/hip mobility without forcing depth." },
    ],
    warning: "Avoid knee-dominant impact or deep flexion work if it reproduces pain.",
  },
  {
    key: "shoulder",
    label: "Shoulder",
    triggers: [/shoulder/i, /rotator cuff/i, /impingement/i, /labrum/i],
    avoid: [
      /overhead press/i,
      /military press/i,
      /push press/i,
      /dips/i,
      /upright row/i,
      /snatch/i,
      /clean and jerk/i,
      /bench press/i,
      /push up/i,
    ],
    alternatives: ["Landmine press", "Incline push-up", "Chest-supported row", "Face pull"],
    routineBlocks: [
      { title: "Warm-up", text: "Scapular control, thoracic mobility, and light band activation before loading." },
      { title: "Main work", text: "Neutral-grip pressing, rows, and pain-free range strength work." },
      { title: "Conditioning", text: "Arm-friendly cardio and trunk work that does not aggravate overhead pain." },
      { title: "Cool-down", text: "External rotation, wall slides, and relaxed breathing." },
    ],
    warning: "Avoid overhead or compressed shoulder positions until the client can load them pain-free.",
  },
  {
    key: "hip",
    label: "Hip / groin",
    triggers: [/hip/i, /groin/i, /hip flexor/i, /tfl/i],
    avoid: [/deep squat/i, /cossack/i, /jump/i, /sprint/i, /long stride/i, /lunge/i],
    alternatives: ["Glute bridge", "Step-up", "Lateral band walk", "Supported split squat"],
    routineBlocks: [
      { title: "Warm-up", text: "Hip circles, adductor rock-backs, and glute activation." },
      { title: "Main work", text: "Supported unilateral work and hip-dominant strength through comfortable range." },
      { title: "Conditioning", text: "Low-impact steady state or intervals if the hip tolerates them." },
      { title: "Cool-down", text: "Adductor, glute, and hip-flexor mobility with easy breathing." },
    ],
    warning: "Keep range of motion conservative when the hip or groin is irritated.",
  },
  {
    key: "ankle",
    label: "Ankle / foot",
    triggers: [/ankle/i, /foot/i, /achilles/i, /plantar/i],
    avoid: [/jump/i, /plyo/i, /sprint/i, /running/i, /box jump/i],
    alternatives: ["Bike", "Split squat to box", "Calf raise", "Sled push"],
    routineBlocks: [
      { title: "Warm-up", text: "Ankle mobility, foot activation, and calf raises before impact work." },
      { title: "Main work", text: "Strength work that keeps foot position stable and pain-free." },
      { title: "Conditioning", text: "Low-impact conditioning such as bike or sled work." },
      { title: "Cool-down", text: "Calf, soleus, and foot mobility at the end of the session." },
    ],
    warning: "Use low-impact options until landing and push-off are pain-free.",
  },
];

const GOAL_RULES = [
  {
    key: "mobility",
    match: [/mobility/i, /movement/i, /back health/i, /flexibility/i],
    title: "Mobility-first routine",
    blocks: [
      { title: "Warm-up", text: "Joint circles, breathing, and easy mobility for the target area." },
      { title: "Main work", text: "Patterning drills, controlled strength work, and range-of-motion practice." },
      { title: "Conditioning", text: "Low-impact steady-state movement to build capacity without flare-ups." },
      { title: "Cool-down", text: "Long exhale breathing and gentle mobility holds." },
    ],
  },
  {
    key: "fat_loss",
    match: [/lose/i, /fat loss/i, /weight loss/i, /trim/i, /lean/i],
    title: "Fat-loss friendly routine",
    blocks: [
      { title: "Warm-up", text: "Raise heart rate gradually with bike, march, or walk intervals." },
      { title: "Main work", text: "Full-body strength blocks with moderate rest and clean form." },
      { title: "Conditioning", text: "Intervals or circuits using the lowest-impact choices the client tolerates." },
      { title: "Cool-down", text: "Breathing reset and a short mobility finish." },
    ],
  },
  {
    key: "strength",
    match: [/strength/i, /muscle/i, /hypertroph/i, /build/i],
    title: "Strength-building routine",
    blocks: [
      { title: "Warm-up", text: "Specific movement prep and ramp-up sets before working loads." },
      { title: "Main work", text: "Primary compound patterns first, then accessory work." },
      { title: "Accessory", text: "Unilateral and stability work to support the main lifts." },
      { title: "Cool-down", text: "Recovery breathing and mobility for the trained area." },
    ],
  },
];

function normalizeText(value) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function firstMatchRule(text, rules) {
  const normalized = normalizeText(text);
  return rules.find((rule) => rule.match.some((rx) => rx.test(normalized))) ?? null;
}

function anyPatternMatch(text, patterns) {
  const normalized = normalizeText(text);
  return patterns.some((rx) => rx.test(normalized));
}

function uniqueBlocks(blocks) {
  const seen = new Set();
  const out = [];
  for (const block of blocks) {
    const key = normalizeText(block?.title ?? block?.label ?? "");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({
      title: String(block?.title ?? block?.label ?? ""),
      text: String(block?.text ?? block?.detail ?? ""),
    });
  }
  return out;
}

export function buildProfileSafetyPlan({ goalText = "", priorCondition = "" } = {}) {
  const goalRule = firstMatchRule(goalText, GOAL_RULES);
  const matchedConditions = CONDITION_RULES.filter((rule) => anyPatternMatch(priorCondition, rule.triggers));
  const fallbackTitle = goalText
    ? `${goalText.trim()} routine`
    : "Balanced coaching routine";

  const title = matchedConditions.length > 0
    ? `${matchedConditions[0].label} friendly ${goalRule?.title ? goalRule.title.toLowerCase() : "routine"}`
    : goalRule?.title ?? fallbackTitle;

  const blocks = uniqueBlocks([
    ...(matchedConditions[0]?.routineBlocks ?? []),
    ...(goalRule?.blocks ?? []),
  ]).slice(0, 4);

  const warnings = matchedConditions.map((rule) => ({
    severity: "warning",
    label: rule.label,
    message: rule.warning,
    alternatives: rule.alternatives,
  }));

  const note = warnings.length > 0
    ? "Use this only as a coaching aid; keep the client in pain-free ranges and regress any movement that irritates symptoms."
    : "No obvious contraindication was detected from the profile notes.";

  return {
    title,
    note,
    blocks,
    warnings,
  };
}

export function buildExerciseWarnings({ exerciseName = "", goalText = "", priorCondition = "" } = {}) {
  const goal = normalizeText(goalText);
  const exercise = normalizeText(exerciseName);
  const matchedConditions = CONDITION_RULES.filter((rule) => anyPatternMatch(priorCondition, rule.triggers));
  const warnings = [];

  for (const rule of matchedConditions) {
    if (rule.avoid.some((rx) => rx.test(exercise))) {
      warnings.push({
        severity: "high",
        label: rule.label,
        message: `Possible mismatch with ${rule.label.toLowerCase()} complaint: ${rule.warning}`,
        alternatives: rule.alternatives,
      });
    }
  }

  if (/mobility|back health/.test(goal) && /(jump|sprint|plyo|running|deadlift|back squat|overhead press)/.test(exercise)) {
    warnings.push({
      severity: "medium",
      label: "Goal mismatch",
      message: "This exercise looks high-load or high-impact relative to a mobility/back-health oriented profile.",
      alternatives: ["Low-impact cardio", "Core stability", "Supported strength work"],
    });
  }

  return warnings;
}
