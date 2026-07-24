"use client";

import { useRef, useState } from "react";
import { hapticMedium } from "app/lib/haptics";

const SWIPE_THRESHOLD = 55;
const MAX_OFFSET = 88;

export default function SwipeableCard({
  children,
  onSwipeLeft,
  disabled = false,
  style,
  actionLabel = "Actions",
}) {
  const startX = useRef(null);
  const [offset, setOffset] = useState(0);
  const [transitioning, setTransitioning] = useState(false);

  function handleTouchStart(e) {
    if (disabled) return;
    startX.current = e.touches[0].clientX;
    setTransitioning(false);
  }

  function handleTouchMove(e) {
    if (disabled || startX.current === null) return;
    const dx = e.touches[0].clientX - startX.current;
    if (dx > 0) return;
    setOffset(Math.max(-MAX_OFFSET, dx));
  }

  function handleTouchEnd() {
    if (disabled || startX.current === null) return;
    startX.current = null;
    setTransitioning(true);
    if (offset <= -SWIPE_THRESHOLD) {
      setOffset(-MAX_OFFSET);
      void hapticMedium();
      setTimeout(() => {
        setOffset(0);
        onSwipeLeft?.();
      }, 120);
    } else {
      setOffset(0);
    }
  }

  return (
    <div
      className="swipeable-card"
      style={{ overflow: "hidden", borderRadius: 14, position: "relative", ...style }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {!disabled ? (
        <div className="swipeable-card-action" aria-hidden="true">
          {actionLabel}
        </div>
      ) : null}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          background: "inherit",
          transform: `translateX(${offset}px)`,
          transition: transitioning ? "transform 0.18s ease" : "none",
          willChange: "transform",
        }}
      >
        {children}
      </div>
    </div>
  );
}
