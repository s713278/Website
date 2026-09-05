type EnvLike = { VITE_API_BASE_URL?: string; env?: Record<string, string> };

export function getApiBaseUrl(override?: string): string {
  if (override) return override.replace(/\/$/, '');
  const meta = (typeof import.meta !== 'undefined' ? import.meta : undefined) as EnvLike | undefined;
  const fromVite = meta?.env?.VITE_API_BASE_URL;
  return (fromVite || 'https://subscriptionapp-wgf8.onrender.com/api').replace(/\/$/, '');
}

export type ClientConfig = {
  baseURL: string;
  timeoutMs: number;
  /** 401 that refresh could not recover. The session is over. */
  onUnauthorized?: () => void;
  /**
   * 403 — authenticated, but not allowed to touch this resource. Deliberately separate
   * from onUnauthorized: signing the user out here would discard a valid session and any
   * unsaved work along with it.
   */
  onForbidden?: (path?: string) => void;
};

let clientConfig: ClientConfig = {
  baseURL: getApiBaseUrl(),
  timeoutMs: 15_000,
};

export function configureApiClient(partial: Partial<ClientConfig>) {
  clientConfig = {
    ...clientConfig,
    ...partial,
    baseURL: (partial.baseURL || clientConfig.baseURL).replace(/\/$/, ''),
  };
  // Rebuild axios instance with new base URL / timeout
  void import('./http').then(({ resetHttpClient }) => resetHttpClient());
  return getClientConfig();
}

export function getClientConfig(): ClientConfig {
  return { ...clientConfig };
}
