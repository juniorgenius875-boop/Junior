"use client";

import { useEffect, useMemo, useState } from "react";
import { chapterMetrics } from "@/lib/performance";
import { saveChapterProgress } from "@/lib/firestore";
import { pp, statusTone } from "@/lib/format";

const emptyRow = {
  firstCutPlanned: "",
  firstCutActual: "",
  firstCutStartTime: "",
  firstCutEndTime: "",
  test1: "",
  rev2Planned: "",
  rev2Actual: "",
  rev2StartTime: "",
  rev2EndTime: "",
  test2: "",
  rev3Planned: "",
  rev3Actual: "",
  rev3StartTime: "",
  rev3EndTime: "",
  test3: "",
  mainWeakness: "",
  actionRequired: "",
};

function cleanValues(values) {
  const next = { ...values };
  ["test1", "test2", "test3"].forEach((key) => {
    if (next[key] === "") next[key] = null;
    else next[key] = Math.max(0, Math.min(100, Number(next[key])));
  });
  return next;
}

function CutBlock({ title, planned, actual, startTime, endTime, test, onChange }) {
  return (
    <div className="revision-block">
      <div className="revision-title"><strong>{title}</strong></div>
      <div className="cut-date-grid">
        <label>Planned<input type="date" value={planned.value || ""} onChange={(e) => onChange(planned.key, e.target.value)} /></label>
        <label>Actual<input type="date" value={actual.value || ""} onChange={(e) => onChange(actual.key, e.target.value)} /></label>
      </div>
      <div className="cut-time-grid">
        <label>From<input type="time" value={startTime.value || ""} onChange={(e) => onChange(startTime.key, e.target.value)} /></label>
        <label>To<input type="time" value={endTime.value || ""} onChange={(e) => onChange(endTime.key, e.target.value)} /></label>
      </div>
      <label>{`${title} test %`}<input inputMode="decimal" type="number" min="0" max="100" value={test.value ?? ""} onChange={(e) => onChange(test.key, e.target.value)} /></label>
    </div>
  );
}

export default function ChapterCard({ uid, chapter, subjectSlug, saved, settings }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyRow, ...(saved || {}) });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setForm({ ...emptyRow, ...(saved || {}) });
  }, [saved]);

  const metrics = useMemo(() => chapterMetrics(form, settings), [form, settings]);

  function set(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setMessage("");
  }

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      await saveChapterProgress(uid, chapter, subjectSlug, cleanValues(form));
      setMessage("Saved");
    } catch (error) {
      console.error(error);
      setMessage("Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className={`chapter-card ${open ? "open" : ""}`}>
      <button className="chapter-summary" onClick={() => setOpen((value) => !value)}>
        <div className="chapter-copy">
          <small>{chapter.section || chapter.group || "Chapter"}</small>
          <strong>{chapter.title}</strong>
          <div className="chapter-meta">
            <span className={`pill ${statusTone(metrics.readiness)}`}>{metrics.readiness}</span>
            {metrics.maxDelay > 0 && <span className="delay-chip">+{metrics.maxDelay}d</span>}
          </div>
        </div>
        <div className="chapter-score-wrap">
          <strong>{metrics.latest === null ? "—" : `${Math.round(metrics.latest)}%`}</strong>
          <small>{metrics.trend === null ? `Target ${chapter.target}%` : pp(metrics.trend)}</small>
          <span className="chapter-details-label">{open ? "Close" : "Details"}</span>
        </div>
      </button>

      {open && (
        <div className="chapter-body">
          <div className="revision-grid">
            <CutBlock
              title="First Cut"
              planned={{ key: "firstCutPlanned", value: form.firstCutPlanned }}
              actual={{ key: "firstCutActual", value: form.firstCutActual }}
              startTime={{ key: "firstCutStartTime", value: form.firstCutStartTime }}
              endTime={{ key: "firstCutEndTime", value: form.firstCutEndTime }}
              test={{ key: "test1", value: form.test1 }}
              onChange={set}
            />
            <CutBlock
              title="Second Cut"
              planned={{ key: "rev2Planned", value: form.rev2Planned }}
              actual={{ key: "rev2Actual", value: form.rev2Actual }}
              startTime={{ key: "rev2StartTime", value: form.rev2StartTime }}
              endTime={{ key: "rev2EndTime", value: form.rev2EndTime }}
              test={{ key: "test2", value: form.test2 }}
              onChange={set}
            />
            <CutBlock
              title="Third Cut"
              planned={{ key: "rev3Planned", value: form.rev3Planned }}
              actual={{ key: "rev3Actual", value: form.rev3Actual }}
              startTime={{ key: "rev3StartTime", value: form.rev3StartTime }}
              endTime={{ key: "rev3EndTime", value: form.rev3EndTime }}
              test={{ key: "test3", value: form.test3 }}
              onChange={set}
            />
          </div>

          <div className="chapter-save-bar">
            <div><strong>{metrics.readiness}</strong><small>Latest {metrics.latest === null ? "—" : `${Math.round(metrics.latest)}%`}</small></div>
            <div className="save-actions">
              {message && <span className={message === "Saved" ? "save-ok" : "save-error"}>{message}</span>}
              <button className="primary-btn compact" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}
