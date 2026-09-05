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

/** Three base64url segments. Used to tell a bearer token from any other string. */
const JWT_PATTERN = /^[\w-]+\.[\w-]+\.[\w-]+$/;

/**
 * A bare token string, or `null` for anything else.
 *
 * Several endpoints put a plain string in `data` — go-live returns a sentence, refresh
 * returns the token itself. Only a JWT-shaped value is accepted so a success message
 * can never be stored as credentials.
 */
function asBearerToken(value: unknown): string | null {
  return typeof value === 'string' && JWT_PATTERN.test(value) ? value : null;
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
    // `POST /v1/auth/refresh` answers `{ success, status, data: "<jwt>" }` — the new
    // access token is the whole of `data`, not a field inside it, and no refresh token
    // comes back. Verified against the deployed API; the contract types it as a generic
    // APIResponseObject with no example, so the shape is not discoverable from OpenAPI.
    accessToken: pickAccess(data) || pickAccess(root) || asBearerToken(root.data),
    refreshToken: pickRefresh(data) || pickRefresh(root),
  };
}
