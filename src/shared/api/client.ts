import { getClientConfig } from './config'
import { apiErrorFromResponse, toApiError } from './errors'
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  parseTokenResponse,
  setTokens,
} from './tokens'
import type { ApiEnvelope, RequestConfig } from './types'

type InternalFlags = {
  skipAuth?: boolean
  skipRefresh?: boolean
  _retry?: boolean
}

function buildUrl(path: string, params?: RequestConfig['params']): string {
  const { baseURL } = getClientConfig()
  const normalized = path.startsWith('http')
    ? path
    : `${baseURL}${path.startsWith('/') ? path : `/${path}`}`

  if (!params) return normalized

  const url = new URL(normalized)
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue
    url.searchParams.set(key, String(value))
  }
  return url.toString()
}

async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

let refreshing: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  if (refreshing) return refreshing

  refreshing = (async () => {
    const refresh = getRefreshToken()
    if (!refresh) {
      clearTokens()
      return null
    }

    try {
      const { baseURL, timeoutMs } = getClientConfig()
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      const response = await fetch(`${baseURL}/v1/auth/refresh`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: refresh }),
        signal: controller.signal,
      })
      clearTimeout(timer)

      const body = await parseBody(response)
      if (!response.ok) {
        clearTokens()
        return null
      }

      const parsed = parseTokenResponse(body)
      if (!parsed.accessToken) {
        clearTokens()
        return null
      }

      setTokens(parsed.accessToken, parsed.refreshToken ?? refresh)
      return parsed.accessToken
    } catch {
      clearTokens()
      return null
    } finally {
      refreshing = null
    }
  })()

  return refreshing
}

async function rawRequest<T>(
  method: string,
  path: string,
  body?: unknown,
  config: RequestConfig & InternalFlags = {},
): Promise<T> {
  const { timeoutMs, onUnauthorized } = getClientConfig()
  const url = buildUrl(path, config.params)
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(config.headers || {}),
  }

  if (body !== undefined && !(body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json'
  }

  if (!config.skipAuth) {
    const token = getAccessToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  if (config.signal) {
    if (config.signal.aborted) controller.abort()
    else config.signal.addEventListener('abort', () => controller.abort(), { once: true })
  }

  try {
    const response = await fetch(url, {
      method,
      headers,
      body:
        body === undefined
          ? undefined
          : body instanceof FormData
            ? body
            : JSON.stringify(body),
      signal: controller.signal,
    })

    const parsed = await parseBody(response)

    if (response.status === 401 && !config.skipAuth && !config.skipRefresh && !config._retry) {
      const nextToken = await refreshAccessToken()
      if (nextToken) {
        return rawRequest<T>(method, path, body, { ...config, _retry: true })
      }
      onUnauthorized?.()
    }

    if (!response.ok) {
      throw apiErrorFromResponse(response.status, parsed, path)
    }

    return parsed as T
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw toApiError(new Error('Request timed out'), path)
    }
    throw toApiError(error, path)
  } finally {
    clearTimeout(timer)
  }
}

export async function apiGet<T>(url: string, config?: RequestConfig): Promise<T> {
  return rawRequest<T>('GET', url, undefined, config)
}

export async function apiPost<T>(url: string, body?: unknown, config?: RequestConfig): Promise<T> {
  return rawRequest<T>('POST', url, body, config)
}

export async function apiPut<T>(url: string, body?: unknown, config?: RequestConfig): Promise<T> {
  return rawRequest<T>('PUT', url, body, config)
}

export async function apiPatch<T>(url: string, body?: unknown, config?: RequestConfig): Promise<T> {
  return rawRequest<T>('PATCH', url, body, config)
}

export async function apiDelete<T>(url: string, config?: RequestConfig): Promise<T> {
  return rawRequest<T>('DELETE', url, undefined, config)
}

export function unwrapData<T>(envelope: ApiEnvelope<T> | T): T {
  if (envelope && typeof envelope === 'object' && 'data' in (envelope as object)) {
    return (envelope as ApiEnvelope<T>).data as T
  }
  return envelope as T
}
