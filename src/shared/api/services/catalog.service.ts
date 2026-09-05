import { storefrontService, unwrapData, vendorsService } from '@mithra/api-client'
import { getStoreById, STORES } from '@/modules/storefront/data/catalog'
import type { Product, ProductPage, Store } from '@/modules/storefront/types'
import {
  FALLBACK_LOCATION,
  getSavedLocation,
  homeQuery,
  type CustomerLocation,
} from '@/shared/lib/customer-location'
import { mapLandingStore, type LandingStore } from '../mappers/landing-store'
import { liveVendorId, mapVendorToStore } from '../mappers/vendor'
import { mapStorefrontProductPage } from '../mappers/storefront-products'
import { isLiveApi } from '../mode'
import { ALL_CATEGORY, parseCategoryFilter, productMatchesCategory, type CategoryFilter } from '@/modules/storefront/lib/catalog-filters'

function delay(ms = 250) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function asObjectList(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
  }
  const rec = asRecord(value)
  if (!rec) return []
  return asObjectList(rec.result ?? rec.content ?? rec.new_vendors ?? rec.vendors ?? rec.items)
}

function isNumericVendorId(id: string) {
  return /^\d+$/.test(id)
}

function isActiveVendor(raw: Record<string, unknown>) {
  const status = String(raw.status ?? 'ACTIVE').toUpperCase()
  return status === 'ACTIVE'
}

/** GET /v1/home — public vendor cards with numeric vendor_id */
export async function listStores(query?: string, location?: CustomerLocation): Promise<Store[]> {
  if (!isLiveApi()) {
    await delay()
    const q = query?.trim().toLowerCase()
    if (!q) return STORES
    return STORES.filter(
      (s) => s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q),
    )
  }

  const area = location ?? getSavedLocation() ?? FALLBACK_LOCATION
  const res = await vendorsService.home(homeQuery(area))
  const data = unwrapData(res)
  const rec = asRecord(data)
  const list = asObjectList(rec?.new_vendors ?? rec?.carousal ?? data)

  let stores = list.filter(isActiveVendor).map(mapVendorToStore).filter((store) => store.id)

  const q = query?.trim().toLowerCase()
  if (q) {
    stores = stores.filter(
      (s) => s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q),
    )
  }
  return stores
}

/** Truthful cards for the landing page's location-keyed public home feed. */
export async function listLandingStores(
  location: CustomerLocation,
  signal?: AbortSignal,
): Promise<LandingStore[]> {
  if (!isLiveApi()) {
    await delay()
    if (signal?.aborted) throw new DOMException('The request was aborted.', 'AbortError')
    return STORES.map((store) =>
      mapLandingStore({
        vendor_id: store.id,
        name: store.name,
        rating: store.rating,
        category: store.category,
        distance_km: store.distanceKm,
        eta_mins: store.etaMins,
        offer: store.offer,
      }),
    ).filter((store): store is LandingStore => store !== null)
  }

  const res = await vendorsService.home(homeQuery(location), { signal })
  const data = asRecord(unwrapData(res))
  const rows = asObjectList(data?.new_vendors)
  return rows.map(mapLandingStore).filter((store): store is LandingStore => store !== null)
}

/** Demo fixture ids like `r1`, which have no live equivalent. */
const DEMO_STORE_ID = /^r\d+$/

async function resolveLiveVendorId(storeId: string): Promise<string | null> {
  if (isNumericVendorId(storeId)) return storeId
  // A published `store_identifier` slug is accepted directly by the storefront
  // operation, so share links resolve without a lookup.
  if (!DEMO_STORE_ID.test(storeId)) return storeId
  const stores = await listStores()
  return stores[0]?.id ?? null
}

export type ListStoreProductsParams = {
  pageNumber?: number
  pageSize?: number
  categoryFilter?: CategoryFilter
}

/** Slice a filtered product list for demo mode and name-only category fallback. */
function sliceProductPage(
  products: Product[],
  pageNumber: number,
  pageSize: number,
  categoryFilter?: CategoryFilter,
): ProductPage {
  const filtered = products.filter((product) => productMatchesCategory(product, categoryFilter))
  const totalElements = filtered.length
  const totalPages = Math.max(1, Math.ceil(totalElements / pageSize) || 1)
  const start = Math.max(0, pageNumber) * pageSize
  const items = filtered.slice(start, start + pageSize)
  const lastPage = pageNumber >= totalPages - 1 || start + items.length >= totalElements
  return {
    items,
    pageNumber,
    pageSize,
    totalElements,
    totalPages,
    lastPage,
  }
}

/**
 * GET /v1/vendors/{id}/storefront/products — paginated catalog for home + browse.
 * Uses numeric `category_id` when known; otherwise filters client-side by category name.
 */
export async function listStoreProducts(
  storeId: string,
  params: ListStoreProductsParams = {},
): Promise<ProductPage> {
  const pageNumber = params.pageNumber ?? 0
  const pageSize = params.pageSize ?? 10
  const categoryFilter =
    params.categoryFilter && params.categoryFilter !== ALL_CATEGORY
      ? params.categoryFilter
      : undefined
  const { categoryId, categoryName } = parseCategoryFilter(categoryFilter)

  if (!isLiveApi()) {
    await delay()
    const store = getStoreById(storeId) ?? STORES[0]
    return sliceProductPage(store?.products ?? [], pageNumber, pageSize, categoryFilter)
  }

  const vendorId = await resolveLiveVendorId(storeId)
  if (!vendorId) {
    return {
      items: [],
      pageNumber,
      pageSize,
      totalElements: 0,
      totalPages: 0,
      lastPage: true,
    }
  }

  const requestPageSize = categoryName ? Math.max(pageSize, 100) : pageSize
  const requestPageNumber = categoryName ? 0 : pageNumber

  const res = await storefrontService.listProducts(vendorId, {
    page_number: requestPageNumber,
    page_size: requestPageSize,
    ...(categoryId != null ? { category_id: categoryId } : {}),
  })

  const page = mapStorefrontProductPage(unwrapData(res))
  if (!categoryName) return page

  const filtered = page.items.filter((product) => productMatchesCategory(product, categoryName))
  return sliceProductPage(filtered, pageNumber, pageSize)
}

/** GET /v1/vendors/{vendor_id}/storefront — chrome only (products load via listStoreProducts). */
export async function getStore(storeId: string): Promise<Store | null> {
  if (!isLiveApi()) {
    await delay()
    return getStoreById(storeId) ?? null
  }

  const vendorId = await resolveLiveVendorId(storeId)
  if (!vendorId) return null

  const storefrontRes = await storefrontService.get(vendorId)
  const storefront = asRecord(unwrapData(storefrontRes)) || {}

  const store = mapVendorToStore({
    ...storefront,
    vendor_id: liveVendorId(storefront) || vendorId,
    products: [],
  })
  return store.id ? store : null
}

export const catalogService = {
  listStores,
  listLandingStores,
  getStore,
  listStoreProducts,
}
