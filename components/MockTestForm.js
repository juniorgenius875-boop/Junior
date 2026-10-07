"use client";

import { useMemo, useState } from "react";
import { addMockTest } from "@/lib/firestore";
import { mockTestMetrics } from "@/lib/performance";
import { pct } from "@/lib/format";
import { SUBJECT_ORDER, SUBJECTS } from "@/lib/catalog";

const initial = {
  date: "",
  subjects: ["Mathematics"],
  chapterIds: [],
  paperSource: "",
  marksObtained: "",
  totalMarks: "80",
  target: "90",
  timeTaken: "",
  unattemptedMarks: "0",
  carelessLoss: "0",
  conceptLoss: "0",
  timeMgmtLoss: "0",
  otherLoss: "0",
  mainLearning: "",
  nextAction: "",
};

function chapterOptionsFor(subjectNames) {
  return SUBJECT_ORDER
    .map((slug) => SUBJECTS[slug])
    .filter((subject) => subjectNames.includes(subject.name))
    .flatMap((subject) =>
      subject.chapters.map((chapter) => ({
        id: chapter.id,
        title: chapter.title,
        subject: subject.name,
      })),
    );
}

export default function MockTestForm({ uid, settings, onDone, heading = "Add mock test", createdByAdmin = null }) {
  const [form, setForm] = useState(() => ({
    ...initial,
    target: String(settings?.defaultTarget ?? initial.target),
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const metrics = useMemo(() => mockTestMetrics(form, settings), [form, settings]);
  const chapterOptions = useMemo(() => chapterOptionsFor(form.subjects), [form.subjects]);

  function set(key, value) { setForm((prev) => ({ ...prev, [key]: value })); }

  function toggleSubject(subjectName) {
    setForm((prev) => {
      const alreadySelected = prev.subjects.includes(subjectName);
      let subjects = alreadySelected
        ? prev.subjects.filter((item) => item !== subjectName)
        : [...prev.subjects, subjectName];

      if (!subjects.length) subjects = [subjectName];

      const validIds = new Set(chapterOptionsFor(subjects).map((item) => item.id));
      return {
        ...prev,
        subjects,
        chapterIds: prev.chapterIds.filter((id) => validIds.has(id)),
      };
    });
  }

  function toggleChapter(chapterId) {
    setForm((prev) => ({
      ...prev,
      chapterIds: prev.chapterIds.includes(chapterId)
        ? prev.chapterIds.filter((id) => id !== chapterId)
        : [...prev.chapterIds, chapterId],
    }));
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const numericKeys = ["marksObtained","totalMarks","target","timeTaken","unattemptedMarks","carelessLoss","conceptLoss","timeMgmtLoss","otherLoss"];
      const values = { ...form };
      numericKeys.forEach((key) => { values[key] = values[key] === "" ? null : Number(values[key]); });

      const chapterMap = new Map(chapterOptions.map((item) => [item.id, item]));
      const selectedChapters = values.chapterIds
        .map((id) => chapterMap.get(id))
        .filter(Boolean);

      values.subject = values.subjects.join(", ");
      values.chapters = selectedChapters.map((item) => item.title);
      values.chapter = values.chapters.length ? values.chapters.join(", ") : "Full syllabus";
      values.chapterIds = selectedChapters.map((item) => item.id);

      if (createdByAdmin) {
        values.createdByAdmin = true;
        values.createdByUid = String(createdByAdmin.uid || "");
        values.createdByName = String(createdByAdmin.name || "Admin");
      }

      await addMockTest(uid, values);
      setForm({ ...initial, target: String(settings.defaultTarget) });
      onDone?.();
    } catch (err) {
      setError(err?.message || "Unable to save this mock test.");
    } finally { setSaving(false); }
  }

  return (
    <form className="mock-form" onSubmit={submit}>
      <div className="section-heading"><h2>{heading}</h2></div>

      <div className="form-grid three">
        <label>Date<input type="date" required value={form.date} onChange={(e) => set("date", e.target.value)} /></label>
        <label>Paper / source<input required value={form.paperSource} onChange={(e) => set("paperSource", e.target.value)} /></label>
        <label>Time taken (min)<input type="number" min="0" value={form.timeTaken} onChange={(e) => set("timeTaken", e.target.value)} /></label>
      </div>

      <div className="multi-subject-field">
        <span className="field-label">Subjects</span>
        <div className="multi-subject-options">
          {SUBJECT_ORDER.map((slug) => {
            const name = SUBJECTS[slug].name;
            const checked = form.subjects.includes(name);
            return (
              <label className={checked ? "subject-check active" : "subject-check"} key={slug}>
                <input type="checkbox" checked={checked} onChange={() => toggleSubject(name)} />
                <span>{name}</span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="chapter-multi-field">
        <span className="field-label">Chapters</span>
        <div className="chapter-options-list">
          {chapterOptions.map((chapter) => {
            const checked = form.chapterIds.includes(chapter.id);
            return (
              <label className={checked ? "chapter-check active" : "chapter-check"} key={chapter.id}>
                <input type="checkbox" checked={checked} onChange={() => toggleChapter(chapter.id)} />
                <span><small>{chapter.subject}</small>{chapter.title}</span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="form-grid four">
        <label>Marks obtained<input type="number" min="0" required value={form.marksObtained} onChange={(e) => set("marksObtained", e.target.value)} /></label>
        <label>Total marks<input type="number" min="1" required value={form.totalMarks} onChange={(e) => set("totalMarks", e.target.value)} /></label>
        <label>Target %<input type="number" min="0" max="100" value={form.target} onChange={(e) => set("target", e.target.value)} /></label>
        <label>Unattempted<input type="number" min="0" value={form.unattemptedMarks} onChange={(e) => set("unattemptedMarks", e.target.value)} /></label>
      </div>

      <div className="loss-box">
        <div className="loss-box-title"><strong>Marks lost</strong><span>{metrics.totalMarksLost} marks</span></div>
        <div className="form-grid four">
          <label>Careless<input type="number" min="0" value={form.carelessLoss} onChange={(e) => set("carelessLoss", e.target.value)} /></label>
          <label>Concept<input type="number" min="0" value={form.conceptLoss} onChange={(e) => set("conceptLoss", e.target.value)} /></label>
          <label>Time management<input type="number" min="0" value={form.timeMgmtLoss} onChange={(e) => set("timeMgmtLoss", e.target.value)} /></label>
          <label>Other<input type="number" min="0" value={form.otherLoss} onChange={(e) => set("otherLoss", e.target.value)} /></label>
        </div>
      </div>

      <div className="form-grid two">
        <label>Main learning<textarea rows="3" value={form.mainLearning} onChange={(e) => set("mainLearning", e.target.value)} /></label>
        <label>Next action<textarea rows="3" value={form.nextAction} onChange={(e) => set("nextAction", e.target.value)} /></label>
      </div>

      <div className="mock-preview mock-preview-clean">
        <div><span>Score</span><strong>{metrics.scorePercent === null ? "—" : pct(metrics.scorePercent, 1)}</strong></div>
        <div><span>Gap</span><strong>{metrics.gap === null ? "—" : `${metrics.gap > 0 ? "+" : ""}${metrics.gap.toFixed(1)} pp`}</strong></div>
        <div><span>Potential</span><strong>{metrics.executionPotential === null ? "—" : pct(metrics.executionPotential, 1)}</strong></div>
        <button className="primary-btn" disabled={saving}>{saving ? "Saving…" : "Save test"}</button>
      </div>
      {error && <div className="error-box">{error}</div>}
    </form>
  );
}
