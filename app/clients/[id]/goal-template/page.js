"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import TrainerShell from "app/_components/TrainerShell";

export default function Page() {
  const params = useParams();
  const clientId = useMemo(() => String(params?.id ?? ""), [params]);
  const [template, setTemplate] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/clients/${clientId}/goal-template`);
        const json = await response.json();
        const gt = json?.data?.goalTemplate ?? null;
        if (!cancelled) {
          setTemplate(gt);
        }
      } catch {
        if (!cancelled) setMessage("Could not load goal template.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  if (!template && !message) {
    return (
      <TrainerShell title="Goal Template" subtitle="Mandatory per-session goal tracking fields.">
        <article className="card panel">
          <p className="item-sub">Loading…</p>
        </article>
      </TrainerShell>
    );
  }

  if (!template) {
    return (
      <TrainerShell title="Goal Template" subtitle="Mandatory per-session goal tracking fields.">
        <article className="card panel">
          <p className="item-sub">{message || "No template for this client."}</p>
        </article>
      </TrainerShell>
    );
  }

  return (
    <TrainerShell title="Goal Template" subtitle="Mandatory per-session goal tracking fields.">
      <article className="card panel">
        <h2>Client goal</h2>
        <p className="item-title">{template.name}</p>
        <p className="item-sub">{template.goal || "No primary goal text on file."}</p>
      </article>

      <article className="card panel">
        <h2>Required updates every session</h2>
        <p className="item-sub">
          Field definitions are recovery defaults until a dedicated template table exists; values are captured in
          session payload and notes on the trainer side.
        </p>
        <div className="form-grid">
          {(template.sessionFields ?? []).map((field) => (
            <label className={field.input === "textarea" ? "field full" : "field"} key={field.key}>
              <span>
                {field.label}
                {field.required ? " *" : ""}
              </span>
              {field.input === "textarea" ? (
                <textarea rows={4} readOnly placeholder="Persisted via session flow (coming next)" />
              ) : (
                <input
                  type={field.input === "number" ? "number" : "text"}
                  readOnly
                  step={field.step}
                  min={field.min}
                  max={field.max}
                  placeholder="—"
                />
              )}
            </label>
          ))}
        </div>
        <div className="quick-actions">
          <button className="mint-button" type="button" disabled>
            Save template update
          </button>
        </div>
      </article>
    </TrainerShell>
  );
}
