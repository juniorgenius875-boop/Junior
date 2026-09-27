import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { aiApi } from '../api/client';
import { InlineLoader } from '../components/Loading';

const DEFAULT = [{ role: 'assistant', content: 'Ask a Grade 6 mathematics question.' }];

function AITutor() {
  const [messages, setMessages] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ai_tutor_chat')) || DEFAULT; } catch { return DEFAULT; }
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState(null);
  const endRef = useRef(null);

  useEffect(() => { localStorage.setItem('ai_tutor_chat', JSON.stringify(messages)); endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);
  useEffect(() => { aiApi.providers().then(setProviders).catch(() => setProviders(null)); }, []);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setMessages(v => [...v, { role: 'user', content: text }]); setInput(''); setLoading(true);
    try {
      const data = await aiApi.chat(text);
      setMessages(v => [...v, { role: 'assistant', content: data.reply, meta: { provider: data.provider, agents: data.agents || [], latency: data.latency_ms, multi: data.multi_agent } }]);
    } catch (error) {
      toast.error(error.message || 'Tutor unavailable');
      setMessages(v => [...v, { role: 'assistant', content: 'The tutor is unavailable. Try again.' }]);
    } finally { setLoading(false); }
  };

  const onKeyDown = e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const clear = () => { setMessages(DEFAULT); localStorage.setItem('ai_tutor_chat', JSON.stringify(DEFAULT)); };

  return (
    <div className="page-shell">
      <div className="tutor-layout">
        <aside className="tutor-side">
          <div><h1>Tutor</h1></div>
          <div className="provider-status">
            <Provider label="Local curriculum" ready={providers?.local_rag?.ready} />
            <Provider label="Groq" ready={providers?.groq?.ready} />
            <Provider label="Gemini" ready={providers?.gemini?.ready} />
            <Provider label="OpenRouter" ready={providers?.openrouter?.ready} />
          </div>
          <button className="button secondary" onClick={clear}>Clear conversation</button>
        </aside>
        <section className="tutor-main">
          <div className="message-list">
            {messages.map((m, i) => <div className={`message-row ${m.role}`} key={`${m.role}-${i}`}><div className="message">{m.content}{m.role === 'assistant' && m.meta?.provider && <div className="message-meta">{m.meta.multi ? 'Multi-agent' : m.meta.provider}{m.meta.latency ? ` · ${(m.meta.latency / 1000).toFixed(1)}s` : ''}</div>}</div></div>)}
            {loading && <div className="message-row"><div className="message"><InlineLoader label="Thinking" /></div></div>}
            <div ref={endRef} />
          </div>
          <div className="composer">
            <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKeyDown} placeholder="Ask a question" disabled={loading} />
            <button className="button primary" onClick={send} disabled={loading || !input.trim()}>Send</button>
          </div>
        </section>
      </div>
    </div>
  );
}

function Provider({ label, ready }) { return <div className="provider-row"><span>{label}</span><b>{ready == null ? '—' : ready ? 'Ready' : 'Off'}</b></div>; }

export default AITutor;
