"use client";

import { useEffect, useState } from "react";
import ClientShell from "app/_components/ClientShell";

export default function Page() {
  const [tips, setTips] = useState(null);

  useEffect(() => {
    fetch("/api/client/tips")
      .then((r) => r.json())
      .then((json) => setTips(Array.isArray(json?.data?.tips) ? json.data.tips : []))
      .catch(() => setTips([]));
  }, []);

  return (
    <ClientShell title="Coach Tips" subtitle="Daily action points curated by your trainer.">
      <article className="card panel">
        <h2>From your trainer</h2>
        {tips === null ? (
          <p className="item-sub">Loading…</p>
        ) : tips.length === 0 ? (
          <div>
            <p className="item-title" style={{ color: "#94a3b8" }}>No tips yet</p>
            <p className="item-sub" style={{ marginTop: 6 }}>
              Your trainer will add tips and reminders for you here.
            </p>
          </div>
        ) : (
          <ul className="list">
            {tips.map((tip) => (
              <li key={tip.id} className="list-item" style={{ alignItems: "flex-start" }}>
                <div>
                  <p className="item-title">{tip.text}</p>
                  {tip.category && tip.category !== "general" ? (
                    <p className="item-sub" style={{ marginTop: 4, textTransform: "capitalize" }}>{tip.category}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </article>
    </ClientShell>
  );
}
