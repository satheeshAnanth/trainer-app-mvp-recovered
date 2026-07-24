"use client";

/**
 * Cadence product mark / wordmark (Option A: Cadence icons + mint UI theme).
 */
export default function BrandLogo({
  variant = "mark",
  size = 40,
  className = "",
  priority = false,
}) {
  if (variant === "wordmark") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="/cadence-logo-dark.svg"
        alt="Cadence"
        className={className}
        width={220}
        height={74}
        style={{ display: "block", width: "min(220px, 70vw)", height: "auto" }}
        decoding="async"
        {...(priority ? { fetchPriority: "high" } : {})}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/cadence-mark.svg"
      alt="Cadence"
      className={className}
      width={size}
      height={size}
      style={{ display: "block", width: size, height: size }}
      decoding="async"
      {...(priority ? { fetchPriority: "high" } : {})}
    />
  );
}
