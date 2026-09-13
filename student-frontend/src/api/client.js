import { API_BASE_URL } from '../config';

const ACCESS_KEY = 'junior_genius_access_token';
const REFRESH_KEY = 'junior_genius_refresh_token';

export const tokenStore = {
  getAccess: () => localStorage.getItem(ACCESS_KEY),
  getRefresh: () => localStorage.getItem(REFRESH_KEY),
  set: (accessToken, refreshToken) => {
    localStorage.setItem(ACCESS_KEY, accessToken);
    localStorage.setItem(REFRESH_KEY, refreshToken);
  },
  clear: () => {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

async function parseResponse(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function refreshAccessToken() {
  const refreshToken = tokenStore.getRefresh();
  if (!refreshToken) return false;

  const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!response.ok) {
    tokenStore.clear();
    window.dispatchEvent(new Event('auth:changed'));
    return false;
  }

  const data = await response.json();
  tokenStore.set(data.access_token, data.refresh_token);
  return true;
}

export async function apiRequest(path, options = {}, retry = true) {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }

  const accessToken = tokenStore.getAccess();
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  let response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });

  if (response.status === 401 && retry && tokenStore.getRefresh()) {
    const refreshed = await refreshAccessToken();
    if (refreshed) return apiRequest(path, options, false);
  }

  const data = await parseResponse(response);
  if (!response.ok) {
    const message = data?.detail || data?.message || (typeof data === 'string' ? data : 'Request failed');
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return data;
}

export const authApi = {
  register: (email, password, name = '') => apiRequest('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, name }),
  }, false),
  login: (email, password) => apiRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  }, false),
  me: () => apiRequest('/api/auth/me'),
  logout: () => apiRequest('/api/auth/logout', { method: 'POST' }),
};

export const profileApi = {
  get: () => apiRequest('/api/profile'),
  update: (profile) => apiRequest('/api/profile', { method: 'PUT', body: JSON.stringify(profile) }),
  stats: () => apiRequest('/api/profile/stats'),
};

export const progressApi = {
  list: (limit = 100) => apiRequest(`/api/progress?limit=${limit}`),
  latest: () => apiRequest('/api/progress/latest'),
  save: (payload) => apiRequest('/api/progress', { method: 'POST', body: JSON.stringify(payload) }),
};

export const predictionApi = {
  predict: (payload) => apiRequest('/api/predictions/predict', { method: 'POST', body: JSON.stringify(payload) }),
  recommend: (payload) => apiRequest('/api/predictions/recommend', { method: 'POST', body: JSON.stringify(payload) }),
};

export const testsApi = {
  saveResult: (payload) => apiRequest('/api/tests/results', { method: 'POST', body: JSON.stringify(payload) }),
  listResults: (limit = 50) => apiRequest(`/api/tests/results?limit=${limit}`),
};

export const aiApi = {
  chat: (message) => apiRequest('/api/ai/chat', { method: 'POST', body: JSON.stringify({ message }) }),
  generateTest: (payload) => apiRequest('/api/ai/tests/generate', { method: 'POST', body: JSON.stringify(payload) }),
  analyzeTest: (payload) => apiRequest('/api/ai/tests/analyze', { method: 'POST', body: JSON.stringify(payload) }),
};
