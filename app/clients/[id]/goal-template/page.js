"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import TrainerShell from "app/_components/TrainerShell";

function newMetric() {
  return { measurement: "", metricName: "", metricValue: "" };
}

function newExercise() {
  return { exercise: "", metrics: [newMetric()] };
}

export default function Page() {
  const params = useParams();
  const clientId = useMemo(() => String(params?.id ?? ""), [params]);
  const [clientName, setClientName] = useState("Client");
  const [exercises, setExercises] = useState([newExercise()]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    (async () => {
      const response = await fetch(`/api/clients/${clientId}/goal-template`);
      const json = await response.json();
      if (cancelled) return;
      const template = json?.data?.goalTemplate;
      setClientName(template?.name ?? "Client");
      if (Array.isArray(template?.exercises) && template.exercises.length > 0) {
        setExercises(template.exercises);
      }
    })().catch(() => null);
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  function setExerciseField(index, key, value) {
    setExercises((prev) => prev.map((e, i) => (i === index ? { ...e, [key]: value } : e)));
  }

  function setMetricField(exIndex, metricIndex, key, value) {
    setExercises((prev) =>
      prev.map((ex, i) =>
        i !== exIndex
          ? ex
          : {
              ...ex,
              metrics: ex.metrics.map((m, j) => (j === metricIndex ? { ...m, [key]: value } : m)),
            }
      )
    );
  }

  function addExercise() {
    setExercises((prev) => [...prev, newExercise()]);
  }

  function removeExercise(index) {
    setExercises((prev) => prev.filter((_, i) => i !== index));
  }

  function addMetricRow(exIndex) {
    setExercises((prev) =>
      prev.map((ex, i) => (i === exIndex ? { ...ex, metrics: [...ex.metrics, newMetric()] } : ex))
    );
  }

  function removeMetricRow(exIndex, metricIndex) {
    setExercises((prev) =>
      prev.map((ex, i) =>
        i === exIndex ? { ...ex, metrics: ex.metrics.filter((_, j) => j !== metricIndex) } : ex
      )
    );
  }

  async function saveTemplate() {
    setMessage("");
    setSaving(true);
    try {
      const response = await fetch(`/api/clients/${clientId}/goal-template`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exercises }),
      });
      const json = await response.json();
      if (!response.ok || !json?.ok) {
        setMessage(json?.message ?? "Could not save goal template.");
        return;
      }
      setMessage("Goal template saved.");
    } catch {
      setMessage("Could not save goal template.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <TrainerShell title={clientName} subtitle="Client goal setup">
      <article className="card panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p className="eyebrow" style={{ marginTop: 0 }}>Client goal setup</p>
            <h2 style={{ margin: "6px 0 0" }}>{clientName}</h2>
          </div>
          <Link href={`/clients/${clientId}`} className="ghost-button">Back</Link>
        </div>
        <p className="item-sub">This template becomes the mandatory goal progress card for every session.</p>

        <div style={{ display: "grid", gap: 12 }}>
          {exercises.map((exercise, exIndex) => (
            <div key={`ex-${exIndex}`} className="metric-card">
              <div className="form-grid">
                <label className="field full">
                  <span>Goal exercise {exIndex + 1}</span>
                  <input
                    value={exercise.exercise}
                    onChange={(e) => setExerciseField(exIndex, "exercise", e.target.value)}
                    placeholder="Goal exercise (e.g. chest press)"
                  />
                </label>

                {(exercise.metrics ?? []).map((metric, metricIndex) => (
                  <div key={`m-${exIndex}-${metricIndex}`} className="form-grid" style={{ gridColumn: "1 / -1" }}>
                    <label className="field">
                      <span>Measurement name</span>
                      <input
                        value={metric.measurement}
                        onChange={(e) => setMetricField(exIndex, metricIndex, "measurement", e.target.value)}
                      />
                    </label>
                    <label className="field">
                      <span>Metric name</span>
                      <input
                        value={metric.metricName}
                        onChange={(e) => setMetricField(exIndex, metricIndex, "metricName", e.target.value)}
                        placeholder="e.g. reps"
                      />
                    </label>
                    <label className="field">
                      <span>Metric value</span>
                      <input
                        value={metric.metricValue}
                        onChange={(e) => setMetricField(exIndex, metricIndex, "metricValue", e.target.value)}
                        placeholder="e.g. 12"
                      />
                    </label>
                    <button className="ghost-button" type="button" onClick={() => removeMetricRow(exIndex, metricIndex)}>
                      X
                    </button>
                  </div>
                ))}
              </div>
              <div className="quick-actions" style={{ marginTop: 8 }}>
                <button className="ghost-button" type="button" onClick={() => addMetricRow(exIndex)}>
                  + Add metric row
                </button>
                <button className="ghost-button" type="button" onClick={() => removeExercise(exIndex)}>
                  X
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="quick-actions" style={{ marginTop: 8 }}>
          <button className="ghost-button" type="button" onClick={addExercise}>+ Add goal exercise</button>
        </div>

        <p className="item-sub">Each measurement row must include all 3 fields: measurement name, metric name, and metric value.</p>
        {message ? <p className="item-sub" style={{ color: message.includes("saved") ? "#34d399" : "#fca5a5" }}>{message}</p> : null}
        <button className="continue-btn" type="button" onClick={saveTemplate} disabled={saving}>
          {saving ? "Saving..." : "Save Goal Template"}
        </button>
      </article>
    </TrainerShell>
  );
}
