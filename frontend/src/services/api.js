import { clearAuthSession, getAuthHeaders, getAuthToken, rememberAuthReturnPath } from './auth';

export const API_BASE = (process.env.REACT_APP_API_BASE_URL || '/api').replace(/\/$/, '');

export function apiUrl(path = '') {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${normalized}`;
}

export class ApiError extends Error {
  constructor(message, status, data = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = 'Session expired. Please sign in again.', data = null) {
    super(message, 401, data);
    this.name = 'UnauthorizedError';
  }
}

async function readResponseBody(res) {
  if (res.status === 204) return null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return res.json().catch(() => null);
  }
  return res.text().catch(() => null);
}

// A server error page (HTML) or a long text body is never a readable message;
// surface a short status line instead of dumping markup into the UI.
function readableTextError(data, status) {
  if (typeof data !== 'string' || !data.trim()) return `Request failed (HTTP ${status}).`;
  const text = data.trim();
  if (/^<!doctype|<html[\s>]/i.test(text) || text.length > 300) {
    return `The server could not complete this request (HTTP ${status}). Please try again.`;
  }
  return text;
}

function errorMessage(data, status) {
  if (data && typeof data === 'object') {
    return data.error?.message || (typeof data.error === 'string' ? data.error : null) || `Request failed (HTTP ${status}).`;
  }
  return readableTextError(data, status);
}

export async function parseApiResponse(res, sentToken = getAuthToken()) {
  const data = await readResponseBody(res);
  if (res.status === 401) {
    if (sentToken && sentToken === getAuthToken()) clearAuthSession();
    throw new UnauthorizedError(errorMessage(data, 401), data);
  }
  if (!res.ok) {
    throw new ApiError(errorMessage(data, res.status), res.status, data);
  }
  return data;
}

export function apiFetch(path, options = {}, token = getAuthToken()) {
  const headers = getAuthHeaders(options.headers || {}, token);
  if (options.body instanceof FormData) delete headers['Content-Type'];
  return fetch(apiUrl(path), { ...options, headers });
}

const RETRYABLE_READ_STATUSES = new Set([500, 502, 503, 504]);
export const READ_RETRY_DELAY_MS = 400;

// Reads are safe to repeat, so one retry absorbs a momentary server or
// database-connection drop. Writes are never retried automatically.
async function fetchWithReadRetry(path, options, token) {
  const method = String(options.method || 'GET').toUpperCase();
  const retryable = method === 'GET' || method === 'HEAD';
  try {
    const res = await apiFetch(path, options, token);
    if (!retryable || !RETRYABLE_READ_STATUSES.has(res.status)) return res;
  } catch (networkError) {
    if (!retryable) throw networkError;
  }
  await new Promise((resolve) => setTimeout(resolve, READ_RETRY_DELAY_MS));
  return apiFetch(path, options, token);
}

export function isUnauthorizedError(error) {
  return error instanceof UnauthorizedError || error?.status === 401;
}

export async function apiJson(path, options = {}) {
  const sentToken = getAuthToken();
  const res = await fetchWithReadRetry(path, options, sentToken);
  try {
    return await parseApiResponse(res, sentToken);
  } catch (error) {
    if (isUnauthorizedError(error) && !getAuthToken() && options.redirectOnUnauthorized !== false
        && typeof window !== 'undefined' && window.location.pathname !== '/login') {
      rememberAuthReturnPath();
      window.location.assign('/login');
    }
    throw error;
  }
}
