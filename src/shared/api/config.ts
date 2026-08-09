type EnvLike = {
  VITE_API_BASE_URL?: string
  VITE_USE_API?: string
}

export type ClientConfig = {
  baseURL: string
  timeoutMs: number
  useApi: boolean
  onUnauthorized?: () => void
}

function readEnv(): EnvLike {
  return (typeof import.meta !== 'undefined' ? import.meta.env : {}) as EnvLike
}

export function getApiBaseUrl(override?: string): string {
  if (override) return override.replace(/\/$/, '')
  const fromVite = readEnv().VITE_API_BASE_URL
  return (fromVite || 'https://subscriptionapp-wgf8.onrender.com/api').replace(/\/$/, '')
}

export function isApiEnabled(): boolean {
  const flag = readEnv().VITE_USE_API
  return flag === 'true' || flag === '1'
}

let clientConfig: ClientConfig = {
  baseURL: getApiBaseUrl(),
  timeoutMs: 15_000,
  useApi: isApiEnabled(),
}

export function configureApiClient(partial: Partial<ClientConfig>) {
  clientConfig = {
    ...clientConfig,
    ...partial,
    baseURL: (partial.baseURL || clientConfig.baseURL).replace(/\/$/, ''),
  }
  return getClientConfig()
}

export function getClientConfig(): ClientConfig {
  return { ...clientConfig }
}
