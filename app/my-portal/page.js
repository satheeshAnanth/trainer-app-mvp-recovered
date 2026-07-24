"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ClientShell from "app/_components/ClientShell";
import CollapsibleSection from "app/_components/CollapsibleSection";
import {
  buildGoalProgressSnapshot,
  buildRecentActivity,
  countPendingScheduleConfirmations,
  deriveHeroCopy,
  describeScheduleCard,
  formatSessionDateShort,
  listOutstandingPayments,
  listSessionsAwaitingTrainerFeedback,
  normalizeClientSession,
  pickNextScheduleItem,
  sumPayments,
} from "app/lib/clientDashboard";

function primaryCta({ pendingConfirmCount, paymentTotalInr, feedbackSessions }) {
  if (pendingConfirmCount > 0) {
    return { href: "/my-portal/schedule", label: "Review schedule" };
  }
  if (paymentTotalInr > 0) {
    return { href: "/my-portal/payments", label: "Open payments" };
  }
  if (feedbackSessions.length > 0) {
    return { href: "/my-portal/progress", label: "Open progress" };
  }
  return { href: "/my-portal/self-log", label: "Log a workout" };
}

export default function Page() {
  const [sessions, setSessions] = useState([]);
  const [scheduleEvents, setScheduleEvents] = useState([]);
  const [clientName, setClientName] = useState("");
  const [profileGoal, setProfileGoal] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [authRes, sessRes, schedRes, profileRes] = await Promise.all([
          fetch("/api/client-auth/session"),
          fetch("/api/client/sessions"),
          fetch("/api/schedule/events"),
          fetch("/api/client/profile"),
        ]);

        const authJson = authRes.ok ? await authRes.json() : null;
        const sessJson = sessRes.ok ? await sessRes.json() : null;
        const schedJson = schedRes.ok ? await schedRes.json() : null;
        const profileJson = profileRes.ok ? await profileRes.json() : null;

        if (cancelled) return;

        const user = authJson?.data?.user;
        if (user?.name) setClientName(String(user.name));

        const rawSessions = sessJson?.data?.sessions;
        setSessions(Array.isArray(rawSessions) ? rawSessions : []);

        const rawEvents = schedJson?.data?.events;
        setScheduleEvents(Array.isArray(rawEvents) ? rawEvents : []);

        const prof = profileJson?.data?.profile ?? profileJson?.data;
        const goal = prof?.goal ?? "";
        if (goal) setProfileGoal(String(goal));
      } catch {
        if (!cancelled) {
          setSessions([]);
          setScheduleEvents([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const model = useMemo(() => {
    const feedbackSessions = listSessionsAwaitingTrainerFeedback(sessions);
    const paymentLines = listOutstandingPayments(sessions);
    const paymentTotalInr = sumPayments(paymentLines);
    const pendingConfirmCount = countPendingScheduleConfirmations(scheduleEvents);
    const nextEvent = pickNextScheduleItem(scheduleEvents);
    const goalSnapshot = buildGoalProgressSnapshot(sessions, profileGoal);
    const activity = buildRecentActivity(sessions, scheduleEvents, { limit: 10 });
    const { welcomeTitle, subtitle } = deriveHeroCopy({
      clientName,
      pendingConfirmCount,
      paymentTotalInr,
      feedbackSessions,
      nextEvent,
    });
    const cta = primaryCta({ pendingConfirmCount, paymentTotalInr, feedbackSessions });
    const scheduleCard = describeScheduleCard(nextEvent);

    return {
      feedbackSessions,
      paymentLines,
      paymentTotalInr,
      pendingConfirmCount,
      nextEvent,
      goalSnapshot,
      activity,
      welcomeTitle,
      subtitle,
      cta,
      scheduleCard,
    };
  }, [sessions, scheduleEvents, clientName, profileGoal]);

  const goalPct =
    model.goalSnapshot.total > 0
      ? Math.round((model.goalSnapshot.completed / model.goalSnapshot.total) * 100)
      : 0;

  return (
    <ClientShell title={model.welcomeTitle} subtitle={model.subtitle}>
      <section
        className="card panel"
        style={{
          borderLeft: "4px solid var(--mint)",
          background: "linear-gradient(135deg, rgba(45, 212, 191, 0.08), transparent)",
        }}
      >
        <div className="quick-actions" style={{ marginTop: 0 }}>
          <Link className="mint-button mint-button-sm" href={model.cta.href}>
            {loading ? "Loading…" : model.cta.label}
          </Link>
        </div>
      </section>

      <div
        style={{
          display: "grid",
          gap: 14,
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
        }}
      >
        <article className="card panel">
          <h2>Next session</h2>
          {loading ? (
            <p className="item-sub">Loading calendar…</p>
          ) : model.scheduleCard ? (
            <div>
              <p className="item-title">
                {model.scheduleCard.dateLabel} · {model.scheduleCard.timeLabel}
              </p>
              <p className="item-sub" style={{ marginTop: 6 }}>
                {model.scheduleCard.notes || "Coaching appointment"}
              </p>
              <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <span className="status-chip">{model.scheduleCard.statusLabel}</span>
                {model.pendingConfirmCount > 0 ? (
                  <span className="status-chip" style={{ color: "#facc15", borderColor: "rgba(250, 204, 21, 0.35)" }}>
                    {model.pendingConfirmCount} awaiting confirmation
                  </span>
                ) : (
                  <span className="status-chip" style={{ color: "#94a3b8" }}>
                    Schedule clear
                  </span>
                )}
              </div>
              <Link className="mint-button mint-button-sm" href="/my-portal/schedule" style={{ marginTop: 14, display: "inline-block" }}>
                Open schedule
              </Link>
            </div>
          ) : (
            <div>
              <p className="item-sub">No upcoming sessions on your calendar.</p>
              <p className="item-sub" style={{ marginTop: 8 }}>
                {model.pendingConfirmCount > 0
                  ? `${model.pendingConfirmCount} request(s) waiting on confirmation.`
                  : "Request a time that works for you."}
              </p>
              <Link className="mint-button mint-button-sm" href="/my-portal/schedule" style={{ marginTop: 14, display: "inline-block" }}>
                Manage schedule
              </Link>
            </div>
          )}
        </article>

        <article className="card panel">
          <h2>Coach feedback</h2>
          {loading ? (
            <p className="item-sub">Loading sessions…</p>
          ) : model.feedbackSessions.length === 0 ? (
            <div>
              <p className="panel-value">
                All caught up
              </p>
              <p className="item-sub" style={{ marginTop: 8 }}>
                Nothing is waiting on your trainer right now.
              </p>
            </div>
          ) : (
            <div>
              <p className="panel-value">
                {model.feedbackSessions.length}
              </p>
              <p className="item-sub" style={{ marginTop: 4 }}>
                {model.feedbackSessions.length === 1 ? "Session needs coach input" : "Sessions need coach input"}
              </p>
              <ul className="list" style={{ marginTop: 12 }}>
                {model.feedbackSessions.slice(0, 3).map((raw) => {
                  const s = normalizeClientSession(raw);
                  return (
                    <li key={s.id} className="list-item" style={{ alignItems: "flex-start" }}>
                      <div>
                        <p className="item-title">{s.sessionTitle}</p>
                        <p className="item-sub">{formatSessionDateShort(s.sessionDate) || "Date TBD"}</p>
                      </div>
                      <span className="status-chip" style={{ color: "#fbbf24" }}>
                        {s.status === "client_submitted" ? "Submitted" : "In review"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </article>

        <article className="card panel">
          <h2>Goal progress</h2>
          {model.goalSnapshot.total === 0 ? (
            <div>
              {model.goalSnapshot.primaryGoal ? (
                <>
                  <p className="item-title">{model.goalSnapshot.primaryGoal}</p>
                  <p className="item-sub" style={{ marginTop: 8 }}>
                    Goal-linked exercises will appear here as your coach logs sessions.
                  </p>
                </>
              ) : (
                <p className="item-sub">Your coach will connect session work to your goals here.</p>
              )}
            </div>
          ) : (
            <div>
              {model.goalSnapshot.primaryGoal ? <p className="item-sub" style={{ marginBottom: 8 }}>{model.goalSnapshot.primaryGoal}</p> : null}
              <p className="item-title">Latest session: {model.goalSnapshot.sessionTitle}</p>
              <p className="item-sub">{formatSessionDateShort(model.goalSnapshot.sessionDate)}</p>
              <div style={{ marginTop: 12, height: 10, borderRadius: 999, background: "#1e293b", overflow: "hidden" }}>
                <div
                  style={{
                    width: `${goalPct}%`,
                    height: "100%",
                    background: "var(--mint)",
                    transition: "width 0.3s ease",
                  }}
                />
              </div>
              <p className="item-sub" style={{ marginTop: 10 }}>
                {model.goalSnapshot.completed}/{model.goalSnapshot.total} goal exercises completed
                {model.goalSnapshot.partial ? ` · ${model.goalSnapshot.partial} partial` : ""}
                {model.goalSnapshot.skipped ? ` · ${model.goalSnapshot.skipped} skipped` : ""}
              </p>
              {model.goalSnapshot.sampleRows.length > 0 ? (
                <ul className="list" style={{ marginTop: 10 }}>
                  {model.goalSnapshot.sampleRows.map((row, idx) => (
                    <li key={`${row.name}-${idx}`} className="list-item" style={{ padding: 10 }}>
                      <div>
                        <p className="item-title">{row.name}</p>
                        <p className="item-sub">
                          Target: {row.target || "—"} · Done: {row.done || row.completionStatus || "—"}
                        </p>
                        {row.skipReason ? (
                          <p className="item-sub" style={{ color: "#fecaca", marginTop: 4 }}>
                            Skip reason: {row.skipReason}
                          </p>
                        ) : null}
                      </div>
                      <span className="status-chip">
                        {String(row.completionStatus).toLowerCase() === "skipped"
                          ? "Skipped"
                          : row.progress === "up"
                            ? "↑"
                            : row.progress === "down"
                              ? "↓"
                              : "→"}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
              <Link className="mint-button mint-button-sm" href="/my-portal/progress" style={{ marginTop: 14, display: "inline-block" }}>
                Open progress
              </Link>
            </div>
          )}
        </article>

        <article
          className="card panel"
          style={
            model.paymentLines.length === 0
              ? {
                  borderStyle: "dashed",
                  borderColor: "rgba(148, 163, 184, 0.35)",
                }
              : undefined
          }
        >
          <h2>Payments</h2>
          {loading ? (
            <p className="item-sub">Loading…</p>
          ) : model.paymentLines.length === 0 ? (
            <div>
              <p className="item-title" style={{ color: "#94a3b8" }}>
                No outstanding fees
              </p>
              <p className="item-sub" style={{ marginTop: 8 }}>
                When your trainer requests payment for a session, it will show up here.
              </p>
            </div>
          ) : (
            <div>
              <p className="panel-value">
                ₹{Math.round(model.paymentTotalInr).toLocaleString("en-IN")}
              </p>
              <p className="item-sub" style={{ marginTop: 4 }}>Due across {model.paymentLines.length} session(s)</p>
              <ul className="list" style={{ marginTop: 12 }}>
                {model.paymentLines.map((line) => (
                  <li key={line.sessionId} className="list-item">
                    <div>
                      <p className="item-title">{line.title}</p>
                      <p className="item-sub">Session fee</p>
                    </div>
                    <span className="status-chip" style={{ color: "#f97316" }}>
                      ₹{Math.round(line.amountInr).toLocaleString("en-IN")}
                    </span>
                  </li>
                ))}
              </ul>
              <Link className="mint-button mint-button-sm" href="/my-portal/payments" style={{ marginTop: 14, display: "inline-block" }}>
                Open payments
              </Link>
            </div>
          )}
        </article>
      </div>

      <CollapsibleSection
        title="Recent activity"
        subtitle={loading ? "Loading…" : `${model.activity.length} update${model.activity.length === 1 ? "" : "s"}`}
        defaultOpen={!loading && model.activity.length > 0 && model.activity.length <= 4}
      >
        {loading ? (
          <p className="item-sub">Loading activity…</p>
        ) : model.activity.length === 0 ? (
          <p className="item-sub">Activity will appear as you train and schedule sessions.</p>
        ) : (
          <ul className="list">
            {model.activity.map((item) => (
              <li key={item.id} className="list-item" style={{ alignItems: "flex-start" }}>
                <div>
                  <p className="item-title">{item.title}</p>
                  <p className="item-sub">{item.detail}</p>
                  {item.meta ? (
                    <p className="item-sub" style={{ marginTop: 4 }}>
                      {item.meta}
                    </p>
                  ) : null}
                </div>
                <span className="status-chip" style={{ color: "#94a3b8", fontSize: 12 }}>
                  {item.kind === "schedule" ? "Calendar" : "Session"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CollapsibleSection>

      <CollapsibleSection
        title="Session history"
        subtitle="Trainer-logged sessions"
        defaultOpen={false}
      >
        <div className="quick-actions" style={{ marginBottom: 12 }}>
          <Link className="ghost-button ghost-button-sm" href="/my-portal/progress">
            Open progress
          </Link>
        </div>
        {loading ? (
          <p className="item-sub">Loading…</p>
        ) : sessions.length === 0 ? (
          <p className="item-sub">Your trainer&apos;s session logs will appear here once they share them.</p>
        ) : (
          <ul className="list">
            {[...sessions]
              .sort((a, b) => {
                const ad = new Date(a.session_date ?? a.date ?? 0).getTime();
                const bd = new Date(b.session_date ?? b.date ?? 0).getTime();
                return bd - ad;
              })
              .slice(0, 8)
              .map((raw) => {
                const s = normalizeClientSession(raw);
                const exerciseCount = Array.isArray(s.payload?.exercises) ? s.payload.exercises.length : null;
                const score = s.payload?.assessment?.score ?? null;
                return (
                  <li key={s.id} className="list-item" style={{ alignItems: "flex-start", padding: "10px 0" }}>
                    <Link href={`/my-portal/sessions/${s.id}`} style={{ flex: 1, textDecoration: "none", color: "inherit" }}>
                      <p className="item-title">{s.sessionTitle}</p>
                      <p className="item-sub">
                        {formatSessionDateShort(s.sessionDate)}
                        {exerciseCount ? ` · ${exerciseCount} exercise${exerciseCount !== 1 ? "s" : ""}` : ""}
                        {score ? ` · Quality ${score}/5` : ""}
                      </p>
                      {s.payload?.sections?.mainWork && (
                        <p className="item-sub" style={{ marginTop: 4, color: "#cbd5e1" }}>{String(s.payload.sections.mainWork).slice(0, 80)}{String(s.payload.sections.mainWork).length > 80 ? "…" : ""}</p>
                      )}
                    </Link>
                    <span className="status-chip" style={{ color: s.status === "completed" ? "#34d399" : s.status === "pending_notes" ? "#facc15" : "#94a3b8" }}>
                      {String(s.status ?? "draft").replace(/_/g, " ")}
                    </span>
                  </li>
                );
              })}
          </ul>
        )}
      </CollapsibleSection>

      {!loading && sessions.length > 0 ? (() => {
        const allExercises = sessions.flatMap((raw) => {
          const s = normalizeClientSession(raw);
          return Array.isArray(s.payload?.exercises) ? s.payload.exercises.map((ex) => ({ ...ex, sessionDate: s.sessionDate })) : [];
        });
        const uniqueNames = [...new Map(allExercises.map((ex) => [String(ex.name ?? "").toLowerCase(), ex])).values()].slice(0, 10);
        if (uniqueNames.length === 0) return null;
        return (
          <CollapsibleSection
            title="Exercise history"
            subtitle="From your trainer's session logs"
            defaultOpen={false}
          >
            <ul className="list">
              {uniqueNames.map((ex, idx) => (
                <li key={`${ex.name}-${idx}`} className="list-item" style={{ padding: "8px 0" }}>
                  <div>
                    <p className="item-title">{ex.name || "Exercise"}</p>
                    <p className="item-sub">
                      {ex.completionStatus ? `Status: ${ex.completionStatus}` : ""}
                      {ex.note ? ` · ${String(ex.note).slice(0, 60)}` : ""}
                    </p>
                  </div>
                  {ex.completionStatus === "completed" ? (
                    <span className="status-chip" style={{ color: "#34d399" }}>Done</span>
                  ) : ex.completionStatus === "skipped" ? (
                    <span className="status-chip" style={{ color: "#f87171" }}>Skipped</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </CollapsibleSection>
        );
      })() : null}
    </ClientShell>
  );
}
