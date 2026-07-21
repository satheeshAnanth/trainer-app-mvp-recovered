"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import TrainerShell from "app/_components/TrainerShell";
import TrainerInsightsPanel from "app/_components/TrainerInsightsPanel";
import CollapsibleSection from "app/_components/CollapsibleSection";
import { useToast } from "app/_components/ToastProvider";

const ALL_SKILLS = [
  "Strength Training",
  "Cardio & Conditioning",
  "Yoga & Flexibility",
  "Sports Performance",
  "Rehabilitation",
  "Nutrition & Wellness",
  "General Fitness",
];

export default function Page() {
  const [profile, setProfile] = useState(null);
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [skills, setSkills] = useState([]);
  const [billing, setBilling] = useState({ status: "trial", maxClients: 5 });
  const [pricing, setPricing] = useState({ billingModels: { trial: { clientLimit: 5 }, perClient: { perClientCostInr: 99 } } });
  const [clientCount, setClientCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [referralCode, setReferralCode] = useState(null);
  const [referredCount, setReferredCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    (async () => {
      try {
        const [profileRes, sessionRes, pricingRes, clientsRes, referralRes] = await Promise.all([
          fetch("/api/profile/trainer"),
          fetch("/api/auth/session"),
          fetch("/api/auth/pricing"),
          fetch("/api/clients"),
          fetch("/api/referrals"),
        ]);
        const profileJson = await profileRes.json();
        const sessionJson = await sessionRes.json();
        const pricingJson = await pricingRes.json();
        const clientsJson = await clientsRes.json();
        const referralJson = await referralRes.json().catch(() => null);
        const trainer = profileJson?.data?.trainer ?? null;
        const sessionUser = sessionJson?.data?.user ?? {};
        if (referralJson?.data?.referralCode) setReferralCode(referralJson.data.referralCode);
        if (typeof referralJson?.data?.referredCount === "number") setReferredCount(referralJson.data.referredCount);
        setProfile(trainer);
        setName(trainer?.name ?? sessionUser?.name ?? "");
        setMobile(trainer?.phone ?? sessionUser?.phone ?? "");
        const normalized = String(trainer?.specialization ?? "")
          .split(/[;,]/)
          .map((s) => s.trim())
          .filter(Boolean);
        setSkills(normalized);
        setBilling({
          status: String(trainer?.billing_status ?? "trial"),
          maxClients: Number(trainer?.max_clients ?? 5),
        });
        if (pricingJson?.data) setPricing((prev) => ({ ...prev, ...pricingJson.data }));
        setClientCount((clientsJson?.data?.clients ?? []).length);
      } catch {
        setProfile(null);
      }
    })();
  }, []);

  const specialization = useMemo(() => skills.join(", "), [skills]);
  const isTrial = String(billing.status).toLowerCase() === "trial";
  const perClientCost = Number(pricing?.billingModels?.perClient?.perClientCostInr ?? 99);
  const trialLimit = Number(pricing?.billingModels?.trial?.clientLimit ?? 5);
  const maxClients = Number(billing.maxClients || (isTrial ? trialLimit : 5000));

  function toggleSkill(skill) {
    setSkills((prev) => (prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]));
  }

  async function saveProfile() {
    setSaving(true);
    try {
      const res = await fetch("/api/profile/trainer", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, specialization }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.message ?? "Unable to save profile.");
      showToast("Profile saved.");
      setProfile((prev) => ({ ...(prev || {}), name, phone: mobile, specialization }));
    } catch (e) {
      showToast(e?.message ?? "Unable to save profile.", { variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/session", { method: "DELETE" });
    window.location.href = "/login";
  }

  return (
    <TrainerShell title="Profile" subtitle="">
      <CollapsibleSection title="Account" subtitle="Name and specializations" defaultOpen>
        <div className="form-grid">
          <label className="field full">
            <span>Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="field full">
            <span>Mobile Number (locked)</span>
            <input value={mobile} disabled />
          </label>
        </div>

        <p className="item-title" style={{ marginTop: 10 }}>Skills / Specializations</p>
        <div className="spec-grid">
          {ALL_SKILLS.map((skill) => {
            const active = skills.includes(skill);
            return (
              <button
                key={skill}
                type="button"
                className={`spec-item ${active ? "spec-item-active" : ""}`}
                onClick={() => toggleSkill(skill)}
              >
                {active ? "✓ " : "○ "}
                {skill}
              </button>
            );
          })}
        </div>

        <button className="continue-btn" type="button" onClick={saveProfile} disabled={saving}>
          Save Profile
        </button>
      </CollapsibleSection>

      <CollapsibleSection
        title="Billing"
        subtitle={isTrial ? `${clientCount}/${maxClients} trial clients` : `${clientCount} active clients`}
        badge={`${Math.max(0, maxClients - clientCount)} left`}
        defaultOpen={false}
      >
        <div className="list-item">
          <div>
            <p className="item-title">{isTrial ? "Free trial up to X clients" : "Per-client pricing after threshold"}</p>
            <p className="item-sub">
              {isTrial
                ? `${clientCount}/${maxClients} clients used in trial`
                : `INR ${perClientCost} per active client per month · ${clientCount} active clients`}
            </p>
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Share & Grow" subtitle="Referral and public profile" defaultOpen={false}>
        {referralCode ? (
          <>
            <div className="list-item" style={{ alignItems: "flex-start", flexDirection: "column", gap: 10 }}>
              <div style={{ width: "100%" }}>
                <p className="item-title">Your referral link</p>
                <p className="item-sub" style={{ marginBottom: 8 }}>
                  Share this link — when another trainer signs up through it, they&apos;ll be linked to you.
                  {referredCount > 0 ? ` You&apos;ve referred ${referredCount} trainer${referredCount !== 1 ? "s" : ""} so far.` : ""}
                </p>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <code style={{
                    flex: 1, minWidth: 0, padding: "8px 12px",
                    background: "rgba(255,255,255,0.05)", borderRadius: 6,
                    fontSize: 13, color: "#cbd5e1", wordBreak: "break-all",
                    border: "1px solid #1e293b",
                  }}>
                    {typeof window !== "undefined" ? window.location.origin : ""}/join?ref={referralCode}
                  </code>
                  <button
                    type="button"
                    className="ghost-button ghost-button-sm"
                    onClick={async () => {
                      const url = `${window.location.origin}/join?ref=${referralCode}`;
                      try {
                        const { Capacitor } = await import("@capacitor/core");
                        if (Capacitor.isNativePlatform()) {
                          const { Clipboard } = await import("@capacitor/clipboard");
                          await Clipboard.write({ string: url });
                        } else {
                          await navigator.clipboard.writeText(url);
                        }
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      } catch { /* ignore */ }
                    }}
                  >
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>
            </div>
            <div className="list-item" style={{ marginTop: 12 }}>
              <div>
                <p className="item-title">Your public profile</p>
                <p className="item-sub">Shareable link for potential clients to find and connect with you.</p>
              </div>
              <a
                href={`/t/${referralCode}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ghost-button ghost-button-sm"
              >
                View
              </a>
            </div>
          </>
        ) : (
          <p className="item-sub">Coming soon</p>
        )}
      </CollapsibleSection>

      <CollapsibleSection title="Exercise Library" subtitle="Browse master catalog" defaultOpen={false}>
        <p className="item-sub" style={{ marginBottom: 12 }}>Browse the master catalog and watch form examples.</p>
        <Link href="/exercises" className="ghost-button" style={{ display: "inline-block" }}>Open exercise library</Link>
      </CollapsibleSection>

      <CollapsibleSection title="Insights" subtitle="Progress snapshot" defaultOpen={false}>
        <p className="item-sub" style={{ marginBottom: 12 }}>Progress snapshot is now part of your profile workspace.</p>
        <TrainerInsightsPanel />
      </CollapsibleSection>

      <CollapsibleSection title="Settings" defaultOpen={false}>
        <div className="list-item">
          <span>Notifications</span>
          <span className="item-sub">Coming soon</span>
        </div>
        <div className="list-item" style={{ marginTop: 8 }}>
          <span>Theme</span>
          <button className="ghost-button" type="button">☼ Light</button>
        </div>
      </CollapsibleSection>

      <article className="card panel">
        <h2>Session</h2>
        <button className="ghost-button" type="button" style={{ width: "100%", borderColor: "#7f1d1d", color: "#fca5a5" }} onClick={logout}>
          Logout
        </button>
        <p className="item-sub" style={{ textAlign: "center", marginTop: 10 }}>Trainer App MVP v0.1.0</p>
      </article>

    </TrainerShell>
  );
}
