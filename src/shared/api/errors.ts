export class ApiError extends Error {
  status: number
  code?: string
  body: unknown
  path?: string

  constructor(message: string, status: number, body?: unknown, path?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
    this.path = path
    if (body && typeof body === 'object' && 'code' in body) {
      this.code = String((body as { code?: string }).code || '')
    }
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

export function getErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (isApiError(error)) return error.message || fallback
  if (error instanceof Error) return error.message || fallback
  return fallback
}

function messageFromBody(body: unknown, fallback: string): string {
  if (!body) return fallback
  if (typeof body === 'string' && body.trim()) return body
  if (typeof body === 'object') {
    const record = body as Record<string, unknown>
    if (typeof record.message === 'string' && record.message.trim()) return record.message
    if (typeof record.error === 'string' && record.error.trim()) return record.error
    if (Array.isArray(record.errors) && record.errors.length) {
      return record.errors.map(String).join(', ')
    }
  }
  return fallback
}

export function toApiError(error: unknown, path?: string, status = 0, body?: unknown): ApiError {
  if (isApiError(error)) return error

  if (error instanceof TypeError && /fetch|network|failed/i.test(error.message)) {
    return new ApiError('Network error — check your connection or API URL', 0, error, path)
  }

  if (error instanceof Error) {
    return new ApiError(error.message, status, body ?? error, path)
  }

  return new ApiError(
    messageFromBody(body, 'Unknown API error'),
    status,
    body ?? error,
    path,
  )
}

export function apiErrorFromResponse(status: number, body: unknown, path?: string): ApiError {
  const fallback = status ? `API error ${status}` : 'API error'
  return new ApiError(messageFromBody(body, fallback), status, body, path)
}
