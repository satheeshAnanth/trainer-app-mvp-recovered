export function labelizeMetricKey(key) {
  return String(key)
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

const METRIC_DESCRIPTIONS = {
  "Balance/Stability": "Control and steadiness during the movement.",
  Calories: "Estimated calories burned in this effort.",
  Distance: "Total distance covered for this set/exercise.",
  Duration: "Total working time for the set/exercise.",
  "Form Quality": "How clean and technically correct the movement felt.",
  "Heart Rate": "Heart rate during or immediately after effort.",
  Incline: "Incline level or gradient used.",
  Load: "Weight/resistance used for the movement.",
  "Machine Resistance": "Resistance level set on the machine.",
  "Pain/Discomfort": "Any pain or discomfort observed while performing.",
  RPE: "Rate of perceived exertion (effort out of 10).",
  "Range of Motion": "Depth or movement range achieved.",
  Reps: "Number of repetitions completed.",
  "Rest Time": "Rest duration before the next set.",
  Sets: "Set count completed for this exercise.",
  "Speed/Pace/RPM": "Movement speed, pace, or RPM depending on exercise.",
  Tempo: "Rep timing pattern (for example: 3-1-1).",
};

export function describeMetricKey(key) {
  const raw = String(key ?? "").trim();
  if (!raw) return "";
  return METRIC_DESCRIPTIONS[raw] ?? "";
}

function makeNumberOptions(start, end, step, suffix = "") {
  const out = [];
  for (let value = start; value <= end; value += step) {
    const text = Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
    out.push({ value: text, label: suffix ? `${text}${suffix}` : text });
  }
  return out;
}

const METRIC_OPTIONS = {
  "Balance/Stability": [
    { value: "poor", label: "Poor" },
    { value: "fair", label: "Fair" },
    { value: "good", label: "Good" },
    { value: "excellent", label: "Excellent" },
  ],
  "Form Quality": [
    { value: "poor", label: "Poor" },
    { value: "needs_cueing", label: "Needs cueing" },
    { value: "good", label: "Good" },
    { value: "excellent", label: "Excellent" },
  ],
  "Range of Motion": [
    { value: "limited", label: "Limited" },
    { value: "partial", label: "Partial" },
    { value: "full", label: "Full" },
  ],
  "Pain/Discomfort": [
    { value: "none", label: "None" },
    { value: "mild", label: "Mild" },
    { value: "moderate", label: "Moderate" },
    { value: "high", label: "High" },
  ],
  Tempo: [
    { value: "controlled", label: "Controlled" },
    { value: "slow_eccentric", label: "Slow eccentric" },
    { value: "explosive", label: "Explosive" },
    { value: "paused", label: "Paused reps" },
  ],
  RPE: [
    { value: "4", label: "4 - Light" },
    { value: "5", label: "5 - Light/Moderate" },
    { value: "6", label: "6 - Moderate" },
    { value: "7", label: "7 - Hard" },
    { value: "8", label: "8 - Very hard" },
    { value: "9", label: "9 - Near max" },
    { value: "10", label: "10 - Max effort" },
  ],
  Sets: [
    { value: "1", label: "1" },
    { value: "2", label: "2" },
    { value: "3", label: "3" },
    { value: "4", label: "4" },
    { value: "5", label: "5" },
    { value: "6", label: "6" },
  ],
  Reps: [
    { value: "5", label: "5" },
    { value: "6", label: "6" },
    { value: "8", label: "8" },
    { value: "10", label: "10" },
    { value: "12", label: "12" },
    { value: "15", label: "15" },
    { value: "20", label: "20" },
  ],
  "Rest Time": [
    { value: "30s", label: "30 sec" },
    { value: "45s", label: "45 sec" },
    { value: "60s", label: "60 sec" },
    { value: "90s", label: "90 sec" },
    { value: "120s", label: "120 sec" },
    { value: "180s", label: "180 sec" },
  ],
  Calories: makeNumberOptions(20, 1000, 20, " kcal"),
  Distance: [
    ...makeNumberOptions(0.1, 2, 0.1, " km"),
    ...makeNumberOptions(2.5, 20, 0.5, " km"),
  ],
  Duration: makeNumberOptions(1, 180, 1, " min"),
  "Heart Rate": makeNumberOptions(60, 210, 5, " bpm"),
  Incline: makeNumberOptions(0, 20, 1, "%"),
  Load: makeNumberOptions(0, 200, 2.5, " kg"),
  "Machine Resistance": makeNumberOptions(1, 30, 1, ""),
  "Speed/Pace/RPM": makeNumberOptions(1, 200, 1, ""),
};

export function getMetricOptions(key) {
  const raw = String(key ?? "").trim();
  if (!raw) return [];
  return METRIC_OPTIONS[raw] ?? [];
}
