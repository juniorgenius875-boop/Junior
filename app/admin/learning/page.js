"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import RequireAuth from "@/components/RequireAuth";
import AppShell from "@/components/AppShell";
import Icon from "@/components/Icons";
import { CardSkeleton } from "@/components/LoadingUI";
import {
  AnalyticsKpiCard,
  AnalyticsModal,
  HorizontalBarChart,
  MultiTrendChart,
  RiskDonut,
  ScoreTrendChart,
} from "@/components/AdminAnalytics";
import { adminApi } from "@/lib/api";

const RANGES = [
  ["1m", "1 Month"],
  ["3m", "3 Months"],
  ["6m", "6 Months"],
  ["1y", "1 Year"],
  ["lifetime", "Lifetime"],
];

function relativeTime(value) {
  if (!value) return "—";
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return "—";
  const minutes = Math.max(0, Math.round((Date.now() - time) / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function riskTone(value) {
  const risk = String(value || "").toLowerCase();
  if (risk === "high") return "danger";
  if (risk === "medium") return "warning";
  if (risk === "low") return "success";
  return "muted";
}

function initials(value = "S") {
  return String(value).trim().split(/\s+/).slice(0, 2).map((item) => item[0]).join("").toUpperCase() || "S";
}

function MetricDetail({ metric, analytics, users }) {
  const overview = analytics?.overview || {};
  if (!metric) return null;

  if (metric === "students") return <div className="analytics-detail-stack">
    <div className="analytics-detail-summary"><strong>{overview.totalStudents || 0}</strong><span>active student accounts</span></div>
    <div className="analytics-detail-list">{(analytics?.studentActivity || users).slice(0, 30).map((student) => <Link href={`/admin/users/${student.id}`} key={student.id} className="analytics-detail-row"><span className="admin-student-avatar">{initials(student.name || student.profile?.name)}</span><div><strong>{student.name || student.profile?.name || "Student"}</strong><small>{student.email}</small></div><Icon name="chevron" size={14}/></Link>)}</div>
  </div>;

  if (metric === "active") return <div className="analytics-detail-stack">
    <div className="analytics-detail-summary"><strong>{overview.activeStudents || 0}</strong><span>students with activity in {analytics?.range?.label || "this period"}</span></div>
    <div className="analytics-detail-list">{(analytics?.studentActivity || []).filter((student) => student.activity + student.tests + student.chats + student.predictions > 0).slice(0, 20).map((student) => <Link href={`/admin/users/${student.id}`} key={student.id} className="analytics-detail-row"><span className="admin-student-avatar">{initials(student.name)}</span><div><strong>{student.name}</strong><small>{student.activity} actions · {student.tests} tests · {student.chats} tutor queries</small></div><span>{relativeTime(student.lastSeenAt)}</span></Link>)}</div>
  </div>;

  if (metric === "risk") return <div className="analytics-detail-stack">
    <RiskDonut distribution={analytics?.riskDistribution} total={overview.totalStudents || 0}/>
    <div className="analytics-detail-list">{(analytics?.highRiskStudents || []).map((student) => <Link href={`/admin/users/${student.id}`} key={student.id} className="analytics-detail-row"><span className="admin-student-avatar danger">{initials(student.name)}</span><div><strong>{student.name}</strong><small>{student.tests} tests · Avg {Math.round(student.averageScore || 0)}%</small></div><span className="pill danger">High risk</span></Link>)}{!analytics?.highRiskStudents?.length && <div className="analytics-empty">No students are currently marked high risk.</div>}</div>
  </div>;

  if (metric === "score" || metric === "tests") return <div className="analytics-detail-stack">
    <ScoreTrendChart rows={analytics?.trends || []}/>
    <div className="analytics-detail-list">{(analytics?.recentTests || []).map((test) => <Link href={`/admin/users/${test.studentId}`} key={test.id} className="analytics-detail-row"><span className="admin-student-avatar">{initials(test.student)}</span><div><strong>{test.student}</strong><small>{test.testType}{test.difficulty ? ` · ${test.difficulty}` : ""}</small></div><b>{test.score === null ? "—" : `${Math.round(test.score)}%`}</b></Link>)}</div>
  </div>;

  if (metric === "tutor") return <div className="analytics-detail-stack">
    <div className="analytics-detail-summary"><strong>{overview.tutorQueries || 0}</strong><span>AI tutor questions in {analytics?.range?.label || "this period"}</span></div>
    <div className="analytics-detail-list">{(analytics?.recentChats || []).map((chat) => <Link href={`/admin/users/${chat.studentId}`} key={chat.id} className="analytics-detail-row multiline"><span className="admin-student-avatar">{initials(chat.student)}</span><div><strong>{chat.student}</strong><small>{chat.question}</small><em>{chat.provider} · {relativeTime(chat.createdAt)}</em></div><Icon name="chevron" size={14}/></Link>)}</div>
  </div>;

  return null;
}

function StudentDetail({ detail, onExport }) {
  if (!detail) return <div className="analytics-modal-loading"><span className="loading-spinner"/><strong>Loading student history…</strong></div>;
  if (detail.error) return <div className="analytics-empty padded">Could not load this student's learning history.</div>;
  const tests = detail.tests || [];
  const predictions = detail.progress || [];
  const chats = detail.chats || [];
  const validScores = tests.map((item) => {
    const score = Number(item.score ?? item.marksObtained);
    const total = Number(item.total_marks ?? item.totalMarks);
    return Number.isFinite(score) && Number.isFinite(total) && total > 0 ? (score / total) * 100 : null;
  }).filter((value) => value !== null);
  const average = validScores.length ? validScores.reduce((sum, value) => sum + value, 0) / validScores.length : 0;
  const latest = predictions[0] || {};

  return <>
    <div className="student-modal-kpis">
      <div><span>Latest prediction</span><strong>{latest.total_predicted_marks ?? "—"}</strong></div>
      <div><span>Risk level</span><strong className={`text-${riskTone(latest.risk_level)}`}>{latest.risk_level || "—"}</strong></div>
      <div><span>Adaptive tests</span><strong>{tests.length}</strong></div>
      <div><span>Average score</span><strong>{Math.round(average)}%</strong></div>
      <div><span>Tutor questions</span><strong>{chats.length}</strong></div>
    </div>
    <div className="student-modal-grid">
      <section><div className="section-heading compact"><h3>Prediction history</h3></div><div className="analytics-detail-list">{predictions.slice(0, 10).map((row) => <div className="analytics-detail-row simple" key={row.id}><div><strong>{row.total_predicted_marks ?? "—"} predicted marks</strong><small>{row.risk_level || "—"} risk</small></div><span>{row.createdAt ? new Date(row.createdAt).toLocaleDateString() : "—"}</span></div>)}{!predictions.length && <div className="analytics-empty">No prediction history.</div>}</div></section>
      <section><div className="section-heading compact"><h3>Adaptive tests</h3></div><div className="analytics-detail-list">{tests.slice(0, 10).map((row) => <div className="analytics-detail-row simple" key={row.id}><div><strong>{row.test_type || "Adaptive test"}</strong><small>{row.difficulty || ""}</small></div><b>{row.total_marks ? `${Math.round((Number(row.score || 0) / Number(row.total_marks)) * 100)}%` : "—"}</b></div>)}{!tests.length && <div className="analytics-empty">No adaptive tests.</div>}</div></section>
      <section><div className="section-heading compact"><h3>Tutor history</h3></div><div className="analytics-detail-list">{chats.slice(0, 8).map((row) => <div className="analytics-detail-row simple multiline" key={row.id}><div><strong>{row.question || "Tutor question"}</strong><small>{row.provider || "AI"}</small></div></div>)}{!chats.length && <div className="analytics-empty">No tutor history.</div>}</div></section>
    </div>
    <div className="student-modal-actions"><button className="secondary-btn compact" onClick={onExport}><Icon name="clipboard" size={14}/>Export student PDF</button></div>
  </>;
}

function LearningAdmin() {
  const [range, setRange] = useState("1m");
  const [analytics, setAnalytics] = useState(null);
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [metricModal, setMetricModal] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentDetail, setStudentDetail] = useState(null);

  const loadAnalytics = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true); else setLoading(true);
    setError("");
    try { setAnalytics(await adminApi.learningDashboard(range)); }
    catch (err) { setError(err?.message || "Could not load learning insights."); }
    finally { setLoading(false); setRefreshing(false); }
  }, [range]);

  const loadUsers = useCallback(async () => {
    try {
      const response = await adminApi.users({ search, page, limit: 20 });
      setUsers(response.items || []);
      setPages(response.pages || 1);
    } catch (err) { setError(err?.message || "Could not load students."); }
  }, [search, page]);

  useEffect(() => { loadAnalytics(); }, [loadAnalytics]);
  useEffect(() => { const timer = setTimeout(loadUsers, 220); return () => clearTimeout(timer); }, [loadUsers]);
  useEffect(() => {
    if (!selectedStudent) { setStudentDetail(null); return; }
    setStudentDetail(null);
    adminApi.user(selectedStudent).then(setStudentDetail).catch(() => setStudentDetail({ error: true }));
  }, [selectedStudent]);

  const overview = analytics?.overview || {};
  const trend = analytics?.trends || [];
  const metricTitles = {
    students: ["All students", "Student accounts currently available to the admin."],
    active: ["Active students", `Students who generated learning activity in ${analytics?.range?.label || "the selected period"}.`],
    risk: ["High-risk students", "Students whose latest AI prediction currently reports High risk."],
    score: ["Adaptive test performance", "Recent adaptive-test scores and average performance."],
    tests: ["Adaptive tests", `Tests completed in ${analytics?.range?.label || "the selected period"}.`],
    tutor: ["AI tutor usage", `Tutor questions asked in ${analytics?.range?.label || "the selected period"}.`],
  };

  const engagementRows = useMemo(() => (analytics?.studentActivity || []).slice(0, 8).map((student) => ({
    id: student.id,
    label: student.name,
    subLabel: `${student.tests} tests · ${student.chats} tutor`,
    value: student.activity + student.tests + student.chats + student.predictions,
  })), [analytics]);

  const scoreBands = useMemo(() => (analytics?.scoreDistribution || []).map((item) => ({ ...item, value: item.count })), [analytics]);

  if (loading && !analytics) return <AppShell admin title="Learning Insights" subtitle="Loading analytics"><section className="admin-kpi-grid">{Array.from({ length: 6 }, (_, index) => <CardSkeleton key={index}/>)}</section><div className="learning-dashboard-primary"><CardSkeleton/><CardSkeleton/></div></AppShell>;

  return <AppShell
    admin
    title="Learning Insights"
    subtitle="AI prediction, adaptive tests, tutor usage and student engagement"
    actions={<div className="admin-header-actions"><button className="secondary-btn compact" onClick={() => loadAnalytics(true)} disabled={refreshing}><Icon name="activity" size={15}/>{refreshing ? "Refreshing" : "Refresh"}</button><button className="secondary-btn compact desktop-action" onClick={() => adminApi.downloadStudents()}><Icon name="clipboard" size={15}/>Export</button></div>}
  >
    <section className="crm-dashboard-toolbar">
      <div><span className="admin-card-kicker">Analytics period</span><strong>{analytics?.range?.label || "1 Month"}</strong></div>
      <div className="crm-range-tabs">{RANGES.map(([key, label]) => <button key={key} type="button" className={range === key ? "active" : ""} onClick={() => setRange(key)}>{label}</button>)}</div>
      <span className="crm-dashboard-updated">Updated {relativeTime(analytics?.generatedAt)}</span>
    </section>

    {error && <div className="error-box admin-dashboard-error">{error}</div>}

    <section className="admin-kpi-grid learning-kpi-grid">
      <AnalyticsKpiCard icon="user" label="Total students" value={overview.totalStudents ?? 0} helper="Open complete student list" tone="blue" trend={trend.map((row) => row.activity)} onClick={() => setMetricModal("students")}/>
      <AnalyticsKpiCard icon="activity" label="Active students" value={overview.activeStudents ?? 0} helper={`${analytics?.range?.label || "Period"} engagement`} tone="cyan" trend={trend.map((row) => row.activity)} onClick={() => setMetricModal("active")}/>
      <AnalyticsKpiCard icon="target" label="High risk" value={overview.highRisk ?? 0} helper="Current AI risk classification" tone="red" trend={trend.map((row) => row.predictions)} onClick={() => setMetricModal("risk")}/>
      <AnalyticsKpiCard icon="trophy" label="Average score" value={`${Math.round(overview.averageScore || 0)}%`} helper="Adaptive test average" tone="green" trend={trend.map((row) => row.avgScore)} onClick={() => setMetricModal("score")}/>
      <AnalyticsKpiCard icon="clipboard" label="Adaptive tests" value={overview.tests ?? 0} helper={`${analytics?.range?.label || "Period"} completed`} tone="purple" trend={trend.map((row) => row.tests)} onClick={() => setMetricModal("tests")}/>
      <AnalyticsKpiCard icon="chat" label="Tutor questions" value={overview.tutorQueries ?? 0} helper={`${overview.predictions ?? 0} AI predictions too`} tone="orange" trend={trend.map((row) => row.chats)} onClick={() => setMetricModal("tutor")}/>
    </section>

    <section className="learning-dashboard-primary below-fold-panel">
      <article className="admin-dashboard-card learning-trend-card">
        <div className="admin-card-heading"><div><span className="admin-card-kicker">Activity trend</span><h2>Student learning activity</h2><p>Study actions, adaptive tests, AI tutor usage and performance predictions for the selected period.</p></div><span className="admin-card-meta">{overview.activityEvents || 0} recorded actions</span></div>
        <MultiTrendChart rows={trend} series={[{ key: "activity", label: "Activity", tone: "blue" }, { key: "tests", label: "Tests", tone: "green" }, { key: "chats", label: "Tutor", tone: "purple" }, { key: "predictions", label: "Predictions", tone: "orange" }]}/>
      </article>
      <article className="admin-dashboard-card learning-risk-card">
        <div className="admin-card-heading"><div><span className="admin-card-kicker">Student health</span><h2>AI risk distribution</h2><p>Latest prediction for every student.</p></div></div>
        <RiskDonut distribution={analytics?.riskDistribution} total={overview.totalStudents || 0}/>
        <button className="analytics-card-link" type="button" onClick={() => setMetricModal("risk")}>View high-risk students <Icon name="chevron" size={13}/></button>
      </article>
    </section>

    <section className="learning-dashboard-secondary below-fold-panel">
      <article className="admin-dashboard-card"><ScoreTrendChart rows={trend}/></article>
      <article className="admin-dashboard-card">
        <div className="admin-card-heading"><div><span className="admin-card-kicker">Score distribution</span><h2>Adaptive test score bands</h2><p>Where completed tests fall across performance bands.</p></div></div>
        <HorizontalBarChart rows={scoreBands} valueKey="value" suffix="" tone="blue" empty="No tests recorded for this period."/>
      </article>
      <article className="admin-dashboard-card">
        <div className="admin-card-heading"><div><span className="admin-card-kicker">Engagement</span><h2>Most active students</h2><p>Combined learning actions, tests, tutor questions and predictions.</p></div></div>
        <HorizontalBarChart rows={engagementRows} valueKey="value" tone="purple" empty="No student activity for this period."/>
      </article>
    </section>

    <section className="learning-live-grid below-fold-panel">
      <article className="admin-dashboard-card">
        <div className="admin-card-heading"><div><span className="admin-card-kicker">Latest intelligence</span><h2>Recent predictions</h2><p>Latest AI performance assessments.</p></div><span className="admin-card-meta">{overview.predictions || 0} in period</span></div>
        <div className="analytics-detail-list compact">{(analytics?.recentPredictions || []).slice(0, 7).map((row) => <Link href={`/admin/users/${row.studentId}`} key={row.id} className="analytics-detail-row"><span className="admin-student-avatar">{initials(row.student)}</span><div><strong>{row.student}</strong><small>{relativeTime(row.createdAt)}</small></div><div className="analytics-row-value"><b>{row.predictedMarks ?? "—"}</b><span className={`pill ${riskTone(row.risk)}`}>{row.risk}</span></div></Link>)}{!analytics?.recentPredictions?.length && <div className="analytics-empty">No predictions in this period.</div>}</div>
      </article>
      <article className="admin-dashboard-card">
        <div className="admin-card-heading"><div><span className="admin-card-kicker">AI tutor</span><h2>Recent tutor questions</h2><p>What students are currently asking for help with.</p></div></div>
        <div className="analytics-detail-list compact">{(analytics?.recentChats || []).slice(0, 7).map((row) => <Link href={`/admin/users/${row.studentId}`} key={row.id} className="analytics-detail-row multiline"><span className="admin-student-avatar">{initials(row.student)}</span><div><strong>{row.student}</strong><small>{row.question}</small><em>{relativeTime(row.createdAt)}</em></div><Icon name="chevron" size={13}/></Link>)}{!analytics?.recentChats?.length && <div className="analytics-empty">No tutor questions in this period.</div>}</div>
      </article>
    </section>

    <section className="admin-dashboard-card learning-students-card below-fold-panel">
      <div className="admin-students-toolbar">
        <div><span className="admin-card-kicker">Student analytics</span><h2>Student learning performance</h2><p>Click a student to open prediction, adaptive-test and tutor details without leaving this dashboard.</p></div>
        <div className="admin-search-box"><Icon name="search" size={16}/><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search student or email"/></div>
      </div>
      <div className="learning-student-table-wrap">
        <div className="learning-student-table">
          <div className="learning-student-row header"><span>Student</span><span>Risk</span><span>Predicted</span><span>Tests</span><span>Average</span><span>Tutor</span><span>Last seen</span><span/></div>
          {users.map((student) => <button type="button" key={student.id} className="learning-student-row" onClick={() => setSelectedStudent(student.id)}>
            <div className="learning-student-identity"><span className="admin-student-avatar">{initials(student.name || student.profile?.name)}</span><div><strong>{student.name || student.profile?.name || "Student"}</strong><small>{student.email}</small></div></div>
            <span><span className={`pill ${riskTone(student.latest_progress?.risk_level)}`}>{student.latest_progress?.risk_level || "No data"}</span></span>
            <strong>{student.latest_progress?.total_predicted_marks ?? "—"}</strong>
            <span>{student.test_stats?.count || 0}</span>
            <span>{Math.round(student.test_stats?.average_score || 0)}%</span>
            <span>{student.chat_stats?.count || 0}</span>
            <span>{relativeTime(student.last_seen_at || student.lastSeenAt)}</span>
            <Icon name="chevron" size={14}/>
          </button>)}
        </div>
      </div>
      {!users.length && <div className="analytics-empty padded">No students match this search.</div>}
      <div className="admin-pagination learning-pagination"><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><span>Page {page} of {pages}</span><button disabled={page >= pages} onClick={() => setPage((value) => value + 1)}>Next</button></div>
    </section>

    <AnalyticsModal open={Boolean(metricModal)} title={metricTitles[metricModal]?.[0] || "Details"} subtitle={metricTitles[metricModal]?.[1]} onClose={() => setMetricModal(null)} wide={metricModal === "score" || metricModal === "tests"}>
      <MetricDetail metric={metricModal} analytics={analytics} users={users}/>
    </AnalyticsModal>

    <AnalyticsModal open={Boolean(selectedStudent)} title={studentDetail?.user?.name || studentDetail?.user?.profile?.name || "Student learning detail"} subtitle={studentDetail?.user?.email || "Prediction, adaptive test and tutor history"} onClose={() => { setSelectedStudent(null); setStudentDetail(null); }} wide>
      <StudentDetail detail={studentDetail} onExport={() => selectedStudent && adminApi.downloadStudent(selectedStudent)}/>
    </AnalyticsModal>
  </AppShell>;
}

export default function Page() {
  return <RequireAuth admin><LearningAdmin/></RequireAuth>;
}
