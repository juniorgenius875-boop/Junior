"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import RequireAuth from "@/components/RequireAuth";
import AppShell from "@/components/AppShell";
import StatCard from "@/components/StatCard";
import InsightCard from "@/components/InsightCard";
import QuickActionCard from "@/components/QuickActionCard";
import Icon from "@/components/Icons";
import { CardSkeleton } from "@/components/LoadingUI";
import { useAuth } from "@/components/AuthProvider";
import { useTracker } from "@/lib/useTracker";
import { pct, statusTone } from "@/lib/format";
import { mockTestMetrics, priorityChapters } from "@/lib/performance";
import { watchMockTests } from "@/lib/firestore";
import { profileApi, progressApi } from "@/lib/api";

function clamp(value) {
  return Math.max(0, Math.min(100, Number(value) || 0));
}

function testSubjects(test) {
  if (Array.isArray(test.subjects) && test.subjects.length) return test.subjects.join(", ");
  return test.subject || "—";
}

function testChapters(test) {
  if (Array.isArray(test.chapters) && test.chapters.length) return test.chapters.join(", ");
  return test.chapter || "Full syllabus";
}

function DashboardContent() {
  const { profile } = useAuth();
  const { uid, dashboard, progress, settings, subjects, ready } = useTracker();
  const [tests, setTests] = useState([]);
  const [junior, setJunior] = useState({ latest: null, stats: null });
  const priorities = useMemo(() => priorityChapters(subjects, progress, settings, 5), [subjects, progress, settings]);
  const firstName = String(profile?.name || "Student").split(" ")[0];
  const readiness = Math.round(clamp(dashboard.boardReadyPercent));
  const threshold = Math.round(clamp(settings?.boardReadyThreshold || settings?.defaultTarget || 80));
  const latestAverage = dashboard.scoredAreas ? Math.round(clamp(dashboard.overallLatest)) : null;
  const nextPriority = priorities[0] || null;

  useEffect(() => {
    if (!uid) return undefined;
    const stop = watchMockTests(uid, setTests);
    Promise.all([progressApi.latest(), profileApi.stats()])
      .then(([latest, stats]) => setJunior({ latest, stats }))
      .catch(() => {});
    return stop;
  }, [uid]);

  if (!ready) {
    return <AppShell title={`Hi ${firstName}`} subtitle="Loading your latest study progress">
      <div className="dashboard-loading-grid"><div className="skeleton-hero"/><CardSkeleton/><CardSkeleton/><CardSkeleton/><CardSkeleton/></div>
    </AppShell>;
  }

  return (
    <AppShell title={`Hi ${firstName}`} subtitle="Your preparation, tests and Junior AI insights in one place">
      <section className="dashboard-overview-grid">
        <article className="prep-overview-card">
          <div className="prep-overview-head">
            <div>
              <span className="section-kicker">Overall preparation</span>
              <h2>{readiness > 0 ? `${readiness}% of your board-readiness plan is complete` : "Start with your first planned study session"}</h2>
              <p>{readiness >= threshold ? "You are at or above your current board-ready threshold." : `Your current board-ready target is ${threshold}%. Keep each revision cut moving consistently.`}</p>
            </div>
            <Link href="/timetable" className="primary-btn prep-primary-action"><Icon name="calendar" size={17}/> Open study plan</Link>
          </div>

          <div className="cut-progress-stack">
            <div className="cut-progress-row">
              <div><span className="cut-dot green"/><strong>First Cut</strong><small>Foundation</small></div>
              <div className="cut-progress-track"><span style={{ width: `${clamp(dashboard.firstCutPercent)}%` }}/></div>
              <b>{pct(dashboard.firstCutPercent)}</b>
            </div>
            <div className="cut-progress-row purple">
              <div><span className="cut-dot purple"/><strong>Second Cut</strong><small>Revision</small></div>
              <div className="cut-progress-track"><span style={{ width: `${clamp(dashboard.secondCutPercent)}%` }}/></div>
              <b>{pct(dashboard.secondCutPercent)}</b>
            </div>
            <div className="cut-progress-row blue">
              <div><span className="cut-dot blue"/><strong>Third Cut</strong><small>Board ready</small></div>
              <div className="cut-progress-track"><span style={{ width: `${clamp(dashboard.thirdCutPercent)}%` }}/></div>
              <b>{pct(dashboard.thirdCutPercent)}</b>
            </div>
          </div>
        </article>

        <article className="readiness-summary-card">
          <div className="readiness-summary-top">
            <span className="summary-icon"><Icon name="target" size={18}/></span>
            <div><span>Board readiness</span><small>Based on your current progress</small></div>
          </div>
          <div className="readiness-dial" style={{ "--readiness": `${readiness * 3.6}deg` }}>
            <div><strong>{readiness}%</strong><span>ready</span></div>
          </div>
          <div className="readiness-target-row"><span>Current target</span><strong>{threshold}%</strong></div>
          <Link href="/subjects" className="summary-link">Review subject progress <Icon name="arrow" size={15}/></Link>
        </article>
      </section>

      <section className="stats-grid four dashboard-stat-grid">
        <StatCard label="First Cut" value={pct(dashboard.firstCutPercent)} tone="success" helper="Foundation coverage" icon="check"/>
        <StatCard label="Second Cut" value={pct(dashboard.secondCutPercent)} tone="purple" helper="Revision coverage" icon="spark"/>
        <StatCard label="Third Cut" value={pct(dashboard.thirdCutPercent)} tone="blue" helper="Final revision coverage" icon="activity"/>
        <StatCard label="Latest test average" value={latestAverage === null ? "—" : `${latestAverage}%`} tone="orange" helper={latestAverage === null ? "No test score recorded yet" : "Across scored areas"} icon="trophy"/>
      </section>

      <section className="dashboard-content-grid">
        <div className="dashboard-main-column">
          <section className="panel-card ui-v2-panel">
            <div className="section-heading ui-v2-section-heading">
              <div><span className="section-kicker">Subjects</span><h2>Progress by subject</h2><p className="muted">One view of all three revision cuts and your latest test performance.</p></div>
              <Link href="/subjects" className="text-link arrow-link">View all <Icon name="arrow" size={15}/></Link>
            </div>
            <div className="subject-list subject-list-v2">
              {dashboard.subjectRows.map((row) => {
                const overall = Math.round((row.firstCutPercent + row.secondCutPercent + row.thirdCutPercent) / 3);
                return <Link href={`/subjects/${row.subject.slug}`} className="subject-row subject-row-v2" key={row.subject.slug}>
                  <span className="subject-emoji">{row.subject.icon || "📘"}</span>
                  <div className="subject-row-main">
                    <div className="subject-row-title"><strong>{row.subject.name}</strong><span className={`pill ${statusTone(row.currentStatus)}`}>{row.currentStatus}</span></div>
                    <div className="subject-progress-line"><span style={{ width: `${clamp(overall)}%` }}/></div>
                    <div className="subject-cut-inline"><span>1st {Math.round(row.firstCutPercent)}%</span><span>2nd {Math.round(row.secondCutPercent)}%</span><span>3rd {Math.round(row.thirdCutPercent)}%</span></div>
                  </div>
                  <div className="subject-score-block"><strong>{row.scoredAreas ? `${Math.round(row.avgLatest)}%` : "—"}</strong><small>latest test</small></div>
                  <span className="subject-row-chevron"><Icon name="chevron" size={15}/></span>
                </Link>;
              })}
            </div>
          </section>

          <section className="panel-card ui-v2-panel below-fold-panel">
            <div className="section-heading ui-v2-section-heading">
              <div><span className="section-kicker">Recent tests</span><h2>Performance history</h2></div>
              <Link href="/mock-tests" className="text-link arrow-link">View all <Icon name="arrow" size={15}/></Link>
            </div>
            {tests.length ? <div className="test-details-table ui-v2-table">
              <div className="test-details-row header"><span>Date</span><span>Subject</span><span>Chapter</span><span>Marks</span><span>Percentage</span></div>
              {tests.slice(0, 6).map((test) => {
                const metrics = mockTestMetrics(test, settings);
                return <div className="test-details-row" key={test.id}>
                  <span data-label="Date">{test.date || "—"}</span><span data-label="Subject">{testSubjects(test)}</span><span data-label="Chapter">{testChapters(test)}</span><strong data-label="Marks">{test.marksObtained ?? "—"}/{test.totalMarks ?? "—"}</strong><strong data-label="Percentage" className="score-cell">{metrics.scorePercent === null ? "—" : pct(metrics.scorePercent, 1)}</strong>
                </div>;
              })}
            </div> : <div className="empty-state ui-v2-empty"><span className="empty-icon"><Icon name="clipboard" size={20}/></span><div><strong>No test scores yet</strong><p>Add a mock test when you complete one. Your progress dashboard will update automatically.</p></div><Link href="/mock-tests" className="secondary-btn">Add mock test</Link></div>}
          </section>
        </div>

        <aside className="dashboard-side-column">
          <section className="focus-card-v2">
            <div className="focus-card-head"><span className="focus-icon"><Icon name="target" size={18}/></span><div><span className="section-kicker">Next priority</span><h2>Work on next</h2></div></div>
            {nextPriority ? <>
              <div className="focus-priority-main">
                <span className="focus-subject">{nextPriority.subject.name}</span>
                <strong>{nextPriority.chapter.title}</strong>
                <p>{nextPriority.metrics.readiness}{nextPriority.metrics.latest !== null ? ` · Latest ${Math.round(nextPriority.metrics.latest)}%` : ""}</p>
              </div>
              <Link href={`/subjects/${nextPriority.subject.slug}`} className="focus-action">Open chapter <Icon name="arrow" size={15}/></Link>
              {priorities.length > 1 && <div className="focus-more-list">{priorities.slice(1, 4).map((item, index) => <Link href={`/subjects/${item.subject.slug}`} key={item.chapter.id}><span>{index + 2}</span><div><strong>{item.chapter.title}</strong><small>{item.subject.name}</small></div><Icon name="chevron" size={14}/></Link>)}</div>}
            </> : <div className="focus-empty"><span><Icon name="check" size={20}/></span><strong>No urgent chapters</strong><p>Your current priority list is clear. Continue with the next item in your timetable.</p><Link href="/timetable" className="focus-action">Open timetable <Icon name="arrow" size={15}/></Link></div>}
          </section>

          <section className="panel-card junior-ai-card-v2 below-fold-panel">
            <div className="junior-ai-heading"><span className="junior-ai-mark"><Icon name="brain" size={20}/></span><div><span className="section-kicker">Junior AI</span><h2>Learning intelligence</h2></div></div>
            <div className="junior-insight-grid junior-insight-grid-v2">
              <InsightCard label="Predicted marks" value={junior.latest?.total_predicted_marks ?? "—"} helper="Latest model result" icon="trophy" tone="blue"/>
              <InsightCard label="Current risk" value={junior.latest?.risk_level || "—"} helper="Performance signal" icon="activity" tone="orange"/>
              <InsightCard label="Adaptive tests" value={junior.stats?.totalTests ?? 0} helper="Completed attempts" icon="clipboard" tone="purple"/>
              <InsightCard label="Adaptive average" value={junior.stats ? `${junior.stats.averageScore || 0}%` : "—"} helper="Across Junior tests" icon="target" tone="green"/>
            </div>
            <div className="junior-ai-actions">
              <Link href="/prediction" className="secondary-btn"><Icon name="chart" size={16}/> Performance AI</Link>
              <Link href="/ai-tutor" className="primary-btn"><Icon name="chat" size={16}/> Ask AI Tutor</Link>
            </div>
          </section>

          <section className="quick-action-stack below-fold-panel">
            <QuickActionCard href="/test-corner" title="Adaptive Test" text="Practice at your current level" icon="brain" tone="purple"/>
            <QuickActionCard href="/words" title="Words & Meanings" text="Review your vocabulary list" icon="words" tone="blue"/>
            <QuickActionCard href="/skills" title="Skill Tracker" text="Track learning habits and skills" icon="target" tone="green"/>
          </section>
        </aside>
      </section>
    </AppShell>
  );
}

export default function DashboardPage() {
  return <RequireAuth><DashboardContent /></RequireAuth>;
}
