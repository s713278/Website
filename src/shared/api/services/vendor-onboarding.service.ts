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
  mapVendorContext,
  type BusinessTypeReference,
  type CategoryReference,
  type ProductReference,
  type ReferencePage,
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

export const vendorOnboardingService = {
  getBusinessTypes,
  getCategories,
  getProductsByCategory,
  getVendorContext,
}
