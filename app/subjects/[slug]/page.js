"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import RequireAuth from "@/components/RequireAuth";
import AppShell from "@/components/AppShell";
import { CardSkeleton } from "@/components/LoadingUI";
import StatCard from "@/components/StatCard";
import { getSubject } from "@/lib/catalog";
import { useTracker } from "@/lib/useTracker";
import { subjectMetrics, chapterMetrics } from "@/lib/performance";
import { pct } from "@/lib/format";

const ChapterCard = dynamic(() => import("@/components/ChapterCard"), { loading: () => <CardSkeleton className="chapter-card-skeleton" /> });

function SubjectContent() {
  const params = useParams();
  const subject = getSubject(params.slug);
  const { uid, progress, settings } = useTracker();
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const metrics = useMemo(
    () => subject ? subjectMetrics(subject.chapters, progress, settings) : null,
    [subject, progress, settings],
  );

  const filtered = useMemo(() => {
    if (!subject) return [];
    return subject.chapters.filter((chapter) => {
      const m = chapterMetrics(progress[chapter.id] || {}, settings);
      const searchOk = !search.trim() || chapter.title.toLowerCase().includes(search.trim().toLowerCase());
      const filterOk = filter === "all" ||
        (filter === "ready" && ["Board Ready", "Mastered"].includes(m.readiness)) ||
        (filter === "pending" && !["Board Ready", "Mastered"].includes(m.readiness));
      return searchOk && filterOk;
    });
  }, [subject, progress, settings, search, filter]);

  if (!subject || !metrics) {
    return <AppShell title="Subject"><div className="empty-state"><strong>Subject not found</strong></div></AppShell>;
  }

  return (
    <AppShell title={subject.name}>
      <section className="stats-grid six compact-stats subject-stage-stats">
        <StatCard label="First Cut" value={pct(metrics.firstCutPercent)} tone="purple" />
        <StatCard label="Second Cut" value={pct(metrics.secondCutPercent)} tone="blue" />
        <StatCard label="Third Cut" value={pct(metrics.thirdCutPercent)} tone="success" />
        <StatCard label="Test 1" value={metrics.test1Avg === null ? "—" : pct(metrics.test1Avg)} />
        <StatCard label="Test 2" value={metrics.test2Avg === null ? "—" : pct(metrics.test2Avg)} />
        <StatCard label="Test 3" value={metrics.test3Avg === null ? "—" : pct(metrics.test3Avg)} />
      </section>

      <section className="filter-bar subject-filter-bar">
        <input className="search-input" placeholder="Search chapters" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="filter-chips">
          {[["all","All"],["pending","Pending"],["ready","Ready"]].map(([value,label]) => (
            <button key={value} onClick={() => setFilter(value)} className={filter === value ? "filter-chip active" : "filter-chip"}>{label}</button>
          ))}
        </div>
      </section>

      <div className="chapter-list">
        {filtered.map((chapter) => (
          <ChapterCard
            key={chapter.id}
            uid={uid}
            chapter={chapter}
            subjectSlug={subject.slug}
            saved={progress[chapter.id]}
            settings={settings}
          />
        ))}
      </div>
      {!filtered.length && <div className="empty-state compact-empty"><strong>No chapters match this filter.</strong></div>}
    </AppShell>
  );
}

export default function SubjectPage() {
  return <RequireAuth><SubjectContent /></RequireAuth>;
}
