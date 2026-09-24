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
  isAccessTokenExpired,
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
  mapVendorCategories,
  mapVendorProducts,
  mapVendorSkus,
  vendorProductIdByPlatformId,
  mapMeasurementCatalog,
  mergeMeasurementCatalogDetails,
  schedulingConfigList,
  schedulingConfigNumber,
  schedulingConfigString,
} from './mappers/vendor-onboarding'
export {
  mapBulkStatusResult,
  mapVendorInsights,
  mapVendorOrderDetail,
  mapVendorOrderPage,
  mapVendorSubscriptionPage,
  mapVendorPlan,
  mapVendorSizes,
  mapVendorStoreProfile,
  toDeliveryStatus,
  toPaymentStatus,
} from './mappers/vendor-dashboard'
export type { BulkStatusFailure, BulkStatusResult } from './mappers/vendor-dashboard'
export { resolveLandingStoreArtwork } from './mappers/landing-store'
export type { LandingStore, LandingStoreArtwork } from './mappers/landing-store'
export type {
  BusinessTypeReference,
  BusinessTypeSaveInput,
  CategoryCreateInput,
  CategoryReference,
  ProductCreateInput,
  CheckoutDeliveryInput,
  CheckoutPaymentInput,
  ProductReference,
  ReferencePage,
  MeasurementCatalog,
  MeasurementCatalogEntry,
  SkuCreateInput,
  SkuMeasurementType,
  StorefrontConfigInput,
  StorefrontConfigRequest,
  CheckoutOptionsSnapshot,
  CheckoutPaymentSnapshot,
  VendorCategoryRef,
  VendorContext,
  VendorProfile,
  VendorOnboardingStatus,
  VendorProductRef,
  VendorSkuRef,
  VendorSubscriptionLimits,
  VendorSubscriptionUsage,
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

export { mapVendorBillingStatus, rupeesToMinorPaise, VendorBillingUnavailableError } from './mappers/vendor-billing'
export type { BillingAction, BillingCheckoutAttempt, BillingSource, SimulatedCancellationStep, SimulatedRenewalStep, VendorBillingService, VendorBillingStatus } from './services/vendor-billing.service'
export { billingFixtureVendorId, createVendorBillingMockService } from './services/vendor-billing-fixture.service'
export type { BillingFixtureScenario } from './services/vendor-billing-fixture.service'
export { billingFailure } from './services/vendor-billing-error'
export { createVendorBillingPreviewService } from './services/vendor-billing-preview.service'
export { createVendorBillingContextService } from './services/vendor-billing-context.service'
export { createVendorBillingLocalTestService } from './services/vendor-billing-local-test.service'
export type { LocalTestHistoryEntry, LocalTestResetObject, LocalTestResetOutcome, LocalTestScenario, LocalTestScenarioState } from './services/vendor-billing-local-test.service'
export type { BillingPreviewConfig, BillingPreviewScenario } from './services/vendor-billing-preview.service'
