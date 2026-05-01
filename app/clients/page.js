"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import TrainerShell from "app/_components/TrainerShell";

const EMPTY_FORM = {
  name: "",
  goal: "",
  mobile: "",
  age: "",
  weightKg: "",
  heightCm: "",
  gender: "not set",
  activityLevel: "not set",
  priorCondition: "",
};

export default function Page() {
  const [clients, setClients] = useState([]);
  const [error, setError] = useState("");
  const [modalError, setModalError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [billing, setBilling] = useState({ status: "trial", maxClients: 5, perClientCostInr: 99 });
  const [form, setForm] = useState(EMPTY_FORM);

  async function loadClients() {
    try {
      const [clientsRes, profileRes, pricingRes] = await Promise.all([
        fetch("/api/clients"),
        fetch("/api/profile/trainer"),
        fetch("/api/auth/pricing"),
      ]);
      const clientsJson = await clientsRes.json();
      const profileJson = await profileRes.json();
      const pricingJson = await pricingRes.json();
      const trainer = profileJson?.data?.trainer ?? {};
      const isTrial = String(trainer?.billing_status ?? "trial").toLowerCase() === "trial";
      setClients(clientsJson?.data?.clients ?? []);
      setBilling({
        status: isTrial ? "trial" : "per_client",
        maxClients: Number(
          trainer?.max_clients ??
            (isTrial ? pricingJson?.data?.billingModels?.trial?.clientLimit ?? 5 : 5000)
        ),
        perClientCostInr: Number(pricingJson?.data?.billingModels?.perClient?.perClientCostInr ?? 99),
      });
      setError("");
    } catch {
      setError("Could not load clients.");
      setClients([]);
    }
  }

  const isTrial = billing.status === "trial";
  const slotsLeft = Math.max(0, Number(billing.maxClients || 0) - clients.length);
  const atCapacity = slotsLeft <= 0;

  useEffect(() => {
    loadClients();
  }, []);

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (modalError) setModalError("");
  }

  async function addClient() {
    if (atCapacity) {
      setModalError(
        isTrial
          ? "Trial client limit reached. Switch plan from Profile to add more clients."
          : "Client limit reached for current plan. Contact support to increase your limit."
      );
      return;
    }
    if (!form.name.trim() || !form.mobile.trim()) {
      setModalError("Name and mobile are required.");
      return;
    }
    setSaving(true);
    setModalError("");
    try {
      const response = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await response.json();
      if (!response.ok || !json?.ok) {
        const message = String(json?.message ?? "Could not add client.");
        if (response.status === 409) {
          setModalError(message || "This mobile number already exists. Use a different number.");
        } else {
          setModalError(message);
        }
        return;
      }
      setShowModal(false);
      setForm(EMPTY_FORM);
      setModalError("");
      await loadClients();
    } catch {
      setModalError("Could not add client.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <TrainerShell title="Clients" subtitle="Track each client and progress details.">
      <article className="card panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <h2 style={{ margin: 0 }}>Clients</h2>
          <button className="mint-button" type="button" onClick={() => setShowModal(true)}>
            + Add Client
          </button>
        </div>
        <p className="item-sub" style={{ marginTop: 8 }}>
          {isTrial
            ? `Free trial up to X clients: ${clients.length}/${billing.maxClients} used (${slotsLeft} slots left).`
            : `Per-client pricing after threshold: INR ${billing.perClientCostInr} per active client / month.`}
        </p>

        {error ? <p className="item-sub" style={{ color: "#fca5a5" }}>{error}</p> : null}

        {clients.length === 0 ? (
          <div className="card panel" style={{ marginTop: 12, textAlign: "center" }}>
            <p className="item-title">No clients yet</p>
            <p className="item-sub">Add your first client to get started</p>
          </div>
        ) : (
          <ul className="list" style={{ marginTop: 12 }}>
            {clients.map((c) => (
              <li className="list-item" key={c.id}>
                <Link
                  href={`/clients/${c.id}`}
                  style={{
                    textDecoration: "none",
                    color: "inherit",
                    display: "block",
                    width: "100%",
                  }}
                >
                  <p className="item-title">{c.name}</p>
                  <p className="item-sub">{c.goal || "No goal set"}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </article>

      {showModal ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setShowModal(false)}>
          <div className="modal-card card" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ margin: 0 }}>Add Client</h2>
              <button
                className="ghost-button"
                type="button"
                onClick={() => {
                  setShowModal(false);
                  setModalError("");
                }}
              >
                Close
              </button>
            </div>
            <div className="form-grid" style={{ marginTop: 12 }}>
              <label className="field full">
                <span>Name *</span>
                <input value={form.name} onChange={(e) => setField("name", e.target.value)} placeholder="Client full name" />
              </label>
              <label className="field full">
                <span>Goal</span>
                <input value={form.goal} onChange={(e) => setField("goal", e.target.value)} placeholder="e.g. Strength and conditioning" />
              </label>
              <label className="field full">
                <span>Mobile (required for client OTP login) *</span>
                <input value={form.mobile} onChange={(e) => setField("mobile", e.target.value)} placeholder="+91 98765 43210" />
              </label>
              <label className="field">
                <span>Age</span>
                <input type="number" value={form.age} onChange={(e) => setField("age", e.target.value)} />
              </label>
              <label className="field">
                <span>Weight (kg)</span>
                <input type="number" value={form.weightKg} onChange={(e) => setField("weightKg", e.target.value)} />
              </label>
              <label className="field">
                <span>Height (cm)</span>
                <input type="number" value={form.heightCm} onChange={(e) => setField("heightCm", e.target.value)} />
              </label>
              <label className="field full">
                <span>Sex</span>
                <select value={form.gender} onChange={(e) => setField("gender", e.target.value)}>
                  <option>not set</option>
                  <option>female</option>
                  <option>male</option>
                  <option>other</option>
                </select>
              </label>
              <label className="field">
                <span>Activity</span>
                <select value={form.activityLevel} onChange={(e) => setField("activityLevel", e.target.value)}>
                  <option>not set</option>
                  <option>sedentary</option>
                  <option>lightly active</option>
                  <option>moderately active</option>
                  <option>very active</option>
                </select>
              </label>
              <label className="field full">
                <span>Prior conditions / injuries (optional)</span>
                <textarea
                  rows={3}
                  value={form.priorCondition}
                  onChange={(e) => setField("priorCondition", e.target.value)}
                  placeholder="e.g. lower back pain, knee surgery history, asthma"
                />
              </label>
            </div>
            {modalError ? <p className="item-sub" style={{ color: "#fca5a5", marginTop: 10 }}>{modalError}</p> : null}
            <button className="continue-btn" type="button" disabled={saving} onClick={addClient}>
              {saving ? "Adding..." : "Add Client"}
            </button>
          </div>
        </div>
      ) : null}
    </TrainerShell>
  );
}
