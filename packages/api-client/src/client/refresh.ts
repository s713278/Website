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
      clearTokens();
      flushQueue(null, null);
      return null;
    }

    setTokens(parsed.accessToken, parsed.refreshToken ?? refresh);
    flushQueue(null, parsed.accessToken);
    return parsed.accessToken;
  } catch (error) {
    clearTokens();
    // Resolve null so callers handle logout once (http interceptor calls onUnauthorized).
    flushQueue(null, null);
    return null;
  } finally {
    refreshing = false;
  }
}

export function isRefreshing() {
  return refreshing;
}
