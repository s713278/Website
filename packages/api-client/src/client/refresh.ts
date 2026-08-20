import axios from 'axios';
import { getApiBaseUrl, getClientConfig } from './config';
import { envelopeFailureStatus } from './errors';
import { clearTokens, getAccessToken, getRefreshToken, parseTokenResponse, setTokens } from './tokens';

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

function persistAccess(accessToken: string, refreshToken: string) {
  setTokens(accessToken, refreshToken);
  getClientConfig().onTokenRefreshed?.(accessToken);
}

async function doRefresh(refresh: string): Promise<string | null> {
  refreshing = true;
  try {
    const { baseURL, timeoutMs } = getClientConfig();
    const res = await axios.post(
      `${baseURL || getApiBaseUrl()}/v1/auth/refresh`,
      { refresh_token: refresh },
      {
        timeout: timeoutMs,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      },
    );

    if (envelopeFailureStatus(res.data) != null) {
      clearTokens();
      flushQueue(null, null);
      return null;
    }

    const parsed = parseTokenResponse(res.data);
    if (!parsed.accessToken) {
      flushQueue(null, null);
      return null;
    }

    persistAccess(parsed.accessToken, parsed.refreshToken ?? refresh);
    flushQueue(null, parsed.accessToken);
    return parsed.accessToken;
  } catch (error) {
    const status = axios.isAxiosError(error) ? error.response?.status : undefined;
    const isHardAuthFailure = status === 400 || status === 401 || status === 403;

    if (isHardAuthFailure) {
      clearTokens();
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

/**
 * Single-flight refresh — concurrent 401s in this tab wait on one refresh call.
 * Also uses a cross-tab Web Lock (when available) so multiple open tabs don't
 * both hit /v1/auth/refresh with the same refresh_token.
 */
export async function refreshAccessToken(): Promise<string | null> {
  const refresh = getRefreshToken();
  if (!refresh) {
    if (queue.length) flushQueue(null, null);
    return null;
  }

  if (refreshing) {
    return new Promise((resolve, reject) => {
      queue.push({ resolve, reject });
    });
  }

  if (typeof navigator !== 'undefined' && navigator.locks) {
    return navigator.locks.request('mithra-token-refresh', async () => {
      const latestRefresh = getRefreshToken();
      if (!latestRefresh) return null;
      if (latestRefresh !== refresh) {
        return getAccessToken();
      }
      return doRefresh(latestRefresh);
    });
  }

  return doRefresh(refresh);
}

export function isRefreshing() {
  return refreshing;
}
