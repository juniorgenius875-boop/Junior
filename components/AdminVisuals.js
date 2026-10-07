"use client";

import { lastNDaysSeries, recentTestSeries, taskCounts } from "@/lib/adminAnalytics";

export function TaskStatusGraphic({ activities = [], day = null, title = "Task status" }) {
  const counts = taskCounts(activities, day);
  const degree = Math.max(0, Math.min(360, counts.completionPercent * 3.6));
  return (
    <div className="task-status-graphic">
      <div className="task-donut" style={{ "--task-progress": `${degree}deg` }}>
        <div className="task-donut-inner">
          <strong>{Math.round(counts.completionPercent)}%</strong>
          <span>done</span>
        </div>
      </div>
      <div className="task-status-copy">
        <div className="visual-title-row"><strong>{title}</strong><span>{counts.total} tasks</span></div>
        <div className="task-status-grid">
          <div><span>Assigned</span><strong>{counts.assigned}</strong></div>
          <div><span>In progress</span><strong>{counts.inProgress}</strong></div>
          <div><span>Completed</span><strong>{counts.completed}</strong></div>
          <div><span>Missed</span><strong>{counts.missed}</strong></div>
        </div>
      </div>
    </div>
  );
}

export function WeeklyTaskChart({ activities = [], title = "Last 7 days" }) {
  const rows = lastNDaysSeries(activities, 7);
  const max = Math.max(1, ...rows.map((row) => row.planned));
  return (
    <div className="visual-block">
      <div className="visual-title-row"><strong>{title}</strong><span>Planned vs completed</span></div>
      <div className="weekly-chart" role="img" aria-label="Planned and completed tasks for the last seven days">
        {rows.map((row) => (
          <div className="weekly-column" key={row.key} title={`${row.dateLabel}: ${row.completed}/${row.planned} completed`}>
            <div className="weekly-bars">
              <span className="weekly-bar planned" style={{ height: `${Math.max(4, (row.planned / max) * 100)}%` }} />
              <span className="weekly-bar completed" style={{ height: `${Math.max(row.completed ? 4 : 0, (row.completed / max) * 100)}%` }} />
            </div>
            <strong>{row.label}</strong>
            <small>{row.completed}/{row.planned}</small>
          </div>
        ))}
      </div>
      <div className="chart-legend"><span><i className="legend-planned" />Planned</span><span><i className="legend-completed" />Completed</span></div>
    </div>
  );
}

export function StageProgressGraphic({ first = 0, second = 0, third = 0, title = "Study progress" }) {
  const rows = [
    ["First Cut", first],
    ["Second Cut", second],
    ["Third Cut", third],
  ];
  return (
    <div className="visual-block">
      <div className="visual-title-row"><strong>{title}</strong><span>Chapter completion</span></div>
      <div className="stage-progress-list">
        {rows.map(([label, value], index) => (
          <div className="stage-progress-row" key={label}>
            <div><span>{label}</span><strong>{Math.round(value)}%</strong></div>
            <div className={`stage-bar stage-${index + 1}`}><span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SubjectProgressGraphic({ rows = [], title = "Subject progress" }) {
  return (
    <div className="visual-block">
      <div className="visual-title-row"><strong>{title}</strong><span>Latest test average</span></div>
      <div className="subject-visual-list">
        {rows.map((row) => (
          <div className="subject-visual-row" key={row.subject.slug}>
            <div><span>{row.subject.name}</span><strong>{row.scoredAreas ? `Latest test ${Math.round(row.avgLatest)}%` : "No test yet"}</strong></div>
            <div className="subject-visual-bar"><span style={{ width: `${Math.max(0, Math.min(100, row.avgLatest || 0))}%` }} /></div>
            <small>First {Math.round(row.firstCutPercent || 0)}% · Second {Math.round(row.secondCutPercent || 0)}% · Third {Math.round(row.thirdCutPercent || 0)}%</small>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TestTrendGraphic({ tests = [], title = "Test performance" }) {
  const rows = recentTestSeries(tests, 8);
  if (!rows.length) {
    return <div className="visual-block"><div className="visual-title-row"><strong>{title}</strong></div><div className="empty-state compact-empty"><strong>No scored mock tests yet</strong></div></div>;
  }

  const width = 700;
  const height = 220;
  const padX = 44;
  const padTop = 20;
  const padBottom = 40;
  const chartHeight = height - padTop - padBottom;
  const step = rows.length > 1 ? (width - padX * 2) / (rows.length - 1) : 0;
  const points = rows.map((row, index) => ({
    ...row,
    x: rows.length === 1 ? width / 2 : padX + index * step,
    y: padTop + ((100 - row.score) / 100) * chartHeight,
  }));
  const polyline = points.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <div className="visual-block">
      <div className="visual-title-row"><strong>{title}</strong><span>Recent mock tests</span></div>
      <div className="test-trend-wrap">
        <svg className="test-trend-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Recent test score trend">
          {[0, 25, 50, 75, 100].map((value) => {
            const y = padTop + ((100 - value) / 100) * chartHeight;
            return <g key={value}><line x1={padX} y1={y} x2={width - padX} y2={y} className="trend-grid-line" /><text x="6" y={y + 4} className="trend-axis-text">{value}%</text></g>;
          })}
          {points.length > 1 && <polyline points={polyline} className="trend-line" />}
          {points.map((point) => (
            <g key={point.id || `${point.date}-${point.x}`}>
              <circle cx={point.x} cy={point.y} r="5" className="trend-point" />
              <text x={point.x} y={height - 10} textAnchor="middle" className="trend-date-text">{point.label}</text>
            </g>
          ))}
        </svg>
      </div>
      <div className="test-trend-summary">
        <span>Latest <strong>{Math.round(rows[rows.length - 1].score)}%</strong></span>
        <span>Best <strong>{Math.round(Math.max(...rows.map((row) => row.score)))}%</strong></span>
      </div>
    </div>
  );
}

export function ConsistencyGraphic({ activities = [], title = "Daily consistency" }) {
  const rows = lastNDaysSeries(activities, 14);
  return (
    <div className="visual-block consistency-block">
      <div className="visual-title-row"><strong>{title}</strong><span>Last 14 days</span></div>
      <div className="consistency-grid">
        {rows.map((row) => {
          let tone = "empty";
          if (row.planned > 0 && row.completionPercent >= 100) tone = "full";
          else if (row.planned > 0 && row.completionPercent > 0) tone = "partial";
          else if (row.planned > 0) tone = "missed";
          return <div key={row.key} className={`consistency-day ${tone}`} title={`${row.dateLabel}: ${row.completed}/${row.planned} completed`}><span>{row.label.slice(0, 1)}</span><small>{row.dateLabel.split(" ")[0]}</small></div>;
        })}
      </div>
    </div>
  );
}
