"use client";

import { useRef, useState } from "react";

const SWIPE_THRESHOLD = 55; // px to trigger action
const MAX_OFFSET = 72;      // max px the card slides before snapping

export default function SwipeableCard({ children, onSwipeLeft, disabled = false, style }) {
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
    if (dx > 0) return; // ignore right swipe
    setOffset(Math.max(-MAX_OFFSET, dx));
  }

  function handleTouchEnd() {
    if (disabled || startX.current === null) return;
    startX.current = null;
    setTransitioning(true);
    if (offset <= -SWIPE_THRESHOLD) {
      // Snap to full offset briefly, then snap back and fire action
      setOffset(-MAX_OFFSET);
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
      style={{ overflow: "hidden", borderRadius: 8, ...style }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div
        style={{
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
