import axios, {
  AxiosHeaders,
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';
import { getClientConfig } from './config';
import { ApiError, toApiError } from './errors';
import { refreshAccessToken } from './refresh';
import { getAccessToken } from './tokens';
import type { ApiEnvelope, RequestConfig } from './types';

type RetryConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
  skipAuth?: boolean;
  skipRefresh?: boolean;
};

let http: AxiosInstance | null = null;

function createHttp(): AxiosInstance {
  const { baseURL, timeoutMs } = getClientConfig();
  const instance = axios.create({
    baseURL,
    timeout: timeoutMs,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  });

  instance.interceptors.request.use((config: RetryConfig) => {
    if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
      const headers = AxiosHeaders.from(config.headers ?? {});
      headers.delete('Content-Type');
      config.headers = headers;
    }

    if (!config.skipAuth) {
      const token = getAccessToken();
      if (token) {
        config.headers = AxiosHeaders.from(config.headers ?? {});
        config.headers.set('Authorization', `Bearer ${token}`);
      }
    }
    return config;
  });

  instance.interceptors.response.use(
    (response) => response,
    async (error) => {
      const original = (error.config || {}) as RetryConfig;
      const status = error.response?.status;

      if (status === 401 && !original.skipAuth && !original.skipRefresh && !original._retry) {
        original._retry = true;
        const token = await refreshAccessToken();
        if (token) {
          original.headers = original.headers || {};
          original.headers.Authorization = `Bearer ${token}`;
          return instance.request(original);
        }
        getClientConfig().onUnauthorized?.();
      }

      return Promise.reject(toApiError(error, original.url));
    },
  );

  return instance;
}

/** Lazily (re)build axios when configureApiClient changes base URL */
export function getHttp(): AxiosInstance {
  if (!http) http = createHttp();
  return http;
}

export function resetHttpClient() {
  http = null;
}

function withFlags(config?: RequestConfig): AxiosRequestConfig {
  const next: AxiosRequestConfig & { skipAuth?: boolean; skipRefresh?: boolean } = {
    params: config?.params,
    signal: config?.signal,
    skipAuth: config?.skipAuth,
    skipRefresh: config?.skipRefresh,
  };
  if (config?.headers) {
    next.headers = config.headers;
  }
  return next;
}

export async function apiGet<T>(url: string, config?: RequestConfig): Promise<T> {
  try {
    const res = await getHttp().get<T>(url, withFlags(config));
    return res.data;
  } catch (error) {
    throw toApiError(error, url);
  }
}

export async function apiPost<T>(url: string, body?: unknown, config?: RequestConfig): Promise<T> {
  try {
    const res = await getHttp().post<T>(url, body, withFlags(config));
    return res.data;
  } catch (error) {
    throw toApiError(error, url);
  }
}

export async function apiPut<T>(url: string, body?: unknown, config?: RequestConfig): Promise<T> {
  try {
    const res = await getHttp().put<T>(url, body, withFlags(config));
    return res.data;
  } catch (error) {
    throw toApiError(error, url);
  }
}

export async function apiPatch<T>(url: string, body?: unknown, config?: RequestConfig): Promise<T> {
  try {
    const res = await getHttp().patch<T>(url, body, withFlags(config));
    return res.data;
  } catch (error) {
    throw toApiError(error, url);
  }
}

export async function apiDelete<T>(url: string, config?: RequestConfig): Promise<T> {
  try {
    const res = await getHttp().delete<T>(url, withFlags(config));
    return res.data;
  } catch (error) {
    throw toApiError(error, url);
  }
}

export function unwrapData<T>(envelope: ApiEnvelope<T> | T): T {
  if (envelope && typeof envelope === 'object' && 'data' in (envelope as object)) {
    return (envelope as ApiEnvelope<T>).data as T;
  }
  return envelope as T;
}

export async function apiRequest<T = unknown>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    auth?: boolean;
    headers?: Record<string, string>;
    signal?: AbortSignal;
    params?: Record<string, unknown>;
  } = {},
): Promise<T> {
  const method = (options.method || (options.body !== undefined ? 'POST' : 'GET')).toUpperCase();
  const config: RequestConfig = {
    skipAuth: options.auth === false,
    headers: options.headers,
    signal: options.signal,
    params: options.params,
  };

  try {
    switch (method) {
      case 'POST':
        return await apiPost<T>(path, options.body, config);
      case 'PUT':
        return await apiPut<T>(path, options.body, config);
      case 'PATCH':
        return await apiPatch<T>(path, options.body, config);
      case 'DELETE':
        return await apiDelete<T>(path, config);
      default:
        return await apiGet<T>(path, config);
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw toApiError(error, path);
  }
}
