"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import TrainerShell from "app/_components/TrainerShell";
import { buildExerciseWarnings, buildProfileSafetyPlan } from "app/lib/coachSafety";
import { describeMetricKey, getMetricOptions, labelizeMetricKey } from "app/lib/metricLabels";
import Link from "next/link";

const TABS = ["live", "review"];
const TAB_LABELS = {
  live: "Draft",
  review: "Final",
};
const DRAFT_STORAGE_KEY = "trainer-session-draft-v1";
const SKIP_REASONS = [
  { value: "time_constraint", label: "Time constraint" },
  { value: "client_fatigue", label: "Client fatigue" },
  { value: "pain_discomfort", label: "Pain/discomfort" },
  { value: "substituted_exercise", label: "Substituted exercise" },
];

function normalizeDateDisplay(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function normalizeTextForMatch(text) {
  return String(text ?? "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function looksLikeSubstitution(adhocName, goalName) {
  const a = normalizeTextForMatch(adhocName);
  const g = normalizeTextForMatch(goalName);
  if (!a || !g) return false;
  return a === g || a.includes(g) || g.includes(a);
}

function classifyCategory(text) {
  const t = String(text ?? "").toLowerCase();
  if (t.includes("stretch") || t.includes("mobility")) return "Mobility";
  if (t.includes("run") || t.includes("bike") || t.includes("row") || t.includes("treadmill")) return "Conditioning";
  if (t.includes("squat") || t.includes("press") || t.includes("lunge") || t.includes("deadlift")) return "Strength";
  return "Other";
}

function blankSetFromKeys(requiredKeys) {
  const out = {};
  for (const key of requiredKeys) out[key] = "";
  return out;
}

function newEntry(partial = {}) {
  const requiredKeys = partial.requiredKeys && partial.requiredKeys.length > 0 ? partial.requiredKeys : ["sets", "reps", "load"];
  return {
    id: crypto.randomUUID(),
    name: "",
    category: "Other",
    source: "adhoc",
    masterExerciseId: "",
    goalExerciseId: null,
    linkedGoalExerciseId: null,
    target: "",
    priority: "optional",
    frequency: "every_session",
    completionStatus: "",
    skipReason: "",
    requiredKeys,
    setLogs: [],
    notes: "",
    ...partial,
  };
}

function makePayload({ overallNotes, entries, goalTemplate }) {
  return {
    goalTemplate: goalTemplate ? { name: goalTemplate.goalName || goalTemplate.goal || "", status: goalTemplate.status || "active" } : null,
    sections: {
      warmup: entries[0]?.name || "Warmup logged",
      mainWork: overallNotes || "Workout logged",
      cooldown: entries.find((e) => e.category === "Mobility")?.name || "Cooldown logged",
      goalUpdate: "Goal progress updated in session flow.",
    },
    exercises: entries.map((entry) => ({
      name: entry.name,
      exerciseId: entry.masterExerciseId || null,
      source: entry.source,
      goalExerciseId: entry.goalExerciseId,
      linkedGoalExerciseId: entry.linkedGoalExerciseId,
      completionStatus: entry.completionStatus || "",
      skipReason: entry.skipReason || "",
      note: entry.notes || "",
      metricRequired: entry.requiredKeys,
      metrics: { setsData: entry.setLogs ?? [] },
    })),
  };
}

function buildLocalAssessment(entries, goalEntries) {
  const totalGoals = goalEntries.length;
  const completedGoals = goalEntries.filter((e) => e.completionStatus === "completed").length;
  const partialGoals = goalEntries.filter((e) => e.completionStatus === "partial").length;
  const skippedGoals = goalEntries.filter((e) => e.completionStatus === "skipped").length;
  const populatedSets = entries.reduce(
    (acc, entry) =>
      acc +
      (entry.setLogs ?? []).filter((setRow) =>
        Object.values(setRow ?? {}).some((v) => String(v ?? "").trim() !== "")
      ).length,
    0
  );
  const unresolvedGoals = goalEntries.filter((e) => !e.completionStatus).length;
  const substitutionCount = entries.filter((e) => e.linkedGoalExerciseId).length;

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
      ? `${completedGoals}/${totalGoals} goal exercises fully completed${partialGoals ? `, with ${partialGoals} partially completed` : ""}.`
      : "Session captured with non-goal exercises.",
    `${populatedSets} sets included measurable metrics.`,
  ];
  if (substitutionCount > 0) wentWell.push(`${substitutionCount} ad-hoc exercise(s) were linked back to goal work.`);

  const improve = [];
  if (skippedGoals > 0) improve.push(`Address ${skippedGoals} skipped goal exercise(s) with planned alternates.`);
  if (unresolvedGoals > 0) improve.push(`Mark completion status for ${unresolvedGoals} pending goal exercise(s) before closure.`);
  if (populatedSets < 4) improve.push("Capture more set-level metrics (load/reps/RPE) for stronger progress tracking.");
  if (improve.length === 0) improve.push("Progressive overload and recovery checks can be tightened next session.");

  return {
    score,
    wentWell: wentWell.slice(0, 3),
    improve: improve.slice(0, 3),
    model: "rule-based",
  };
}

function isStructuralSetsMetric(key) {
  const normalized = String(key ?? "").trim().toLowerCase();
  return normalized === "sets";
}

export default function Page() {
  const [tab, setTab] = useState("live");
  const [clients, setClients] = useState([]);
  const [goalTemplate, setGoalTemplate] = useState(null);
  const [entries, setEntries] = useState([]);
  const [entryIndex, setEntryIndex] = useState(0);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [exerciseSearch, setExerciseSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [currentSetIndex, setCurrentSetIndex] = useState(0);
  const [showTimingFields, setShowTimingFields] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [showAddClient, setShowAddClient] = useState(false);
  const [sharedNote, setSharedNote] = useState("");
  const [discussion, setDiscussion] = useState([]);
  const [publishText, setPublishText] = useState("");
  const [finalComment, setFinalComment] = useState("");
  const [assessment, setAssessment] = useState(null);
  const [assessmentLoading, setAssessmentLoading] = useState(false);
  const [payment, setPayment] = useState({ amountInr: "", upiId: "", note: "" });
  const [paymentReceived, setPaymentReceived] = useState(false);
  const [form, setForm] = useState({
    clientId: "",
    sessionDate: normalizeDateDisplay(new Date().toISOString()),
    sessionTitle: `Session on ${normalizeDateDisplay(new Date().toISOString())}`,
    sessionStartTime: "",
    sessionEndTime: "",
    durationMinutes: "",
    trainerPrivateNotes: "",
    overallNotes: "",
  });
  const [newClient, setNewClient] = useState({
    name: "", goal: "", mobile: "", age: "", weightKg: "", heightCm: "", gender: "not set", activityLevel: "not set", priorCondition: "",
  });
  const [draftRestored, setDraftRestored] = useState(false);

  // Restore draft on first mount
  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(DRAFT_STORAGE_KEY) : null;
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved?.form) setForm((prev) => ({ ...prev, ...saved.form }));
      if (Array.isArray(saved?.entries) && saved.entries.length > 0) setEntries(saved.entries);
      if (saved?.sessionId) setSessionId(saved.sessionId);
      setDraftRestored(true);
    } catch {
      // corrupt draft — ignore
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autosave draft on every form/entries change
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ form, entries, sessionId }));
    } catch {
      // storage full or unavailable — ignore
    }
  }, [form, entries, sessionId]);

  function clearDraft() {
    try { window.localStorage.removeItem(DRAFT_STORAGE_KEY); } catch { /* ignore */ }
    setDraftRestored(false);
  }

  const currentEntry = entries[entryIndex] ?? null;
  const selectedClient = useMemo(
    () => clients.find((client) => String(client.id) === String(form.clientId)) ?? null,
    [clients, form.clientId]
  );
  const coachingSafety = useMemo(
    () =>
      buildProfileSafetyPlan({
        goalText: goalTemplate?.goalName ?? selectedClient?.goal ?? "",
        priorCondition: selectedClient?.prior_condition ?? selectedClient?.priorCondition ?? "",
      }),
    [goalTemplate, selectedClient]
  );
  const currentExerciseWarnings = useMemo(
    () =>
      buildExerciseWarnings({
        exerciseName: currentEntry?.name ?? "",
        goalText: goalTemplate?.goalName ?? selectedClient?.goal ?? "",
        priorCondition: selectedClient?.prior_condition ?? selectedClient?.priorCondition ?? "",
      }),
    [currentEntry, goalTemplate, selectedClient]
  );
  const goalEntries = useMemo(() => entries.filter((e) => e.source === "goal"), [entries]);
  const pendingGoalEntries = useMemo(() => goalEntries.filter((e) => !e.completionStatus), [goalEntries]);
  const unresolvedGoalCount = pendingGoalEntries.length;
  const skippedWithoutReasonCount = goalEntries.filter((e) => e.completionStatus === "skipped" && !e.skipReason).length;
  const goalChecksPassed = unresolvedGoalCount === 0 && skippedWithoutReasonCount === 0;
  const readyToPublish = publishText.trim().length > 0;

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/clients");
        const json = await res.json();
        const list = json?.data?.clients ?? [];
        setClients(list);
        if (!form.clientId && list[0]?.id) setForm((prev) => ({ ...prev, clientId: list[0].id }));
      } catch {
        setClients([]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchRequiredKeys(masterExerciseId, name) {
    try {
      const res = await fetch(`/api/exercises/master/search?withKeys=1&limit=200&q=${encodeURIComponent(name || "")}`);
      const json = await res.json();
      const rows = Array.isArray(json?.data?.exercises) ? json.data.exercises : [];
      const match = rows.find((row) => String(row?.id) === String(masterExerciseId)) || rows.find((row) => normalizeTextForMatch(row?.name) === normalizeTextForMatch(name));
      return Array.isArray(match?.requiredKeys) && match.requiredKeys.length > 0 ? match.requiredKeys : ["sets", "reps", "load"];
    } catch {
      return ["sets", "reps", "load"];
    }
  }

  useEffect(() => {
    if (!form.clientId) return;
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/clients/${form.clientId}/goal-template`);
      const json = await res.json();
      const template = json?.data?.goalTemplate ?? null;
      if (cancelled) return;
      if (!template || !Array.isArray(template.exercises) || template.exercises.length === 0) {
        setGoalTemplate(null);
        setEntries((prev) => prev.filter((e) => e.source !== "goal"));
        return;
      }
      const normalizedTemplateExercises = template.exercises
        .map((exercise) => {
          const mappedName = String(exercise?.exercise ?? exercise?.name ?? "").trim();
          if (!mappedName) return null;
          return { ...exercise, exercise: mappedName };
        })
        .filter(Boolean);
      if (normalizedTemplateExercises.length === 0) {
        setGoalTemplate(null);
        setEntries((prev) => prev.filter((e) => e.source !== "goal"));
        return;
      }
      setGoalTemplate(template);
      const goalRows = await Promise.all(normalizedTemplateExercises.map(async (exercise, index) => {
        const name = String(exercise?.exercise ?? "").trim();
        const requiredKeys = await fetchRequiredKeys(String(exercise?.masterExerciseId ?? ""), name);
        return newEntry({
          name,
          category: classifyCategory(name),
          source: "goal",
          masterExerciseId: String(exercise?.masterExerciseId ?? ""),
          goalExerciseId: String(exercise?.id ?? `${index + 1}`),
          target: String(exercise?.target ?? ""),
          priority: String(exercise?.priority ?? "mandatory"),
          frequency: String(exercise?.frequency ?? "every_session"),
          requiredKeys,
          setLogs: [],
        });
      }));
      setEntries((prev) => [...goalRows, ...prev.filter((e) => e.source !== "goal")]);
    })().catch(() => null);
    return () => { cancelled = true; };
  }, [form.clientId]);

  function setEntryField(key, value) {
    setEntries((prev) =>
      prev.map((entry, i) => {
        if (i !== entryIndex) return entry;
        if (key === "name") {
          return { ...entry, [key]: value, masterExerciseId: "" };
        }
        return { ...entry, [key]: value };
      })
    );
  }

  function setSetMetric(setIndex, key, value) {
    setEntries((prev) => prev.map((entry, i) => {
      if (i !== entryIndex) return entry;
      return { ...entry, setLogs: (entry.setLogs ?? []).map((setRow, idx) => (idx === setIndex ? { ...setRow, [key]: value } : setRow)) };
    }));
  }

  function addSetRow(duplicate = false) {
    setEntries((prev) => prev.map((entry, i) => {
      if (i !== entryIndex) return entry;
      const base = duplicate && entry.setLogs?.length ? entry.setLogs[entry.setLogs.length - 1] : blankSetFromKeys(entry.requiredKeys || []);
      return { ...entry, setLogs: [...(entry.setLogs || []), { ...base }] };
    }));
    setCurrentSetIndex((prev) => prev + 1);
  }

  function deleteSetRow(setIndex) {
    setEntries((prev) => prev.map((entry, i) => {
      if (i !== entryIndex) return entry;
      const kept = (entry.setLogs || []).filter((_, idx) => idx !== setIndex);
      return { ...entry, setLogs: kept };
    }));
  }

  async function runExerciseSearch(term) {
    const q = String(term ?? "").trim();
    if (q.length < 4) {
      setMessage("Enter at least 4 characters and press Enter to search.");
      setSearchResults([]);
      return;
    }
    try {
      const res = await fetch(`/api/exercises/master/search?withKeys=1&limit=200&q=${encodeURIComponent(q)}`);
      const json = await res.json();
      setSearchResults(Array.isArray(json?.data?.exercises) ? json.data.exercises : []);
    } catch {
      setSearchResults([]);
    }
  }

  function startAdhocExercise(item) {
    const requiredKeys = Array.isArray(item?.requiredKeys) && item.requiredKeys.length > 0 ? item.requiredKeys : ["sets", "reps", "load"];
    const next = newEntry({
      name: String(item?.name ?? "").trim(),
      category: classifyCategory(item?.name),
      source: "adhoc",
      masterExerciseId: String(item?.id ?? ""),
      requiredKeys,
      setLogs: [],
    });
    setEntries((prev) => [...prev, next]);
    setEntryIndex(entries.length);
    setCurrentSetIndex(0);
    setEditorOpen(true);
    setSearchModalOpen(false);
    setExerciseSearch("");
    setSearchResults([]);
  }

  function finishCurrentExercise() {
    if (!currentEntry) return;
    if (!currentEntry.masterExerciseId) return setMessage("Use Search and select a mapped exercise first.");
    if (currentEntry.source === "goal" && !currentEntry.completionStatus) return setMessage("Select completion status for this goal exercise.");
    if (currentEntry.source === "goal" && currentEntry.completionStatus === "skipped" && !currentEntry.skipReason) {
      return setMessage("Select a skip reason for skipped goal exercise.");
    }
    setMessage("Exercise saved to timeline.");
    setEditorOpen(false);
    setTab("live");
  }

  function logCurrentSet() {
    if (!currentEntry) return;
    if (!currentEntry.setLogs?.length) {
      setMessage("Add a set first.");
      return;
    }
    const row = currentEntry.setLogs?.[currentSetIndex] ?? {};
    const hasValue = Object.values(row).some((v) => String(v ?? "").trim() !== "");
    if (!hasValue) {
      setMessage("Enter at least one value for this set.");
      return;
    }
    setMessage(`Set ${currentSetIndex + 1} logged.`);
  }

  function openSearchForCurrentEntry() {
    if (!currentEntry) return;
    setExerciseSearch(currentEntry.name || "");
    setSearchResults([]);
    setSearchModalOpen(true);
  }

  async function mapSelectedExercise(item) {
    const requiredKeys = Array.isArray(item?.requiredKeys) && item.requiredKeys.length > 0 ? item.requiredKeys : ["sets", "reps", "load"];
    setEntries((prev) =>
      prev.map((entry, i) =>
        i === entryIndex
          ? {
              ...entry,
              name: String(item?.name ?? ""),
              masterExerciseId: String(item?.id ?? ""),
              requiredKeys,
              setLogs: entry.setLogs && entry.setLogs.length > 0 ? entry.setLogs : [],
            }
          : entry
      )
    );
    setSearchModalOpen(false);
  }

  async function runWorkoutAssessment() {
    setAssessmentLoading(true);
    try {
      const response = await fetch("/api/sessions/assessment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries, goalEntries }),
      });
      const json = await response.json();
      if (response.ok && json?.ok && json?.data?.assessment) {
        setAssessment(json.data.assessment);
      } else {
        setAssessment(buildLocalAssessment(entries, goalEntries));
      }
    } catch {
      setAssessment(buildLocalAssessment(entries, goalEntries));
    } finally {
      setAssessmentLoading(false);
    }
  }

  useEffect(() => {
    if (tab !== "review") return;
    runWorkoutAssessment().catch(() => null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, entries]);

  useEffect(() => {
    if (tab !== "review") return;
    loadDiscussion(sessionId).catch(() => null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, sessionId]);

  async function ensureSession(status = "draft") {
    const client = clients.find((c) => c.id === form.clientId);
    if (!client) throw new Error("Select a client first.");
    const body = {
      clientId: form.clientId,
      clientName: client.name,
      sessionDate: form.sessionDate,
      sessionTitle: form.sessionTitle,
      rawNotes: form.overallNotes || form.trainerPrivateNotes,
      summary: "Draft updated",
      status,
      payload: {
        ...makePayload({ overallNotes: form.overallNotes, entries, goalTemplate }),
        assessment: assessment ?? null,
        paymentReceived: Boolean(paymentReceived),
        payment: {
          amountInr: payment.amountInr ? Number(payment.amountInr) : null,
          upiId: payment.upiId || null,
          note: payment.note || null,
        },
      },
      durationMinutes: Number.isFinite(Number(form.durationMinutes)) ? Number(form.durationMinutes) : null,
      estimatedCalories: null,
    };
    if (!sessionId) {
      const res = await fetch("/api/sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.message ?? "Unable to create session.");
      setSessionId(json?.data?.id ?? "");
      return json?.data?.id;
    }
    const res = await fetch(`/api/sessions/${sessionId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json();
    if (!res.ok || !json?.ok) throw new Error(json?.message ?? "Unable to update session.");
    return sessionId;
  }

  async function loadDiscussion(targetSessionId) {
    if (!targetSessionId) {
      setDiscussion([]);
      return;
    }
    try {
      const res = await fetch(`/api/sessions/${targetSessionId}/comments`);
      const json = await res.json();
      const rows = Array.isArray(json?.data?.comments) ? json.data.comments : [];
      setDiscussion(rows);
    } catch {
      setDiscussion([]);
    }
  }

  async function saveDraft() {
    setSaving(true); setMessage("");
    try { await ensureSession("draft"); setMessage("Draft updated."); } catch (e) { setMessage(e?.message ?? "Unable to save draft."); } finally { setSaving(false); }
  }

  async function sendSharedNote() {
    if (!sharedNote.trim()) return;
    setSaving(true); setMessage("");
    try {
      const id = await ensureSession("draft");
      const res = await fetch(`/api/sessions/${id}/comments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: sharedNote, authorRole: "trainer", authorName: "Trainer" }) });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.message ?? "Unable to post shared note.");
      await loadDiscussion(id);
      setSharedNote("");
      setMessage("Shared note added.");
    } catch (e) { setMessage(e?.message ?? "Unable to post shared note."); } finally { setSaving(false); }
  }

  async function requestPayment() {
    setSaving(true); setMessage("");
    try {
      const id = await ensureSession("draft");
      const res = await fetch(`/api/sessions/${id}/payment`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payment) });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.message ?? "Unable to request payment.");
      setMessage("Payment request saved.");
    } catch (e) { setMessage(e?.message ?? "Unable to request payment."); } finally { setSaving(false); }
  }

  async function publishToClient() {
    if (!readyToPublish) return setMessage("Add publish notes before publishing.");
    if (!goalChecksPassed) return setMessage("Complete goal exercise statuses and skip reasons first.");
    setSaving(true); setMessage("");
    try {
      const id = await ensureSession("pending_notes");
      await fetch(`/api/sessions/${id}/share`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ share: true }) });
      setMessage("Session details published to client.");
    } catch (e) { setMessage(e?.message ?? "Unable to publish session."); } finally { setSaving(false); }
  }

  async function lockSessionNotes() {
    if (!goalChecksPassed) return setMessage("Complete goal exercise statuses and skip reasons first.");
    if (!paymentReceived) return setMessage("Confirm payment received before locking notes.");
    if (!finalComment.trim()) return setMessage("Add a final trainer comment before locking notes.");
    setSaving(true); setMessage("");
    try {
      const id = await ensureSession("pending_notes");
      const res = await fetch(`/api/sessions/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: finalComment.trim(), authorRole: "trainer", authorName: "Trainer" }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.message ?? "Unable to add final trainer comment.");
      setFinalComment("");
      await ensureSession("completed");
      clearDraft();
      setMessage("Session notes locked.");
    } catch (e) { setMessage(e?.message ?? "Unable to lock session notes."); } finally { setSaving(false); }
  }

  async function uploadPhoto(file) {
    if (!file) return;
    setUploading(true);
    setMessage("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.message ?? "Upload failed.");
      setEntries((prev) =>
        prev.map((entry, i) =>
          i !== entryIndex ? entry : { ...entry, photos: [...(entry.photos ?? []), json.url] }
        )
      );
      setMessage("Photo attached.");
    } catch (e) {
      setMessage(e?.message ?? "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function addClientInline() {
    if (!newClient.name.trim() || !newClient.mobile.trim()) return setMessage("Client name and mobile are required.");
    const res = await fetch("/api/clients", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newClient) });
    const json = await res.json();
    if (!res.ok || !json?.ok) return setMessage(json?.message ?? "Unable to add client.");
    setShowAddClient(false);
    setNewClient({ name: "", goal: "", mobile: "", age: "", weightKg: "", heightCm: "", gender: "not set", activityLevel: "not set", priorCondition: "" });
    const listRes = await fetch("/api/clients");
    const listJson = await listRes.json();
    const list = listJson?.data?.clients ?? [];
    setClients(list);
    if (json?.data?.id) setForm((prev) => ({ ...prev, clientId: json.data.id }));
  }

  return (
    <TrainerShell title={form.sessionTitle} subtitle="">
      {draftRestored ? (
        <div className="metric-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderLeft: "4px solid #facc15", marginBottom: 0 }}>
          <p className="item-sub" style={{ margin: 0, color: "#facc15" }}>Draft restored from your last session.</p>
          <button className="ghost-button ghost-button-sm" type="button" onClick={clearDraft}>Discard draft</button>
        </div>
      ) : null}
      <article className="card panel session-wizard-header">
        <div className="wizard-topline"><h2>{form.sessionTitle}</h2><button className="ghost-button" type="button" onClick={clearDraft}>Cancel</button></div>
        <div className="wizard-tabs">{TABS.map((t) => <button key={t} type="button" className={`wizard-tab ${tab === t ? "wizard-tab-active" : ""}`} onClick={() => setTab(t)}>{TAB_LABELS[t]}</button>)}</div>
      </article>

      {tab === "live" ? <article className="card panel">
        <h2>Draft Capture</h2>
        <div className="form-grid">
          <label className="field"><span>Client</span><select value={form.clientId} onChange={(e) => setForm((prev) => ({ ...prev, clientId: e.target.value }))}><option value="">Select a client</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <div className="field" style={{ alignSelf: "end", width: "fit-content" }}><button className="ghost-button ghost-button-compact" type="button" onClick={() => setShowAddClient(true)}>+ Add</button></div>
          <label className="field"><span>Session Date</span><input value={form.sessionDate} onChange={(e) => setForm((prev) => ({ ...prev, sessionDate: e.target.value }))} /></label>
          <label className="field full"><span>Overall session notes</span><textarea rows={3} value={form.overallNotes} onChange={(e) => setForm((prev) => ({ ...prev, overallNotes: e.target.value }))} /></label>
        </div>
        <details style={{ marginTop: 8 }} open={Boolean(form.sessionStartTime || form.sessionEndTime || form.durationMinutes || showTimingFields)}>
          <summary className="ghost-button" style={{ display: "inline-block", cursor: "pointer" }} onClick={() => setShowTimingFields(true)}>
            Timing (optional)
          </summary>
          <div className="form-grid" style={{ marginTop: 10 }}>
            <label className="field"><span>Start time (optional)</span><input placeholder="e.g. 06:10 PM" value={form.sessionStartTime} onChange={(e) => setForm((prev) => ({ ...prev, sessionStartTime: e.target.value }))} /></label>
            <label className="field"><span>End time (optional)</span><input placeholder="e.g. 07:05 PM" value={form.sessionEndTime} onChange={(e) => setForm((prev) => ({ ...prev, sessionEndTime: e.target.value }))} /></label>
            <label className="field"><span>Duration (min)</span><input placeholder="e.g. 55" value={form.durationMinutes} onChange={(e) => setForm((prev) => ({ ...prev, durationMinutes: e.target.value }))} /></label>
          </div>
        </details>
        {goalEntries.length === 0 ? (
          <div className="metric-card" style={{ marginTop: 10 }}>
            <p className="item-sub">No goal exercise template is active for this client yet.</p>
            {form.clientId ? (
              <Link href={`/clients/${form.clientId}/goal-template`} className="ghost-button" style={{ display: "inline-block", marginTop: 8 }}>
                Create goal exercises now
              </Link>
            ) : (
              <p className="item-sub">Select a client first to create goal exercises.</p>
            )}
          </div>
        ) : null}
        <div className="metric-card" style={{ marginTop: 10 }}>
          <p className="item-title">Session timeline</p>
          {entries.length === 0 ? <p className="item-sub">No entries yet.</p> : entries.map((entry, idx) => <button key={entry.id} type="button" className="list-item ghost-button" style={{ width: "100%", textAlign: "left", marginTop: 8 }} onClick={() => { setEntryIndex(idx); setCurrentSetIndex(Math.max(0, (entry.setLogs?.length || 1) - 1)); setEditorOpen(true); }}><span>{entry.name || "Untitled"} {entry.source === "goal" ? "· Goal" : "· Other Exercise"}</span><span>{entry.setLogs?.length || 0} sets</span></button>)}
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 10, marginTop: 10 }}>
            <button className="mint-button" type="button" onClick={() => { setExerciseSearch(""); setSearchResults([]); setSearchModalOpen(true); }} title="Add exercise">+</button>
            <button className="ghost-button" type="button" onClick={() => { setExerciseSearch(""); setSearchResults([]); setSearchModalOpen(true); }}>Other Exercise</button>
          </div>
          {pendingGoalEntries.length > 0 ? (
            <p className="item-sub" style={{ marginTop: 8 }}>
              Goal exercises are managed from the client goal template and appear here automatically.
            </p>
          ) : null}
        </div>
        <div className="quick-actions" style={{ marginTop: 10 }}>
          <button className="mint-button" type="button" onClick={saveDraft} disabled={saving}>
            {saving ? "Saving..." : "Save Draft"}
          </button>
        </div>
      </article> : null}

      {editorOpen && currentEntry ? (
        <div className="modal-backdrop">
          <div className="modal-card card" style={{ maxHeight: "100vh", height: "100vh", borderRadius: 0, paddingBottom: 110 }} onClick={(e) => e.stopPropagation()}>
            <div className="wizard-review-top">
              <div>
                <p className="item-title">{currentEntry.name || "Exercise capture"}</p>
                <p className="item-sub">
                  {currentEntry.setLogs?.length
                    ? `Set ${Math.min(currentSetIndex + 1, currentEntry.setLogs.length)} of ${currentEntry.setLogs.length}`
                    : "No sets yet"}
                </p>
              </div>
              <div className="quick-actions">
                <button className="ghost-button" type="button" onClick={() => setEditorOpen(false)}>Back</button>
              </div>
            </div>
            <label className="field full">
              <span>Exercise name</span>
              <input
                value={currentEntry.name}
                onChange={(e) => setEntryField("name", e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !currentEntry.source === "goal") openSearchForCurrentEntry(); }}
                disabled={currentEntry.source === "goal"}
                placeholder={currentEntry.source === "goal" ? "Locked — edit from Goal Template" : "Type name then press Enter to search"}
              />
            </label>
            {currentEntry.source === "goal" ? (
              <p className="item-sub">Goal exercise name is locked here. Edit it from Client &gt; Goal Template.</p>
            ) : null}
            <p className="item-sub">{currentEntry.masterExerciseId ? "Mapped exercise selected." : "Not mapped yet. Search and select canonical exercise."}</p>
            <div className="metric-card" style={{ marginTop: 8, borderLeft: "4px solid var(--mint)" }}>
              <p className="item-title" style={{ marginTop: 0 }}>Suggested routine</p>
              <p className="item-sub" style={{ marginTop: 4 }}>{coachingSafety.title}</p>
              <p className="item-sub" style={{ marginTop: 4 }}>{coachingSafety.note}</p>
              {coachingSafety.blocks.length > 0 ? (
                <ul className="list" style={{ marginTop: 8 }}>
                  {coachingSafety.blocks.map((block) => (
                    <li key={`${block.title}-${block.text}`} className="list-item" style={{ alignItems: "flex-start" }}>
                      <div>
                        <p className="item-title">{block.title}</p>
                        <p className="item-sub" style={{ marginTop: 4 }}>{block.text}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
              {currentExerciseWarnings.length > 0 ? (
                <div className="metric-card" style={{ marginTop: 10, borderLeft: "4px solid #f59e0b" }}>
                  <p className="item-title" style={{ marginTop: 0 }}>Safety warning</p>
                  <ul className="list" style={{ marginTop: 8 }}>
                    {currentExerciseWarnings.map((warning) => (
                      <li key={`${warning.label}-${warning.message}`} className="list-item" style={{ alignItems: "flex-start" }}>
                        <div>
                          <p className="item-title">{warning.label}</p>
                          <p className="item-sub" style={{ marginTop: 4 }}>{warning.message}</p>
                          <p className="item-sub" style={{ marginTop: 4, color: "#94a3b8" }}>
                            Alternatives: {warning.alternatives.join(", ")}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
            {currentEntry.source === "goal" ? (
              <>
                <p className="item-sub" style={{ color: "#5eead4" }}>Goal Exercise{currentEntry.target ? ` · Target: ${currentEntry.target}` : ""}</p>
                <div className="form-grid">
                  <label className="field">
                    <span>Completion status</span>
                    <select value={currentEntry.completionStatus || ""} onChange={(e) => setEntryField("completionStatus", e.target.value)}>
                      <option value="">Select status</option>
                      <option value="completed">Completed</option>
                      <option value="partial">Partially completed</option>
                      <option value="skipped">Skipped</option>
                    </select>
                  </label>
                  {currentEntry.completionStatus === "skipped" ? (
                    <label className="field">
                      <span>Skip reason (required)</span>
                      <select value={currentEntry.skipReason || ""} onChange={(e) => setEntryField("skipReason", e.target.value)}>
                        <option value="">Select reason</option>
                        {SKIP_REASONS.map((reason) => <option key={reason.value} value={reason.value}>{reason.label}</option>)}
                      </select>
                    </label>
                  ) : null}
                </div>
              </>
            ) : (
              <>
                <p className="item-sub">Other Exercise</p>
                {goalEntries.filter((goal) => !goal.completionStatus && looksLikeSubstitution(currentEntry.name, goal.name)).slice(0, 1).map((goal) => (
                  <div key={goal.id} className="metric-card" style={{ marginBottom: 8 }}>
                    <p className="item-sub">This looks like a variation of &quot;{goal.name}&quot; (Goal Exercise). Link it?</p>
                    <div className="quick-actions">
                      <button className="ghost-button" type="button" onClick={() => {
                        setEntries((prev) => prev.map((entry, i) => {
                          if (i === entryIndex) return { ...entry, linkedGoalExerciseId: goal.goalExerciseId };
                          if (entry.id === goal.id) return { ...entry, completionStatus: entry.completionStatus || "completed", skipReason: "" };
                          return entry;
                        }));
                      }}>Yes, link</button>
                      <button className="ghost-button" type="button" onClick={() => setEntryField("linkedGoalExerciseId", null)}>No, keep separate</button>
                    </div>
                  </div>
                ))}
              </>
            )}
            {message ? (
              <p className="item-sub" style={{ color: message.toLowerCase().includes("unable") || message.toLowerCase().includes("select") || message.toLowerCase().includes("resolve") || message.toLowerCase().includes("enter") ? "#fca5a5" : "#34d399", padding: "6px 0", fontWeight: 500 }}>
                {message}
              </p>
            ) : null}
            <div className="quick-actions" style={{ marginBottom: 8 }}>
              <button className="mint-button" type="button" onClick={logCurrentSet}>Log this set</button>
              <button className="ghost-button" type="button" onClick={() => addSetRow(false)}>
                {currentEntry.setLogs?.length ? "Add next set" : "Add first set"}
              </button>
              <button className="continue-btn" type="button" onClick={finishCurrentExercise}>Done with this Exercise</button>
            </div>
            {(currentEntry.setLogs ?? []).length === 0 ? <p className="item-sub">No sets logged yet.</p> : null}
            {(currentEntry.setLogs ?? []).map((setRow, setIdx) => (
              <div key={`${currentEntry.id}-set-${setIdx}`} className="metric-card" style={{ marginTop: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <p className="item-sub" style={{ margin: 0 }}>Set {setIdx + 1}</p>
                  <button className="ghost-button" type="button" onClick={() => deleteSetRow(setIdx)}>Delete</button>
                </div>
                <div className="form-grid" style={{ marginTop: 8 }}>
                  {(currentEntry.requiredKeys || []).filter((key) => !isStructuralSetsMetric(key)).map((key) => (
                    <label key={`${currentEntry.id}-${setIdx}-${key}`} className="field">
                      <span>{labelizeMetricKey(key)}</span>
                      {describeMetricKey(key) ? <p className="item-sub" style={{ margin: "2px 0 6px" }}>{describeMetricKey(key)}</p> : null}
                      {getMetricOptions(key).length > 0 ? (
                        <select
                          value={
                            getMetricOptions(key).some((option) => option.value === String(setRow[key] ?? ""))
                              ? String(setRow[key] ?? "")
                              : ""
                          }
                          onChange={(e) => setSetMetric(setIdx, key, e.target.value)}
                        >
                          <option value="">Select {labelizeMetricKey(key).toLowerCase()}</option>
                          {getMetricOptions(key).map((option) => (
                            <option key={`${key}-${option.value}`} value={option.value}>{option.label}</option>
                          ))}
                          {setRow[key] && !getMetricOptions(key).some((option) => option.value === String(setRow[key])) ? (
                            <option value={String(setRow[key])}>{`Current: ${setRow[key]}`}</option>
                          ) : null}
                        </select>
                      ) : (
                        <input value={setRow[key] ?? ""} onChange={(e) => setSetMetric(setIdx, key, e.target.value)} />
                      )}
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <details style={{ marginTop: 8 }}>
              <summary className="item-sub" style={{ cursor: "pointer" }}>Notes &amp; photos</summary>
              <label className="field full" style={{ marginTop: 8 }}>
                <span>Exercise note</span>
                <textarea rows={3} value={currentEntry.notes || ""} onChange={(e) => setEntryField("notes", e.target.value)} />
              </label>
              <div style={{ marginTop: 10 }}>
                <p className="item-sub" style={{ marginBottom: 6 }}>Attach photo (progress / form)</p>
                <label style={{ display: "inline-block", cursor: "pointer" }}>
                  <span className="ghost-button ghost-button-sm" style={{ display: "inline-block" }}>
                    {uploading ? "Uploading…" : "+ Add photo"}
                  </span>
                  <input
                    type="file"
                    accept="image/*,video/mp4"
                    style={{ display: "none" }}
                    disabled={uploading}
                    onChange={(e) => uploadPhoto(e.target.files?.[0])}
                  />
                </label>
                {(currentEntry.photos ?? []).length > 0 ? (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                    {(currentEntry.photos ?? []).map((url) => (
                      <Image
                        key={url}
                        src={url}
                        alt="Attached"
                        width={72}
                        height={72}
                        style={{ objectFit: "cover", borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)" }}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            </details>
          </div>
        </div>
      ) : null}

      {tab === "review" ? <>
        <article className="card panel">
          <h2>Goal Progress Summary</h2>
          {goalEntries.length === 0 ? <p className="item-sub">No goal exercises.</p> : goalEntries.map((entry) => (
            <div key={entry.id} className="list-item" style={{ marginTop: 8 }}>
              <div>
                <p className="item-title">{entry.name}</p>
                <p className="item-sub">
                  {entry.completionStatus ? `Status: ${entry.completionStatus}` : "Status not marked"}
                  {entry.skipReason ? ` · Reason: ${entry.skipReason}` : ""}
                </p>
              </div>
              <button className="ghost-button" type="button" onClick={() => { setEntryIndex(entries.findIndex((e) => e.id === entry.id)); setEditorOpen(true); }}>
                Edit
              </button>
            </div>
          ))}
        </article>
        <article className="card panel">
          <h2>Additional Exercises</h2>
          {entries.filter((e) => e.source === "adhoc").length === 0 ? <p className="item-sub">No other exercises.</p> : entries.filter((e) => e.source === "adhoc").map((entry) => (
            <div key={entry.id} className="list-item" style={{ marginTop: 8 }}>
              <span>{entry.name || "Other exercise"}</span>
              <span>{entry.setLogs?.length || 0} sets</span>
            </div>
          ))}
        </article>
        <article className="card panel">
          <h2>Workout Assessment</h2>
          {assessment ? (
            <div className="metric-card">
              <p className="item-title" style={{ marginTop: 0 }}>Quality score: {assessment.score}/5</p>
              <p className="item-sub" style={{ marginBottom: 6 }}>What went well</p>
              <ul className="list">
                {(assessment.wentWell ?? []).map((item, idx) => (
                  <li key={`well-${idx}`} className="list-item"><span>{item}</span></li>
                ))}
              </ul>
              <p className="item-sub" style={{ margin: "10px 0 6px" }}>What to improve next session</p>
              <ul className="list">
                {(assessment.improve ?? []).map((item, idx) => (
                  <li key={`improve-${idx}`} className="list-item"><span>{item}</span></li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="item-sub">Assessment not generated yet.</p>
          )}
          <div className="quick-actions" style={{ marginTop: 10 }}>
            <button className="ghost-button" type="button" onClick={runWorkoutAssessment} disabled={assessmentLoading}>
              {assessmentLoading ? "Generating..." : "Re-run assessment"}
            </button>
          </div>
        </article>
        <article className="card panel">
          <h2>Finish Session</h2>
          {!goalChecksPassed ? <p className="item-sub" style={{ color: "#facc15" }}>Resolve goal statuses before final submit. Missing status: {unresolvedGoalCount}. Missing skip reason: {skippedWithoutReasonCount}.</p> : null}
          <div className="quick-actions">
            <button className="ghost-button" type="button" onClick={() => setTab("live")}>Back to draft</button>
          </div>
        </article>
        <article className="card panel">
          <h2>Discussion (Trainer + Client)</h2>
          <div className="card panel" style={{ marginBottom: 10 }}>
            {discussion.length === 0 ? (
              <p className="item-sub">No messages yet.</p>
            ) : (
              <ul className="list">
                {discussion.map((comment) => (
                  <li key={comment.id} className="list-item">
                    <div>
                      <p className="item-title">
                        {String(comment.author_name ?? "User")} · {String(comment.author_role ?? "trainer")}
                      </p>
                      <p className="item-sub">{comment.text}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="form-grid">
            <input value={sharedNote} onChange={(e) => setSharedNote(e.target.value)} placeholder="Reply to client..." />
            <button className="ghost-button" type="button" onClick={sendSharedNote}>Reply</button>
          </div>
        </article>
        <article className="card panel"><h2>Session Payment (UPI)</h2><div className="form-grid"><input placeholder="Amount INR" value={payment.amountInr} onChange={(e) => setPayment((p) => ({ ...p, amountInr: e.target.value }))} /><input placeholder="UPI ID" value={payment.upiId} onChange={(e) => setPayment((p) => ({ ...p, upiId: e.target.value }))} /><input placeholder="Payment note" value={payment.note} onChange={(e) => setPayment((p) => ({ ...p, note: e.target.value }))} /></div><button className="ghost-button" type="button" onClick={requestPayment}>Request payment</button></article>
        <article className="card panel">
          <h2>Payment Confirmation</h2>
          <label className="field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={paymentReceived} onChange={(e) => setPaymentReceived(e.target.checked)} />
            <span>I confirm payment has been received from client.</span>
          </label>
          <p className="item-sub">Finalization is enabled only after trainer confirms payment receipt.</p>
        </article>
        <article className="card panel">
          <h2>Publish to Client</h2>
          <textarea rows={3} value={publishText} onChange={(e) => setPublishText(e.target.value)} placeholder="Add trainer publish notes the client should see..." />
          <div className="quick-actions" style={{ marginTop: 8 }}>
            <button className="continue-btn" type="button" disabled={!readyToPublish || !goalChecksPassed || saving} onClick={publishToClient}>
              Publish Session Details
            </button>
          </div>
        </article>
        <article className="card panel">
          <h2>Lock Notes</h2>
          <label className="field full">
            <span>Final trainer comment (required)</span>
            <textarea rows={3} value={finalComment} onChange={(e) => setFinalComment(e.target.value)} placeholder="Add final closure note before locking..." />
          </label>
          <button className="continue-btn" type="button" disabled={saving || !paymentReceived || !finalComment.trim()} onClick={lockSessionNotes}>
            Lock Session Notes
          </button>
        </article>
      </> : null}

      {message ? <p className="item-sub" style={{ color: message.toLowerCase().includes("unable") || message.toLowerCase().includes("select") || message.toLowerCase().includes("resolve") ? "#fca5a5" : "#34d399" }}>{message}</p> : null}

      {searchModalOpen ? (
        <div className="modal-backdrop">
          <div className="modal-card card" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ margin: 0 }}>Search Exercise</h2>
              <button className="ghost-button" type="button" onClick={() => setSearchModalOpen(false)}>Close</button>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <input
                style={{ flex: 1 }}
                value={exerciseSearch}
                onChange={(e) => setExerciseSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") runExerciseSearch(exerciseSearch); }}
                placeholder="Type at least 4 characters…"
                autoFocus
              />
              <button className="mint-button" type="button" onClick={() => runExerciseSearch(exerciseSearch)}>Search</button>
            </div>
            <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
              {searchResults.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="ghost-button"
                  style={{ textAlign: "left" }}
                  onClick={() => (editorOpen && currentEntry ? mapSelectedExercise(item) : startAdhocExercise(item))}
                >
                  {item.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {showAddClient ? (
        <div className="modal-backdrop">
          <div className="modal-card card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><h2 style={{ margin: 0 }}>Add Client</h2><button className="ghost-button" type="button" onClick={() => setShowAddClient(false)}>Close</button></div>
            <div className="form-grid" style={{ marginTop: 12 }}>
              <label className="field full"><span>Name *</span><input placeholder="Client full name" value={newClient.name} onChange={(e)=>setNewClient((p)=>({...p,name:e.target.value}))} /></label>
              <label className="field full"><span>Goal</span><input placeholder="e.g. Strength / fat loss / mobility" value={newClient.goal} onChange={(e)=>setNewClient((p)=>({...p,goal:e.target.value}))} /></label>
              <label className="field full"><span>Mobile *</span><input placeholder="+91 98765 43210" value={newClient.mobile} onChange={(e)=>setNewClient((p)=>({...p,mobile:e.target.value}))} /></label>
              <label className="field"><span>Age</span><input value={newClient.age} onChange={(e)=>setNewClient((p)=>({...p,age:e.target.value}))} /></label>
              <label className="field"><span>Weight (kg)</span><input value={newClient.weightKg} onChange={(e)=>setNewClient((p)=>({...p,weightKg:e.target.value}))} /></label>
              <label className="field"><span>Height (cm)</span><input value={newClient.heightCm} onChange={(e)=>setNewClient((p)=>({...p,heightCm:e.target.value}))} /></label>
              <label className="field"><span>Sex</span><select value={newClient.gender} onChange={(e)=>setNewClient((p)=>({...p,gender:e.target.value}))}><option value="not set">not set</option><option value="female">female</option><option value="male">male</option><option value="other">other</option></select></label>
              <label className="field"><span>Activity level</span><select value={newClient.activityLevel} onChange={(e)=>setNewClient((p)=>({...p,activityLevel:e.target.value}))}><option value="not set">not set</option><option value="sedentary">sedentary</option><option value="lightly active">lightly active</option><option value="moderately active">moderately active</option><option value="very active">very active</option></select></label>
              <label className="field full"><span>Prior conditions / injuries (optional)</span><textarea rows={3} value={newClient.priorCondition} onChange={(e)=>setNewClient((p)=>({...p,priorCondition:e.target.value}))} /></label>
            </div>
            <button className="continue-btn" type="button" onClick={addClientInline}>Add Client</button>
          </div>
        </div>
      ) : null}
    </TrainerShell>
  );
}

