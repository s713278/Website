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

/**
 * Update token store.
 * - `access` undefined → leave access unchanged; `null` → clear access
 * - `refresh` only written when a non-empty string is passed
 * - Passing `refresh: null` does NOT delete refresh (use clearTokens for full wipe)
 *   so login/rehydrate paths cannot accidentally kill silent refresh.
 */
export function setTokens(access?: string | null, refresh?: string | null) {
  if (access !== undefined) safeSet(ACCESS_KEY, access);
  if (typeof refresh === 'string' && refresh.length > 0) {
    safeSet(REFRESH_KEY, refresh);
  }
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
  const rawData = root.data;

  // /v1/auth/refresh returns data as the JWT string itself:
  // { success: true, data: "eyJhbGciOi..." }
  if (typeof rawData === 'string' && rawData.trim().length > 0) {
    const refreshFromRoot =
      (typeof root.refresh_token === 'string' && root.refresh_token) ||
      (typeof root.refreshToken === 'string' && root.refreshToken) ||
      null;
    return {
      accessToken: rawData.trim(),
      refreshToken: refreshFromRoot,
    };
  }

  const data =
    rawData && typeof rawData === 'object' ? (rawData as Record<string, unknown>) : {};

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
