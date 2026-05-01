"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import TrainerShell from "app/_components/TrainerShell";

const CATEGORIES = ["all", "form", "nutrition", "recovery", "mindset", "lifestyle"];

export default function Page() {
  const params = useParams();
  const clientId = useMemo(() => String(params?.id ?? ""), [params]);
  const [clientName, setClientName] = useState("Trainer Tips");
  const [tips, setTips] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [text, setText] = useState("");
  const [category, setCategory] = useState("form");
  const [message, setMessage] = useState("");

  async function loadTips() {
    const response = await fetch(
      `/api/clients/${clientId}/tips?status=${encodeURIComponent(statusFilter)}&category=${encodeURIComponent(categoryFilter)}`
    );
    const json = await response.json();
    setTips(json?.data?.tips ?? []);
  }

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    (async () => {
      const clientRes = await fetch(`/api/clients/${clientId}`);
      const clientJson = await clientRes.json();
      if (!cancelled) setClientName(clientJson?.data?.client?.name ?? "Trainer Tips");
      if (!cancelled) await loadTips();
    })().catch(() => null);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  useEffect(() => {
    if (!clientId) return;
    loadTips().catch(() => null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, categoryFilter]);

  async function sendTip() {
    setMessage("");
    if (!text.trim()) {
      setMessage("Enter a tip before sending.");
      return;
    }
    const response = await fetch(`/api/clients/${clientId}/tips`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, category }),
    });
    const json = await response.json();
    if (!response.ok || !json?.ok) {
      setMessage(json?.message ?? "Could not send tip.");
      return;
    }
    setText("");
    setMessage("Tip sent.");
    await loadTips();
  }

  return (
    <TrainerShell title="Trainer Tips" subtitle={clientName}>
      <article className="card panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0 }}>Trainer Tips</h2>
          <Link href={`/clients/${clientId}`} className="ghost-button">Back</Link>
        </div>
        <p className="item-sub">Send one-way advice. Client can mark each tip as read.</p>
        <label className="field full">
          <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Share coaching tip..." />
        </label>
        <label className="field">
          <span>Category</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.slice(1).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
        <div className="quick-actions" style={{ marginTop: 8 }}>
          <button className="mint-button" type="button" onClick={sendTip}>Send Tip</button>
        </div>
      </article>

      <article className="card panel">
        <div className="quick-actions">
          {[
            ["all", "All"],
            ["unread", "Unread"],
            ["read", "Read"],
          ].map(([key, label]) => (
            <button
              key={key}
              className={statusFilter === key ? "mint-button" : "ghost-button"}
              type="button"
              onClick={() => setStatusFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="quick-actions" style={{ marginTop: 8 }}>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              className={categoryFilter === c ? "mint-button" : "ghost-button"}
              type="button"
              onClick={() => setCategoryFilter(c)}
            >
              {c === "all" ? "All categories" : c}
            </button>
          ))}
        </div>

        <div className="card panel" style={{ marginTop: 10 }}>
          {tips.length === 0 ? (
            <p className="item-sub">No tips for this filter.</p>
          ) : (
            <ul className="list">
              {tips.map((tip) => (
                <li key={tip.id} className="list-item">
                  <div>
                    <p className="item-title">{tip.category}</p>
                    <p className="item-sub">{tip.text}</p>
                  </div>
                  <span className="status-chip">{tip.read ? "read" : "unread"}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {message ? <p className="item-sub">{message}</p> : null}
      </article>
    </TrainerShell>
  );
}
