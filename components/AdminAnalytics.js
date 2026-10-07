"use client";

import { useEffect, useMemo } from "react";
import Icon from "@/components/Icons";

function clamp(value, min = 0, max = 100) {
  const number = Number(value) || 0;
  return Math.max(min, Math.min(max, number));
}

export function AnalyticsKpiCard({ icon = "chart", label, value, helper, tone = "blue", trend = [], onClick }) {
  const points = useMemo(() => {
    const values = (trend || []).map(Number).filter(Number.isFinite);
    if (values.length < 2) return "";
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = Math.max(1, max - min);
    return values.map((item, index) => {
      const x = (index / Math.max(1, values.length - 1)) * 92 + 4;
      const y = 30 - ((item - min) / span) * 22;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
  }, [trend]);

  const Tag = onClick ? "button" : "article";
  return <Tag type={onClick ? "button" : undefined} className={`analytics-kpi-card tone-${tone}${onClick ? " clickable" : ""}`} onClick={onClick}>
    <div className="analytics-kpi-top">
      <span className="analytics-kpi-icon"><Icon name={icon} size={18}/></span>
      {onClick && <span className="analytics-kpi-open"><Icon name="chevron" size={13}/></span>}
    </div>
    <span className="analytics-kpi-label">{label}</span>
    <strong className="analytics-kpi-value">{value}</strong>
    <div className="analytics-kpi-foot">
      <small>{helper}</small>
      {points && <svg className="analytics-spark" viewBox="0 0 100 34" preserveAspectRatio="none" aria-hidden="true"><polyline points={points}/></svg>}
    </div>
  </Tag>;
}

export function MultiTrendChart({ rows = [], series = [], title, subtitle }) {
  const width = 760;
  const height = 270;
  const pad = { left: 42, right: 18, top: 22, bottom: 42 };
  const values = rows.flatMap((row) => series.map((item) => Number(row[item.key]) || 0));
  const maxValue = Math.max(1, ...values);
  const chartHeight = height - pad.top - pad.bottom;
  const chartWidth = width - pad.left - pad.right;
  const x = (index) => pad.left + (rows.length <= 1 ? chartWidth / 2 : (index / (rows.length - 1)) * chartWidth);
  const y = (value) => pad.top + chartHeight - (Number(value || 0) / maxValue) * chartHeight;
  const labelStep = Math.max(1, Math.ceil(rows.length / 6));

  return <div className="analytics-chart-block">
    {(title || subtitle) && <div className="analytics-chart-heading"><div>{title && <h3>{title}</h3>}{subtitle && <p>{subtitle}</p>}</div><div className="analytics-chart-legend">{series.map((item) => <span key={item.key}><i className={`tone-${item.tone || "blue"}`}/>{item.label}</span>)}</div></div>}
    <div className="analytics-line-chart">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label={title || "Trend chart"}>
        {[0, .25, .5, .75, 1].map((part) => {
          const yy = pad.top + chartHeight * part;
          const val = Math.round(maxValue * (1 - part));
          return <g key={part}><line x1={pad.left} y1={yy} x2={width - pad.right} y2={yy} className="analytics-grid-line"/><text x={pad.left - 9} y={yy + 3} textAnchor="end" className="analytics-axis-text">{val}</text></g>;
        })}
        {series.map((item) => {
          const path = rows.map((row, index) => `${index ? "L" : "M"}${x(index).toFixed(1)},${y(row[item.key]).toFixed(1)}`).join(" ");
          return <g key={item.key} className={`analytics-svg-series tone-${item.tone || "blue"}`}><path d={path} className="analytics-line-path"/>{rows.map((row, index) => <circle key={`${item.key}-${index}`} cx={x(index)} cy={y(row[item.key])} r="2.6" className="analytics-line-dot"><title>{`${row.label}: ${item.label} ${row[item.key] || 0}`}</title></circle>)}</g>;
        })}
        {rows.map((row, index) => (index % labelStep === 0 || index === rows.length - 1) ? <text key={row.key || index} x={x(index)} y={height - 13} textAnchor="middle" className="analytics-axis-text x">{row.label}</text> : null)}
      </svg>
    </div>
  </div>;
}

export function ScoreTrendChart({ rows = [] }) {
  return <MultiTrendChart rows={rows} series={[{ key: "avgScore", label: "Average score", tone: "green" }]} title="Adaptive test performance" subtitle="Average score of tests completed in each period."/>;
}

export function HorizontalBarChart({ rows = [], valueKey = "value", labelKey = "label", suffix = "", tone = "blue", empty = "No data yet" }) {
  const max = Math.max(1, ...rows.map((row) => Number(row[valueKey]) || 0));
  if (!rows.length) return <div className="analytics-empty">{empty}</div>;
  return <div className="analytics-bar-list">{rows.map((row, index) => <div className="analytics-bar-row" key={row.id || row[labelKey] || index}>
    <div><strong>{row[labelKey]}</strong><span>{row.subLabel || ""}</span></div>
    <div className="analytics-bar-track"><span className={`tone-${row.tone || tone}`} style={{ width: `${clamp(((Number(row[valueKey]) || 0) / max) * 100)}%` }}/></div>
    <b>{Number(row[valueKey] || 0).toFixed(row.decimals ?? 0)}{suffix}</b>
  </div>)}</div>;
}

export function RiskDonut({ distribution = {}, total = 0 }) {
  const high = Number(distribution.high || 0);
  const medium = Number(distribution.medium || 0);
  const low = Number(distribution.low || 0);
  const noData = Number(distribution.noData || 0);
  const safeTotal = Math.max(1, total || high + medium + low + noData);
  const highDeg = (high / safeTotal) * 360;
  const mediumDeg = highDeg + (medium / safeTotal) * 360;
  const lowDeg = mediumDeg + (low / safeTotal) * 360;
  const style = { background: `conic-gradient(#df5e69 0 ${highDeg}deg,#e6a143 ${highDeg}deg ${mediumDeg}deg,#27a77a ${mediumDeg}deg ${lowDeg}deg,#dfe5ee ${lowDeg}deg 360deg)` };
  return <div className="analytics-risk-wrap">
    <div className="analytics-risk-donut" style={style}><div><strong>{total || 0}</strong><span>students</span></div></div>
    <div className="analytics-risk-legend">
      <div><i className="high"/><span>High risk</span><strong>{high}</strong></div>
      <div><i className="medium"/><span>Medium risk</span><strong>{medium}</strong></div>
      <div><i className="low"/><span>Low risk</span><strong>{low}</strong></div>
      <div><i className="nodata"/><span>No prediction</span><strong>{noData}</strong></div>
    </div>
  </div>;
}

export function AnalyticsModal({ open, title, subtitle, onClose, children, wide = false }) {
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event) => { if (event.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", onKey); };
  }, [open, onClose]);

  if (!open) return null;
  return <div className="analytics-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose?.(); }}>
    <section className={`analytics-modal${wide ? " wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
      <header className="analytics-modal-head"><div><span className="admin-card-kicker">Detailed view</span><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button type="button" className="analytics-modal-close" onClick={onClose} aria-label="Close"><Icon name="close" size={18}/></button></header>
      <div className="analytics-modal-body">{children}</div>
    </section>
  </div>;
}
