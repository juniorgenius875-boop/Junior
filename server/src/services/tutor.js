import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const knowledgePath = path.resolve(__dirname, '../../knowledge/junior_genius_grade6_math_rag.md');
const knowledge = fs.existsSync(knowledgePath) ? fs.readFileSync(knowledgePath, 'utf8') : '';
const chunks = knowledge.split(/\n(?=##?\s)/g).map(v => v.trim()).filter(Boolean);

function words(text) {
  return new Set(String(text || '').toLowerCase().match(/[a-z0-9]+/g) || []);
}
export function retrieveLocal(question, limit = 4) {
  const q = words(question);
  return chunks.map(chunk => {
    const cw = words(chunk);
    let score = 0;
    for (const token of q) if (cw.has(token)) score += token.length > 4 ? 2 : 1;
    return { chunk, score };
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, limit).map(x => x.chunk);
}

async function openAiCompatible({ baseUrl, apiKey, model, messages }) {
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages, temperature: 0.3 }),
    signal: AbortSignal.timeout(18000),
  });
  if (!response.ok) throw new Error(`AI provider error ${response.status}`);
  const data = await response.json();
  return data?.choices?.[0]?.message?.content?.trim() || '';
}

async function gemini(messages) {
  const prompt = messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.gemini.model)}:generateContent?key=${encodeURIComponent(config.gemini.apiKey)}`;
  const response = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    signal: AbortSignal.timeout(18000),
  });
  if (!response.ok) throw new Error(`Gemini error ${response.status}`);
  const data = await response.json();
  return data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('\n').trim() || '';
}

function localAnswer(question, context) {
  if (!context.length) return 'I could not find that topic in the local curriculum notes. Add a Groq, Gemini, or OpenRouter key in the server .env for broader AI answers.';
  const excerpt = context.join('\n\n').replace(/^#+\s*/gm, '').slice(0, 3500);
  return `Here is the closest explanation from the connected curriculum:\n\n${excerpt}`;
}

export async function tutorReply(question, studentContext = '') {
  const started = Date.now();
  const local = retrieveLocal(question);
  const system = `You are a patient school tutor. Give a clear, age-appropriate explanation, use short steps, and do not invent facts. Student context: ${studentContext || 'not available'}. Curriculum context:\n${local.join('\n\n').slice(0, 6000)}`;
  const messages = [{ role: 'system', content: system }, { role: 'user', content: question }];
  const providers = [
    config.groq.apiKey ? ['groq', () => openAiCompatible({ ...config.groq, messages })] : null,
    config.gemini.apiKey ? ['gemini', () => gemini(messages)] : null,
    config.openrouter.apiKey ? ['openrouter', () => openAiCompatible({ ...config.openrouter, messages })] : null,
  ].filter(Boolean);
  for (const [provider, call] of providers) {
    try {
      const reply = await call();
      if (reply) return { reply, provider, latency_ms: Date.now() - started, local_context_used: local.length > 0 };
    } catch (error) {
      console.warn(`${provider} tutor failed:`, error.message);
    }
  }
  return { reply: localAnswer(question, local), provider: 'local-curriculum', latency_ms: Date.now() - started, local_context_used: local.length > 0 };
}

export function providerStatus() {
  return {
    local_rag: { ready: knowledge.length > 0 },
    groq: { ready: Boolean(config.groq.apiKey), model: config.groq.model },
    gemini: { ready: Boolean(config.gemini.apiKey), model: config.gemini.model },
    openrouter: { ready: Boolean(config.openrouter.apiKey), model: config.openrouter.model },
  };
}
