"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import Icon from "@/components/Icons";

export default function LoginPage() {
  const router=useRouter();
  const {user,profile,loading,login,register}=useAuth();
  const [mode,setMode]=useState("login"),[name,setName]=useState(""),[email,setEmail]=useState(""),[password,setPassword]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");

  useEffect(()=>{if(!loading&&user&&profile)router.replace(profile.role==="admin"?"/admin":"/dashboard");},[loading,user,profile,router]);

  async function submit(e){
    e.preventDefault();setBusy(true);setError("");
    try{if(mode==="register")await register(email.trim(),password,name.trim());else await login(email.trim(),password);}
    catch(err){setError(err?.message||"Unable to continue.");}
    finally{setBusy(false);}
  }

  return <main className="auth-page auth-page-modern">
    <section className="auth-hero auth-hero-modern">
      <div className="auth-hero-glow one"/><div className="auth-hero-glow two"/>
      <div className="auth-brand"><span className="brand-logo"><Icon name="bolt" size={19}/></span><span><strong>BoardTrack</strong><small>Study + Junior AI</small></span></div>
      <div className="auth-hero-content">
        <span className="auth-badge"><Icon name="spark" size={14}/> Built for a complete academic year</span>
        <h1>Plan better. Practice smarter. See progress clearly.</h1>
        <p>Your study plan, chapter tracking, mock tests, adaptive assessments and Junior AI support now work from one MongoDB-backed student profile.</p>
        <div className="auth-feature-grid">
          <div><span><Icon name="calendar" size={18}/></span><strong>Year planner</strong><small>Three-cut chapter schedule</small></div>
          <div><span><Icon name="brain" size={18}/></span><strong>Adaptive tests</strong><small>Practice at your level</small></div>
          <div><span><Icon name="chart" size={18}/></span><strong>Performance AI</strong><small>Prediction and risk signals</small></div>
          <div><span><Icon name="chat" size={18}/></span><strong>AI Tutor</strong><small>Help when you need it</small></div>
        </div>
      </div>
      <div className="auth-proof"><span className="auth-proof-icon"><Icon name="shield" size={18}/></span><p><strong>One secure student account</strong><small>Your study plan, tests, profile and Junior AI progress stay connected through the same backend.</small></p></div>
    </section>

    <section className="auth-form-side">
      <div className="auth-card auth-card-modern">
        <div className="auth-mobile-brand"><span className="brand-logo"><Icon name="bolt" size={18}/></span><strong>BoardTrack</strong></div>
        <span className="section-kicker">{mode==="login"?"Welcome back":"Get started"}</span>
        <h2>{mode==="login"?"Sign in to your workspace":"Create student account"}</h2>
        <p className="muted">One login for Study Tracker and Junior Genius.</p>
        <form onSubmit={submit} className="stack-form modern-stack-form">
          {mode==="register"&&<label>Student name<div className="input-shell"><Icon name="user" size={17}/><input value={name} onChange={e=>setName(e.target.value)} required placeholder="Student name"/></div></label>}
          <label>Email<div className="input-shell"><span className="at-icon">@</span><input type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="student@example.com"/></div></label>
          <label>Password<div className="input-shell"><Icon name="shield" size={17}/><input type="password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={6} placeholder="Minimum 6 characters"/></div></label>
          {error&&<div className="error-box">{error}</div>}
          <button className="primary-btn auth-submit" disabled={busy}>{busy?"Please wait…":mode==="login"?"Sign in":"Create account"}<Icon name="arrow" size={17}/></button>
        </form>
        <div className="auth-switch"><span>{mode==="login"?"New student?":"Already registered?"}</span><button className="text-btn" onClick={()=>{setMode(mode==="login"?"register":"login");setError("");}}>{mode==="login"?"Create an account":"Sign in"}</button></div>
      </div>
    </section>
  </main>;
}
