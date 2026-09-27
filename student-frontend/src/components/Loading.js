import React from 'react';

export function PageLoader({ rows = 3 }) {
  return (
    <div className="page-shell" aria-busy="true">
      <div className="skeleton skeleton-title" />
      <div className="metric-grid skeleton-metrics">
        {[0, 1, 2, 3].map(i => <div className="skeleton skeleton-card" key={i} />)}
      </div>
      {Array.from({ length: rows }).map((_, i) => <div className="skeleton skeleton-panel" key={i} />)}
    </div>
  );
}

export function TableLoader({ rows = 6 }) {
  return <div className="table-loader">{Array.from({ length: rows }).map((_, i) => <div className="skeleton skeleton-row" key={i} />)}</div>;
}

export function InlineLoader({ label = 'Loading' }) {
  return <span className="inline-loader"><i />{label}</span>;
}
