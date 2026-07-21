export function SkeletonBlock({ className = "", style }) {
  return <div className={`skeleton-block ${className}`.trim()} style={style} aria-hidden="true" />;
}

export function SkeletonCard() {
  return (
    <article className="card surface-glass skeleton-card">
      <SkeletonBlock style={{ width: "40%", height: 14, marginBottom: 10 }} />
      <SkeletonBlock style={{ width: "55%", height: 28, marginBottom: 8 }} />
      <SkeletonBlock style={{ width: "70%", height: 12 }} />
    </article>
  );
}

export function SkeletonInsightsGrid() {
  return (
    <section className="spec-grid">
      {Array.from({ length: 6 }).map((_, index) => (
        <SkeletonCard key={index} />
      ))}
    </section>
  );
}
