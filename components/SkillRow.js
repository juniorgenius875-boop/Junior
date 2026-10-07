"use client";

import { useEffect, useMemo, useState } from "react";
import { saveSkillProgress } from "@/lib/firestore";
import { skillMetrics } from "@/lib/performance";
import { pp, statusTone } from "@/lib/format";

export default function SkillRow({ uid, skill, saved, settings }) {
  const [form, setForm] = useState({ test1: "", test2: "", test3: "", notes: "", ...(saved || {}) });
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);

  useEffect(() => setForm({ test1: "", test2: "", test3: "", notes: "", ...(saved || {}) }), [saved]);
  const metrics = useMemo(() => skillMetrics(form, settings), [form, settings]);

  function change(key, value) {
    setSavedMsg(false);
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    setSaving(true);
    try {
      const values = { ...form };
      ["test1", "test2", "test3"].forEach((key) => {
        values[key] = values[key] === "" || values[key] === null ? null : Math.max(0, Math.min(100, Number(values[key])));
      });
      await saveSkillProgress(uid, skill, values);
      setSavedMsg(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="skill-row-card">
      <div className="skill-row-head">
        <div><small>{skill.subject}</small><strong>{skill.name}</strong></div>
        <div className="skill-result"><span className={`pill ${statusTone(metrics.status)}`}>{metrics.status}</span><strong>{metrics.latest === null ? "—" : `${Math.round(metrics.latest)}%`}</strong></div>
      </div>
      <div className="score-inputs">
        {[1,2,3].map((n) => <label key={n}>Test {n}<input type="number" min="0" max="100" inputMode="decimal" value={form[`test${n}`] ?? ""} onChange={(e) => change(`test${n}`, e.target.value)} placeholder="%" /></label>)}
      </div>
      <textarea rows="2" value={form.notes || ""} onChange={(e) => change("notes", e.target.value)} placeholder="Notes / improvement action" />
      <div className="skill-row-footer"><small>{metrics.trend === null ? `Target ${skill.target}%` : `Trend ${pp(metrics.trend)}`}</small><div>{savedMsg && <span className="save-ok">Saved</span>} <button onClick={save} disabled={saving} className="secondary-btn compact">{saving ? "Saving…" : "Save"}</button></div></div>
    </div>
  );
}
