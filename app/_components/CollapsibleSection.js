"use client";

import { useId, useState } from "react";

export default function CollapsibleSection({
  title,
  subtitle = "",
  defaultOpen = false,
  badge = null,
  children,
  className = "card panel",
}) {
  const [open, setOpen] = useState(Boolean(defaultOpen));
  const panelId = useId();

  return (
    <article className={`${className} collapsible-section ${open ? "collapsible-section-open" : ""}`}>
      <button
        type="button"
        className="collapsible-section-toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="collapsible-section-copy">
          <strong>{title}</strong>
          {subtitle ? <small>{subtitle}</small> : null}
        </span>
        <span className="collapsible-section-meta">
          {badge ? <span className="status-chip">{badge}</span> : null}
          <span className="collapsible-section-chevron" aria-hidden="true">{open ? "▾" : "▸"}</span>
        </span>
      </button>
      {open ? (
        <div id={panelId} className="collapsible-section-body">
          {children}
        </div>
      ) : null}
    </article>
  );
}
