export function CardSkeleton({ className = "" }) {
  return <div className={`skeleton-card ${className}`.trim()} aria-hidden="true"><span className="skeleton-line wide"/><span className="skeleton-line medium"/><span className="skeleton-line short"/></div>;
}

export function PageSkeleton({ cards = 6 }) {
  return <div className="app-loading-shell" aria-label="Loading page">
    <div className="loading-sidebar" />
    <main className="loading-main">
      <div className="loading-topbar"><span className="skeleton-line title"/><span className="skeleton-avatar"/></div>
      <div className="loading-content">
        <div className="skeleton-hero" />
        <div className="skeleton-grid">{Array.from({ length: cards }, (_, i) => <CardSkeleton key={i}/>)}</div>
      </div>
    </main>
  </div>;
}

export function InlineSkeleton({ rows = 3 }) {
  return <div className="inline-skeleton" aria-hidden="true">{Array.from({ length: rows }, (_, i) => <span key={i} className={`skeleton-line ${i === rows - 1 ? "medium" : "wide"}`}/>)}</div>;
}
