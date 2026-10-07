"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { SUBJECT_ORDER, SUBJECTS } from "@/lib/catalog";
import { DEFAULT_SETTINGS, dashboardMetrics } from "@/lib/performance";
import { watchChapterProgress, watchSettings } from "@/lib/firestore";

export function useTracker(forUid = null) {
  const { user } = useAuth();
  const uid = forUid || user?.uid;
  const [progress, setProgress] = useState({});
  const [settingsRemote, setSettingsRemote] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!uid) return undefined;
    const stopProgress = watchChapterProgress(uid, (rows) => {
      setProgress(rows);
      setReady(true);
    });
    const stopSettings = watchSettings(setSettingsRemote);
    return () => {
      stopProgress();
      stopSettings();
    };
  }, [uid]);

  const settings = useMemo(
    () => ({ ...DEFAULT_SETTINGS, ...(settingsRemote || {}) }),
    [settingsRemote],
  );

  const subjects = useMemo(() => SUBJECT_ORDER.map((slug) => SUBJECTS[slug]), []);
  const dashboard = useMemo(
    () => dashboardMetrics(subjects, progress, settings),
    [subjects, progress, settings],
  );

  return { uid, progress, settings, subjects, dashboard, ready };
}
