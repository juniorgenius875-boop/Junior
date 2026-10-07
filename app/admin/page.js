"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import RequireAuth from "@/components/RequireAuth";
import AppShell from "@/components/AppShell";
import StatCard from "@/components/StatCard";
import {
  ConsistencyGraphic,
  StageProgressGraphic,
  SubjectProgressGraphic,
  TaskStatusGraphic,
  TestTrendGraphic,
  WeeklyTaskChart,
} from "@/components/AdminVisuals";
import { SUBJECT_ORDER, SUBJECTS } from "@/lib/catalog";
import { aggregateSubjectRows, dateKey, taskCounts } from "@/lib/adminAnalytics";
import { dashboardMetrics, DEFAULT_SETTINGS } from "@/lib/performance";
import { pct } from "@/lib/format";
import {
  saveSettings,
  watchAllChapterProgress,
  watchAllMockTests,
  watchAllStudyActivities,
  watchSettings,
  watchUsers,
} from "@/lib/firestore";

const subjects = SUBJECT_ORDER.map((slug) => SUBJECTS[slug]);

function AdminContent() {
  const [users, setUsers] = useState([]);
  const [allProgress, setAllProgress] = useState({});
  const [allActivities, setAllActivities] = useState([]);
  const [allTests, setAllTests] = useState([]);
  const [settingsRemote, setSettingsRemote] = useState(null);
  const [search, setSearch] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    const stops = [
      watchUsers(setUsers),
      watchAllChapterProgress(setAllProgress),
      watchAllStudyActivities(setAllActivities),
      watchAllMockTests(setAllTests),
      watchSettings(setSettingsRemote),
    ];
    return () => stops.forEach((stop) => stop());
  }, []);

  const settings = useMemo(() => ({ ...DEFAULT_SETTINGS, ...(settingsRemote || {}) }), [settingsRemote]);
  const students = useMemo(() => users.filter((user) => user.role !== "admin" && user.active !== false), [users]);
  const rows = useMemo(() => students.map((student) => ({
    student,
    metrics: dashboardMetrics(subjects, allProgress[student.id] || {}, settings),
  })), [students, allProgress, settings]);

  const today = dateKey();
  const todayActivities = useMemo(() => allActivities.filter((item) => item.scheduledDate === today), [allActivities, today]);
  const todayCounts = useMemo(() => taskCounts(todayActivities), [todayActivities]);
  const subjectSummary = useMemo(() => aggregateSubjectRows(rows), [rows]);

  const cutAverage = useMemo(() => {
    if (!rows.length) return { first: 0, second: 0, third: 0 };
    return {
      first: rows.reduce((sum, row) => sum + row.metrics.firstCutPercent, 0) / rows.length,
      second: rows.reduce((sum, row) => sum + row.metrics.secondCutPercent, 0) / rows.length,
      third: rows.reduce((sum, row) => sum + row.metrics.thirdCutPercent, 0) / rows.length,
    };
  }, [rows]);

  const averageLatest = useMemo(() => {
    const scored = rows.filter((row) => row.metrics.scoredAreas > 0);
    return {
      hasTests: scored.length > 0,
      value: scored.length
        ? scored.reduce((sum, row) => sum + row.metrics.overallLatest, 0) / scored.length
        : 0,
    };
  }, [rows]);

  const filtered = rows.filter(({ student }) => {
    const q = search.trim().toLowerCase();
    return !q || `${student.name || ""} ${student.email || ""}`.toLowerCase().includes(q);
  });

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
    } finally {
      setSavingSettings(false);
    }
  }

  return (
    <AppShell
      admin
      title="Admin overview"
      actions={<div className="live-actions"><Link href="/admin/planner" className="primary-btn compact">Assign work</Link><button className="secondary-btn compact" onClick={() => setShowSettings((value) => !value)}>Settings</button></div>}
    >
      <section className="stats-grid four compact-stats">
        <StatCard label="Students" value={students.length} />
        <StatCard label="Today planned" value={todayCounts.total} tone="blue" />
        <StatCard label="Today completed" value={todayCounts.completed} tone="success" />
        <StatCard label="Average test score" value={averageLatest.hasTests ? `Latest test ${Math.round(averageLatest.value)}%` : "No test yet"} tone="purple" />
      </section>

      {showSettings && (
        <section className="panel-card settings-panel">
          <div className="section-heading"><h2>Performance settings</h2></div>
          <form className="form-grid six" onSubmit={updateSettings}>
            <label>Chapter target %<input name="defaultTarget" type="number" min="0" max="100" defaultValue={settings.defaultTarget} /></label>
            <label>Board ready %<input name="boardReadyThreshold" type="number" min="0" max="100" defaultValue={settings.boardReadyThreshold} /></label>
            <label>Mastered %<input name="masteredThreshold" type="number" min="0" max="100" defaultValue={settings.masteredThreshold} /></label>
            <label>Good %<input name="goodThreshold" type="number" min="0" max="100" defaultValue={settings.goodThreshold} /></label>
            <label>Weak below %<input name="weakThreshold" type="number" min="0" max="100" defaultValue={settings.weakThreshold} /></label>
            <label>Delay days<input name="delayWarningDays" type="number" min="0" defaultValue={settings.delayWarningDays} /></label>
            <button className="primary-btn compact" disabled={savingSettings}>{savingSettings ? "Saving…" : "Save"}</button>
          </form>
        </section>
      )}

      <div className="admin-visual-grid">
        <section className="panel-card"><TaskStatusGraphic activities={todayActivities} title="Today" /></section>
        <section className="panel-card"><WeeklyTaskChart activities={allActivities} /></section>
        <section className="panel-card"><StageProgressGraphic first={cutAverage.first} second={cutAverage.second} third={cutAverage.third} title="Overall cut progress" /></section>
        <section className="panel-card"><TestTrendGraphic tests={allTests} title="Overall test trend" /></section>
      </div>

      <div className="admin-visual-grid wide-left">
        <section className="panel-card"><SubjectProgressGraphic rows={subjectSummary} /></section>
        <section className="panel-card"><ConsistencyGraphic activities={allActivities} /></section>
      </div>

      <section className="panel-card admin-student-panel">
        <div className="admin-list-header">
          <div><h2>Students</h2><p className="muted admin-section-note">Open a student to monitor daily work, cut progress and test trend.</p></div>
          <input className="search-input admin-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search student" />
        </div>
        <div className="admin-user-list admin-user-list-clean">
          {filtered.map(({ student, metrics }) => {
            const studentActivities = allActivities.filter((item) => item.userId === student.id && item.scheduledDate === today);
            const counts = taskCounts(studentActivities);
            return (
              <Link href={`/admin/users/${student.id}`} className="admin-user-row admin-user-row-track" key={student.id}>
                <div className="avatar large">{String(student.name || student.email || "S").slice(0, 1).toUpperCase()}</div>
                <div className="admin-user-main">
                  <strong>{student.name || "Student"}</strong>
                  <small>{student.email}</small>
                  <div className="mini-progress"><span style={{ width: `${Math.min(100, counts.completionPercent)}%` }} /></div>
                </div>
                <div className="admin-mini-metric metric-today"><span>Today</span><strong>{counts.completed}/{counts.total}</strong></div>
                <div className="admin-mini-metric metric-first"><span>First</span><strong>{pct(metrics.firstCutPercent)}</strong></div>
                <div className="admin-mini-metric metric-second"><span>Second</span><strong>{pct(metrics.secondCutPercent)}</strong></div>
                <div className="admin-mini-metric metric-third"><span>Third</span><strong>{pct(metrics.thirdCutPercent)}</strong></div>
              </Link>
            );
          })}
          {!filtered.length && <div className="empty-state compact-empty"><strong>No students found</strong></div>}
        </div>
      </section>
    </AppShell>
  );
}

export default function AdminPage() {
  return <RequireAuth admin><AdminContent /></RequireAuth>;
}
