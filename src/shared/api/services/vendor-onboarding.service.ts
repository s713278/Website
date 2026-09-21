import {
  catalogService as apiCatalogService,
  isApiError,
  platformService as apiPlatformService,
  pricesService as apiPricesService,
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
  mapCategoryCreateRequest,
  mapCategoryPage,
  mapCheckoutOptionsRequest,
  mapCreatedCategory,
  mapCreatedProduct,
  mapProductCreateRequest,
  mapProductPage,
  mapSkuCreateRequest,
  mapSkuUpdateRequest,
  mapStorefrontConfigRequest,
  mapVendorCategories,
  mapVendorContext,
  mapVendorProducts,
  mapVendorSkuPage,
  mapVendorProfile,
  mapCheckoutOptionsResponse,
  mapMeasurementCatalog,
  mergeMeasurementCatalogDetails,
  type BusinessTypeReference,
  type CategoryCreateInput,
  type CategoryReference,
  type ProductCreateInput,
  type ProductReference,
  type BusinessTypeSaveInput,
  type CheckoutDeliveryInput,
  type CheckoutPaymentInput,
  type ReferencePage,
  type SkuCreateInput,
  type SkuUpdateInput,
  type StorefrontConfigInput,
  type VendorCategoryRef,
  type VendorContext,
  type VendorProductRef,
  type VendorSkuRef,
  type VendorProfile,
  type CheckoutOptionsSnapshot,
  type MeasurementCatalog,
} from '../mappers/vendor-onboarding'
import { demoVendorContext } from '../fixtures/vendor-dashboard'
import { isLiveApi } from '../mode'
import { demoDelay } from './demo-delay'

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

/** Keep usable detail rows while preserving cancellation as a request-level failure. */
export async function settleMeasurementDetails(
  requests: Promise<unknown>[],
  signal?: AbortSignal,
): Promise<unknown[]> {
  const results = await Promise.allSettled(requests)
  if (signal?.aborted) throw signal.reason
  return results.flatMap((result) => result.status === 'fulfilled' ? [result.value] : [])
}

/**
 * GET /v1/measurements/ plus authenticated GET /v1/measurements/{id} detail reads — the
 * authoritative platform measurement catalog. Units at Step 6 come from here, not a table baked
 * into the frontend; detail supplies the quantity options omitted by the deployed list response.
 */
async function getMeasurements(
  config: ReferenceRequestConfig = {},
): Promise<MeasurementCatalog> {
  const catalog = mapMeasurementCatalog(await apiPlatformService.listMeasurements(config))
  const details = await settleMeasurementDetails(
    catalog.map((measurement) => apiPlatformService.getMeasurement(measurement.id, config)),
    config.signal,
  )
  return mergeMeasurementCatalogDetails(catalog, details)
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
  if (!isLiveApi()) {
    await demoDelay()
    return mapVendorContext(demoVendorContext(vendorId))
  }
  return mapVendorContext(await apiVendorsService.getContext(vendorId, config))
}

/* --- Vendor-scoped writes -------------------------------------------------
 * Request payloads use the generated schemas plus verified live behavior. Generic
 * write responses are not treated as read models: when a later operation needs an
 * assigned ID, the service resolves it through the mapped vendor-scoped reads.
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
  const skus = new Map<number, VendorSkuRef>()
  for (let pageNumber = 0; ; pageNumber++) {
    config.signal?.throwIfAborted()
    const page = mapVendorSkuPage(await apiVendorsService.getProductSkus(vendorId, {
      ...config, params: { page_number: pageNumber, page_size: 50 },
    }))
    config.signal?.throwIfAborted()
    if (page.pageNumber !== pageNumber || page.lastPage == null) {
      throw new Error('Could not load all your sizes. Please try again.')
    }
    const previousCount = skus.size
    for (const sku of page.skus) skus.set(sku.skuId, sku)
    if (page.lastPage) return [...skus.values()]
    if (skus.size === previousCount) throw new Error('Could not load all your sizes. Please try again.')
  }
}

/* --- Platform catalog authoring ------------------------------------------
 * A vendor authoring their own catalog creates the entry in the shared platform
 * catalog first (below), then assigns the returned platform id to their store through
 * the vendor-scoped writes. Both return the created positive id so the wizard can record
 * it into the draft before assigning — a create-then-failed-assign must never re-mint.
 * ------------------------------------------------------------------------ */

/** POST /v1/categories/ — returns the created platform category id. */
async function createCategory(input: CategoryCreateInput): Promise<number> {
  return mapCreatedCategory(await apiCatalogService.createCategory(mapCategoryCreateRequest(input)))
}

/** POST /v1/categories/{category_id}/products/ — returns the created platform product id. */
async function createProduct(
  platformCategoryId: number,
  input: ProductCreateInput,
): Promise<number> {
  return mapCreatedProduct(
    await apiCatalogService.addProduct(platformCategoryId, mapProductCreateRequest(input)),
  )
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
async function createSkus(
  vendorId: number | string,
  input: SkuCreateInput,
  vendorProductId: number,
): Promise<void> {
  await apiVendorsService.createSku(vendorId, mapSkuCreateRequest(input, vendorProductId))
}

/** PATCH /v1/vendors/{vendor_id}/skus/{sku_id} preserves fields omitted from the body. */
async function updateSku(vendorId: number | string, skuId: number, input: SkuUpdateInput): Promise<void> {
  await apiVendorsService.updateSku(vendorId, skuId, mapSkuUpdateRequest(input))
}

/** Price writes address the price record, with the owning SKU in the body. */
async function updateSkuPrice(
  skuId: number,
  priceId: number,
  input: { listPrice: number; salePrice: number },
): Promise<void> {
  await apiPricesService.updateSkuPrice(priceId, {
    sku_id: skuId,
    list_price: input.listPrice,
    sale_price: input.salePrice,
  })
}

/**
 * DELETE /v1/vendors/{vendor_id}/skus/{sku_id}
 *
 * The only removal a vendor is allowed to perform on their own catalog: products and
 * categories are additive-only for this role. See docs/API_GAPS.md.
 */
async function deleteSku(vendorId: number | string, skuId: number): Promise<void> {
  await apiVendorsService.deleteSku(vendorId, skuId)
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
async function getCheckoutOptions(
  vendorId: number | string,
  config: ReferenceRequestConfig = {},
): Promise<CheckoutOptionsSnapshot | null> {
  try {
    return mapCheckoutOptionsResponse(await apiVendorsService.getCheckoutOptions(vendorId, config))
  } catch (error) {
    if (isApiError(error) && error.status === 404) return null
    throw error
  }
}

/** GET /v1/vendors/{vendor_id} — the only read that exposes the vendor's business type. */
async function getVendorProfile(
  vendorId: number | string,
  config: ReferenceRequestConfig = {},
): Promise<VendorProfile> {
  return mapVendorProfile(await apiVendorsService.getById(vendorId, config))
}

/** POST /v1/vendors/{vendor_id}/go-live — activates, then awaits admin approval. */
async function goLive(vendorId: number | string): Promise<void> {
  await apiVendorsService.goLive(vendorId)
}

export const vendorOnboardingService = {
  getBusinessTypes,
  getCategories,
  getProductsByCategory,
  getMeasurements,
  getVendorContext,
  saveBusinessType,
  saveCategories,
  saveStorefront,
  getVendorCategories,
  getVendorProducts,
  getVendorSkus,
  getVendorProfile,
  createCategory,
  createProduct,
  assignProducts,
  createSkus,
  updateSku,
  updateSkuPrice,
  deleteSku,
  getCheckoutOptions,
  saveCheckoutOptions,
  goLive,
}
