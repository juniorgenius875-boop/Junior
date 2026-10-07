import 'dotenv/config';

const normalizeOrigin = value => String(value || '').trim().replace(/\/+$/, '');

const csv = (value, fallback = []) => {
  const parsed = String(value || '')
    .split(',')
    .map(normalizeOrigin)
    .filter(Boolean);
  return parsed.length ? parsed : fallback.map(normalizeOrigin);
};

export const config = {
  port: Number(process.env.PORT || 9010),
  mongodbUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017',
  mongodbDb: process.env.MONGODB_DB || 'junior_genius',
  jwtSecret: process.env.JWT_SECRET || 'CHANGE_ME_IN_PRODUCTION',
  jwtAlgorithm: process.env.JWT_ALGORITHM || 'HS256',
  accessExpire: process.env.ACCESS_TOKEN_EXPIRE || `${Number(process.env.ACCESS_TOKEN_EXPIRE_MINUTES || 30)}m`,
  refreshExpire: process.env.REFRESH_TOKEN_EXPIRE || `${Number(process.env.REFRESH_TOKEN_EXPIRE_DAYS || 7)}d`,
  corsOrigins: csv(process.env.CORS_ORIGINS, ['http://localhost:3000']),
  groq: {
    apiKey: process.env.GROQ_API_KEY || '',
    model: process.env.GROQ_MODEL || 'openai/gpt-oss-20b',
    baseUrl: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  },
  openrouter: {
    apiKey: process.env.OPENROUTER_API_KEY || '',
    model: process.env.OPENROUTER_MODEL || 'openrouter/free',
    baseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
  },
};
