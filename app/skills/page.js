"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import RequireAuth from "@/components/RequireAuth";
import AppShell from "@/components/AppShell";
import { CardSkeleton } from "@/components/LoadingUI";
import { useAuth } from "@/components/AuthProvider";
import { SKILLS } from "@/lib/catalog";
import { DEFAULT_SETTINGS } from "@/lib/performance";
import { watchSettings, watchSkillProgress } from "@/lib/firestore";

const SkillRow = dynamic(() => import("@/components/SkillRow"), { loading: () => <CardSkeleton /> });

function SkillsContent() {
  const { user } = useAuth();
  const [progress, setProgress] = useState({});
  const [remoteSettings, setRemoteSettings] = useState(null);
  const [subject, setSubject] = useState("All");
  const settings = useMemo(() => ({ ...DEFAULT_SETTINGS, ...(remoteSettings || {}) }), [remoteSettings]);

  useEffect(() => {
    if (!user?.uid) return;
    const stop1 = watchSkillProgress(user.uid, setProgress);
    const stop2 = watchSettings(setRemoteSettings);
    return () => { stop1(); stop2(); };
  }, [user?.uid]);

  const rows = subject === "All" ? SKILLS : SKILLS.filter((skill) => skill.subject === subject);
  const subjects = ["All", ...new Set(SKILLS.map((skill) => skill.subject))];

  return (
    <AppShell title="Skill tracker">
      <div className="filter-chips standalone horizontal-scroll-chips">{subjects.map((item) => <button key={item} className={subject === item ? "filter-chip active" : "filter-chip"} onClick={() => setSubject(item)}>{item}</button>)}</div>
      <div className="skill-grid">
        {rows.map((skill) => <SkillRow key={skill.id} uid={user.uid} skill={skill} saved={progress[skill.id]} settings={settings} />)}
      </div>
    </AppShell>
  );
}

export default function SkillsPage() {
  return <RequireAuth><SkillsContent /></RequireAuth>;
}
