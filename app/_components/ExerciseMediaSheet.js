"use client";

import { useEffect, useState } from "react";
import { useModalDismiss } from "app/_components/useModalDismiss";

export function ExerciseMediaSheet({ exercise, onClose }) {
  const [mediaList, setMediaList] = useState([]);
  const [loading, setLoading] = useState(true);

  useModalDismiss(Boolean(exercise), onClose);

  useEffect(() => {
    if (!exercise?.id) return undefined;
    let cancelled = false;
    (async () => {
      setLoading(true);
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
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 12,
                  display: "grid",
                  placeItems: "center",
                  fontWeight: 700,
                  border: "1px solid var(--line-strong)",
                  color: "var(--mint)",
                  background: "var(--mint-dim)",
                }}
              >
                {(exercise.category || "EX").slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="item-title" style={{ margin: 0 }}>No example yet</p>
                <p className="item-sub" style={{ margin: "4px 0 0" }}>A curated form demo for this exercise has not been added yet.</p>
              </div>
            </div>
          </article>
        ) : null}

        {display?.title ? <p className="item-sub" style={{ marginTop: 10 }}>{display.title}{display.channelName ? ` · ${display.channelName}` : ""}</p> : null}
        {display?.attribution ? <p className="item-sub" style={{ marginTop: 4 }}>{display.attribution}</p> : null}
      </div>
    </div>
  );
}
