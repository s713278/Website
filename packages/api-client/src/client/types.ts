export type ApiEnvelope<T = unknown> = {
  message?: string;
  timestamp?: string;
  success?: boolean;
  status?: number;
  data?: T;
};

export type TokenPair = {
  accessToken: string;
  refreshToken?: string | null;
};

export type AuthTokensResponse = {
  access_token?: string;
  refresh_token?: string;
  token?: string;
  accessToken?: string;
  refreshToken?: string;
};

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type RequestConfig = {
  /** Skip Authorization header (public endpoints) */
  skipAuth?: boolean;
  /** Skip 401 → refresh retry */
  skipRefresh?: boolean;
  headers?: Record<string, string>;
  params?: Record<string, unknown>;
  signal?: AbortSignal;
};
