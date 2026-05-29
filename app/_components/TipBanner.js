"use client";

import { useEffect, useState } from "react";

export default function TipBanner({ storageKey, title, steps }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(storageKey)) setVisible(true);
    } catch { /* storage unavailable */ }
  }, [storageKey]);

  function dismiss() {
    try { localStorage.setItem(storageKey, "1"); } catch { /* ignore */ }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div style={{
      background: "linear-gradient(135deg, rgba(45,212,191,0.10), rgba(45,212,191,0.04))",
      border: "1px solid rgba(45,212,191,0.30)",
      borderRadius: 14,
      padding: "14px 16px",
      marginBottom: 14,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <p className="eyebrow" style={{ margin: 0, color: "var(--mint)" }}>How this works</p>
        <button
          type="button"
          onClick={dismiss}
          style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: 0 }}
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
      <p className="item-title" style={{ marginTop: 6, marginBottom: 10 }}>{title}</p>
      <ol style={{ margin: 0, padding: "0 0 0 18px", display: "grid", gap: 6 }}>
        {steps.map((step, i) => (
          <li key={i} style={{ color: "#cbd5e1", fontSize: 14, lineHeight: 1.5 }}>{step}</li>
        ))}
      </ol>
      <button
        type="button"
        onClick={dismiss}
        className="ghost-button ghost-button-sm"
        style={{ marginTop: 12 }}
      >
        Got it
      </button>
    </div>
  );
}
