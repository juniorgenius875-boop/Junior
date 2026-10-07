import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { User } from '../models/index.js';

export const hashPassword = password => bcrypt.hash(password, 12);
export const verifyPassword = (password, hash) => bcrypt.compare(password, hash);

function sign(user, type, expiresIn) {
  return jwt.sign({ sub: String(user._id), email: user.email, type, token_version: Number(user.token_version || 0) }, config.jwtSecret, { expiresIn, algorithm: config.jwtAlgorithm });
}
export const accessToken = user => sign(user, 'access', config.accessExpire);
export const refreshToken = user => sign(user, 'refresh', config.refreshExpire);
export const tokenPair = user => ({ access_token: accessToken(user), refresh_token: refreshToken(user), token_type: 'bearer' });

export async function verifyJwt(token, expectedType = 'access') {
  const payload = jwt.verify(token, config.jwtSecret, { algorithms: [config.jwtAlgorithm] });
  if (payload.type !== expectedType) throw new Error('Invalid token type');
  const user = await User.findById(payload.sub);
  if (!user || user.is_active === false || Number(user.token_version || 0) !== Number(payload.token_version || 0)) throw new Error('Session is invalid');
  return { payload, user };
}
