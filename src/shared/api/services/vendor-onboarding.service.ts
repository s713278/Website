import {
  catalogService as apiCatalogService,
  vendorsService as apiVendorsService,
  type BusinessTypeQuery,
  type CategoryQuery,
  type ProductsByCategoryQuery,
} from '@mithra/api-client'
import {
  mapBusinessTypePage,
  mapCategoryPage,
  mapProductPage,
  mapAssignCategoriesRequest,
  mapBusinessTypeRequest,
  mapStorefrontConfigRequest,
  mapVendorContext,
  type BusinessTypeReference,
  type CategoryReference,
  type ProductReference,
  type BusinessTypeSaveInput,
  type ReferencePage,
  type StorefrontConfigInput,
  type VendorContext,
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

export const vendorOnboardingService = {
  getBusinessTypes,
  getCategories,
  getProductsByCategory,
  getVendorContext,
  saveBusinessType,
  saveCategories,
  saveStorefront,
}
