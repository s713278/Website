const ACCESS_KEY = 'mithra_access_token';
const REFRESH_KEY = 'mithra_refresh_token';

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string | null) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* ignore SSR / private mode */
  }
}

export function getAccessToken(): string | null {
  return safeGet(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  return safeGet(REFRESH_KEY);
}

export function setTokens(access?: string | null, refresh?: string | null) {
  if (access !== undefined) safeSet(ACCESS_KEY, access);
  if (refresh !== undefined) safeSet(REFRESH_KEY, refresh);
}

export function clearTokens() {
  safeSet(ACCESS_KEY, null);
  safeSet(REFRESH_KEY, null);
}

export function parseTokenResponse(payload: unknown): {
  accessToken: string | null;
  refreshToken: string | null;
} {
  const root = (payload || {}) as Record<string, unknown>;
  const data =
    root.data && typeof root.data === 'object'
      ? (root.data as Record<string, unknown>)
      : {};

  const pickAccess = (obj: Record<string, unknown>) =>
    (obj.access_token as string | undefined) ||
    (obj.accessToken as string | undefined) ||
    (obj.token as string | undefined) ||
    null;
  const pickRefresh = (obj: Record<string, unknown>) =>
    (obj.refresh_token as string | undefined) ||
    (obj.refreshToken as string | undefined) ||
    null;

  return {
    accessToken: pickAccess(data) || pickAccess(root),
    refreshToken: pickRefresh(data) || pickRefresh(root),
  };
}
