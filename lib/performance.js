export const DEFAULT_SETTINGS = {
  defaultTarget: 90,
  boardReadyThreshold: 85,
  masteredThreshold: 90,
  goodThreshold: 80,
  weakThreshold: 60,
  delayWarningDays: 5,
};

export const WEAKNESS_OPTIONS = [
  "Concept not clear",
  "Forgot formula / fact",
  "Calculation mistake",
  "Careless mistake",
  "Question misunderstood",
  "Incomplete answer",
  "Presentation",
  "Time management",
  "Insufficient practice",
  "Not revised",
];

const DAY_MS = 24 * 60 * 60 * 1000;

function numberOrNull(value) {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function dateDiffDays(planned, actual) {
  if (!planned || !actual) return 0;
  const p = new Date(`${planned}T00:00:00`);
  const a = new Date(`${actual}T00:00:00`);
  if (Number.isNaN(p.getTime()) || Number.isNaN(a.getTime())) return 0;
  return Math.max(0, Math.round((a.getTime() - p.getTime()) / DAY_MS));
}

export function latestScore(row = {}) {
  return numberOrNull(row.test3) ?? numberOrNull(row.test2) ?? numberOrNull(row.test1);
}

export function chapterMetrics(row = {}, settings = DEFAULT_SETTINGS) {
  const test1 = numberOrNull(row.test1);
  const test2 = numberOrNull(row.test2);
  const test3 = numberOrNull(row.test3);
  const latest = test3 ?? test2 ?? test1;

  const trend = test1 === null || latest === null ? null : latest - test1;
  const completedActuals = [row.firstCutActual, row.rev2Actual, row.rev3Actual].filter(Boolean).length;

  let readiness = "Not Started";
  if (latest !== null) {
    if (
      test2 !== null &&
      test3 !== null &&
      test2 >= settings.masteredThreshold &&
      test3 >= settings.masteredThreshold
    ) {
      readiness = "Mastered";
    } else if (
      test3 !== null &&
      test3 >= settings.boardReadyThreshold &&
      completedActuals >= 2
    ) {
      readiness = "Board Ready";
    } else if (latest < settings.weakThreshold) {
      readiness = "Weak";
    } else {
      readiness = "Developing";
    }
  }

  const maxDelay = Math.max(
    dateDiffDays(row.firstCutPlanned, row.firstCutActual),
    dateDiffDays(row.rev2Planned, row.rev2Actual),
    dateDiffDays(row.rev3Planned, row.rev3Actual),
  );

  // Excel R-column returns blank only when D:K has no numeric/date values.
  // D:K includes the three planned/actual date pairs plus Test 1 and Test 2.
  const delayApplicable = Boolean(
    row.firstCutPlanned || row.firstCutActual || test1 !== null ||
    row.rev2Planned || row.rev2Actual || test2 !== null ||
    row.rev3Planned || row.rev3Actual
  );

  return { latest, trend, readiness, maxDelay, completedActuals, delayApplicable };
}

export function subjectMetrics(chapters, progressById, settings = DEFAULT_SETTINGS) {
  const rows = chapters.map((chapter) => ({
    chapter,
    progress: progressById[chapter.id] || {},
    metrics: chapterMetrics(progressById[chapter.id] || {}, settings),
  }));

  const withScore = rows.filter((row) => row.metrics.latest !== null);
  const firstCutComplete = rows.filter((row) => row.progress.firstCutActual).length;
  const secondCutComplete = rows.filter((row) => row.progress.rev2Actual).length;
  const thirdCutComplete = rows.filter((row) => row.progress.rev3Actual).length;
  const boardReady = rows.filter((row) => ["Board Ready", "Mastered"].includes(row.metrics.readiness)).length;
  const weak = rows.filter((row) => row.metrics.readiness === "Weak").length;
  const delayRows = rows.filter((row) => row.metrics.delayApplicable);

  const testAverage = (field) => {
    const values = rows
      .map((row) => numberOrNull(row.progress[field]))
      .filter((value) => value !== null);
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  };

  const avgLatest = withScore.length
    ? withScore.reduce((sum, row) => sum + row.metrics.latest, 0) / withScore.length
    : 0;
  const avgDelay = delayRows.length
    ? delayRows.reduce((sum, row) => sum + row.metrics.maxDelay, 0) / delayRows.length
    : 0;

  let currentStatus = "No Data";
  if (withScore.length) {
    if (avgLatest >= settings.masteredThreshold) currentStatus = "Strong";
    else if (avgLatest >= settings.goodThreshold) currentStatus = "Good";
    else if (avgLatest >= 70) currentStatus = "Needs Revision";
    else currentStatus = "Attention";
  }

  return {
    trackedAreas: rows.length,
    scoredAreas: withScore.length,
    firstCutPercent: rows.length ? (firstCutComplete / rows.length) * 100 : 0,
    secondCutPercent: rows.length ? (secondCutComplete / rows.length) * 100 : 0,
    thirdCutPercent: rows.length ? (thirdCutComplete / rows.length) * 100 : 0,
    test1Avg: testAverage("test1"),
    test2Avg: testAverage("test2"),
    test3Avg: testAverage("test3"),
    avgLatest,
    boardReady,
    boardReadyPercent: rows.length ? (boardReady / rows.length) * 100 : 0,
    weak,
    avgDelay,
    currentStatus,
    rows,
  };
}

export function dashboardMetrics(subjects, progressById, settings = DEFAULT_SETTINGS) {
  const subjectRows = subjects.map((subject) => ({
    subject,
    ...subjectMetrics(subject.chapters, progressById, settings),
  }));

  const allRows = subjectRows.flatMap((row) => row.rows);
  const scored = allRows.filter((row) => row.metrics.latest !== null);
  const overallLatest = scored.length
    ? scored.reduce((sum, row) => sum + row.metrics.latest, 0) / scored.length
    : 0;
  const boardReady = allRows.filter((row) => ["Board Ready", "Mastered"].includes(row.metrics.readiness)).length;
  const firstCut = allRows.filter((row) => row.progress.firstCutActual).length;
  const secondCut = allRows.filter((row) => row.progress.rev2Actual).length;
  const thirdCut = allRows.filter((row) => row.progress.rev3Actual).length;
  const weak = allRows.filter((row) => row.metrics.readiness === "Weak").length;

  return {
    boardGoal: settings.defaultTarget,
    scoredAreas: scored.length,
    overallLatest,
    boardReadyPercent: allRows.length ? (boardReady / allRows.length) * 100 : 0,
    firstCutPercent: allRows.length ? (firstCut / allRows.length) * 100 : 0,
    secondCutPercent: allRows.length ? (secondCut / allRows.length) * 100 : 0,
    thirdCutPercent: allRows.length ? (thirdCut / allRows.length) * 100 : 0,
    weak,
    trackedAreas: allRows.length,
    subjectRows,
  };
}

export function skillMetrics(row = {}, settings = DEFAULT_SETTINGS) {
  const first = numberOrNull(row.test1);
  const latest = numberOrNull(row.test3) ?? numberOrNull(row.test2) ?? first;
  const trend = first === null || latest === null ? null : latest - first;

  let status = "No Data";
  if (latest !== null) {
    if (latest >= settings.masteredThreshold) status = "Strong";
    else if (latest >= settings.goodThreshold) status = "Good";
    else if (latest >= 70) status = "Needs Revision";
    else status = "Attention";
  }

  return { latest, trend, status };
}

export function mockTestMetrics(row = {}, settings = DEFAULT_SETTINGS) {
  const obtained = numberOrNull(row.marksObtained);
  const total = numberOrNull(row.totalMarks);
  const target = numberOrNull(row.target) ?? settings.defaultTarget;

  const scorePercent = obtained !== null && total ? (obtained / total) * 100 : null;
  const gap = scorePercent === null ? null : scorePercent - target;

  const unattempted = numberOrNull(row.unattemptedMarks) ?? 0;
  const careless = numberOrNull(row.carelessLoss) ?? 0;
  const concept = numberOrNull(row.conceptLoss) ?? 0;
  const timeMgmt = numberOrNull(row.timeMgmtLoss) ?? 0;
  const other = numberOrNull(row.otherLoss) ?? 0;
  const totalMarksLost = unattempted + careless + concept + timeMgmt + other;

  // Mirrors the workbook exactly: execution potential adds back careless,
  // time-management and other losses, but not unattempted or concept loss.
  const executionPotential = obtained !== null && total
    ? Math.min(100, ((obtained + careless + timeMgmt + other) / total) * 100)
    : null;

  return { scorePercent, gap, totalMarksLost, executionPotential };
}

export function priorityChapters(subjects, progressById, settings = DEFAULT_SETTINGS, limit = 6) {
  const items = subjects.flatMap((subject) =>
    subject.chapters.map((chapter) => {
      const progress = progressById[chapter.id] || {};
      const metrics = chapterMetrics(progress, settings);
      let priority = 0;
      if (metrics.readiness === "Weak") priority += 100;
      if (metrics.readiness === "Developing") priority += 50;
      if (metrics.maxDelay > settings.delayWarningDays) priority += 30 + metrics.maxDelay;
      if (metrics.latest !== null) priority += Math.max(0, settings.defaultTarget - metrics.latest);
      if (!progress.firstCutActual) priority += 15;
      return { subject, chapter, progress, metrics, priority };
    }),
  );

  return items
    .filter((item) => item.priority > 0)
    .sort((a, b) => b.priority - a.priority)
    .slice(0, limit);
}
