"use client";

import { useEffect, useRef, useState } from "react";
import RequireAuth from "@/components/RequireAuth";
import AppShell from "@/components/AppShell";
import { aiApi } from "@/lib/api";

const INITIAL=[{role:"assistant",content:"Ask me a study question. I can use the Junior curriculum notes and any configured AI provider."}];
function Tutor(){
  const [messages,setMessages]=useState(INITIAL),[input,setInput]=useState(""),[busy,setBusy]=useState(false),[providers,setProviders]=useState(null),[error,setError]=useState(""); const end=useRef(null);
  useEffect(()=>{try{const saved=JSON.parse(localStorage.getItem("boardtrack_tutor_chat")||"null");if(Array.isArray(saved)&&saved.length)setMessages(saved);}catch{} aiApi.providers().then(setProviders).catch(()=>{});},[]);
  useEffect(()=>{localStorage.setItem("boardtrack_tutor_chat",JSON.stringify(messages));end.current?.scrollIntoView({behavior:"smooth"});},[messages,busy]);
  async function send(){const text=input.trim();if(!text||busy)return;setMessages(v=>[...v,{role:"user",content:text}]);setInput("");setBusy(true);setError("");try{const data=await aiApi.chat(text);setMessages(v=>[...v,{role:"assistant",content:data.reply,provider:data.provider,latency:data.latency_ms}]);}catch(e){setError(e.message||"Tutor unavailable");}finally{setBusy(false);}}
  return <AppShell title="AI Tutor" subtitle="Junior Genius tutoring inside the Study Tracker UI" actions={<button className="secondary-btn compact" onClick={()=>setMessages(INITIAL)}>Clear chat</button>}>
    <div className="tutor-study-grid">
      <aside className="panel-card tutor-info-card"><div className="section-heading"><h2>Tutor sources</h2></div><div className="provider-list">{[["Local curriculum",providers?.local_rag?.ready],["Groq",providers?.groq?.ready],["Gemini",providers?.gemini?.ready],["OpenRouter",providers?.openrouter?.ready]].map(([label,ready])=><div className="provider-row" key={label}><span>{label}</span><span className={`pill ${ready?"success":"neutral"}`}>{ready?"Ready":"Not configured"}</span></div>)}</div><p className="muted tutor-help">The local curriculum works without an API key. Configure one of the AI providers in the Node backend for broader answers.</p></aside>
      <section className="panel-card tutor-chat-card"><div className="tutor-messages">{messages.map((m,i)=><div key={i} className={`tutor-bubble-row ${m.role}`}><div className="tutor-bubble"><p>{m.content}</p>{m.provider&&<small>{m.provider}{m.latency?` · ${(m.latency/1000).toFixed(1)}s`:""}</small>}</div></div>)}{busy&&<div className="tutor-bubble-row assistant"><div className="tutor-bubble"><span className="muted">Thinking…</span></div></div>}<div ref={end}/></div>{error&&<div className="error-box">{error}</div>}<div className="tutor-composer"><textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}} placeholder="Ask a question…"/><button className="primary-btn" disabled={busy||!input.trim()} onClick={send}>Send</button></div></section>
    </div>
  </AppShell>;
}
export default function Page(){return <RequireAuth><Tutor/></RequireAuth>;}
