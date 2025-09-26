// Centralized API base resolution
// Prefer build-time override; do NOT default to window.location.origin to avoid GitHub Pages relative requests.
export const API_BASE = (process.env.REACT_APP_API_BASE_URL && process.env.REACT_APP_API_BASE_URL.replace(/\/$/, '')) || '';
export const FALLBACK_API_BASE = process.env.REACT_APP_FALLBACK_API_BASE || 'http://localhost:3001';

export function buildUrl(path: string, useFallbackIfEmpty = true) {
  if (!path.startsWith('/')) path = '/' + path;
  if (API_BASE) return API_BASE + path;
  return useFallbackIfEmpty ? FALLBACK_API_BASE + path : path;
}

export function tryFetchWithFallback(path: string, opts?: RequestInit) {
  const primary = API_BASE ? API_BASE + (path.startsWith('/') ? path : '/' + path) : '';
  const fallback = FALLBACK_API_BASE + (path.startsWith('/') ? path : '/' + path);
  if (!primary) return fetch(fallback, opts);
  return fetch(primary, opts).catch((err) => {
    console.warn('tryFetchWithFallback: primary failed, trying fallback', err && err.message ? err.message : err);
    return fetch(fallback, opts);
  });
}
