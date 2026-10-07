import { Router } from 'express';
import { User } from '../models/index.js';
import { hashPassword, verifyPassword, tokenPair, verifyJwt } from '../services/auth.js';
import { publicUser } from '../utils/serialize.js';
import { requireAuth } from '../middleware/auth.js';
import { recordActivity } from '../services/activity.js';

const router = Router();

router.post('/register', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const name = String(req.body.name || '').trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ message: 'Valid email is required' });
    if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });
    if (await User.exists({ email })) return res.status(409).json({ message: 'An account with this email already exists' });
    const user = await User.create({ email, password_hash: await hashPassword(password), profile: { name: name || email.split('@')[0] } });
    await recordActivity(user, 'register', '/login');
    res.status(201).json({ user: publicUser(user), ...tokenPair(user) });
  } catch (error) { next(error); }
});

router.post('/login', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const user = await User.findOne({ email });
    if (!user || !(await verifyPassword(String(req.body.password || ''), user.password_hash))) return res.status(401).json({ message: 'Invalid email or password' });
    if (user.is_active === false) return res.status(403).json({ message: 'Account is inactive' });
    user.last_login_at = new Date(); user.last_seen_at = new Date(); await user.save();
    await recordActivity(user, 'login', '/login');
    res.json({ user: publicUser(user), ...tokenPair(user) });
  } catch (error) { next(error); }
});

router.post('/refresh', async (req, res) => {
  try {
    const { user } = await verifyJwt(String(req.body.refresh_token || ''), 'refresh');
    res.json(tokenPair(user));
  } catch { res.status(401).json({ message: 'Invalid or expired refresh token' }); }
});

router.get('/me', requireAuth, async (req, res) => res.json(publicUser(req.user)));
router.post('/logout', requireAuth, async (req, res, next) => {
  try {
    req.user.token_version = Number(req.user.token_version || 0) + 1;
    await req.user.save();
    res.json({ message: 'Logged out' });
  } catch (error) { next(error); }
});

export default router;
