import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { TestResult } from '../models/index.js';
import { recordActivity } from '../services/activity.js';

const router = Router();
router.use(requireAuth);

router.get('/', (req, res) => res.json(req.user.profile || {}));
router.put('/', async (req, res, next) => {
  try {
    const allowed = ['name','grade','school','favorite_subject','dream_job','hobbies'];
    const profile = { ...(req.user.profile?.toObject?.() || req.user.profile || {}) };
    for (const key of allowed) if (req.body[key] !== undefined) profile[key] = String(req.body[key] ?? '');
    req.user.profile = profile;
    await req.user.save();
    await recordActivity(req.user, 'profile_updated', '/profile');
    res.json(profile);
  } catch (error) { next(error); }
});
router.get('/stats', async (req, res, next) => {
  try {
    const tests = await TestResult.find({ user_id: req.user._id }).lean();
    const p = tests.filter(x => Number(x.total_marks) > 0).map(x => Number(x.score || 0) / Number(x.total_marks) * 100);
    res.json({ totalTests: p.length, bestScore: p.length ? Number(Math.max(...p).toFixed(1)) : 0, averageScore: p.length ? Number((p.reduce((a,b)=>a+b,0)/p.length).toFixed(1)) : 0, level: Math.floor(p.length/2)+1 });
  } catch (error) { next(error); }
});
export default router;
