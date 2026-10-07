"use client";

import { apiRequest } from "@/lib/api";

const CHANGE_EVENT = "boardtrack:data-changed";
const changed = () => typeof window !== "undefined" && window.dispatchEvent(new Event(CHANGE_EVENT));
function poll(loader, callback, ms = 12000) {
  let alive = true;
  const run = async () => { try { const data = await loader(); if (alive) callback(data); } catch (error) { if (alive) console.error(error); } };
  run();
  const id = setInterval(run, ms);
  const onChange = () => run();
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => { alive = false; clearInterval(id); window.removeEventListener(CHANGE_EVENT, onChange); };
}
const q = uid => `?userId=${encodeURIComponent(uid)}`;
function localDateKey(date = new Date()) { const y=date.getFullYear(),m=String(date.getMonth()+1).padStart(2,"0"),d=String(date.getDate()).padStart(2,"0"); return `${y}-${m}-${d}`; }
function activityRows(rows=[]) { return rows.map(item=>{const storedStatus=item.status||"NOT_STARTED";const overdue=item.scheduledDate&&String(item.scheduledDate)<localDateKey();const status=!['COMPLETED','IN_PROGRESS','MISSED'].includes(storedStatus)&&overdue?'PENDING':storedStatus;return{...item,storedStatus,status};}).sort((a,b)=>String(a.scheduledDate||'').localeCompare(String(b.scheduledDate||''))||String(a.startTime||'').localeCompare(String(b.startTime||''))); }

export async function ensureUserProfile(user) { return getUserProfile(user.uid); }
export async function getUserProfile(uid) { return apiRequest(`/api/study/users/${uid}`); }
export function watchUserProfile(uid, cb) { return poll(()=>getUserProfile(uid),cb); }
export function watchUsers(cb) { return poll(()=>apiRequest('/api/study/users'),cb); }
export function watchChapterProgress(uid, cb) { return poll(async()=>{const rows=await apiRequest(`/api/study/chapter-progress${q(uid)}`);return Object.fromEntries(rows.map(r=>[r.chapterId,r]));},cb); }
export function watchAllChapterProgress(cb) { return poll(async()=>{const rows=await apiRequest('/api/study/chapter-progress/all');const out={};for(const r of rows){out[r.userId]??={};out[r.userId][r.chapterId]=r;}return out;},cb); }
export function watchAllStudyActivities(cb) { return poll(async()=>activityRows(await apiRequest('/api/study/activities/all')),cb); }
export function watchAllMockTests(cb) { return poll(()=>apiRequest('/api/study/mock-tests/all'),cb); }
export async function addChapterStageActivity(uid, chapter, subjectSlug, stageKey, values={}) { const r=await apiRequest('/api/study/chapter-stage',{method:'POST',body:JSON.stringify({userId:uid,chapterId:chapter.id,chapterTitle:chapter.title,subjectSlug,stageKey,values})});changed();return r; }
export async function saveChapterProgress(uid, chapter, subjectSlug, values) { const r=await apiRequest(`/api/study/chapter-progress/${encodeURIComponent(chapter.id)}`,{method:'PUT',body:JSON.stringify({userId:uid,chapterTitle:chapter.title,subjectSlug,values})});changed();return r; }
export async function assignChapterStageTask(uid, chapter, subjectSlug, stageKey, values={}) { const r=await apiRequest('/api/study/chapter-stage/assign',{method:'POST',body:JSON.stringify({userId:uid,chapterId:chapter.id,chapterTitle:chapter.title,subjectSlug,stageKey,values})});changed();return r; }
export async function syncExistingChapterPlansToTimetable(uid) { const r=await apiRequest('/api/study/chapter-progress/sync',{method:'POST',body:JSON.stringify({userId:uid})});changed();return r; }
export function watchSkillProgress(uid, cb) { return poll(async()=>{const rows=await apiRequest(`/api/study/skills${q(uid)}`);return Object.fromEntries(rows.map(r=>[r.skillId,r]));},cb); }
export async function saveSkillProgress(uid, skill, values) { const r=await apiRequest(`/api/study/skills/${encodeURIComponent(skill.id)}`,{method:'PUT',body:JSON.stringify({userId:uid,subject:skill.subject,skillName:skill.name,values})});changed();return r; }
export function watchMockTests(uid, cb) { return poll(()=>apiRequest(`/api/study/mock-tests${q(uid)}`),cb); }
export async function addMockTest(uid, values) { const r=await apiRequest('/api/study/mock-tests',{method:'POST',body:JSON.stringify({userId:uid,values})});changed();return r; }
export async function deleteMockTest(uid,id) { const r=await apiRequest(`/api/study/mock-tests/${id}`,{method:'DELETE'});changed();return r; }
export function watchSettings(cb) { return poll(()=>apiRequest('/api/study/settings'),cb,30000); }
export async function saveSettings(values) { const r=await apiRequest('/api/study/settings',{method:'PUT',body:JSON.stringify(values)});changed();return r; }
export function watchStudyActivities(uid, cb) { return poll(async()=>activityRows(await apiRequest(`/api/study/activities${q(uid)}`)),cb); }
export async function addStudyActivity(uid,values) { const r=await apiRequest('/api/study/activities',{method:'POST',body:JSON.stringify({userId:uid,values})});changed();return r; }
export async function updateStudyActivity(uid,id,values) { const r=await apiRequest(`/api/study/activities/${id}`,{method:'PATCH',body:JSON.stringify({values})});changed();return r; }
export async function updateStudyActivityStatus(uid,id,status) { const r=await apiRequest(`/api/study/activities/${id}/status`,{method:'PATCH',body:JSON.stringify({status})});changed();return r; }
export async function deleteStudyActivity(uid,id) { try{const r=await apiRequest(`/api/study/activities/${id}`,{method:'DELETE'});changed();return r;}catch(error){if(!String(error.message).includes('Chapter plan'))throw error;} }
export function watchVocabulary(uid,cb) { return poll(()=>apiRequest(`/api/study/vocabulary${q(uid)}`),cb); }
export async function addVocabularyWord(uid,values) { const r=await apiRequest('/api/study/vocabulary',{method:'POST',body:JSON.stringify({userId:uid,values})});changed();return r; }
export async function updateVocabularyWord(uid,id,values) { const r=await apiRequest(`/api/study/vocabulary/${id}`,{method:'PATCH',body:JSON.stringify({values})});changed();return r; }
export async function deleteVocabularyWord(uid,id) { const r=await apiRequest(`/api/study/vocabulary/${id}`,{method:'DELETE'});changed();return r; }
export async function updateUserProfile(uid,values) { const r=await apiRequest(`/api/study/users/${uid}`,{method:'PATCH',body:JSON.stringify(values)});changed();return r; }
