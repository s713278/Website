import {
  configureApiClient as configurePackageClient,
  getApiBaseUrl,
  getClientConfig as getPackageClientConfig,
  type ClientConfig as PackageClientConfig,
} from '@mithra/api-client'

type EnvLike = {
  VITE_API_BASE_URL?: string
  VITE_USE_API?: string
}

export type ClientConfig = PackageClientConfig & {
  useApi: boolean
}

function readEnv(): EnvLike {
  return (typeof import.meta !== 'undefined' ? import.meta.env : {}) as EnvLike
}

export function isApiEnabled(): boolean {
  const flag = readEnv().VITE_USE_API
  return flag === 'true' || flag === '1'
}

let useApi = isApiEnabled()

export { getApiBaseUrl }

export function configureApiClient(partial: Partial<ClientConfig> = {}) {
  if (partial.useApi !== undefined) useApi = partial.useApi
  configurePackageClient({
    baseURL: partial.baseURL,
    timeoutMs: partial.timeoutMs,
    onUnauthorized: partial.onUnauthorized,
  })
  return getClientConfig()
}

export function getClientConfig(): ClientConfig {
  return { ...getPackageClientConfig(), useApi }
}
