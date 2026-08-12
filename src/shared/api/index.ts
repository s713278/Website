/**
 * App-facing API façade.
 * HTTP/Axios + OpenAPI services live in `@mithra/api-client`.
 * This module keeps demo-mode services and re-exports the shared client.
 */
export {
  resetHttpClient,
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
  apiPut,
  apiRequest,
  unwrapData,
  getHttp,
  ApiError,
  apiErrorFromResponse,
  getErrorMessage,
  isApiError,
  toApiError,
  clearTokens,
  getAccessToken,
  getRefreshToken,
  parseTokenResponse,
  setTokens,
  refreshAccessToken,
} from '@mithra/api-client'
export type {
  ApiEnvelope,
  AuthTokensResponse,
  HttpMethod,
  RequestConfig,
  TokenPair,
  paths,
  components,
  operations,
} from '@mithra/api-client'

export {
  configureApiClient,
  getApiBaseUrl,
  getClientConfig,
  isApiEnabled,
} from './config'
export type { ClientConfig } from './config'
export { isLiveApi } from './mode'

/** Domain services — single access point for the app */
export * from './services'
