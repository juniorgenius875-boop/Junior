import React, { useEffect, useMemo, useState } from 'react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend } from 'chart.js';
import { profileApi, progressApi, testsApi } from '../api/client';
import { PageLoader } from '../components/Loading';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

const fmt = value => value == null || value === '' ? '—' : value;
const date = value => value ? new Date(value).toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

function Dashboard() {
  const [data, setData] = useState({ profile: {}, stats: {}, progress: [], tests: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([profileApi.get(), profileApi.stats(), progressApi.list(120), testsApi.listResults(30)])
      .then(([profile, stats, progress, tests]) => {
        if (active) setData({ profile: profile || {}, stats: stats || {}, progress: progress || [], tests: tests || [] });
      })
      .catch(() => { if (active) setData({ profile: {}, stats: {}, progress: [], tests: [] }); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const latest = data.progress[0] || null;
  const history = useMemo(() => [...data.progress].reverse(), [data.progress]);
  const scoreSeries = useMemo(() => ({
    labels: history.map(row => new Date(row.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })),
    datasets: [{
      label: 'Predicted marks',
      data: history.map(row => row.total_predicted_marks),
      borderColor: '#4f46e5',
      backgroundColor: 'rgba(79,70,229,.08)',
      tension: .3,
      borderWidth: 2,
      pointRadius: 2.5,
      pointHoverRadius: 4,
      fill: true,
    }],
  }), [history]);

  if (loading) return <PageLoader rows={2} />;

  const risk = (latest?.risk_level || 'No data').toLowerCase();
  const tests = data.tests.slice(0, 6);

  return (
    <div className="page-shell">
      <div className="page-heading">
        <div>
          <h1>Overview</h1>
          <p>{data.profile?.name || 'Student'}{data.profile?.grade ? ` · Grade ${data.profile.grade}` : ''}{data.profile?.school ? ` · ${data.profile.school}` : ''}</p>
        </div>
      </div>

      <section className="metric-grid">
        <Metric label="Predicted marks" value={fmt(latest?.total_predicted_marks)} meta={latest ? date(latest.created_at) : 'No prediction yet'} />
        <Metric label="Assessment average" value={`${data.stats?.averageScore || 0}%`} meta={`${data.stats?.totalTests || 0} completed`} />
        <Metric label="Best assessment" value={`${data.stats?.bestScore || 0}%`} meta={`Level ${data.stats?.level || 1}`} />
        <Metric label="Current risk" value={latest?.risk_level || 'No data'} meta={latest ? `${Math.round((latest.pass_probability || 0) * 100)}% pass probability` : 'Run a performance analysis'} className={`risk-${risk}`} />
      </section>

      <section className="content-grid">
        <div className="panel">
          <div className="panel-head"><h2>Performance trend</h2><span>{history.length} saved analyses</span></div>
          {history.length ? (
            <div className="chart-box"><Line data={scoreSeries} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { color: '#7a8190', maxTicksLimit: 8 } }, y: { min: 0, max: 100, grid: { color: '#eceef2' }, ticks: { color: '#7a8190' } } } }} /></div>
          ) : <div className="empty-state">No saved performance data.</div>}
        </div>

        <div className="stack">
          <div className="panel">
            <div className="panel-head"><h2>Academic snapshot</h2></div>
            <div className="panel-body">
              <div className="subject-grid">
                <Subject label="Math" value={latest?.math_score} />
                <Subject label="Reading" value={latest?.reading_score} />
                <Subject label="Writing" value={latest?.writing_score} />
              </div>
            </div>
          </div>
          <div className="panel">
            <div className="panel-head"><h2>Study metrics</h2></div>
            <div className="info-list">
              <Info label="Attendance" value={latest?.attendance != null ? `${latest.attendance}%` : '—'} />
              <Info label="Daily study" value={latest?.study_hours != null ? `${latest.study_hours} h` : '—'} />
              <Info label="Internal 1" value={fmt(latest?.internal_test_1)} />
              <Info label="Internal 2" value={fmt(latest?.internal_test_2)} />
            </div>
          </div>
        </div>
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <div className="panel-head"><h2>Recent assessments</h2><span>{data.tests.length} recorded</span></div>
        {tests.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Date</th><th>Assessment</th><th>Difficulty</th><th>Score</th><th>Result</th><th>Review areas</th></tr></thead><tbody>{tests.map(row => {
          const percent = row.total_marks ? (row.score / row.total_marks) * 100 : 0;
          return <tr key={row.id}><td>{date(row.created_at)}</td><td className="cell-main">{row.test_type}</td><td>{row.difficulty}</td><td>{row.score}/{row.total_marks}</td><td><span className={`badge ${percent >= 75 ? 'low' : percent >= 50 ? 'medium' : 'high'}`}>{percent.toFixed(0)}%</span></td><td>{(row.wrong_answers || []).slice(0, 2).join(', ') || 'None'}</td></tr>;
        })}</tbody></table></div> : <div className="empty-state">No assessments completed.</div>}
      </section>
    </div>
  );
}

function Metric({ label, value, meta, className = '' }) { return <div className={`metric-card ${className}`}><span className="metric-label">{label}</span><strong className="metric-value">{value}</strong><span className="metric-meta">{meta}</span></div>; }
function Subject({ label, value }) { const n = Number(value); return <div className="subject-stat"><span>{label}</span><strong>{value == null ? '—' : value}</strong><div className="progress-track"><i style={{ width: `${Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0}%` }} /></div></div>; }
function Info({ label, value }) { return <div className="info-item"><span>{label}</span><strong>{value}</strong></div>; }

export default Dashboard;
