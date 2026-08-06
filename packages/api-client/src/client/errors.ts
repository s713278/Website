import type { AxiosError } from 'axios';

export class ApiError extends Error {
  status: number;
  code?: string;
  body: unknown;
  path?: string;

  constructor(message: string, status: number, body?: unknown, path?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
    this.path = path;
    if (body && typeof body === 'object' && 'code' in body) {
      this.code = String((body as { code?: string }).code || '');
    }
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function getErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (isApiError(error)) return error.message || fallback;
  if ((error as AxiosError)?.isAxiosError) {
    const ax = error as AxiosError<{ message?: string }>;
    return ax.response?.data?.message || ax.message || fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

export function toApiError(error: unknown, path?: string): ApiError {
  if (isApiError(error)) return error;
  if ((error as AxiosError)?.isAxiosError) {
    const ax = error as AxiosError<{ message?: string }>;
    const status = ax.response?.status || 0;
    const body = ax.response?.data;
    const message =
      (body && typeof body === 'object' && 'message' in body && String(body.message)) ||
      ax.message ||
      `API ${status || 'error'}`;
    return new ApiError(message, status, body, path || ax.config?.url);
  }
  if (error instanceof Error) return new ApiError(error.message, 0, error, path);
  return new ApiError('Unknown API error', 0, error, path);
}
