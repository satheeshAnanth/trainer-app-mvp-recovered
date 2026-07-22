"use client";

import { useEffect, useState } from "react";
import { useModalDismiss } from "app/_components/useModalDismiss";

export function ExerciseMediaSheet({ exercise, onClose, allowSubmit = false }) {
  const [mediaList, setMediaList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");

  useModalDismiss(Boolean(exercise), onClose);

  useEffect(() => {
    if (!exercise?.id) return undefined;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setSubmitMessage("");
      setYoutubeUrl("");
      try {
        const res = await fetch(`/api/exercises/master/${encodeURIComponent(exercise.id)}/media`);
        const json = await res.json();
        if (!cancelled) {
          setMediaList(Array.isArray(json?.data?.media) ? json.data.media : []);
        }
      } catch {
        if (!cancelled) setMediaList([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [exercise?.id]);

  async function submitSuggestion() {
    if (!exercise?.id || !youtubeUrl.trim()) return;
    setSubmitting(true);
    setSubmitMessage("");
    try {
      const res = await fetch(`/api/exercises/master/${encodeURIComponent(exercise.id)}/media/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ youtubeUrlOrId: youtubeUrl.trim() }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.message ?? "Submit failed.");
      setYoutubeUrl("");
      setSubmitMessage(json?.data?.note ?? "Submitted for review.");
    } catch (error) {
      setSubmitMessage(error.message ?? "Unable to submit.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!exercise) return null;

  const primary = exercise.media?.primaryMedia ?? mediaList[0] ?? null;
  const display = primary ?? mediaList.find(Boolean) ?? null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card card" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <h2 style={{ margin: 0 }}>{exercise.name}</h2>
          <button className="ghost-button" type="button" onClick={onClose}>Close</button>
        </div>
        {exercise.category ? <p className="item-sub" style={{ marginTop: 8 }}>{exercise.category}{exercise.equipment ? ` · ${exercise.equipment}` : ""}</p> : null}

        {loading ? <p className="item-sub" style={{ marginTop: 12 }}>Loading example…</p> : null}

        {!loading && display?.type === "youtube_video" && display.youtubeVideoId ? (
          <div style={{ marginTop: 12, aspectRatio: "16 / 9", borderRadius: 12, overflow: "hidden", border: "1px solid var(--line-strong)" }}>
            <iframe
              title={display.title || exercise.name}
              src={`https://www.youtube-nocookie.com/embed/${display.youtubeVideoId}`}
              style={{ width: "100%", height: "100%", border: 0 }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : null}

        {!loading && display?.type === "image" && display.imageUrl ? (
          <img
            src={display.imageUrl}
            alt={display.title || exercise.name}
            style={{ width: "100%", marginTop: 12, borderRadius: 12, border: "1px solid var(--line-strong)" }}
          />
        ) : null}

        {!loading && !display ? (
          <article className="callout-card" style={{ marginTop: 12 }}>
            <p className="item-title" style={{ margin: 0 }}>No example yet</p>
            <p className="item-sub" style={{ margin: "4px 0 0" }}>A curated form demo for this exercise has not been added yet.</p>
          </article>
        ) : null}

        {display?.title ? <p className="item-sub" style={{ marginTop: 10 }}>{display.title}{display.channelName ? ` · ${display.channelName}` : ""}</p> : null}
        {display?.attribution ? <p className="item-sub" style={{ marginTop: 4 }}>{display.attribution}</p> : null}

        {allowSubmit ? (
          <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--line-strong)" }}>
            <p className="item-title" style={{ marginBottom: 6 }}>Suggest a form video</p>
            <p className="item-sub" style={{ marginBottom: 8 }}>Paste a YouTube link. It goes to admin review before clients see it.</p>
            <label className="field full">
              <span>YouTube URL</span>
              <input
                type="url"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=…"
              />
            </label>
            <div className="quick-actions" style={{ marginTop: 10 }}>
              <button className="mint-button" type="button" disabled={submitting || !youtubeUrl.trim()} onClick={submitSuggestion}>
                {submitting ? "Submitting…" : "Submit for review"}
              </button>
            </div>
            {submitMessage ? <p className="item-sub" style={{ marginTop: 8 }}>{submitMessage}</p> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
