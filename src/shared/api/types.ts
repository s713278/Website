export type ApiEnvelope<T = unknown> = {
  message?: string
  timestamp?: string
  success?: boolean
  status?: number
  data?: T
}

export type RequestConfig = {
  /** Skip Authorization header (public endpoints) */
  skipAuth?: boolean
  /** Skip 401 → refresh retry */
  skipRefresh?: boolean
  headers?: Record<string, string>
  params?: Record<string, string | number | boolean | undefined | null>
  signal?: AbortSignal
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
