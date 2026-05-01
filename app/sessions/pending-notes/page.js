"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import TrainerShell from "app/_components/TrainerShell";

function kindForStatus(status) {
  if (status === "client_submitted") return "client";
  return "trainer";
}

export default function Page() {
  const [items, setItems] = useState([]);
  const [message, setMessage] = useState("");

  async function loadPending() {
    const response = await fetch("/api/sessions");
    const json = await response.json();
    const sessions = json?.data?.sessions ?? [];
    const pending = sessions.filter((item) =>
      ["pending_notes", "client_submitted", "draft"].includes(item.status)
    );
    setItems(pending);
  }

  useEffect(() => {
    loadPending();
  }, []);

  async function approve(sessionId) {
    setMessage("");
    const response = await fetch(`/api/sessions/${sessionId}/complete`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewer: "trainer" }),
    });
    const json = await response.json();
    if (!response.ok || !json?.ok) {
      setMessage(json?.message ?? "Unable to approve session.");
      return;
    }
    setMessage("Session approved and marked complete.");
    await loadPending();
  }

  return (
    <TrainerShell
      title="Pending Notes"
      subtitle="Trainer drafts, pending note work, and client self-logged sessions."
    >
      <article className="card panel">
        <h2>Action queue</h2>
        <p className="item-sub">
          Client self-log: approve after you review and capture details in the session record.
        </p>
        <p className="item-sub">
          Trainer draft or pending: open the session, finish mandatory sections and metrics, then mark complete on
          the detail screen.
        </p>
        <ul className="list">
          {items.length === 0 ? (
            <li className="list-item">
              <span>No pending sessions.</span>
            </li>
          ) : (
            items.map((item) => {
              const kind = kindForStatus(item.status);
              return (
                <li className="list-item" key={item.id}>
                  <div>
                    <p className="item-title">
                      {item.client_name_snapshot} — {item.session_title}
                    </p>
                    <p className="item-sub">
                      <span className="status-chip">{item.status}</span>
                      {kind === "client" ? " · Client submitted" : " · Trainer workspace"}
                    </p>
                    {item.raw_notes_preview ? (
                      <p className="item-sub" style={{ marginTop: "0.35rem" }}>
                        {item.raw_notes_preview}
                        {item.raw_notes_preview.length >= 200 ? "…" : ""}
                      </p>
                    ) : null}
                  </div>
                  <div className="quick-actions">
                    <Link href={`/sessions/${item.id}`} className="ghost-button">
                      Review
                    </Link>
                    {item.status === "client_submitted" ? (
                      <button className="mint-button" type="button" onClick={() => approve(item.id)}>
                        Approve
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })
          )}
        </ul>
        {message ? <p className="item-sub">{message}</p> : null}
      </article>
    </TrainerShell>
  );
}
