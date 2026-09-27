import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { adminApi, reportApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { TableLoader } from '../components/Loading';
import './AdminDashboard.css';

const PAGE_LABELS = { '/': 'Overview', '/profile': 'Profile', '/predict': 'Performance', '/test-corner': 'Assessments', '/ai-tutor': 'Tutor' };
const ACTION_LABELS = { login: 'Login', page_view: 'Page view', heartbeat: 'Active', prediction_saved: 'Prediction saved', test_completed: 'Assessment completed', ai_question: 'Tutor question', profile_updated: 'Profile updated' };

const fmtDate = value => value ? new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—';
const ago = value => {
  if (!value) return 'Never';
  const m = Math.floor((Date.now() - new Date(value).getTime()) / 60000);
  if (m < 1) return 'Now'; if (m < 60) return `${m}m`; if (m < 1440) return `${Math.floor(m / 60)}h`; return `${Math.floor(m / 1440)}d`;
};
const online = value => value && Date.now() - new Date(value).getTime() <= 120000;
const risk = value => (value || 'none').toLowerCase();

function AdminDashboard() {
  const { user, logout } = useAuth();
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [activity, setActivity] = useState([]);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [tab, setTab] = useState('summary');
  const [exportingAll, setExportingAll] = useState(false);
  const [exportingStudent, setExportingStudent] = useState(false);

  useEffect(() => { const t = setTimeout(() => { setQuery(search.trim()); setPage(1); }, 300); return () => clearTimeout(t); }, [search]);

  const load = async () => {
    setLoading(true);
    try {
      const [o, u, a] = await Promise.all([adminApi.overview(), adminApi.users({ search: query, page, limit: 25 }), adminApi.activity(80)]);
      setOverview(o); setUsers(u.items || []); setPages(u.pages || 1); setTotal(u.total || 0); setActivity(a || []);
    } catch (error) { toast.error(error.message || 'Admin data unavailable'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [query, page]);
  useEffect(() => { const t = setInterval(() => { adminApi.overview().then(setOverview).catch(() => {}); adminApi.activity(80).then(setActivity).catch(() => {}); }, 30000); return () => clearInterval(t); }, []);

  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    setDetailLoading(true); setTab('summary');
    adminApi.user(selectedId).then(setDetail).catch(error => toast.error(error.message || 'Student record unavailable')).finally(() => setDetailLoading(false));
  }, [selectedId]);

  const avgTest = useMemo(() => {
    const values = (detail?.tests || []).filter(t => t.total_marks).map(t => (t.score / t.total_marks) * 100);
    return values.length ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1) : '0.0';
  }, [detail]);

  const exportAll = async () => {
    setExportingAll(true);
    try { await reportApi.downloadAdminStudents(); toast.success('Portfolio report exported'); }
    catch (error) { toast.error(error.message || 'Export failed'); }
    finally { setExportingAll(false); }
  };

  const exportStudent = async () => {
    if (!selectedId) return;
    setExportingStudent(true);
    try { await reportApi.downloadAdminStudent(selectedId); toast.success('Student report exported'); }
    catch (error) { toast.error(error.message || 'Export failed'); }
    finally { setExportingStudent(false); }
  };

  return (
    <div className="admin-page">
      <header className="admin-topbar">
        <div className="admin-topbar-inner">
          <div className="admin-brandline"><span className="admin-mark">JG</span><strong>Admin</strong></div>
          <div className="admin-top-actions"><span>{user?.email}</span><button className="admin-text-btn" onClick={logout}>Log out</button></div>
        </div>
      </header>

      <main className="admin-workspace">
        <div className="admin-title-row">
          <div><h1>Learning operations</h1><span>Updated {overview?.generated_at ? fmtDate(overview.generated_at) : '—'}</span></div>
          <div className="admin-action-row"><button className="admin-btn secondary" onClick={load} disabled={loading}>Refresh</button><button className="admin-btn primary" onClick={exportAll} disabled={exportingAll}>{exportingAll ? 'Exporting…' : 'Export all PDF'}</button></div>
        </div>

        <section className="admin-metrics">
          <AdminMetric label="Students" value={overview?.total_users ?? '—'} />
          <AdminMetric label="Active 24h" value={overview?.active_24h ?? '—'} />
          <AdminMetric label="Online" value={overview?.online_now ?? '—'} />
          <AdminMetric label="High risk" value={overview?.high_risk ?? '—'} tone="danger" />
          <AdminMetric label="Tests 24h" value={overview?.tests_24h ?? '—'} />
          <AdminMetric label="Tutor queries 24h" value={overview?.chats_24h ?? '—'} />
        </section>

        <section className="admin-layout">
          <div className="admin-card students-card">
            <div className="admin-card-head"><div><h2>Students</h2><span>{total} records</span></div><input className="admin-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search students" /></div>
            {loading ? <TableLoader rows={8} /> : <div className="admin-table-scroll"><table className="admin-data-table"><thead><tr><th>Student</th><th>Status</th><th>Grade</th><th>Last section</th><th>Risk</th><th>Predicted</th><th>Tests</th><th>Avg</th><th>Tutor</th><th>Last seen</th></tr></thead><tbody>{users.map(s => <tr key={s.id} onClick={() => setSelectedId(s.id)}><td><strong>{s.profile?.name || 'Unnamed'}</strong><small>{s.email}</small></td><td><span className={`status-dot ${online(s.last_seen_at) ? 'on' : ''}`}>{online(s.last_seen_at) ? 'Online' : 'Offline'}</span></td><td>{s.profile?.grade || '—'}</td><td>{PAGE_LABELS[s.current_page] || s.current_page || '—'}</td><td><span className={`risk-tag ${risk(s.latest_progress?.risk_level)}`}>{s.latest_progress?.risk_level || 'No data'}</span></td><td>{s.latest_progress?.total_predicted_marks ?? '—'}</td><td>{s.test_stats?.count || 0}</td><td>{s.test_stats?.average_score || 0}%</td><td>{s.chat_stats?.count || 0}</td><td>{ago(s.last_seen_at)}</td></tr>)}</tbody></table>{!users.length && <div className="admin-empty">No students found.</div>}</div>}
            <div className="admin-pagination"><button disabled={page <= 1} onClick={() => setPage(v => v - 1)}>Previous</button><span>{page} / {pages}</span><button disabled={page >= pages} onClick={() => setPage(v => v + 1)}>Next</button></div>
          </div>

          <div className="admin-card activity-card">
            <div className="admin-card-head"><div><h2>Recent activity</h2><span>{activity.length} events</span></div></div>
            <div className="admin-activity-list">{activity.map(event => <div className="admin-activity" key={event.id}><div><strong>{event.user?.name || event.user?.email || 'Student'}</strong><span>{ACTION_LABELS[event.action] || event.action}{event.page ? ` · ${PAGE_LABELS[event.page] || event.page}` : ''}</span>{event.action === 'test_completed' && event.metadata?.total_marks ? <small>{event.metadata.score}/{event.metadata.total_marks}</small> : null}</div><time>{ago(event.created_at)}</time></div>)}{!activity.length && <div className="admin-empty">No activity.</div>}</div>
          </div>
        </section>
      </main>

      {selectedId && <div className="admin-drawer-backdrop" onMouseDown={e => e.target === e.currentTarget && setSelectedId(null)}>
        <aside className="admin-drawer">
          <div className="drawer-top"><button className="admin-text-btn" onClick={() => setSelectedId(null)}>Close</button><div className="drawer-actions"><button className="admin-btn primary" onClick={exportStudent} disabled={exportingStudent}>{exportingStudent ? 'Exporting…' : 'Export PDF'}</button></div></div>
          {detailLoading ? <div className="drawer-loading"><TableLoader rows={8} /></div> : detail && <StudentDetail detail={detail} tab={tab} setTab={setTab} avgTest={avgTest} />}
        </aside>
      </div>}
    </div>
  );
}

function StudentDetail({ detail, tab, setTab, avgTest }) {
  const u = detail.user || {}; const p = u.profile || {}; const latest = detail.progress?.[0];
  return <>
    <div className="drawer-identity"><div className="drawer-avatar">{(p.name || u.email || 'S').slice(0, 2).toUpperCase()}</div><div><h2>{p.name || 'Unnamed student'}</h2><p>{u.email}</p><span>{p.grade ? `Grade ${p.grade}` : 'Grade —'}{p.school ? ` · ${p.school}` : ''}</span></div><div className="drawer-state">{online(u.last_seen_at) ? 'Online' : `Last seen ${ago(u.last_seen_at)}`}</div></div>
    <div className="drawer-tabs">{['summary', 'progress', 'tests', 'tutor', 'activity'].map(x => <button key={x} className={tab === x ? 'active' : ''} onClick={() => setTab(x)}>{x === 'tutor' ? 'Tutor' : x[0].toUpperCase() + x.slice(1)}</button>)}</div>
    <div className="drawer-content">
      {tab === 'summary' && <><div className="drawer-metrics"><Mini label="Predicted" value={latest?.total_predicted_marks ?? '—'} /><Mini label="Risk" value={latest?.risk_level || '—'} /><Mini label="Test average" value={`${avgTest}%`} /><Mini label="Tests" value={detail.tests?.length || 0} /><Mini label="Tutor queries" value={detail.chats?.length || 0} /><Mini label="Attendance" value={latest?.attendance != null ? `${latest.attendance}%` : '—'} /></div><div className="admin-info-grid"><Mini label="Favorite subject" value={p.favorite_subject || '—'} /><Mini label="Dream job" value={p.dream_job || '—'} /><Mini label="Hobbies" value={p.hobbies || '—'} /><Mini label="Study hours" value={latest?.study_hours ?? '—'} /></div></>}
      {tab === 'progress' && <DetailTable headers={['Date','Math','Read','Write','Attendance','Study h','Predicted','Risk']} rows={(detail.progress || []).map(r => [fmtDate(r.created_at),r.math_score ?? '—',r.reading_score ?? '—',r.writing_score ?? '—',r.attendance ?? '—',r.study_hours ?? '—',r.total_predicted_marks ?? '—',r.risk_level || '—'])} />}
      {tab === 'tests' && <DetailTable headers={['Date','Assessment','Difficulty','Score','Review areas']} rows={(detail.tests || []).map(r => [fmtDate(r.created_at),r.test_type,r.difficulty,`${r.score}/${r.total_marks}`,(r.wrong_answers || []).slice(0,3).join(', ') || 'None'])} />}
      {tab === 'tutor' && <div className="tutor-records">{(detail.chats || []).map(r => <article key={r.id}><time>{fmtDate(r.created_at)} · {r.provider || 'AI'}</time><strong>{r.question}</strong><p>{r.reply}</p></article>)}{!detail.chats?.length && <div className="admin-empty">No tutor history.</div>}</div>}
      {tab === 'activity' && <DetailTable headers={['Date','Action','Section','Details']} rows={(detail.activity || []).map(r => [fmtDate(r.created_at),ACTION_LABELS[r.action] || r.action,PAGE_LABELS[r.page] || r.page || '—',formatMeta(r.metadata)])} />}
    </div>
  </>;
}

function formatMeta(m) { if (!m || !Object.keys(m).length) return '—'; if (m.score != null) return `${m.score}/${m.total_marks}`; if (m.risk_level) return `${m.risk_level} · ${m.total_predicted_marks ?? '—'}`; if (m.question_preview) return m.question_preview; return Object.entries(m).map(([k,v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' · '); }
function AdminMetric({ label, value, tone = '' }) { return <div className={`admin-metric ${tone}`}><span>{label}</span><strong>{value}</strong></div>; }
function Mini({ label, value }) { return <div className="admin-mini"><span>{label}</span><strong>{value}</strong></div>; }
function DetailTable({ headers, rows }) { return rows.length ? <div className="drawer-table-wrap"><table className="drawer-table"><thead><tr>{headers.map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((r,i) => <tr key={i}>{r.map((c,j) => <td key={j}>{c}</td>)}</tr>)}</tbody></table></div> : <div className="admin-empty">No records.</div>; }

export default AdminDashboard;
