"use client";

import { useEffect, useMemo, useState } from "react";
import RequireAuth from "@/components/RequireAuth";
import AppShell from "@/components/AppShell";
import StatCard from "@/components/StatCard";
import { useAuth } from "@/components/AuthProvider";
import { SUBJECT_ORDER, SUBJECTS } from "@/lib/catalog";
import { useTracker } from "@/lib/useTracker";
import { taskStatusLabel, taskStatusTone } from "@/lib/adminAnalytics";
import {
  addStudyActivity,
  addChapterStageActivity,
  deleteStudyActivity,
  updateStudyActivityStatus,
  watchStudyActivities,
  syncExistingChapterPlansToTimetable,
} from "@/lib/firestore";

const ACTIVITY_TYPES = [
  "First Cut",
  "Second Cut",
  "Third Cut",
  "Test 1",
  "Test 2",
  "Test 3",
  "Study",
  "Revision",
  "Homework",
  "Test",
  "Reading",
  "Practice",
  "Other",
];

const CUT_STAGES = {
  "First Cut": { stageKey: "first-cut", actualField: "firstCutActual" },
  "Second Cut": { stageKey: "revision-2", actualField: "rev2Actual" },
  "Third Cut": { stageKey: "revision-3", actualField: "rev3Actual" },
};

function dateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDateKey(value) {
  const [y, m, d] = String(value).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function shiftDate(value, amount) {
  const d = parseDateKey(value);
  d.setDate(d.getDate() + amount);
  return dateKey(d);
}

function getWeek(value) {
  const selected = parseDateKey(value);
  const day = selected.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(selected);
  monday.setDate(selected.getDate() + mondayOffset);
  return Array.from({ length: 7 }, (_, index) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + index);
    return {
      key: dateKey(d),
      day: d.toLocaleDateString("en-IN", { weekday: "short" }).slice(0, 2),
      date: d.getDate(),
    };
  });
}

function humanDate(value) {
  return parseDateKey(value).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function displayTime(activity) {
  if (activity.startTime && activity.endTime) return `${activity.startTime} – ${activity.endTime}`;
  if (activity.startTime) return `From ${activity.startTime}`;
  if (activity.endTime) return `Until ${activity.endTime}`;
  return "Anytime";
}

function TimetableContent() {
  const { user } = useAuth();
  const { progress } = useTracker();
  const [activities, setActivities] = useState([]);
  const [selectedDate, setSelectedDate] = useState(() => dateKey());
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const initialSubjectSlug = SUBJECT_ORDER[0] || "";
  const initialChapterId = SUBJECTS[initialSubjectSlug]?.chapters?.[0]?.id || "";
  const [activitySubjectSlug, setActivitySubjectSlug] = useState(initialSubjectSlug);
  const [activityChapterId, setActivityChapterId] = useState(initialChapterId);

  useEffect(() => {
    if (!user?.uid) return undefined;
    return watchStudyActivities(user.uid, setActivities);
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    syncExistingChapterPlansToTimetable(user.uid).catch((e) => console.error("Unable to sync chapter plan with timetable", e));
  }, [user?.uid]);

  const week = useMemo(() => getWeek(selectedDate), [selectedDate]);
  const dayActivities = useMemo(() => activities.filter((item) => item.scheduledDate === selectedDate), [activities, selectedDate]);
  const selectedActivitySubject = SUBJECTS[activitySubjectSlug];
  const selectedActivityChapters = selectedActivitySubject?.chapters || [];

  const counts = useMemo(() => ({
    total: dayActivities.length,
    completed: dayActivities.filter((item) => taskStatusLabel(item) === "Completed").length,
    inProgress: dayActivities.filter((item) => taskStatusLabel(item) === "In progress").length,
    missed: dayActivities.filter((item) => taskStatusLabel(item) === "Missed").length,
  }), [dayActivities]);

  function changeActivitySubject(slug) {
    setActivitySubjectSlug(slug);
    setActivityChapterId(SUBJECTS[slug]?.chapters?.[0]?.id || "");
  }

  async function addActivity(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const title = String(form.get("title") || "").trim();
    const subjectSlug = String(form.get("subjectSlug") || activitySubjectSlug);
    const chapterId = String(form.get("chapterId") || activityChapterId);
    const subject = SUBJECTS[subjectSlug];
    const chapter = subject?.chapters?.find((item) => item.id === chapterId);

    if (!subject || !chapter) {
      setError("Please select a subject and chapter.");
      setSaving(false);
      return;
    }
    if (!title) {
      setError("Activity title is required.");
      setSaving(false);
      return;
    }

    try {
      const activityType = String(form.get("activityType") || "Study");
      const values = {
        title,
        subject: subject.name,
        subjectSlug,
        chapterId,
        chapterTitle: chapter.title,
        activityType,
        scheduledDate: String(form.get("scheduledDate") || selectedDate),
        startTime: String(form.get("startTime") || ""),
        endTime: String(form.get("endTime") || ""),
        status: String(form.get("status") || "NOT_STARTED"),
        notes: String(form.get("notes") || "").trim(),
      };

      const cutStage = CUT_STAGES[activityType];
      if (cutStage) {
        await addChapterStageActivity(user.uid, chapter, subjectSlug, cutStage.stageKey, {
          ...values,
          existingActualDate: progress[chapter.id]?.[cutStage.actualField] || "",
        });
      } else {
        await addStudyActivity(user.uid, values);
      }
      formElement.reset();
      changeActivitySubject(initialSubjectSlug);
      setShowForm(false);
    } catch (e) {
      setError(e?.message || "Unable to add activity.");
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(activity, status) {
    await updateStudyActivityStatus(user.uid, activity.id, status);
  }

  return (
    <AppShell title="Timetable" actions={<button className="primary-btn compact desktop-action" onClick={() => setShowForm((value) => !value)}>{showForm ? "Close" : "Add activity"}</button>}>
      <section className="panel-card timetable-date-card">
        <div className="date-nav-row">
          <button className="ghost-btn compact week-nav-button" onClick={() => setSelectedDate(shiftDate(selectedDate, -7))}>Previous</button>
          <div className="date-title-block"><h2>{humanDate(selectedDate)}</h2></div>
          <div className="date-nav-actions">
            <button className="secondary-btn compact" onClick={() => setSelectedDate(dateKey())}>Today</button>
            <button className="ghost-btn compact week-nav-button" onClick={() => setSelectedDate(shiftDate(selectedDate, 7))}>Next</button>
          </div>
        </div>
        <div className="week-strip">
          {week.map((item) => (
            <button key={item.key} className={item.key === selectedDate ? "week-day active" : "week-day"} onClick={() => setSelectedDate(item.key)}>
              <span>{item.day}</span><strong>{item.date}</strong>{activities.some((row) => row.scheduledDate === item.key) && <i />}
            </button>
          ))}
        </div>
      </section>

      <section className="stats-grid four compact-stats timetable-stats">
        <StatCard label="Activities" value={counts.total} />
        <StatCard label="Completed" value={counts.completed} tone="success" />
        <StatCard label="In progress" value={counts.inProgress} tone="blue" />
        <StatCard label="Missed" value={counts.missed} tone={counts.missed ? "danger" : "success"} />
      </section>

      <button className="primary-btn mobile-add" onClick={() => setShowForm((value) => !value)}>{showForm ? "Close" : "Add activity"}</button>

      {showForm && (
        <section className="panel-card form-panel">
          <div className="section-heading"><h2>Add study activity</h2></div>
          <form className="study-activity-form" onSubmit={addActivity}>
            <div className="form-grid two">
              <label>Subject<select name="subjectSlug" value={activitySubjectSlug} onChange={(e) => changeActivitySubject(e.target.value)} required>{SUBJECT_ORDER.map((slug) => <option key={slug} value={slug}>{SUBJECTS[slug].name}</option>)}</select></label>
              <label>Chapter<select name="chapterId" value={activityChapterId} onChange={(e) => setActivityChapterId(e.target.value)} required>{selectedActivityChapters.map((chapter) => <option key={chapter.id} value={chapter.id}>{chapter.title}</option>)}</select></label>
            </div>
            <div className="form-grid two">
              <label>Activity title<input name="title" autoFocus /></label>
              <label>Type<select name="activityType" defaultValue="Study">{ACTIVITY_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label>
            </div>
            <div className="form-grid four">
              <label>Date<input name="scheduledDate" type="date" defaultValue={selectedDate} /></label>
              <label>Start time<input name="startTime" type="time" /></label>
              <label>End time<input name="endTime" type="time" /></label>
              <label>Status<select name="status" defaultValue="NOT_STARTED"><option value="NOT_STARTED">Assigned</option><option value="IN_PROGRESS">In progress</option><option value="COMPLETED">Completed</option><option value="MISSED">Missed</option></select></label>
            </div>
            <label>Notes<textarea name="notes" /></label>
            {error && <div className="error-box">{error}</div>}
            <div className="form-actions-right"><button type="button" className="ghost-btn compact" onClick={() => setShowForm(false)}>Cancel</button><button className="primary-btn compact" disabled={saving}>{saving ? "Saving…" : "Add activity"}</button></div>
          </form>
        </section>
      )}

      <section className="panel-card">
        <div className="section-heading"><h2>{dayActivities.length ? `${dayActivities.length} activities` : "Daily plan"}</h2></div>
        {dayActivities.length ? (
          <div className="activity-list">
            {dayActivities.map((activity) => {
              const label = taskStatusLabel(activity);
              const tone = taskStatusTone(activity);
              const chapterTitle = activity.chapterTitle || activity.linkedChapterTitle || "";
              return (
                <article className={`activity-card status-${label.toLowerCase().replaceAll(" ", "-")}`} key={activity.id}>
                  <div className="activity-time"><strong>{displayTime(activity)}</strong></div>
                  <div className="activity-main">
                    <div className="activity-title-row"><strong>{activity.title}</strong><span className={`pill ${tone}`}>{label}</span></div>
                    <small>{activity.subject || "General"}{chapterTitle ? ` • ${chapterTitle}` : ""}{` • ${activity.activityType || "Study"}`}</small>
                    {activity.assignedByAdmin && <small>Assigned by {activity.assignedByName || "Admin"}{activity.priority ? ` • ${String(activity.priority).toLowerCase()} priority` : ""}</small>}
                    {activity.notes && !String(activity.notes).startsWith("Automatically linked to") && <p>{activity.notes}</p>}
                    <div className="activity-status-actions four-status-actions">
                      <button className={label === "Assigned" ? "status-btn active" : "status-btn"} onClick={() => setStatus(activity, "NOT_STARTED")}>Assigned</button>
                      <button className={label === "In progress" ? "status-btn progress active" : "status-btn progress"} onClick={() => setStatus(activity, "IN_PROGRESS")}>In progress</button>
                      <button className={label === "Completed" ? "status-btn complete active" : "status-btn complete"} onClick={() => setStatus(activity, "COMPLETED")}>Completed</button>
                      <button className={label === "Missed" ? "status-btn missed active" : "status-btn missed"} onClick={() => setStatus(activity, "MISSED")}>Missed</button>
                    </div>
                  </div>
                  {!activity.autoGenerated && !activity.assignedByAdmin && <button className="danger-text activity-delete" onClick={() => deleteStudyActivity(user.uid, activity.id)}>Delete</button>}
                </article>
              );
            })}
          </div>
        ) : <div className="empty-state compact-empty"><strong>No activities on this day</strong></div>}
      </section>
    </AppShell>
  );
}

export default function TimetablePage() {
  return <RequireAuth><TimetableContent /></RequireAuth>;
}
