"use client";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9010";
const ACCESS_KEY = "boardtrack_access_token";
const REFRESH_KEY = "boardtrack_refresh_token";

export const tokenStore = {
  getAccess: () => typeof window === "undefined" ? null : localStorage.getItem(ACCESS_KEY),
  getRefresh: () => typeof window === "undefined" ? null : localStorage.getItem(REFRESH_KEY),
  set(access, refresh) {
    if (typeof window === "undefined") return;
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
    window.dispatchEvent(new Event("auth:changed"));
  },
  clear() {
    if (typeof window === "undefined") return;
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    window.dispatchEvent(new Event("auth:changed"));
  },
};

async function parseResponse(response) {
  const type = response.headers.get("content-type") || "";
  if (type.includes("application/json")) return response.json();
  const text = await response.text();
  try { return JSON.parse(text); } catch { return text || null; }
}

async function refreshTokens() {
  const refresh = tokenStore.getRefresh();
  if (!refresh) return false;
  const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: refresh }),
  });
  if (!response.ok) { tokenStore.clear(); return false; }
  const data = await response.json();
  tokenStore.set(data.access_token, data.refresh_token);
  return true;
}

export async function apiRequest(path, options = {}, retry = true) {
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const token = tokenStore.getAccess();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  if (response.status === 401 && retry && tokenStore.getRefresh()) {
    if (await refreshTokens()) return apiRequest(path, options, false);
  }
  const data = await parseResponse(response);
  if (!response.ok) throw new Error(data?.message || data?.detail || "Request failed");
  return data;
}

export async function apiDownload(path, fallbackName = "report.pdf") {
  const headers = new Headers();
  const token = tokenStore.getAccess();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API_BASE_URL}${path}`, { headers });
  if (response.status === 401 && tokenStore.getRefresh() && await refreshTokens()) return apiDownload(path, fallbackName);
  if (!response.ok) throw new Error("Could not export report");
  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") || "";
  const match = disposition.match(/filename="?([^";]+)"?/i);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = match?.[1] || fallbackName; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

export const authApi = {
  register: (email, password, name) => apiRequest("/api/auth/register", { method: "POST", body: JSON.stringify({ email, password, name }) }, false),
  login: (email, password) => apiRequest("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }, false),
  me: () => apiRequest("/api/auth/me"),
  logout: () => apiRequest("/api/auth/logout", { method: "POST" }),
};
export const profileApi = {
  get: () => apiRequest("/api/profile"),
  update: profile => apiRequest("/api/profile", { method: "PUT", body: JSON.stringify(profile) }),
  stats: () => apiRequest("/api/profile/stats"),
};
export const predictionApi = {
  predict: payload => apiRequest("/api/predictions/predict", { method: "POST", body: JSON.stringify(payload) }),
  recommend: payload => apiRequest("/api/predictions/recommend", { method: "POST", body: JSON.stringify(payload) }),
};
export const progressApi = {
  list: (limit = 100) => apiRequest(`/api/progress?limit=${limit}`),
  latest: () => apiRequest("/api/progress/latest"),
  save: payload => apiRequest("/api/progress", { method: "POST", body: JSON.stringify(payload) }),
};
export const testsApi = {
  list: (limit = 50) => apiRequest(`/api/tests/results?limit=${limit}`),
  save: payload => apiRequest("/api/tests/results", { method: "POST", body: JSON.stringify(payload) }),
};
export const aiApi = {
  providers: () => apiRequest("/api/ai/providers"),
  chat: message => apiRequest("/api/ai/chat", { method: "POST", body: JSON.stringify({ message }) }),
  generateTest: payload => apiRequest("/api/ai/tests/generate", { method: "POST", body: JSON.stringify(payload) }),
  analyzeTest: payload => apiRequest("/api/ai/tests/analyze", { method: "POST", body: JSON.stringify(payload) }),
  studyPlan: payload => apiRequest("/api/ai/study-plan", { method: "POST", body: JSON.stringify(payload) }),
  evaluateAnswer: payload => apiRequest("/api/ai/evaluate-answer", { method: "POST", body: JSON.stringify(payload) }),
};
export const reportApi = {
  mine: () => apiRequest("/api/reports/me"),
  downloadMine: () => apiDownload("/api/reports/me.pdf", "student-learning-report.pdf"),
};
export const adminApi = {
  dashboard: (date = "") => apiRequest(`/api/admin/dashboard${date ? `?date=${encodeURIComponent(date)}` : ""}`),
  learningDashboard: (range = "1m") => apiRequest(`/api/admin/learning-dashboard?range=${encodeURIComponent(range)}`),
  overview: () => apiRequest("/api/admin/overview"),
  users: ({ search = "", page = 1, limit = 20, role = "student" } = {}) => apiRequest(`/api/admin/users?${new URLSearchParams({ search, page: String(page), limit: String(limit), role })}`),
  user: id => apiRequest(`/api/admin/users/${id}`),
  activity: (limit = 50) => apiRequest(`/api/admin/activity?limit=${limit}`),
  studentsReport: () => apiRequest("/api/admin/report/students"),
  downloadStudents: () => apiDownload("/api/admin/report/students.pdf", "boardtrack-junior-students-report.pdf"),
  downloadStudent: id => apiDownload(`/api/admin/report/users/${id}.pdf`, "student-learning-report.pdf"),
};
