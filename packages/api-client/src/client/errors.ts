import type { AxiosError } from 'axios';

export type ApiErrorKind =
  | 'timeout'
  | 'network'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'validation'
  | 'rate_limit'
  | 'server'
  | 'client'
  | 'unknown';

export class ApiError extends Error {
  status: number;
  code?: string;
  body: unknown;
  /** Request path/url (AC: url) */
  path?: string;
  url?: string;
  kind: ApiErrorKind;

  constructor(
    message: string,
    status: number,
    body?: unknown,
    path?: string,
    kind: ApiErrorKind = 'unknown',
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
    this.path = path;
    this.url = path;
    this.kind = kind;
    this.code = extractErrorCode(body);
  }
}

function extractErrorCode(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const record = body as Record<string, unknown>;
  const code = record.reason_code ?? record.code ?? record.status;
  if (typeof code === 'string' && code.trim()) return code.trim();
  if (typeof code === 'number') return String(code);
  return undefined;
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

const SENSITIVE_KEY =
  /^(authorization|access_token|refresh_token|token|password|otp|secret|authorization)$/i;

function scrubValue(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[Truncated]';
  if (value == null) return value;
  if (typeof value === 'string') {
    if (value.length > 200) return `${value.slice(0, 200)}…`;
    return value;
  }
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => scrubValue(v, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEY.test(key) ? '[Redacted]' : scrubValue(entry, depth + 1);
    }
    return out;
  }
  return value;
}

/** Safe snapshot for console/telemetry — no tokens/PII fields. */
export function toLoggableApiError(error: ApiError) {
  return {
    name: error.name,
    message: error.message,
    status: error.status,
    code: error.code,
    kind: error.kind,
    url: error.url || error.path,
    body: scrubValue(error.body),
  };
}

export type ApiErrorLogger = (payload: ReturnType<typeof toLoggableApiError>) => void;

let apiErrorLogger: ApiErrorLogger | null = (payload) => {
  // Default hook point — replace via setApiErrorLogger (e.g. telemetry).
  console.error('[api]', payload);
};

export function setApiErrorLogger(logger: ApiErrorLogger | null) {
  apiErrorLogger = logger;
}

export function logApiError(error: ApiError) {
  try {
    apiErrorLogger?.(toLoggableApiError(error));
  } catch {
    /* never throw from logger */
  }
}

function messageFromBody(body: unknown): string {
  if (!body) return '';
  if (typeof body === 'string' && body.trim()) return body.trim();
  if (typeof body === 'object') {
    const record = body as Record<string, unknown>;
    // Mithra backend often uses user_message / failure_reason (not only `message`)
    const candidates = [
      record.user_message,
      record.failure_reason,
      record.message,
      record.error,
    ];
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
    }
    if (Array.isArray(record.errors) && record.errors.length) {
      return record.errors
        .map((item) => {
          if (typeof item === 'string') return item;
          if (item && typeof item === 'object' && 'message' in item) {
            return String((item as { message?: string }).message || item);
          }
          return String(item);
        })
        .filter(Boolean)
        .join(', ');
    }
  }
  return '';
}

/** Prefer short backend copy; block stacks, HTML, and Axios generic status text. */
function isUiSafeMessage(message: string): boolean {
  if (!message || message.length > 180) return false;
  if (/stack|exception|at\s+\w+\s*\(|<html|<!doctype/i.test(message)) return false;
  if (/^request failed with status code \d+/i.test(message)) return false;
  return true;
}

function kindFromStatus(status: number): ApiErrorKind {
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 422 || status === 400) return 'validation';
  if (status === 429) return 'rate_limit';
  if (status >= 500) return 'server';
  if (status >= 400) return 'client';
  return 'unknown';
}

function fallbackForKind(kind: ApiErrorKind, status: number): string {
  switch (kind) {
    case 'timeout':
      return 'Request timed out. Please try again.';
    case 'network':
      return 'You appear to be offline. Check your connection and try again.';
    case 'unauthorized':
      return 'Your session expired. Please sign in again.';
    case 'forbidden':
      return 'You do not have permission to do that.';
    case 'not_found':
      return 'We could not find what you were looking for.';
    case 'validation':
      return 'Please check your details and try again.';
    case 'rate_limit':
      return 'Too many requests. Please wait a moment and try again.';
    case 'server':
      return 'Something went wrong on our side. Please try again later.';
    case 'client':
      return status ? `Request failed (${status}). Please try again.` : 'Request failed. Please try again.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

function resolveUserMessage(kind: ApiErrorKind, status: number, body: unknown, raw?: string): string {
  const fromBody = messageFromBody(body);
  if (fromBody && isUiSafeMessage(fromBody)) return fromBody;
  // Never surface Axios "Request failed with status code 401" — use mapped copy instead.
  if (
    raw &&
    isUiSafeMessage(raw) &&
    kind !== 'network' &&
    kind !== 'timeout' &&
    kind !== 'unauthorized'
  ) {
    return raw;
  }
  return fallbackForKind(kind, status);
}

function isTimeoutError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const ax = error as AxiosError & { code?: string };
  if (ax.code === 'ECONNABORTED' || ax.code === 'ETIMEDOUT') return true;
  if (ax.message && /timeout/i.test(ax.message)) return true;
  if (error instanceof DOMException && error.name === 'AbortError') return true;
  if (error instanceof Error && /timeout/i.test(error.message)) return true;
  return false;
}

function isNetworkError(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  if (!error || typeof error !== 'object') return false;
  const ax = error as AxiosError & { code?: string };
  if (ax.code === 'ERR_NETWORK' || ax.code === 'ENOTFOUND') return true;
  if (!ax.response && ax.isAxiosError && !isTimeoutError(error)) return true;
  if (error instanceof TypeError && /fetch|network|failed/i.test(error.message)) return true;
  return false;
}

/**
 * Normalize any failure to ApiError (status, code/message, url) and emit log hook once.
 */
export function toApiError(
  error: unknown,
  path?: string,
  status = 0,
  body?: unknown,
): ApiError {
  if (isApiError(error)) return error;

  let kind: ApiErrorKind = 'unknown';
  let nextStatus = status;
  let nextBody: unknown = body;
  let nextPath = path;
  let rawMessage = '';

  if ((error as AxiosError)?.isAxiosError) {
    const ax = error as AxiosError;
    nextStatus = ax.response?.status || status || 0;
    nextBody = ax.response?.data ?? body;
    nextPath = path || ax.config?.url;
    rawMessage = ax.message || '';

    if (isTimeoutError(ax)) {
      kind = 'timeout';
      nextStatus = nextStatus || 0;
    } else if (isNetworkError(ax)) {
      kind = 'network';
      nextStatus = nextStatus || 0;
    } else {
      kind = kindFromStatus(nextStatus);
    }
  } else if (isTimeoutError(error)) {
    kind = 'timeout';
    rawMessage = error instanceof Error ? error.message : '';
  } else if (isNetworkError(error)) {
    kind = 'network';
    rawMessage = error instanceof Error ? error.message : '';
  } else if (error instanceof Error) {
    rawMessage = error.message;
    kind = kindFromStatus(nextStatus);
    if (!nextBody) nextBody = error;
  } else {
    nextBody = body ?? error;
    kind = kindFromStatus(nextStatus);
  }

  const message = resolveUserMessage(kind, nextStatus, nextBody, rawMessage);
  const apiError = new ApiError(message, nextStatus, nextBody, nextPath, kind);
  logApiError(apiError);
  return apiError;
}

export function apiErrorFromResponse(status: number, body: unknown, path?: string): ApiError {
  const kind = kindFromStatus(status);
  const message = resolveUserMessage(kind, status, body);
  const apiError = new ApiError(message, status, body, path, kind);
  logApiError(apiError);
  return apiError;
}

/** UI-facing copy — never returns stack traces. */
export function getErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (isApiError(error)) return error.message || fallback;
  if ((error as AxiosError)?.isAxiosError || error instanceof Error) {
    return toApiError(error).message || fallback;
  }
  return fallback;
}

/**
 * Map Mithra envelope failures (HTTP 200 + success:false) to an HTTP-like status.
 * Returns null when the payload is not a failure envelope.
 */
export function envelopeFailureStatus(data: unknown): number | null {
  if (
    !data ||
    typeof data !== 'object' ||
    !('success' in (data as object)) ||
    (data as { success?: boolean }).success !== false
  ) {
    return null;
  }

  const record = data as Record<string, unknown>;
  const label = `${record.status ?? ''} ${record.reason_code ?? ''} ${record.failure_reason ?? ''}`;
  if (/unauthorized|access_token_expired|token.*expired/i.test(label)) return 401;
  if (/forbidden/i.test(label)) return 403;
  if (/not[_ ]?found/i.test(label)) return 404;
  if (/valid/i.test(label)) return 422;
  return 400;
}

/**
 * Mithra envelopes sometimes return HTTP 200 with `success: false`.
 * Normalize those to ApiError so UI never treats them as success.
 */
export function assertApiSuccess<T>(data: T, path?: string): T {
  const status = envelopeFailureStatus(data);
  if (status != null) {
    throw apiErrorFromResponse(status, data, path);
  }
  return data;
}
