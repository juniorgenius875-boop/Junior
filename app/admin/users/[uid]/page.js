"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import RequireAuth from "@/components/RequireAuth";
import AppShell from "@/components/AppShell";
import StatCard from "@/components/StatCard";
import { CardSkeleton } from "@/components/LoadingUI";
import { useAuth } from "@/components/AuthProvider";
const MockTestForm = dynamic(() => import("@/components/MockTestForm"), { loading: () => <CardSkeleton /> });
const ConsistencyGraphic = dynamic(() => import("@/components/AdminVisuals").then((m) => m.ConsistencyGraphic), { loading: () => <CardSkeleton /> });
const StageProgressGraphic = dynamic(() => import("@/components/AdminVisuals").then((m) => m.StageProgressGraphic), { loading: () => <CardSkeleton /> });
const SubjectProgressGraphic = dynamic(() => import("@/components/AdminVisuals").then((m) => m.SubjectProgressGraphic), { loading: () => <CardSkeleton /> });
const TaskStatusGraphic = dynamic(() => import("@/components/AdminVisuals").then((m) => m.TaskStatusGraphic), { loading: () => <CardSkeleton /> });
const TestTrendGraphic = dynamic(() => import("@/components/AdminVisuals").then((m) => m.TestTrendGraphic), { loading: () => <CardSkeleton /> });
const WeeklyTaskChart = dynamic(() => import("@/components/AdminVisuals").then((m) => m.WeeklyTaskChart), { loading: () => <CardSkeleton /> });
import { SUBJECT_ORDER, SUBJECTS } from "@/lib/catalog";
import { DEFAULT_SETTINGS, dashboardMetrics, chapterMetrics } from "@/lib/performance";
import { dateKey, taskCounts, taskStatusLabel, taskStatusTone } from "@/lib/adminAnalytics";
import {
  getUserProfile,
  watchChapterProgress,
  watchMockTests,
  watchSettings,
  watchStudyActivities,
} from "@/lib/firestore";
import { pct, statusTone } from "@/lib/format";

const subjects = SUBJECT_ORDER.map((slug) => SUBJECTS[slug]);

function displayTime(activity) {
  if (activity.startTime && activity.endTime) return `${activity.startTime} – ${activity.endTime}`;
  if (activity.startTime) return `From ${activity.startTime}`;
  if (activity.endTime) return `Until ${activity.endTime}`;
  return "Anytime";
}

function UserProgressContent() {
  const params = useParams();
  const uid = params.uid;
  const { user, profile } = useAuth();
  const [student, setStudent] = useState(null);
  const [progress, setProgress] = useState({});
  const [settingsRemote, setSettingsRemote] = useState(null);
  const [activities, setActivities] = useState([]);
  const [tests, setTests] = useState([]);
  const [showMockTestForm, setShowMockTestForm] = useState(false);

  useEffect(() => {
    let active = true;
    getUserProfile(uid).then((row) => active && setStudent(row));
    const stops = [
      watchChapterProgress(uid, setProgress),
      watchSettings(setSettingsRemote),
      watchStudyActivities(uid, setActivities),
      watchMockTests(uid, setTests),
    ];
    return () => { active = false; stops.forEach((stop) => stop()); };
  }, [uid]);

  const settings = useMemo(() => ({ ...DEFAULT_SETTINGS, ...(settingsRemote || {}) }), [settingsRemote]);
  const metrics = useMemo(() => dashboardMetrics(subjects, progress, settings), [progress, settings]);
  const today = dateKey();
  const todayActivities = useMemo(() => activities.filter((item) => item.scheduledDate === today), [activities, today]);
  const todayCounts = useMemo(() => taskCounts(todayActivities), [todayActivities]);
  const recentMissed = useMemo(() => activities
    .filter((item) => taskStatusLabel(item) === "Missed")
    .sort((a, b) => String(b.scheduledDate || "").localeCompare(String(a.scheduledDate || "")))
    .slice(0, 6), [activities]);

  return (
    <AppShell
      admin
      title={student?.name || "Student progress"}
      subtitle={student?.email || ""}
      actions={<div className="live-actions"><Link href={`/admin/planner?student=${uid}`} className="primary-btn compact">Assign work</Link><button className="secondary-btn compact desktop-action" onClick={() => setShowMockTestForm((value) => !value)}>{showMockTestForm ? "Close test form" : "Add mock test"}</button><Link href="/admin" className="secondary-btn compact">All students</Link></div>}
    >
      <section className="stats-grid four compact-stats">
        <StatCard label="Today completed" value={`${todayCounts.completed}/${todayCounts.total}`} tone="success" />
        <StatCard label="First Cut" value={pct(metrics.firstCutPercent)} tone="blue" />
        <StatCard label="Second Cut" value={pct(metrics.secondCutPercent)} tone="purple" />
        <StatCard label="Third Cut" value={pct(metrics.thirdCutPercent)} />
      </section>

      <button className="secondary-btn mobile-add" onClick={() => setShowMockTestForm((value) => !value)}>{showMockTestForm ? "Close test form" : "Add mock test"}</button>

      {showMockTestForm && (
        <section className="panel-card form-panel">
          <MockTestForm
            uid={uid}
            settings={settings}
            heading={`Add mock test for ${student?.name || "student"}`}
            createdByAdmin={{
              uid: user?.uid,
              name: profile?.name || profile?.email || "Admin",
            }}
            onDone={() => setShowMockTestForm(false)}
          />
        </section>
      )}

      <div className="admin-visual-grid">
        <section className="panel-card"><TaskStatusGraphic activities={todayActivities} title="Today" /></section>
        <section className="panel-card"><WeeklyTaskChart activities={activities} title="Weekly execution" /></section>
        <section className="panel-card"><StageProgressGraphic first={metrics.firstCutPercent} second={metrics.secondCutPercent} third={metrics.thirdCutPercent} /></section>
        <section className="panel-card"><TestTrendGraphic tests={tests} /></section>
      </div>

      <div className="admin-visual-grid wide-left">
        <section className="panel-card"><SubjectProgressGraphic rows={metrics.subjectRows} /></section>
        <section className="panel-card"><ConsistencyGraphic activities={activities} /></section>
      </div>

      <div className="dashboard-grid admin-monitor-grid">
        <section className="panel-card">
          <div className="section-heading"><h2>Today&apos;s work</h2><span className="pill blue">{todayActivities.length} tasks</span></div>
          {todayActivities.length ? (
            <div className="admin-activity-list">
              {todayActivities.map((item) => (
                <div className="admin-activity-row admin-activity-row-rich" key={item.id}>
                  <div className="admin-activity-time"><strong>{displayTime(item)}</strong></div>
                  <div>
                    <strong>{item.title}</strong>
                    <small>{item.subject || "General"}{item.chapterTitle || item.linkedChapterTitle ? ` · ${item.chapterTitle || item.linkedChapterTitle}` : ""}</small>
                    {item.assignedByAdmin && <small>Assigned by {item.assignedByName || "Admin"}{item.priority ? ` · ${String(item.priority).toLowerCase()} priority` : ""}</small>}
                  </div>
                  <span className={`pill ${taskStatusTone(item)}`}>{taskStatusLabel(item)}</span>
                </div>
              ))}
            </div>
          ) : <div className="empty-state compact-empty"><strong>No work planned today</strong></div>}
        </section>

        <section className="panel-card">
          <div className="section-heading"><h2>Needs attention</h2></div>
          {recentMissed.length ? (
            <div className="attention-list">
              {recentMissed.map((item) => (
                <div className="attention-row" key={item.id}>
                  <div><strong>{item.title}</strong><small>{item.subject || "General"} · {item.scheduledDate}</small></div>
                  <span className="pill danger">Missed</span>
                </div>
              ))}
            </div>
          ) : <div className="empty-state compact-empty"><strong>No missed work</strong></div>}
        </section>
      </div>

      <section className="panel-card">
        <div className="section-heading"><h2>Chapter tracking</h2></div>
        <div className="admin-chapter-table admin-chapter-table-clean">
          {subjects.flatMap((subject) => subject.chapters.map((chapter) => {
            const row = progress[chapter.id] || {};
            const m = chapterMetrics(row, settings);
            return (
              <div className="admin-chapter-row admin-chapter-row-cuts" key={chapter.id}>
                <div><small>{subject.name}</small><strong>{chapter.title}</strong></div>
                <span>{row.firstCutActual ? "First ✓" : "First —"}</span>
                <span>{row.rev2Actual ? "Second ✓" : "Second —"}</span>
                <span>{row.rev3Actual ? "Third ✓" : "Third —"}</span>
                <span>{m.latest === null ? "No test" : `${Math.round(m.latest)}%`}</span>
                <span className={`pill ${statusTone(m.readiness)}`}>{m.readiness}</span>
              </div>
            );
          }))}
        </div>
      </section>
    </AppShell>
  );
}

export default function AdminUserPage() {
  return <RequireAuth admin><UserProgressContent /></RequireAuth>;
}
