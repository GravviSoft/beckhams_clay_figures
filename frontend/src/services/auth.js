// Authentication session transport.
//
// The bearer token is the only value kept in browser storage. It is a documented
// exception to the Production State Rule (see docs/architecture/decisions/003):
// business records, workflow state, and preferences never go in browser storage.
const TOKEN_KEY = 'auth_token';
const RETURN_PATH_KEY = 'auth_return_path';

export function getAuthToken() {
  try {
    return window.localStorage.getItem(TOKEN_KEY) || null;
  } catch {
    return null;
  }
}

export function setAuthToken(token) {
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Storage blocked: the session lasts only for this page load.
  }
}

export function clearAuthSession() {
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Nothing to clear.
  }
}

export function isAuthenticated() {
  return Boolean(getAuthToken());
}

export function getAuthHeaders(headers = {}) {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...headers,
  };
}

// Navigation-only and consumed immediately after sign-in.
export function rememberAuthReturnPath(path = window.location.pathname) {
  try {
    if (path && path !== '/login') window.sessionStorage.setItem(RETURN_PATH_KEY, path);
  } catch {
    // Optional convenience only.
  }
}

export function consumeAuthReturnPath(fallback = '/') {
  try {
    const path = window.sessionStorage.getItem(RETURN_PATH_KEY);
    window.sessionStorage.removeItem(RETURN_PATH_KEY);
    return path || fallback;
  } catch {
    return fallback;
  }
}
