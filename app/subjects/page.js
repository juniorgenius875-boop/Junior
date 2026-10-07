"use client";

import Link from "next/link";
import RequireAuth from "@/components/RequireAuth";
import AppShell from "@/components/AppShell";
import Icon from "@/components/Icons";
import { useTracker } from "@/lib/useTracker";
import { subjectMetrics } from "@/lib/performance";
import { statusTone } from "@/lib/format";

function CutProgress({ label, value, tone = "blue" }) {
  const safe = Math.max(0, Math.min(100, Number(value) || 0));
  return <div className={`subject-cut-row tone-${tone}`}>
    <div><span>{label}</span><strong>{Math.round(safe)}%</strong></div>
    <div className="subject-cut-bar"><span style={{ width: `${safe}%` }}/></div>
  </div>;
}

function SubjectsContent() {
  const { subjects, progress, settings, dashboard } = useTracker();

  return <AppShell title="Subjects" subtitle="Track every chapter across your three preparation cuts">
    <section className="subjects-overview-card">
      <div>
        <span className="hero-badge"><Icon name="book" size={15}/> Complete syllabus</span>
        <h2>{subjects.length} subjects in one preparation view</h2>
        <p>Open any subject to plan chapter dates, record revisions and keep test performance tied to the same study record.</p>
      </div>
      <div className="subjects-overview-metric"><span>Overall readiness</span><strong>{Math.round(dashboard.boardReadyPercent || 0)}%</strong><div className="subject-progress-line"><span style={{width:`${Math.max(0,Math.min(100,dashboard.boardReadyPercent||0))}%`}}/></div></div>
    </section>

    <div className="subject-card-grid subject-card-grid-modern">
      {subjects.map((subject, index) => {
        const metrics = subjectMetrics(subject.chapters, progress, settings);
        const overall = Math.round((metrics.firstCutPercent + metrics.secondCutPercent + metrics.thirdCutPercent) / 3);
        const tones = ["blue", "purple", "green", "orange", "cyan", "pink"];
        return <Link href={`/subjects/${subject.slug}`} className={`subject-card subject-card-clean subject-card-modern tone-${tones[index % tones.length]}`} key={subject.slug}>
          <div className="subject-card-top-modern">
            <span className="subject-card-icon">{subject.icon || "📘"}</span>
            <span className={`pill ${statusTone(metrics.currentStatus)}`}>{metrics.currentStatus}</span>
          </div>
          <div className="subject-card-heading">
            <div><h2>{subject.name}</h2><p className="muted">{subject.chapters.length} chapters · {metrics.trackedAreas} tracked</p></div>
          </div>
          <div className="subject-overall-line"><div><span>Preparation progress</span><strong>{overall}%</strong></div><div className="subject-progress-line"><span style={{width:`${overall}%`}}/></div></div>
          <div className="subject-card-metrics cut-bars-only">
            <CutProgress label="First Cut" value={metrics.firstCutPercent} tone="green"/>
            <CutProgress label="Second Cut" value={metrics.secondCutPercent} tone="purple"/>
            <CutProgress label="Third Cut" value={metrics.thirdCutPercent} tone="blue"/>
          </div>
          <div className="subject-card-footer"><span>Open subject</span><Icon name="arrow" size={16}/></div>
        </Link>;
      })}
    </div>
  </AppShell>;
}

export default function SubjectsPage() {
  return <RequireAuth><SubjectsContent /></RequireAuth>;
}
