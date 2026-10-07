import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import {
  User,
  StudentProgress,
  TestResult,
  ChatHistory,
  ActivityLog,
  ChapterProgress,
  StudyActivity,
  MockTest,
  AppConfig,
} from '../models/index.js';
import { plain, publicUser } from '../utils/serialize.js';
import { buildStudentReport } from './reports.js';
import { studentPdf, studentsPdf } from '../services/pdf.js';

const router = Router();
router.use(requireAuth, requireAdmin);

const DEFAULT_SETTINGS = {
  defaultTarget: 90,
  boardReadyThreshold: 85,
  masteredThreshold: 90,
  goodThreshold: 80,
  weakThreshold: 60,
  delayWarningDays: 5,
};

function asNumber(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function latestChapterScore(row = {}) {
  return asNumber(row.test3) ?? asNumber(row.test2) ?? asNumber(row.test1);
}

function chapterReadiness(row = {}, settings = DEFAULT_SETTINGS) {
  const test1 = asNumber(row.test1);
  const test2 = asNumber(row.test2);
  const test3 = asNumber(row.test3);
  const latest = test3 ?? test2 ?? test1;
  const completedCuts = [row.firstCutActual, row.rev2Actual, row.rev3Actual].filter(Boolean).length;

  if (latest === null) return 'Not Started';
  if (test2 !== null && test3 !== null && test2 >= settings.masteredThreshold && test3 >= settings.masteredThreshold) return 'Mastered';
  if (test3 !== null && test3 >= settings.boardReadyThreshold && completedCuts >= 2) return 'Board Ready';
  if (latest < settings.weakThreshold) return 'Weak';
  return 'Developing';
}

function percent(value, total) {
  return total ? Number(((value / total) * 100).toFixed(1)) : 0;
}

function average(values) {
  const clean = values.filter((value) => Number.isFinite(Number(value))).map(Number);
  return clean.length ? Number((clean.reduce((sum, value) => sum + value, 0) / clean.length).toFixed(1)) : 0;
}

function startDateKey(today, daysBack) {
  const date = new Date(`${today}T12:00:00`);
  date.setDate(date.getDate() - daysBack);
  return date.toISOString().slice(0, 10);
}

function dateSeries(start, days) {
  const date = new Date(`${start}T12:00:00`);
  return Array.from({ length: days }, (_, index) => {
    const current = new Date(date);
    current.setDate(date.getDate() + index);
    return current.toISOString().slice(0, 10);
  });
}

function taskStatus(row = {}, today) {
  const status = String(row.status || 'NOT_STARTED').toUpperCase();
  if (status === 'COMPLETED') return 'completed';
  if (status === 'IN_PROGRESS') return 'inProgress';
  if (status === 'MISSED' || status === 'PENDING') return 'missed';
  if (row.scheduledDate && String(row.scheduledDate) < today) return 'missed';
  return 'assigned';
}


function learningRange(value = '1m') {
  const key = ['1m', '3m', '6m', '1y', 'lifetime'].includes(String(value).toLowerCase()) ? String(value).toLowerCase() : '1m';
  const now = new Date();
  const configs = {
    '1m': { label: '1 Month', days: 30, bucketDays: 1 },
    '3m': { label: '3 Months', days: 90, bucketDays: 7 },
    '6m': { label: '6 Months', days: 180, bucketDays: 14 },
    '1y': { label: '1 Year', days: 365, bucketDays: 30 },
    lifetime: { label: 'Lifetime', days: null, bucketDays: 30 },
  };
  const config = configs[key];
  const start = config.days ? new Date(now.getTime() - (config.days - 1) * 86400000) : null;
  if (start) start.setHours(0, 0, 0, 0);
  return { key, ...config, start, end: now };
}

function scorePercent(row = {}) {
  const score = asNumber(row.score ?? row.marksObtained);
  const total = asNumber(row.total_marks ?? row.totalMarks);
  if (score === null || total === null || total <= 0) return null;
  return Number(((score / total) * 100).toFixed(1));
}

function rangeMatch(start) {
  return start ? { $gte: start } : { $exists: true };
}

function activityBucketRows(range, rowsByType) {
  const allDates = Object.values(rowsByType).flat().map((row) => new Date(row.created_at || row.createdAt)).filter((date) => Number.isFinite(date.getTime()));
  let start = range.start;
  if (!start) {
    const earliest = allDates.length ? new Date(Math.min(...allDates.map((date) => date.getTime()))) : new Date(range.end.getTime() - 29 * 86400000);
    earliest.setHours(0, 0, 0, 0);
    start = earliest;
  }
  const spanDays = Math.max(1, Math.ceil((range.end.getTime() - start.getTime()) / 86400000) + 1);
  const bucketDays = range.key === 'lifetime' ? Math.max(1, Math.ceil(spanDays / 18)) : range.bucketDays;
  const bucketCount = Math.max(1, Math.ceil(spanDays / bucketDays));
  const rows = Array.from({ length: bucketCount }, (_, index) => {
    const bucketStart = new Date(start.getTime() + index * bucketDays * 86400000);
    const bucketEnd = new Date(Math.min(range.end.getTime(), bucketStart.getTime() + bucketDays * 86400000 - 1));
    const label = bucketDays <= 2
      ? bucketStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : bucketDays <= 16
        ? bucketStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : bucketStart.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    return { key: String(index), label, start: bucketStart, end: bucketEnd, activity: 0, tests: 0, chats: 0, predictions: 0, scoreTotal: 0, scoreCount: 0, avgScore: 0 };
  });

  function put(type, row, score = null) {
    const date = new Date(row.created_at || row.createdAt);
    if (!Number.isFinite(date.getTime()) || date < start || date > range.end) return;
    const index = Math.min(rows.length - 1, Math.max(0, Math.floor((date.getTime() - start.getTime()) / (bucketDays * 86400000))));
    rows[index][type] += 1;
    if (score !== null) { rows[index].scoreTotal += score; rows[index].scoreCount += 1; }
  }

  for (const row of rowsByType.activity || []) put('activity', row);
  for (const row of rowsByType.tests || []) put('tests', row, scorePercent(row));
  for (const row of rowsByType.chats || []) put('chats', row);
  for (const row of rowsByType.predictions || []) put('predictions', row);
  return rows.map(({ start: _start, end: _end, scoreTotal, scoreCount, ...row }) => ({ ...row, avgScore: scoreCount ? Number((scoreTotal / scoreCount).toFixed(1)) : 0 }));
}
async function studentSummary(user) {
  const [latest, tests, chats] = await Promise.all([
    StudentProgress.findOne({ user_id: user._id }).sort({ created_at: -1 }).lean(),
    TestResult.find({ user_id: user._id }).lean(),
    ChatHistory.countDocuments({ user_id: user._id }),
  ]);
  const perc = tests.filter((x) => Number(x.total_marks) > 0).map((x) => Number(x.score || 0) / Number(x.total_marks) * 100);
  return {
    ...publicUser(user),
    latest_progress: latest ? plain(latest, { keepUserId: false }) : null,
    test_stats: {
      count: perc.length,
      average_score: perc.length ? Number((perc.reduce((a, b) => a + b, 0) / perc.length).toFixed(1)) : 0,
      best_score: perc.length ? Number(Math.max(...perc).toFixed(1)) : 0,
    },
    chat_stats: { count: chats },
  };
}

router.get('/dashboard', async (req, res, next) => {
  try {
    const today = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.date || ''))
      ? String(req.query.date)
      : new Date().toISOString().slice(0, 10);
    const weekStart = startDateKey(today, 6);
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [settingsRow, users] = await Promise.all([
      AppConfig.findOne({ key: 'performance' }).lean(),
      User.find({ role: 'student', is_active: { $ne: false } }).sort({ 'profile.name': 1, email: 1 }).lean(),
    ]);

    const settings = { ...DEFAULT_SETTINGS, ...(settingsRow || {}) };
    const userIds = users.map((user) => user._id);

    if (!userIds.length) {
      return res.json({
        generatedAt: new Date(), today, settings,
        overview: { totalStudents: 0, active24h: 0, active7d: 0, averageReadiness: 0, averageTest: 0, atRisk: 0, todayPlanned: 0, todayCompleted: 0 },
        cutAverages: { first: 0, second: 0, third: 0 },
        distribution: { ready: 0, onTrack: 0, attention: 0 },
        weekly: [], subjects: [], students: [], recentActivity: [],
      });
    }

    const [chapterRows, todayRows, weekRows, overdueRows, mockRows, latestAiRows, recentActivityRows] = await Promise.all([
      ChapterProgress.find({ userId: { $in: userIds } }).lean(),
      StudyActivity.find({ userId: { $in: userIds }, scheduledDate: today }).lean(),
      StudyActivity.find({ userId: { $in: userIds }, scheduledDate: { $gte: weekStart, $lte: today } }).lean(),
      StudyActivity.find({ userId: { $in: userIds }, scheduledDate: { $lt: today }, status: { $nin: ['COMPLETED', 'completed'] } }).select('userId scheduledDate status').lean(),
      MockTest.find({ userId: { $in: userIds } }).sort({ date: -1, createdAt: -1 }).lean(),
      StudentProgress.aggregate([
        { $match: { user_id: { $in: userIds } } },
        { $sort: { created_at: -1 } },
        { $group: { _id: '$user_id', row: { $first: '$$ROOT' } } },
      ]),
      ActivityLog.find({ user_id: { $in: userIds } }).sort({ created_at: -1 }).limit(12).populate('user_id', 'email profile').lean(),
    ]);

    const chaptersByUser = new Map();
    const todayByUser = new Map();
    const overdueByUser = new Map();
    const testsByUser = new Map();
    const latestAiByUser = new Map(latestAiRows.map((item) => [String(item._id), item.row]));

    for (const row of chapterRows) {
      const key = String(row.userId);
      if (!chaptersByUser.has(key)) chaptersByUser.set(key, []);
      chaptersByUser.get(key).push(row);
    }
    for (const row of todayRows) {
      const key = String(row.userId);
      if (!todayByUser.has(key)) todayByUser.set(key, []);
      todayByUser.get(key).push(row);
    }
    for (const row of overdueRows) {
      const key = String(row.userId);
      overdueByUser.set(key, (overdueByUser.get(key) || 0) + 1);
    }
    for (const row of mockRows) {
      const key = String(row.userId);
      if (!testsByUser.has(key)) testsByUser.set(key, []);
      testsByUser.get(key).push(row);
    }

    const studentRows = users.map((user) => {
      const id = String(user._id);
      const progress = chaptersByUser.get(id) || [];
      const tracked = progress.length;
      const firstDone = progress.filter((row) => Boolean(row.firstCutActual)).length;
      const secondDone = progress.filter((row) => Boolean(row.rev2Actual)).length;
      const thirdDone = progress.filter((row) => Boolean(row.rev3Actual)).length;
      const readyCount = progress.filter((row) => ['Board Ready', 'Mastered'].includes(chapterReadiness(row, settings))).length;
      const weakCount = progress.filter((row) => chapterReadiness(row, settings) === 'Weak').length;
      const scores = progress.map(latestChapterScore).filter((value) => value !== null);
      const tests = testsByUser.get(id) || [];
      const latestMock = tests[0] || null;
      const latestTest = latestMock && Number(latestMock.totalMarks) > 0
        ? Number(((Number(latestMock.marksObtained || 0) / Number(latestMock.totalMarks)) * 100).toFixed(1))
        : (scores.length ? average(scores) : null);
      const todayActivities = todayByUser.get(id) || [];
      const todayCompleted = todayActivities.filter((row) => taskStatus(row, today) === 'completed').length;
      const todayTotal = todayActivities.length;
      const overdue = overdueByUser.get(id) || 0;
      const ai = latestAiByUser.get(id) || null;
      const readiness = percent(readyCount, tracked);
      const first = percent(firstDone, tracked);
      const second = percent(secondDone, tracked);
      const third = percent(thirdDone, tracked);

      let status = 'On Track';
      if (String(ai?.risk_level || '').toLowerCase() === 'high' || (latestTest !== null && latestTest < settings.weakThreshold) || overdue >= 8) status = 'At Risk';
      else if (readiness >= settings.boardReadyThreshold) status = 'Board Ready';
      else if (latestTest !== null && latestTest < settings.goodThreshold) status = 'Needs Attention';

      return {
        id,
        name: user.profile?.name || 'Student',
        email: user.email || '',
        grade: user.profile?.grade || '',
        school: user.profile?.school || '',
        favoriteSubject: user.profile?.favorite_subject || '',
        lastSeenAt: user.last_seen_at || null,
        lastActivityAt: user.last_activity_at || null,
        currentPage: user.current_page || '',
        trackedChapters: tracked,
        firstCutPercent: first,
        secondCutPercent: second,
        thirdCutPercent: third,
        boardReadiness: readiness,
        chapterAverage: scores.length ? average(scores) : null,
        latestTest,
        latestTestDate: latestMock?.date || null,
        todayPlanned: todayTotal,
        todayCompleted,
        todayCompletion: percent(todayCompleted, todayTotal),
        overdue,
        weakChapters: weakCount,
        aiRisk: ai?.risk_level || '—',
        predictedMarks: ai?.total_predicted_marks ?? null,
        status,
      };
    });

    const allTodayCompleted = todayRows.filter((row) => taskStatus(row, today) === 'completed').length;
    const active24h = users.filter((user) => user.last_seen_at && new Date(user.last_seen_at) >= since24h).length;
    const active7d = users.filter((user) => user.last_seen_at && new Date(user.last_seen_at) >= since7d).length;
    const testValues = studentRows.map((student) => student.latestTest).filter((value) => value !== null);
    const readinessValues = studentRows.map((student) => student.boardReadiness);

    const distribution = studentRows.reduce((acc, student) => {
      if (student.status === 'Board Ready') acc.ready += 1;
      else if (student.status === 'At Risk' || student.status === 'Needs Attention') acc.attention += 1;
      else acc.onTrack += 1;
      return acc;
    }, { ready: 0, onTrack: 0, attention: 0 });

    const dates = dateSeries(weekStart, 7);
    const weekly = dates.map((date) => {
      const rows = weekRows.filter((row) => row.scheduledDate === date);
      const completed = rows.filter((row) => taskStatus(row, today) === 'completed').length;
      return { date, planned: rows.length, completed, completion: percent(completed, rows.length) };
    });

    const subjectMap = new Map();
    for (const row of chapterRows) {
      const slug = row.subjectSlug || 'other';
      const current = subjectMap.get(slug) || { slug, name: row.subjectName || slug, chapters: 0, first: 0, second: 0, third: 0, ready: 0, scores: [] };
      current.chapters += 1;
      if (row.firstCutActual) current.first += 1;
      if (row.rev2Actual) current.second += 1;
      if (row.rev3Actual) current.third += 1;
      if (['Board Ready', 'Mastered'].includes(chapterReadiness(row, settings))) current.ready += 1;
      const score = latestChapterScore(row);
      if (score !== null) current.scores.push(score);
      subjectMap.set(slug, current);
    }
    const subjects = Array.from(subjectMap.values()).map((subject) => ({
      slug: subject.slug,
      name: subject.name,
      firstCutPercent: percent(subject.first, subject.chapters),
      secondCutPercent: percent(subject.second, subject.chapters),
      thirdCutPercent: percent(subject.third, subject.chapters),
      boardReadiness: percent(subject.ready, subject.chapters),
      averageScore: subject.scores.length ? average(subject.scores) : null,
    })).sort((a, b) => String(a.name).localeCompare(String(b.name)));

    const recentActivity = recentActivityRows.map((row) => ({
      id: String(row._id),
      action: row.action || '',
      page: row.page || '',
      createdAt: row.created_at || null,
      student: row.user_id ? {
        id: String(row.user_id._id),
        name: row.user_id.profile?.name || row.user_id.email || 'Student',
        email: row.user_id.email || '',
      } : null,
    }));

    res.json({
      generatedAt: new Date(),
      today,
      settings,
      overview: {
        totalStudents: studentRows.length,
        active24h,
        active7d,
        averageReadiness: average(readinessValues),
        averageTest: testValues.length ? average(testValues) : 0,
        atRisk: studentRows.filter((student) => student.status === 'At Risk' || student.status === 'Needs Attention').length,
        todayPlanned: todayRows.length,
        todayCompleted: allTodayCompleted,
      },
      cutAverages: {
        first: average(studentRows.map((student) => student.firstCutPercent)),
        second: average(studentRows.map((student) => student.secondCutPercent)),
        third: average(studentRows.map((student) => student.thirdCutPercent)),
      },
      distribution,
      weekly,
      subjects,
      students: studentRows,
      recentActivity,
    });
  } catch (error) {
    next(error);
  }
});


router.get('/learning-dashboard', async (req, res, next) => {
  try {
    const range = learningRange(req.query.range);
    const users = await User.find({ role: 'student', is_active: { $ne: false } }).select('email profile last_seen_at last_activity_at current_page').sort({ 'profile.name': 1 }).lean();
    const userIds = users.map((user) => user._id);
    const createdFilter = range.start ? { created_at: rangeMatch(range.start), user_id: { $in: userIds } } : { user_id: { $in: userIds } };
    const [activities, tests, chats, predictions, latestPredictionRows] = await Promise.all([
      ActivityLog.find(createdFilter).sort({ created_at: -1 }).limit(5000).populate('user_id', 'email profile').lean(),
      TestResult.find(createdFilter).sort({ created_at: -1 }).limit(5000).populate('user_id', 'email profile').lean(),
      ChatHistory.find(createdFilter).sort({ created_at: -1 }).limit(5000).populate('user_id', 'email profile').lean(),
      StudentProgress.find(createdFilter).sort({ created_at: -1 }).limit(5000).populate('user_id', 'email profile').lean(),
      StudentProgress.aggregate([{ $match: { user_id: { $in: userIds } } }, { $sort: { created_at: -1 } }, { $group: { _id: '$user_id', row: { $first: '$$ROOT' } } }]),
    ]);

    const activeIds = new Set();
    for (const group of [activities, tests, chats, predictions]) for (const row of group) if (row.user_id) activeIds.add(String(row.user_id._id || row.user_id));
    if (range.start) {
      for (const user of users) if (user.last_seen_at && new Date(user.last_seen_at) >= range.start) activeIds.add(String(user._id));
    } else {
      for (const user of users) if (user.last_seen_at) activeIds.add(String(user._id));
    }

    const latestByUser = new Map(latestPredictionRows.map((item) => [String(item._id), item.row]));
    const riskDistribution = { high: 0, medium: 0, low: 0, noData: 0 };
    for (const user of users) {
      const row = latestByUser.get(String(user._id));
      const risk = String(row?.risk_level || '').toLowerCase();
      if (risk === 'high') riskDistribution.high += 1;
      else if (risk === 'medium') riskDistribution.medium += 1;
      else if (risk === 'low') riskDistribution.low += 1;
      else riskDistribution.noData += 1;
    }

    const scores = tests.map(scorePercent).filter((value) => value !== null);
    const scoreDistribution = [
      { label: 'Below 50%', min: 0, max: 49.999, count: 0, tone: 'red' },
      { label: '50–69%', min: 50, max: 69.999, count: 0, tone: 'orange' },
      { label: '70–84%', min: 70, max: 84.999, count: 0, tone: 'blue' },
      { label: '85–100%', min: 85, max: 100, count: 0, tone: 'green' },
    ];
    for (const score of scores) {
      const bucket = scoreDistribution.find((item) => score >= item.min && score <= item.max);
      if (bucket) bucket.count += 1;
    }

    const perUser = new Map(users.map((user) => [String(user._id), {
      id: String(user._id),
      name: user.profile?.name || 'Student',
      email: user.email || '',
      lastSeenAt: user.last_seen_at || null,
      tests: 0, scoreTotal: 0, scoreCount: 0, chats: 0, predictions: 0, activity: 0,
      risk: latestByUser.get(String(user._id))?.risk_level || 'No data',
      predictedMarks: latestByUser.get(String(user._id))?.total_predicted_marks ?? null,
    }]));
    const addUser = (row, key, score = null) => {
      const id = String(row.user_id?._id || row.user_id || '');
      const item = perUser.get(id);
      if (!item) return;
      item[key] += 1;
      if (score !== null) { item.scoreTotal += score; item.scoreCount += 1; }
    };
    activities.forEach((row) => addUser(row, 'activity'));
    tests.forEach((row) => addUser(row, 'tests', scorePercent(row)));
    chats.forEach((row) => addUser(row, 'chats'));
    predictions.forEach((row) => addUser(row, 'predictions'));
    const studentActivity = Array.from(perUser.values()).map(({ scoreTotal, scoreCount, ...row }) => ({ ...row, averageScore: scoreCount ? Number((scoreTotal / scoreCount).toFixed(1)) : 0 }))
      .sort((a, b) => (b.activity + b.tests + b.chats + b.predictions) - (a.activity + a.tests + a.chats + a.predictions));

    const highRiskStudents = studentActivity.filter((student) => String(student.risk).toLowerCase() === 'high')
      .sort((a, b) => (a.averageScore || 999) - (b.averageScore || 999));

    const recentPredictions = predictions.slice(0, 12).map((row) => ({
      id: String(row._id), studentId: row.user_id ? String(row.user_id._id || row.user_id) : '',
      student: row.user_id?.profile?.name || row.user_id?.email || 'Student',
      email: row.user_id?.email || '', risk: row.risk_level || '—', predictedMarks: row.total_predicted_marks ?? null, createdAt: row.created_at || null,
    }));
    const recentChats = chats.slice(0, 12).map((row) => ({
      id: String(row._id), studentId: row.user_id ? String(row.user_id._id || row.user_id) : '',
      student: row.user_id?.profile?.name || row.user_id?.email || 'Student', email: row.user_id?.email || '',
      question: row.question || row.message || row.prompt || 'Tutor question', provider: row.provider || 'AI', createdAt: row.created_at || null,
    }));
    const recentTests = tests.slice(0, 12).map((row) => ({
      id: String(row._id), studentId: row.user_id ? String(row.user_id._id || row.user_id) : '',
      student: row.user_id?.profile?.name || row.user_id?.email || 'Student', email: row.user_id?.email || '',
      score: scorePercent(row), testType: row.test_type || row.type || 'Adaptive test', difficulty: row.difficulty || '', createdAt: row.created_at || null,
    }));

    const trends = activityBucketRows(range, { activity: activities, tests, chats, predictions });
    res.json({
      generatedAt: new Date(),
      range: { key: range.key, label: range.label, from: range.start, to: range.end },
      overview: {
        totalStudents: users.length, activeStudents: activeIds.size, highRisk: riskDistribution.high, averageScore: scores.length ? average(scores) : 0,
        tests: tests.length, tutorQueries: chats.length, predictions: predictions.length, activityEvents: activities.length,
      },
      riskDistribution, scoreDistribution: scoreDistribution.map(({ min, max, ...item }) => item), trends, studentActivity, highRiskStudents, recentPredictions, recentChats, recentTests,
    });
  } catch (error) { next(error); }
});
router.get('/overview', async (_req, res, next) => {
  try {
    const since = new Date(Date.now() - 24 * 3600 * 1000);
    const onlineSince = new Date(Date.now() - 5 * 60 * 1000);
    const [total, active, online, tests, chats, latestRows] = await Promise.all([
      User.countDocuments({ role: 'student', is_active: { $ne: false } }),
      User.countDocuments({ role: 'student', last_seen_at: { $gte: since } }),
      User.countDocuments({ role: 'student', last_seen_at: { $gte: onlineSince } }),
      TestResult.countDocuments({ created_at: { $gte: since } }),
      ChatHistory.countDocuments({ created_at: { $gte: since } }),
      StudentProgress.aggregate([{ $sort: { created_at: -1 } }, { $group: { _id: '$user_id', row: { $first: '$$ROOT' } } }]),
    ]);
    res.json({ total_users: total, active_24h: active, online_now: online, high_risk: latestRows.filter((x) => x.row?.risk_level === 'High').length, tests_24h: tests, chats_24h: chats, generated_at: new Date() });
  } catch (e) { next(e); }
});

router.get('/users', async (req, res, next) => {
  try {
    const search = String(req.query.search || '').trim();
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
    const role = String(req.query.role || 'student');
    const filter = { role };
    if (search) filter.$or = [{ email: { $regex: search, $options: 'i' } }, { 'profile.name': { $regex: search, $options: 'i' } }];
    const [users, total] = await Promise.all([
      User.find(filter).sort({ 'profile.name': 1, email: 1 }).skip((page - 1) * limit).limit(limit),
      User.countDocuments(filter),
    ]);
    res.json({ items: await Promise.all(users.map(studentSummary)), total, page, pages: Math.max(1, Math.ceil(total / limit)) });
  } catch (e) { next(e); }
});

router.get('/users/:id', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'Student not found' });
    const [progress, tests, chats, activity] = await Promise.all([
      StudentProgress.find({ user_id: user._id }).sort({ created_at: -1 }).limit(200).lean(),
      TestResult.find({ user_id: user._id }).sort({ created_at: -1 }).limit(200).lean(),
      ChatHistory.find({ user_id: user._id }).sort({ created_at: -1 }).limit(100).lean(),
      ActivityLog.find({ user_id: user._id }).sort({ created_at: -1 }).limit(200).lean(),
    ]);
    res.json({ user: publicUser(user), progress: progress.map((x) => plain(x, { keepUserId: false })), tests: tests.map((x) => plain(x, { keepUserId: false })), chats: chats.map((x) => plain(x, { keepUserId: false })), activity: activity.map((x) => plain(x, { keepUserId: false })) });
  } catch (e) { next(e); }
});

router.get('/activity', async (req, res, next) => {
  try {
    const limit = Math.min(200, Math.max(1, Number(req.query.limit || 50)));
    const rows = await ActivityLog.find({}).sort({ created_at: -1 }).limit(limit).populate('user_id', 'email profile').lean();
    res.json(rows.map((row) => ({ id: String(row._id), action: row.action, page: row.page, metadata: row.metadata || {}, createdAt: row.created_at, user: row.user_id ? { id: String(row.user_id._id), email: row.user_id.email, name: row.user_id.profile?.name || '' } : null })));
  } catch (e) { next(e); }
});

router.get('/report/students', async (_req, res, next) => {
  try {
    const users = await User.find({ role: 'student' }).sort({ created_at: -1 }).limit(2000);
    const students = await Promise.all(users.map(studentSummary));
    const since = new Date(Date.now() - 24 * 3600 * 1000);
    const onlineSince = new Date(Date.now() - 5 * 60 * 1000);
    const latestRows = await StudentProgress.aggregate([{ $sort: { created_at: -1 } }, { $group: { _id: '$user_id', row: { $first: '$$ROOT' } } }]);
    const overview = {
      total_users: students.length,
      active_24h: await User.countDocuments({ role: 'student', last_seen_at: { $gte: since } }),
      online_now: await User.countDocuments({ role: 'student', last_seen_at: { $gte: onlineSince } }),
      high_risk: latestRows.filter((x) => x.row?.risk_level === 'High').length,
      tests_24h: await TestResult.countDocuments({ created_at: { $gte: since } }),
      chats_24h: await ChatHistory.countDocuments({ created_at: { $gte: since } }),
    };
    res.json({ overview, students, generated_at: new Date() });
  } catch (e) { next(e); }
});

router.get('/report/students.pdf', async (_req, res, next) => {
  try {
    const users = await User.find({ role: 'student' });
    const rows = await Promise.all(users.map(studentSummary));
    const pdf = await studentsPdf(rows);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="boardtrack-junior-students-report.pdf"');
    res.send(pdf);
  } catch (e) { next(e); }
});

router.get('/report/users/:id.pdf', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'Student not found' });
    const data = await buildStudentReport(user);
    const pdf = await studentPdf(data);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="student-learning-report.pdf"');
    res.send(pdf);
  } catch (e) { next(e); }
});

export default router;
