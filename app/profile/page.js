"use client";

import { useEffect, useState } from "react";
import RequireAuth from "@/components/RequireAuth";
import AppShell from "@/components/AppShell";
import StatCard from "@/components/StatCard";
import Icon from "@/components/Icons";
import { useAuth } from "@/components/AuthProvider";
import { profileApi, progressApi, reportApi, testsApi } from "@/lib/api";

const empty={name:"",grade:"",school:"",favorite_subject:"",dream_job:"",hobbies:""};

function Profile(){
 const{profile:authProfile,refresh}=useAuth();
 const[form,setForm]=useState(empty),[stats,setStats]=useState({}),[latest,setLatest]=useState(null),[tests,setTests]=useState([]),[editing,setEditing]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 useEffect(()=>{Promise.all([profileApi.get(),profileApi.stats(),progressApi.latest(),testsApi.list(8)]).then(([p,s,l,t])=>{setForm({...empty,...p});setStats(s||{});setLatest(l);setTests(t||[]);});},[]);
 async function save(){setBusy(true);setMessage("");try{const p=await profileApi.update(form);setForm({...empty,...p});await refresh();setEditing(false);setMessage("Profile saved.");}catch(e){setMessage(e.message||"Could not save profile");}finally{setBusy(false);}}
 const initial=String(form.name||authProfile?.email||"S").trim().charAt(0).toUpperCase();
 return <AppShell title="Profile & Report" subtitle={authProfile?.email||"Student account"} actions={<button className="secondary-btn compact" onClick={()=>reportApi.downloadMine()}><Icon name="clipboard" size={16}/> Download report</button>}>
  <section className="profile-hero-card">
    <div className="profile-avatar-xl">{initial}</div>
    <div className="profile-hero-copy"><span className="section-kicker">Student profile</span><h2>{form.name||"Student"}</h2><p>{form.school||"School not added"} · {form.grade||"Grade not added"}</p><div className="profile-badge-row"><span><Icon name="target" size={14}/>{form.favorite_subject||"Add favorite subject"}</span><span><Icon name="spark" size={14}/>{form.dream_job||"Add a dream goal"}</span></div></div>
    <button className="secondary-btn profile-edit-btn" onClick={()=>setEditing(v=>!v)}>{editing?"Cancel edit":"Edit profile"}</button>
  </section>

  <section className="stats-grid four compact-stats modern-stats-grid">
    <StatCard label="Tests completed" value={stats.totalTests||0} icon="clipboard"/>
    <StatCard label="Average score" value={`${stats.averageScore||0}%`} tone="blue" icon="chart"/>
    <StatCard label="Best score" value={`${stats.bestScore||0}%`} tone="success" icon="trophy"/>
    <StatCard label="Junior level" value={stats.level||1} tone="purple" icon="spark"/>
  </section>

  <div className="dashboard-grid profile-study-grid dashboard-grid-modern">
    <section className="panel-card modern-panel">
      <div className="section-heading section-heading-modern"><div><span className="section-kicker">About you</span><h2>Student information</h2></div></div>
      {editing?<div className="form-grid two profile-form-grid">{[["Name","name"],["Grade","grade"],["School","school"],["Favorite subject","favorite_subject"],["Dream job","dream_job"],["Hobbies","hobbies"]].map(([label,key])=><label key={key}>{label}<input value={form[key]} onChange={e=>setForm({...form,[key]:e.target.value})}/></label>)}<div className="profile-form-action"><button className="primary-btn" onClick={save} disabled={busy}>{busy?"Saving…":"Save profile"}</button></div></div>:<div className="profile-info-study profile-info-modern">{[["Name",form.name,"user"],["Grade",form.grade,"school"],["School",form.school,"school"],["Favorite subject",form.favorite_subject,"book"],["Dream job",form.dream_job,"target"],["Hobbies",form.hobbies,"spark"]].map(([l,v,icon])=><div key={l}><span className="profile-info-icon"><Icon name={icon} size={16}/></span><span>{l}</span><strong>{v||"—"}</strong></div>)}</div>}
      {message&&<div className={message.includes("saved")?"success-note":"error-box"}>{message}</div>}
    </section>
    <section className="panel-card modern-panel">
      <div className="section-heading section-heading-modern"><div><span className="section-kicker">AI snapshot</span><h2>Latest performance AI</h2></div></div>
      {latest?<div className="performance-snapshot-grid"><div><span>Predicted marks</span><strong>{latest.total_predicted_marks??"—"}</strong></div><div><span>Risk</span><strong>{latest.risk_level||"—"}</strong></div><div><span>Attendance</span><strong>{latest.attendance!=null?`${latest.attendance}%`:"—"}</strong></div><div><span>Daily study</span><strong>{latest.study_hours!=null?`${latest.study_hours} h`:"—"}</strong></div></div>:<div className="empty-state compact-empty"><strong>No saved AI analysis yet</strong><p>Run Performance AI to build your first prediction.</p></div>}
    </section>
  </div>

  <section className="panel-card profile-tests-study modern-panel"><div className="section-heading section-heading-modern"><div><span className="section-kicker">History</span><h2>Recent adaptive tests</h2></div></div>{tests.length?<div className="test-details-table modern-table"><div className="test-details-row header"><span>Date</span><span>Assessment</span><span>Difficulty</span><span>Score</span><span>Percentage</span></div>{tests.map(t=>{const p=t.total_marks?Math.round(t.score/t.total_marks*100):0;return <div className="test-details-row" key={t.id}><span data-label="Date">{t.createdAt?new Date(t.createdAt).toLocaleDateString():"—"}</span><span data-label="Assessment">{t.test_type}</span><span data-label="Difficulty">{t.difficulty}</span><strong data-label="Score">{t.score}/{t.total_marks}</strong><strong data-label="Percentage" className="score-cell">{p}%</strong></div>;})}</div>:<div className="empty-state compact-empty"><strong>No adaptive tests yet</strong></div>}</section>
 </AppShell>;
}
export default function Page(){return <RequireAuth><Profile/></RequireAuth>;}
