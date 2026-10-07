"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import RequireAuth from "@/components/RequireAuth";
import AppShell from "@/components/AppShell";
import StatCard from "@/components/StatCard";
import { CardSkeleton } from "@/components/LoadingUI";
import { useAuth } from "@/components/AuthProvider";
import { SUBJECT_ORDER, SUBJECTS } from "@/lib/catalog";
import { dateKey, shiftDateKey, taskCounts, taskStatusLabel, taskStatusTone } from "@/lib/adminAnalytics";
import {
  addStudyActivity,
  assignChapterStageTask,
  deleteStudyActivity,
  updateStudyActivityStatus,
  watchStudyActivities,
  watchUsers,
} from "@/lib/firestore";

const TaskStatusGraphic = dynamic(() => import("@/components/AdminVisuals").then((m) => m.TaskStatusGraphic), { loading: () => <CardSkeleton /> });
const WeeklyTaskChart = dynamic(() => import("@/components/AdminVisuals").then((m) => m.WeeklyTaskChart), { loading: () => <CardSkeleton /> });

const WORK_TYPES = [
  { value: "FIRST_CUT", label: "First Cut", stageKey: "first-cut" },
  { value: "SECOND_CUT", label: "Second Cut", stageKey: "revision-2" },
  { value: "THIRD_CUT", label: "Third Cut", stageKey: "revision-3" },
  { value: "TEST_1", label: "Test 1", activityType: "Test 1" },
  { value: "TEST_2", label: "Test 2", activityType: "Test 2" },
  { value: "TEST_3", label: "Test 3", activityType: "Test 3" },
  { value: "STUDY", label: "Study", activityType: "Study" },
  { value: "REVISION", label: "Revision", activityType: "Revision" },
  { value: "PRACTICE", label: "Practice", activityType: "Practice" },
  { value: "HOMEWORK", label: "Homework", activityType: "Homework" },
  { value: "TEST", label: "Test", activityType: "Test" },
  { value: "READING", label: "Reading", activityType: "Reading" },
  { value: "OTHER", label: "Other", activityType: "Other" },
];

function humanDate(value) {
  const [y, m, d] = String(value || "").split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString("en-IN", {
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

function AdminPlannerContent() {
  const searchParams = useSearchParams();
  const { user, profile } = useAuth();
  const requestedStudent = searchParams.get("student") || "";
  const [users, setUsers] = useState([]);
  const [selectedUid, setSelectedUid] = useState(requestedStudent);
  const [activities, setActivities] = useState([]);
  const [selectedDate, setSelectedDate] = useState(() => dateKey());
  const [subjectSlug, setSubjectSlug] = useState(SUBJECT_ORDER[0] || "");
  const [chapterId, setChapterId] = useState(SUBJECTS[SUBJECT_ORDER[0]]?.chapters?.[0]?.id || "");
  const [workType, setWorkType] = useState("FIRST_CUT");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => watchUsers(setUsers), []);

  const students = useMemo(() => users.filter((item) => item.role !== "admin" && item.active !== false), [users]);

  useEffect(() => {
    if (requestedStudent) setSelectedUid(requestedStudent);
  }, [requestedStudent]);

  useEffect(() => {
    if (!selectedUid && students.length) setSelectedUid(students[0].id);
  }, [students, selectedUid]);

  useEffect(() => {
    if (!selectedUid) {
      setActivities([]);
      return undefined;
    }
    return watchStudyActivities(selectedUid, setActivities);
  }, [selectedUid]);

  const selectedStudent = students.find((item) => item.id === selectedUid) || null;
  const selectedSubject = SUBJECTS[subjectSlug];
  const chapters = selectedSubject?.chapters || [];
  const dayActivities = useMemo(() => activities.filter((item) => item.scheduledDate === selectedDate), [activities, selectedDate]);
  const counts = useMemo(() => taskCounts(dayActivities), [dayActivities]);

  function changeSubject(value) {
    setSubjectSlug(value);
    setChapterId(SUBJECTS[value]?.chapters?.[0]?.id || "");
  }

  async function assignWork(event) {
    event.preventDefault();
    if (!selectedUid) return;
    const formElement = event.currentTarget;
    setSaving(true);
    setMessage("");
    setError("");

    const form = new FormData(formElement);
    const subject = SUBJECTS[subjectSlug];
    const chapter = subject?.chapters?.find((item) => item.id === chapterId);
    const type = WORK_TYPES.find((item) => item.value === workType);
    if (!subject || !chapter || !type) {
      setError("Select a student, subject and chapter.");
      setSaving(false);
      return;
    }

    const taskDate = String(form.get("scheduledDate") || selectedDate);
    const startTime = String(form.get("startTime") || "");
    const endTime = String(form.get("endTime") || "");
    const priority = String(form.get("priority") || "NORMAL");
    const notes = String(form.get("notes") || "").trim();
    const customTitle = String(form.get("title") || "").trim();

    try {
      if (type.stageKey) {
        await assignChapterStageTask(selectedUid, chapter, subjectSlug, type.stageKey, {
          scheduledDate: taskDate,
          startTime,
          endTime,
          priority,
          notes,
          assignedByUid: user.uid,
          assignedByName: profile?.name || profile?.email || "Admin",
        });
      } else {
        await addStudyActivity(selectedUid, {
          title: customTitle || `${type.label}: ${chapter.title}`,
          subject: subject.name,
          subjectSlug,
          chapterId: chapter.id,
          chapterTitle: chapter.title,
          activityType: type.activityType,
          scheduledDate: taskDate,
          startTime,
          endTime,
          status: "NOT_STARTED",
          priority,
          notes,
          source: "ADMIN_ASSIGNED",
          assignedByAdmin: true,
          assignedByUid: user.uid,
          assignedByName: profile?.name || profile?.email || "Admin",
        });
      }
      setSelectedDate(taskDate);
      setMessage("Work assigned.");
      formElement.reset();
    } catch (err) {
      setError(err?.message || "Unable to assign work.");
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(activity, status) {
    await updateStudyActivityStatus(selectedUid, activity.id, status);
  }

  async function removeTask(activity) {
    if (activity.autoGenerated) return;
    await deleteStudyActivity(selectedUid, activity.id);
  }

  return (
    <AppShell admin title="Work planner" actions={<span className="planner-student-name">{selectedStudent?.name || "Select student"}</span>}>
      <section className="panel-card planner-selector-card">
        <div className="form-grid two planner-selector-grid">
          <label>Student
            <select value={selectedUid} onChange={(event) => setSelectedUid(event.target.value)}>
              {students.map((student) => <option key={student.id} value={student.id}>{student.name || student.email}</option>)}
            </select>
          </label>
          <label>Monitor date<input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} /></label>
        </div>
      </section>

      <section className="stats-grid four compact-stats">
        <StatCard label="Tasks" value={counts.total} />
        <StatCard label="Assigned" value={counts.assigned} />
        <StatCard label="In progress" value={counts.inProgress} tone="blue" />
        <StatCard label="Completed" value={counts.completed} tone="success" />
      </section>

      <div className="admin-visual-grid planner-visual-grid">
        <section className="panel-card"><TaskStatusGraphic activities={dayActivities} title={humanDate(selectedDate)} /></section>
        <section className="panel-card"><WeeklyTaskChart activities={activities} title="Student execution" /></section>
      </div>

      <div className="planner-main-grid">
        <section className="panel-card form-panel">
          <div className="section-heading"><h2>Assign work</h2></div>
          <form className="study-activity-form" onSubmit={assignWork}>
            <div className="form-grid two">
              <label>Subject
                <select value={subjectSlug} onChange={(event) => changeSubject(event.target.value)}>
                  {SUBJECT_ORDER.map((slug) => <option key={slug} value={slug}>{SUBJECTS[slug].name}</option>)}
                </select>
              </label>
              <label>Chapter
                <select value={chapterId} onChange={(event) => setChapterId(event.target.value)}>
                  {chapters.map((chapter) => <option key={chapter.id} value={chapter.id}>{chapter.title}</option>)}
                </select>
              </label>
            </div>

            <div className="form-grid two">
              <label>Work type
                <select value={workType} onChange={(event) => setWorkType(event.target.value)}>
                  {WORK_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </label>
              <label>Priority
                <select name="priority" defaultValue="NORMAL">
                  <option value="LOW">Low</option>
                  <option value="NORMAL">Normal</option>
                  <option value="HIGH">High</option>
                </select>
              </label>
            </div>

            {!WORK_TYPES.find((item) => item.value === workType)?.stageKey && <label>Task title<input name="title" placeholder="Optional custom title" /></label>}

            <div className="form-grid three">
              <label>Date<input name="scheduledDate" type="date" defaultValue={selectedDate} key={selectedDate} required /></label>
              <label>From<input name="startTime" type="time" /></label>
              <label>To<input name="endTime" type="time" /></label>
            </div>

            <label>Notes<textarea name="notes" rows="3" /></label>
            {message && <div className="success-box">{message}</div>}
            {error && <div className="error-box">{error}</div>}
            <button className="primary-btn" disabled={saving || !selectedUid}>{saving ? "Assigning…" : "Assign work"}</button>
          </form>
        </section>

        <section className="panel-card planner-day-panel">
          <div className="section-heading planner-day-heading">
            <div><h2>{humanDate(selectedDate)}</h2><small>{dayActivities.length} tasks</small></div>
            <div className="date-step-actions"><button className="ghost-btn compact" onClick={() => setSelectedDate(shiftDateKey(selectedDate, -1))}>Previous</button><button className="ghost-btn compact" onClick={() => setSelectedDate(shiftDateKey(selectedDate, 1))}>Next</button></div>
          </div>

          {dayActivities.length ? (
            <div className="planner-task-list">
              {dayActivities.map((activity) => (
                <article className="planner-task-card" key={activity.id}>
                  <div className="planner-task-head">
                    <div><strong>{activity.title}</strong><small>{displayTime(activity)} · {activity.subject || "General"}{activity.chapterTitle || activity.linkedChapterTitle ? ` · ${activity.chapterTitle || activity.linkedChapterTitle}` : ""}</small></div>
                    <span className={`pill ${taskStatusTone(activity)}`}>{taskStatusLabel(activity)}</span>
                  </div>
                  <div className="planner-task-meta"><span>{String(activity.priority || "NORMAL").toLowerCase()} priority</span>{activity.assignedByAdmin && <span>Admin assigned</span>}</div>
                  {activity.notes && !String(activity.notes).startsWith("Automatically linked to") && <p>{activity.notes}</p>}
                  <div className="planner-status-actions">
                    <button className={taskStatusLabel(activity) === "Assigned" ? "status-btn active" : "status-btn"} onClick={() => setStatus(activity, "NOT_STARTED")}>Assigned</button>
                    <button className={taskStatusLabel(activity) === "In progress" ? "status-btn progress active" : "status-btn progress"} onClick={() => setStatus(activity, "IN_PROGRESS")}>In progress</button>
                    <button className={taskStatusLabel(activity) === "Completed" ? "status-btn complete active" : "status-btn complete"} onClick={() => setStatus(activity, "COMPLETED")}>Completed</button>
                    <button className={taskStatusLabel(activity) === "Missed" ? "status-btn missed active" : "status-btn missed"} onClick={() => setStatus(activity, "MISSED")}>Missed</button>
                  </div>
                  {!activity.autoGenerated && <button className="danger-text planner-delete" onClick={() => removeTask(activity)}>Delete task</button>}
                </article>
              ))}
            </div>
          ) : <div className="empty-state compact-empty"><strong>No work on this day</strong></div>}
        </section>
      </div>
    </AppShell>
  );
}

export default function AdminPlannerPage() {
  return <RequireAuth admin><AdminPlannerContent /></RequireAuth>;
}
