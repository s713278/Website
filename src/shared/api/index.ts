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
  assertApiSuccess,
  getErrorMessage,
  isApiError,
  logApiError,
  setApiErrorLogger,
  toApiError,
  toLoggableApiError,
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
  ApiErrorKind,
  ApiErrorLogger,
  HttpMethod,
  RequestConfig,
  TokenPair,
  paths,
  components,
  operations,
} from '@mithra/api-client'

export {
  InvalidReferencePayloadError,
  InvalidVendorContextError,
  mapBusinessTypePage,
  mapCategoryPage,
  mapAssignCategoriesRequest,
  mapBusinessTypeRequest,
  mapStorefrontConfigRequest,
  mapProductPage,
  mapVendorContext,
} from './mappers/vendor-onboarding'
export type {
  BusinessTypeReference,
  CategoryReference,
  BusinessTypeSaveInput,
  StorefrontConfigInput,
  StorefrontConfigRequest,
  ProductReference,
  ReferencePage,
} from './mappers/vendor-onboarding'

export {
  configureApiClient,
  getApiBaseUrl,
  getClientConfig,
  isApiEnabled,
} from './config'
export type { ClientConfig } from './config'
export { isLiveApi } from './mode'
export { useApiError } from './useApiError'

/** Domain services — single access point for the app */
export * from './services'
