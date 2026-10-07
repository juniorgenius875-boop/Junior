import { verifyJwt } from '../services/auth.js';

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) return res.status(401).json({ message: 'Authentication required' });
    const { user } = await verifyJwt(token, 'access');
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ message: 'Admin access required' });
  next();
}

export function canAccessUser(req, res, next) {
  const target = String(req.params.userId || req.query.userId || '');
  if (req.user?.role === 'admin' || target === String(req.user?._id)) return next();
  return res.status(403).json({ message: 'Access denied' });
}
