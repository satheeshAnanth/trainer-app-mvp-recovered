"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import TrainerShell from "app/_components/TrainerShell";

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
    setMessage("Session approved.");
    await loadPending();
  }

  return (
    <TrainerShell title="Pending Notes" subtitle="Sessions waiting for mandatory sections completion.">
      <article className="card panel">
        <h2>Action required</h2>
        <ul className="list">
          {items.length === 0 ? (
            <li className="list-item"><span>No pending sessions.</span></li>
          ) : (
            items.map((item) => (
              <li className="list-item" key={item.id}>
                <div>
                  <p className="item-title">{item.client_name_snapshot} - {item.session_title}</p>
                  <p className="item-sub">Status: {item.status}</p>
                </div>
                <div className="quick-actions">
                  <Link href={`/sessions/${item.id}`} className="ghost-button">Review</Link>
                  <button className="mint-button" type="button" onClick={() => approve(item.id)}>Approve</button>
                </div>
              </li>
            ))
          )}
        </ul>
        {message ? <p className="item-sub">{message}</p> : null}
      </article>
    </TrainerShell>
  );
}
