"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import RequireAuth from "@/components/RequireAuth";
import AppShell from "@/components/AppShell";
import { CardSkeleton } from "@/components/LoadingUI";
import { useAuth } from "@/components/AuthProvider";
import { DEFAULT_SETTINGS, mockTestMetrics } from "@/lib/performance";
import { deleteMockTest, watchMockTests, watchSettings } from "@/lib/firestore";
import { pct } from "@/lib/format";

const MockTestForm = dynamic(() => import("@/components/MockTestForm"), { loading: () => <CardSkeleton /> });

function MockTestsContent() {
  const { user } = useAuth();
  const [tests, setTests] = useState([]);
  const [settingsRemote, setSettingsRemote] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const settings = useMemo(() => ({ ...DEFAULT_SETTINGS, ...(settingsRemote || {}) }), [settingsRemote]);

  useEffect(() => {
    if (!user?.uid) return;
    const stop1 = watchMockTests(user.uid, setTests);
    const stop2 = watchSettings(setSettingsRemote);
    return () => { stop1(); stop2(); };
  }, [user?.uid]);

  const scored = tests.map((test) => ({ test, metrics: mockTestMetrics(test, settings) }));
  const avg = scored.filter((x) => x.metrics.scorePercent !== null);
  const avgScore = avg.length ? avg.reduce((s, x) => s + x.metrics.scorePercent, 0) / avg.length : 0;

  return (
    <AppShell title="Mock tests" actions={<button className="primary-btn compact desktop-action" onClick={() => setShowForm((v) => !v)}>{showForm ? "Close" : "Add test"}</button>}>
      <section className="stats-grid three compact-stats">
        <div className="stat-card blue"><span className="stat-label">Papers logged</span><strong className="stat-value">{tests.length}</strong></div>
        <div className="stat-card success"><span className="stat-label">Average score</span><strong className="stat-value">{pct(avgScore)}</strong></div>
        <div className="stat-card purple"><span className="stat-label">Best score</span><strong className="stat-value">{avg.length ? pct(Math.max(...avg.map((x) => x.metrics.scorePercent))) : "—"}</strong></div>
      </section>

      <button className="primary-btn mobile-add" onClick={() => setShowForm((v) => !v)}>{showForm ? "Close" : "Add test"}</button>

      {showForm && <section className="panel-card form-panel"><MockTestForm uid={user.uid} settings={settings} onDone={() => setShowForm(false)} /></section>}

      <section className="panel-card">
        <div className="section-heading"><h2>Test history</h2></div>
        {scored.length ? <div className="mock-list">{scored.map(({ test, metrics }) => (
          <article className="mock-card" key={test.id}>
            <div className="mock-card-main">
              <div>
                <small>{test.date} • {(test.subjects || []).length ? test.subjects.join(", ") : test.subject}</small>
                <strong>{test.paperSource || "Mock test"}</strong>
                <span>{test.chapter || (test.chapters || []).join(", ") || "Full syllabus"}</span>
                <span>{test.marksObtained}/{test.totalMarks} marks{test.timeTaken ? ` • ${test.timeTaken} min` : ""}</span>
              </div>
              <div className="mock-score"><strong>{pct(metrics.scorePercent, 1)}</strong><small>{metrics.gap >= 0 ? "+" : ""}{metrics.gap?.toFixed(1)} pp</small></div>
            </div>
            <div className="mock-losses">
              <span>Lost <strong>{metrics.totalMarksLost}</strong></span>
              <span>Potential <strong>{pct(metrics.executionPotential, 1)}</strong></span>
              {test.mainLearning && <span className="grow"><strong>{test.mainLearning}</strong></span>}
              <button className="danger-text" onClick={() => deleteMockTest(user.uid, test.id)}>Delete</button>
            </div>
          </article>
        ))}</div> : <div className="empty-state compact-empty"><strong>No mock tests yet</strong></div>}
      </section>
    </AppShell>
  );
}

export default function MockTestsPage() { return <RequireAuth><MockTestsContent /></RequireAuth>; }
