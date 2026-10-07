"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import RequireAuth from "@/components/RequireAuth";
import AppShell from "@/components/AppShell";
import Icon from "@/components/Icons";
import { CardSkeleton } from "@/components/LoadingUI";
import { adminApi } from "@/lib/api";
import { dateKey } from "@/lib/adminAnalytics";
import { saveSettings } from "@/lib/firestore";

function clamp(value) {
  return Math.max(0, Math.min(100, Number(value) || 0));
}

function percent(value) {
  return `${Math.round(Number(value) || 0)}%`;
}

function initials(name = "S") {
  return String(name).trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "S";
}

function statusClass(status) {
  if (status === "Board Ready") return "success";
  if (status === "On Track") return "blue";
  if (status === "Needs Attention") return "warning";
  return "danger";
}

function relativeTime(value) {
  if (!value) return "No recent activity";
  const diff = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(diff)) return "—";
  const minutes = Math.max(0, Math.round(diff / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function activityLabel(action = "") {
  return String(action).replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function KpiCard({ icon, label, value, helper, tone = "blue" }) {
  return <article className={`admin-kpi-card ${tone}`}>
    <div className="admin-kpi-icon"><Icon name={icon} size={19}/></div>
    <div className="admin-kpi-copy"><span>{label}</span><strong>{value}</strong><small>{helper}</small></div>
  </article>;
}

function ProgressBar({ value, tone = "blue" }) {
  return <div className={`admin-progress-bar ${tone}`}><span style={{ width: `${clamp(value)}%` }}/></div>;
}

function DashboardContent() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [showSettings, setShowSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true); else setLoading(true);
    setError("");
    try {
      setData(await adminApi.dashboard(dateKey()));
    } catch (err) {
      setError(err?.message || "Could not load the admin dashboard.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(() => load(true), 60000);
    return () => clearInterval(id);
  }, [load]);

  const students = data?.students || [];
  const filteredStudents = useMemo(() => {
    const query = search.trim().toLowerCase();
    return students.filter((student) => {
      const matchesSearch = !query || `${student.name} ${student.email} ${student.school}`.toLowerCase().includes(query);
      const matchesFilter = filter === "all"
        || (filter === "risk" && ["At Risk", "Needs Attention"].includes(student.status))
        || (filter === "ready" && student.status === "Board Ready")
        || (filter === "active" && student.lastSeenAt && (Date.now() - new Date(student.lastSeenAt).getTime()) <= 7 * 86400000);
      return matchesSearch && matchesFilter;
    });
  }, [students, search, filter]);

  const attentionStudents = useMemo(() => students
    .filter((student) => ["At Risk", "Needs Attention"].includes(student.status))
    .sort((a, b) => (b.overdue - a.overdue) || ((a.latestTest ?? 101) - (b.latestTest ?? 101)))
    .slice(0, 6), [students]);

  const overview = data?.overview || {};
  const distribution = data?.distribution || { ready: 0, onTrack: 0, attention: 0 };
  const distributionTotal = Math.max(1, distribution.ready + distribution.onTrack + distribution.attention);
  const readyDeg = (distribution.ready / distributionTotal) * 360;
  const trackDeg = readyDeg + (distribution.onTrack / distributionTotal) * 360;
  const weeklyMax = Math.max(1, ...(data?.weekly || []).map((row) => row.planned));

  async function exportReport() {
    try { await adminApi.downloadStudents(); } catch (err) { setError(err?.message || "Could not export report."); }
  }

  async function updateSettings(event) {
    event.preventDefault();
    setSavingSettings(true);
    const form = new FormData(event.currentTarget);
    try {
      await saveSettings({
        defaultTarget: Number(form.get("defaultTarget")),
        boardReadyThreshold: Number(form.get("boardReadyThreshold")),
        masteredThreshold: Number(form.get("masteredThreshold")),
        goodThreshold: Number(form.get("goodThreshold")),
        weakThreshold: Number(form.get("weakThreshold")),
        delayWarningDays: Number(form.get("delayWarningDays")),
      });
      setShowSettings(false);
      await load(true);
    } finally {
      setSavingSettings(false);
    }
  }

  if (loading) return <AppShell admin title="Dashboard" subtitle="Loading student performance"><div className="admin-kpi-grid">{Array.from({ length: 6 }, (_, index) => <CardSkeleton key={index}/>)}</div><div className="admin-dashboard-grid admin-dashboard-grid-primary"><CardSkeleton/><CardSkeleton/></div></AppShell>;

  return (
    <AppShell
      admin
      title="Dashboard"
      subtitle="Monitor every student, study-plan execution and learning performance"
      actions={<div className="admin-header-actions">
        <button className="secondary-btn compact" type="button" onClick={() => load(true)} disabled={refreshing}><Icon name="activity" size={15}/>{refreshing ? "Refreshing" : "Refresh"}</button>
        <button className="secondary-btn compact desktop-action" type="button" onClick={exportReport}><Icon name="clipboard" size={15}/>Export</button>
        <Link className="primary-btn compact" href="/admin/planner"><Icon name="calendar" size={15}/>Assign work</Link>
      </div>}
    >
      {error && <div className="error-box admin-dashboard-error">{error}</div>}

      <section className="admin-kpi-grid">
        <KpiCard icon="user" label="Total students" value={overview.totalStudents || 0} helper={`${overview.active7d || 0} active in last 7 days`} tone="blue"/>
        <KpiCard icon="activity" label="Average readiness" value={percent(overview.averageReadiness)} helper="Board-ready chapters across all students" tone="purple"/>
        <KpiCard icon="trophy" label="Average test score" value={percent(overview.averageTest)} helper="Latest recorded student tests" tone="green"/>
        <KpiCard icon="target" label="Needs attention" value={overview.atRisk || 0} helper="At-risk or below expected performance" tone="orange"/>
        <KpiCard icon="clipboard" label="Tasks today" value={`${overview.todayCompleted || 0}/${overview.todayPlanned || 0}`} helper="Completed versus planned" tone="cyan"/>
        <KpiCard icon="clock" label="Active today" value={overview.active24h || 0} helper="Students seen in the last 24 hours" tone="slate"/>
      </section>

      <section className="admin-dashboard-grid admin-dashboard-grid-primary">
        <article className="admin-dashboard-card admin-cut-card">
          <div className="admin-card-heading">
            <div><span className="admin-card-kicker">Academic plan</span><h2>Overall revision progress</h2><p>Average completion across the complete student group.</p></div>
            <button className="admin-icon-button" type="button" onClick={() => setShowSettings((value) => !value)} title="Performance settings"><Icon name="target" size={17}/></button>
          </div>
          <div className="admin-cut-list">
            <div className="admin-cut-row"><div><span className="cut-index first">01</span><div><strong>First Cut</strong><small>Foundation coverage</small></div></div><b>{percent(data?.cutAverages?.first)}</b><ProgressBar value={data?.cutAverages?.first} tone="green"/></div>
            <div className="admin-cut-row"><div><span className="cut-index second">02</span><div><strong>Second Cut</strong><small>Revision coverage</small></div></div><b>{percent(data?.cutAverages?.second)}</b><ProgressBar value={data?.cutAverages?.second} tone="purple"/></div>
            <div className="admin-cut-row"><div><span className="cut-index third">03</span><div><strong>Third Cut</strong><small>Final board preparation</small></div></div><b>{percent(data?.cutAverages?.third)}</b><ProgressBar value={data?.cutAverages?.third} tone="blue"/></div>
          </div>
        </article>

        <article className="admin-dashboard-card admin-health-card">
          <div className="admin-card-heading"><div><span className="admin-card-kicker">Student health</span><h2>Performance distribution</h2><p>Current status across all active students.</p></div></div>
          <div className="admin-health-layout">
            <div className="admin-health-donut" style={{ "--ready": `${readyDeg}deg`, "--track": `${trackDeg}deg` }}><div><strong>{overview.totalStudents || 0}</strong><span>students</span></div></div>
            <div className="admin-health-legend">
              <div><i className="ready"/><span>Board Ready</span><strong>{distribution.ready || 0}</strong></div>
              <div><i className="track"/><span>On Track</span><strong>{distribution.onTrack || 0}</strong></div>
              <div><i className="attention"/><span>Attention</span><strong>{distribution.attention || 0}</strong></div>
            </div>
          </div>
        </article>
      </section>

      {showSettings && <section className="admin-dashboard-card admin-settings-card">
        <div className="admin-card-heading"><div><span className="admin-card-kicker">Configuration</span><h2>Performance thresholds</h2><p>These values control readiness and performance status calculations.</p></div><button type="button" className="admin-icon-button" onClick={() => setShowSettings(false)}><Icon name="close" size={17}/></button></div>
        <form className="admin-settings-grid" onSubmit={updateSettings}>
          <label>Chapter target %<input name="defaultTarget" type="number" min="0" max="100" defaultValue={data?.settings?.defaultTarget ?? 90}/></label>
          <label>Board ready %<input name="boardReadyThreshold" type="number" min="0" max="100" defaultValue={data?.settings?.boardReadyThreshold ?? 85}/></label>
          <label>Mastered %<input name="masteredThreshold" type="number" min="0" max="100" defaultValue={data?.settings?.masteredThreshold ?? 90}/></label>
          <label>Good %<input name="goodThreshold" type="number" min="0" max="100" defaultValue={data?.settings?.goodThreshold ?? 80}/></label>
          <label>Weak below %<input name="weakThreshold" type="number" min="0" max="100" defaultValue={data?.settings?.weakThreshold ?? 60}/></label>
          <label>Delay warning days<input name="delayWarningDays" type="number" min="0" defaultValue={data?.settings?.delayWarningDays ?? 5}/></label>
          <button className="primary-btn compact" disabled={savingSettings}>{savingSettings ? "Saving…" : "Save settings"}</button>
        </form>
      </section>}

      <section className="admin-dashboard-grid admin-dashboard-grid-secondary below-fold-panel">
        <article className="admin-dashboard-card admin-weekly-card">
          <div className="admin-card-heading"><div><span className="admin-card-kicker">Study execution</span><h2>Last 7 days</h2><p>Planned tasks compared with completed work.</p></div><span className="admin-card-meta">Group activity</span></div>
          <div className="admin-weekly-chart">
            {(data?.weekly || []).map((row) => {
              const date = new Date(`${row.date}T12:00:00`);
              return <div className="admin-week-column" key={row.date}>
                <div className="admin-week-bars">
                  <span className="planned" style={{ height: `${Math.max(row.planned ? 8 : 0, (row.planned / weeklyMax) * 100)}%` }}/>
                  <span className="completed" style={{ height: `${Math.max(row.completed ? 8 : 0, (row.completed / weeklyMax) * 100)}%` }}/>
                </div>
                <strong>{date.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 2)}</strong>
                <small>{row.completed}/{row.planned}</small>
              </div>;
            })}
          </div>
          <div className="admin-chart-key"><span><i className="planned"/>Planned</span><span><i className="completed"/>Completed</span></div>
        </article>

        <article className="admin-dashboard-card admin-subject-card">
          <div className="admin-card-heading"><div><span className="admin-card-kicker">Curriculum</span><h2>Subject performance</h2><p>Average chapter score and readiness by subject.</p></div></div>
          <div className="admin-subject-list">
            {(data?.subjects || []).map((subject) => <div className="admin-subject-row" key={subject.slug}>
              <div className="admin-subject-title"><strong>{subject.name}</strong><span>{subject.averageScore === null ? "No score" : `${Math.round(subject.averageScore)}% avg`}</span></div>
              <div className="admin-subject-values"><span>Ready {percent(subject.boardReadiness)}</span><span>1st {percent(subject.firstCutPercent)}</span><span>2nd {percent(subject.secondCutPercent)}</span><span>3rd {percent(subject.thirdCutPercent)}</span></div>
              <ProgressBar value={subject.averageScore ?? subject.firstCutPercent} tone="blue"/>
            </div>)}
          </div>
        </article>
      </section>

      <section className="admin-dashboard-grid admin-dashboard-grid-secondary below-fold-panel">
        <article className="admin-dashboard-card admin-attention-card">
          <div className="admin-card-heading"><div><span className="admin-card-kicker">Intervention</span><h2>Students needing attention</h2><p>Prioritized using missed work, latest scores and AI risk.</p></div><span className="admin-card-meta">{attentionStudents.length} shown</span></div>
          <div className="admin-attention-list">
            {attentionStudents.length ? attentionStudents.map((student) => <Link href={`/admin/users/${student.id}`} className="admin-attention-row" key={student.id}>
              <span className="admin-student-avatar">{initials(student.name)}</span>
              <div className="admin-attention-main"><strong>{student.name}</strong><small>{student.school || student.email}</small></div>
              <div className="admin-attention-reason"><strong>{student.latestTest === null ? "—" : percent(student.latestTest)}</strong><small>latest test</small></div>
              <div className="admin-attention-reason"><strong>{student.overdue}</strong><small>overdue</small></div>
              <span className={`admin-status-badge ${statusClass(student.status)}`}>{student.status}</span>
              <Icon name="chevron" size={14}/>
            </Link>) : <div className="admin-empty-state"><Icon name="check" size={22}/><div><strong>No students currently flagged</strong><span>All active students are within the current thresholds.</span></div></div>}
          </div>
        </article>

        <article className="admin-dashboard-card admin-activity-card">
          <div className="admin-card-heading"><div><span className="admin-card-kicker">Live feed</span><h2>Recent activity</h2><p>Latest learning actions recorded by students.</p></div></div>
          <div className="admin-feed-list">
            {(data?.recentActivity || []).slice(0, 7).map((row) => <div className="admin-feed-row" key={row.id}>
              <span className="admin-feed-dot"/>
              <div><strong>{row.student?.name || "Student"}</strong><span>{activityLabel(row.action)}</span><small>{relativeTime(row.createdAt)}</small></div>
            </div>)}
            {!data?.recentActivity?.length && <div className="admin-empty-state compact"><Icon name="activity" size={20}/><div><strong>No activity yet</strong><span>Student activity will appear here.</span></div></div>}
          </div>
        </article>
      </section>

      <section id="student-progress" className="admin-dashboard-card admin-students-card below-fold-panel">
        <div className="admin-students-toolbar">
          <div><span className="admin-card-kicker">Student management</span><h2>All student progress</h2><p>Complete progress view for every active student. Open a student for chapter-level detail.</p></div>
          <div className="admin-student-controls">
            <div className="admin-search-box"><Icon name="search" size={16}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search student, email or school"/></div>
            <select value={filter} onChange={(event) => setFilter(event.target.value)}>
              <option value="all">All students</option>
              <option value="risk">Needs attention</option>
              <option value="ready">Board ready</option>
              <option value="active">Active this week</option>
            </select>
          </div>
        </div>

        <div className="admin-table-summary"><span>Showing <strong>{filteredStudents.length}</strong> of <strong>{students.length}</strong> students</span><span>Updated {relativeTime(data?.generatedAt)}</span></div>

        <div className="admin-student-table-wrap">
          <div className="admin-student-table">
            <div className="admin-student-table-row header">
              <span>Student</span><span>Board readiness</span><span>1st Cut</span><span>2nd Cut</span><span>3rd Cut</span><span>Latest test</span><span>Today</span><span>Overdue</span><span>Status</span><span/>
            </div>
            {filteredStudents.map((student) => <Link href={`/admin/users/${student.id}`} className="admin-student-table-row" key={student.id}>
              <div className="admin-student-cell identity"><span className="admin-student-avatar">{initials(student.name)}</span><div><strong>{student.name}</strong><small>{student.grade ? `Grade ${student.grade}` : "Student"}{student.school ? ` · ${student.school}` : ""}</small><em>{student.email}</em></div></div>
              <div className="admin-student-cell readiness"><div><strong>{percent(student.boardReadiness)}</strong><small>{student.weakChapters} weak chapter{student.weakChapters === 1 ? "" : "s"}</small></div><ProgressBar value={student.boardReadiness} tone="blue"/></div>
              <span className="admin-number-cell">{percent(student.firstCutPercent)}</span>
              <span className="admin-number-cell">{percent(student.secondCutPercent)}</span>
              <span className="admin-number-cell">{percent(student.thirdCutPercent)}</span>
              <div className="admin-number-cell score"><strong>{student.latestTest === null ? "—" : percent(student.latestTest)}</strong><small>{student.latestTestDate || "No test"}</small></div>
              <div className="admin-number-cell score"><strong>{student.todayCompleted}/{student.todayPlanned}</strong><small>{student.todayPlanned ? percent(student.todayCompletion) : "No tasks"}</small></div>
              <span className={`admin-overdue-count ${student.overdue ? "has-overdue" : ""}`}>{student.overdue}</span>
              <span className={`admin-status-badge ${statusClass(student.status)}`}>{student.status}</span>
              <span className="admin-row-action"><Icon name="chevron" size={15}/></span>
            </Link>)}
          </div>
        </div>

        {!filteredStudents.length && <div className="admin-empty-state table-empty"><Icon name="search" size={22}/><div><strong>No students match this view</strong><span>Try changing the search or filter.</span></div></div>}
      </section>
    </AppShell>
  );
}

export default function AdminPage() {
  return <RequireAuth admin><DashboardContent/></RequireAuth>;
}
