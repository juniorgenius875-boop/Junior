"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { authApi, tokenStore } from "@/lib/api";

const AuthContext = createContext(null);

function normalizeUser(row) {
  if (!row) return null;
  return { uid: row.id || row.uid, id: row.id || row.uid, email: row.email || "" };
}
function normalizeProfile(row) {
  if (!row) return null;
  return { id: row.id || row.uid, uid: row.id || row.uid, email: row.email || "", role: row.role || "student", active: row.active !== false, name: row.name || row.profile?.name || "Student", ...(row.profile || {}) };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!tokenStore.getAccess() && !tokenStore.getRefresh()) { setUser(null); setProfile(null); setLoading(false); return null; }
    try {
      const row = await authApi.me();
      setUser(normalizeUser(row)); setProfile(normalizeProfile(row)); return row;
    } catch { tokenStore.clear(); setUser(null); setProfile(null); return null; }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); const handler = () => refresh(); window.addEventListener("auth:changed", handler); return () => window.removeEventListener("auth:changed", handler); }, [refresh]);

  const login = useCallback(async (email, password) => { const data = await authApi.login(email, password); tokenStore.set(data.access_token, data.refresh_token); setUser(normalizeUser(data.user)); setProfile(normalizeProfile(data.user)); return data; }, []);
  const register = useCallback(async (email, password, name) => { const data = await authApi.register(email, password, name); tokenStore.set(data.access_token, data.refresh_token); setUser(normalizeUser(data.user)); setProfile(normalizeProfile(data.user)); return data; }, []);
  const logout = useCallback(async () => { try { await authApi.logout(); } catch {} tokenStore.clear(); setUser(null); setProfile(null); }, []);

  const value = useMemo(() => ({ user, profile, loading, login, register, logout, refresh }), [user, profile, loading, login, register, logout, refresh]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() { return useContext(AuthContext); }
