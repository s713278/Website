import axios from 'axios';
import { getApiBaseUrl, getClientConfig } from './config';
import { clearTokens, getRefreshToken, parseTokenResponse, setTokens } from './tokens';

type QueueItem = {
  resolve: (token: string | null) => void;
  reject: (error: unknown) => void;
};

let refreshing = false;
let queue: QueueItem[] = [];

function flushQueue(error: unknown, token: string | null) {
  queue.forEach((item) => {
    if (error) item.reject(error);
    else item.resolve(token);
  });
  queue = [];
}

/**
 * Single-flight refresh — concurrent 401s wait on one refresh call.
 */
export async function refreshAccessToken(): Promise<string | null> {
  const refresh = getRefreshToken();
  if (!refresh) {
    clearTokens();
    return null;
  }

  if (refreshing) {
    return new Promise((resolve, reject) => {
      queue.push({ resolve, reject });
    });
  }

  refreshing = true;
  try {
    const { baseURL, timeoutMs } = getClientConfig();
    const res = await axios.post(
      `${baseURL || getApiBaseUrl()}/v1/auth/refresh`,
      { refresh_token: refresh },
      {
        timeout: timeoutMs,
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      },
    );

    const parsed = parseTokenResponse(res.data);
    if (!parsed.accessToken) {
      // The server accepted the refresh, so the credentials are alive; we simply did not
      // recognize the payload. Clearing here would destroy a refresh token that still
      // works — which is exactly how an unannounced response-shape change turns into a
      // silent logout. Fail this attempt instead and let the next 401 try again.
      // Falls through to the catch below, which treats it as a transient failure.
      // `toApiError` surfaces this message to the user when it looks UI-safe, so it is
      // written for a vendor; the technical detail rides along in `cause`.
      const error = new Error('Could not refresh your session. Please try again.');
      error.cause = 'auth/refresh returned no recognizable access token';
      throw error;
    }

    setTokens(parsed.accessToken, parsed.refreshToken ?? refresh);
    flushQueue(null, parsed.accessToken);
    return parsed.accessToken;
  } catch (error) {
    const status = axios.isAxiosError(error) ? error.response?.status : undefined;
    const isHardAuthFailure = status === 400 || status === 401 || status === 403;

    if (isHardAuthFailure) {
      clearTokens();
      // Resolve null so callers handle logout once (http interceptor calls onUnauthorized).
      flushQueue(null, null);
      return null;
    }

    // Transient failures (network/5xx/timeouts) should not force logout.
    flushQueue(error, null);
    throw error;
  } finally {
    refreshing = false;
  }
}

export function isRefreshing() {
  return refreshing;
}
