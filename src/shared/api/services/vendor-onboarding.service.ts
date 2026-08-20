import {
  catalogService as apiCatalogService,
  isApiError,
  vendorsService as apiVendorsService,
  type BusinessTypeQuery,
  type CategoryQuery,
  type ProductsByCategoryQuery,
} from '@mithra/api-client'
import {
  mapAssignCategoriesRequest,
  mapAssignProductsRequest,
  mapBusinessTypePage,
  mapBusinessTypeRequest,
  mapCategoryPage,
  mapCheckoutOptionsRequest,
  mapProductPage,
  mapSkuCreateRequest,
  mapStorefrontConfigRequest,
  mapVendorCategories,
  mapVendorContext,
  mapVendorProducts,
  mapVendorSkus,
  type BusinessTypeReference,
  type CategoryReference,
  type ProductReference,
  type BusinessTypeSaveInput,
  type CheckoutDeliveryInput,
  type CheckoutPaymentInput,
  type ReferencePage,
  type SkuCreateInput,
  type StorefrontConfigInput,
  type VendorCategoryRef,
  type VendorContext,
  type VendorProductRef,
  type VendorSkuRef,
} from '../mappers/vendor-onboarding'

export type ReferenceRequestConfig = {
  signal?: AbortSignal
}

async function getBusinessTypes(
  params: BusinessTypeQuery = {},
  config: ReferenceRequestConfig = {},
): Promise<ReferencePage<BusinessTypeReference>> {
  return mapBusinessTypePage(await apiCatalogService.getBusinessTypes(params, config))
}

async function getCategories(
  params: CategoryQuery = {},
  config: ReferenceRequestConfig = {},
): Promise<ReferencePage<CategoryReference>> {
  return mapCategoryPage(await apiCatalogService.getCategories(params, config))
}

async function getProductsByCategory(
  categoryId: number,
  params: ProductsByCategoryQuery = {},
  config: ReferenceRequestConfig = {},
): Promise<ReferencePage<ProductReference>> {
  if (!Number.isSafeInteger(categoryId) || categoryId <= 0) {
    throw new Error('A live category ID must be a positive integer.')
  }
  return mapProductPage(
    await apiCatalogService.getProductsByCategory(categoryId, params, config),
  )
}

/**
 * Authoritative vendor state for a signed-in vendor. This is the only trustworthy source
 * of membership, approval status and subscription limits — a persisted session is just a
 * cache of what the browser was told at login.
 */
async function getVendorContext(
  vendorId: number | string,
  config: ReferenceRequestConfig = {},
): Promise<VendorContext> {
  return mapVendorContext(await apiVendorsService.getContext(vendorId, config))
}

/* --- Vendor-scoped writes -------------------------------------------------
 * Only operations with an unambiguous request schema are exposed. Assigning
 * products and creating SKUs are absent on purpose: their responses are untyped,
 * so the vendor-assigned product ID that SKU creation requires cannot be
 * resolved. Adding them would mean guessing a wire format.
 * ------------------------------------------------------------------------ */

/** PATCH /v1/vendors/{vendor_id}/business-type */
async function saveBusinessType(
  vendorId: number | string,
  input: BusinessTypeSaveInput,
): Promise<void> {
  await apiVendorsService.updateBusinessType(vendorId, mapBusinessTypeRequest(input))
}

/** PATCH /v1/vendors/{vendor_id}/categories */
async function saveCategories(vendorId: number | string, categoryIds: number[]): Promise<void> {
  await apiVendorsService.assignCategories(vendorId, mapAssignCategoriesRequest(categoryIds))
}

/** PUT /v1/vendors/{vendor_id}/storefront */
async function saveStorefront(
  vendorId: number | string,
  input: StorefrontConfigInput,
): Promise<void> {
  await apiVendorsService.saveStorefront(vendorId, mapStorefrontConfigRequest(input))
}

/* --- Vendor-scoped resource reads ---------------------------------------- */

async function getVendorCategories(
  vendorId: number | string,
  config: ReferenceRequestConfig = {},
): Promise<VendorCategoryRef[]> {
  return mapVendorCategories(await apiVendorsService.getCategories(vendorId, config))
}

async function getVendorProducts(
  vendorId: number | string,
  config: ReferenceRequestConfig = {},
): Promise<VendorProductRef[]> {
  return mapVendorProducts(await apiVendorsService.getProducts(vendorId, config))
}

async function getVendorSkus(
  vendorId: number | string,
  config: ReferenceRequestConfig = {},
): Promise<VendorSkuRef[]> {
  return mapVendorSkus(await apiVendorsService.getProductSkus(vendorId, config))
}

/* --- Catalog and checkout writes ----------------------------------------- */

/** PATCH /v1/vendors/{vendor_id}/assign/products — one call per selected category. */
async function assignProducts(
  vendorId: number | string,
  platformCategoryId: number,
  platformProductIds: number[],
): Promise<void> {
  if (!platformProductIds.length) return
  await apiVendorsService.assignProducts(
    vendorId,
    mapAssignProductsRequest(platformCategoryId, platformProductIds),
  )
}

/** POST /v1/vendors/{vendor_id}/skus — `vendorProductId`, never the platform ID. */
async function createSku(
  vendorId: number | string,
  input: SkuCreateInput,
  vendorProductId: number,
): Promise<void> {
  await apiVendorsService.createSku(vendorId, mapSkuCreateRequest(input, vendorProductId))
}

/** PUT /v1/vendors/{vendor_id}/checkout_options — Steps 7 and 8 combined. */
async function saveCheckoutOptions(
  vendorId: number | string,
  delivery: CheckoutDeliveryInput,
  payments: CheckoutPaymentInput,
): Promise<void> {
  await apiVendorsService.saveCheckoutOptions(
    vendorId,
    mapCheckoutOptionsRequest(delivery, payments),
  )
}

/**
 * A first-time vendor legitimately gets 404 here — it means "not configured yet",
 * not a failure. Every other error still propagates.
 */
async function getCheckoutOptions(vendorId: number | string): Promise<unknown | null> {
  try {
    return await apiVendorsService.getCheckoutOptions(vendorId)
  } catch (error) {
    if (isApiError(error) && error.status === 404) return null
    throw error
  }
}

/** POST /v1/vendors/{vendor_id}/go-live — activates, then awaits admin approval. */
async function goLive(vendorId: number | string): Promise<void> {
  await apiVendorsService.goLive(vendorId)
}

export const vendorOnboardingService = {
  getBusinessTypes,
  getCategories,
  getProductsByCategory,
  getVendorContext,
  saveBusinessType,
  saveCategories,
  saveStorefront,
  getVendorCategories,
  getVendorProducts,
  getVendorSkus,
  assignProducts,
  createSku,
  getCheckoutOptions,
  saveCheckoutOptions,
  goLive,
}
