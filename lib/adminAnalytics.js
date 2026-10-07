export function dateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseDateKey(value) {
  const [y, m, d] = String(value || "").split("-").map(Number);
  return new Date(y || 1970, (m || 1) - 1, d || 1);
}

export function shiftDateKey(value, amount) {
  const d = parseDateKey(value);
  d.setDate(d.getDate() + amount);
  return dateKey(d);
}

export function taskStatusBucket(activity, today = dateKey()) {
  const stored = String(activity?.status || "NOT_STARTED").toUpperCase();
  if (stored === "COMPLETED") return "completed";
  if (stored === "IN_PROGRESS") return "inProgress";
  if (stored === "MISSED" || stored === "PENDING") return "missed";
  if (activity?.scheduledDate && String(activity.scheduledDate) < today) return "missed";
  return "assigned";
}

export function taskStatusLabel(activity, today = dateKey()) {
  const bucket = taskStatusBucket(activity, today);
  if (bucket === "completed") return "Completed";
  if (bucket === "inProgress") return "In progress";
  if (bucket === "missed") return "Missed";
  return "Assigned";
}

export function taskStatusTone(activity, today = dateKey()) {
  const bucket = taskStatusBucket(activity, today);
  if (bucket === "completed") return "success";
  if (bucket === "inProgress") return "blue";
  if (bucket === "missed") return "danger";
  return "neutral";
}

export function taskCounts(activities = [], day = null, today = dateKey()) {
  const rows = day ? activities.filter((item) => item.scheduledDate === day) : activities;
  const counts = { total: rows.length, assigned: 0, inProgress: 0, completed: 0, missed: 0 };
  rows.forEach((item) => {
    const bucket = taskStatusBucket(item, today);
    counts[bucket] += 1;
  });
  counts.completionPercent = counts.total ? (counts.completed / counts.total) * 100 : 0;
  return counts;
}

export function lastNDaysSeries(activities = [], days = 7, anchor = dateKey()) {
  const series = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const key = shiftDateKey(anchor, -offset);
    const rows = activities.filter((item) => item.scheduledDate === key);
    const counts = taskCounts(rows, null, anchor);
    const d = parseDateKey(key);
    series.push({
      key,
      label: d.toLocaleDateString("en-IN", { weekday: "short" }).slice(0, 3),
      dateLabel: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      planned: rows.length,
      completed: counts.completed,
      missed: counts.missed,
      completionPercent: counts.completionPercent,
    });
  }
  return series;
}

export function testScorePercent(test = {}) {
  const obtained = Number(test.marksObtained);
  const total = Number(test.totalMarks);
  if (!Number.isFinite(obtained) || !Number.isFinite(total) || total <= 0) return null;
  return Math.max(0, Math.min(100, (obtained / total) * 100));
}

export function recentTestSeries(tests = [], limit = 8) {
  return [...tests]
    .filter((test) => testScorePercent(test) !== null)
    .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")))
    .slice(-limit)
    .map((test) => ({
      id: test.id,
      date: test.date || "",
      label: test.date
        ? parseDateKey(test.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
        : "Test",
      score: testScorePercent(test),
      subject: Array.isArray(test.subjects) && test.subjects.length
        ? test.subjects.join(", ")
        : test.subject || "Mock test",
    }));
}

export function aggregateSubjectRows(studentRows = []) {
  if (!studentRows.length) return [];
  const bySlug = new Map();
  studentRows.forEach(({ metrics }) => {
    metrics.subjectRows.forEach((row) => {
      const current = bySlug.get(row.subject.slug) || {
        subject: row.subject,
        latestSum: 0,
        latestCount: 0,
        scoredAreas: 0,
        firstSum: 0,
        secondSum: 0,
        thirdSum: 0,
        count: 0,
      };
      if (row.scoredAreas > 0) {
        current.latestSum += row.avgLatest || 0;
        current.latestCount += 1;
      }
      current.scoredAreas += row.scoredAreas || 0;
      current.firstSum += row.firstCutPercent || 0;
      current.secondSum += row.secondCutPercent || 0;
      current.thirdSum += row.thirdCutPercent || 0;
      current.count += 1;
      bySlug.set(row.subject.slug, current);
    });
  });

  return Array.from(bySlug.values()).map((row) => ({
    subject: row.subject,
    avgLatest: row.latestCount ? row.latestSum / row.latestCount : 0,
    scoredAreas: row.scoredAreas,
    firstCutPercent: row.count ? row.firstSum / row.count : 0,
    secondCutPercent: row.count ? row.secondSum / row.count : 0,
    thirdCutPercent: row.count ? row.thirdSum / row.count : 0,
  }));
}
