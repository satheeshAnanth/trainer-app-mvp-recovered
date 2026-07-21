"use client";

import { resolveExerciseThumb } from "app/lib/exerciseThumb";

export default function ExerciseThumb({ exercise, size = 48 }) {
  const thumb = resolveExerciseThumb(exercise);
  const box = {
    width: size,
    height: size,
    borderRadius: 10,
    flexShrink: 0,
    overflow: "hidden",
    border: "1px solid var(--line-strong)",
    background: "rgba(15, 23, 42, 0.9)",
    display: "grid",
    placeItems: "center",
  };

  if (thumb.kind === "image") {
    return (
      <div style={box} aria-hidden="true">
        <img
          src={thumb.src}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        ...box,
        background: `linear-gradient(145deg, ${thumb.hue}33, rgba(15,23,42,0.95))`,
        color: thumb.hue,
        fontWeight: 700,
        fontSize: Math.max(11, Math.round(size * 0.28)),
        letterSpacing: 0.4,
      }}
      title={thumb.label}
      aria-hidden="true"
    >
      {thumb.short}
    </div>
  );
}
