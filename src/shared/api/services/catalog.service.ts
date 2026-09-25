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
import {
  mapStorefrontCheckoutOptions,
  type StorefrontCheckoutOptions,
} from '../mappers/storefront-checkout'
import { mapPdpSkuDetail, mapStorefrontProductPage } from '../mappers/storefront-products'
import { isLiveApi } from '../mode'
import { ALL_CATEGORY, parseCategoryFilter, productMatchesCategory, type CategoryFilter } from '@/modules/storefront/lib/catalog-filters'
import { isSearchApiReady, matchesSearchQuery } from '@/shared/lib/search-query'

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

function mapKeywordVendor(raw: Record<string, unknown>): Store | null {
  const category = Array.isArray(raw.category)
    ? raw.category.filter((item): item is string => typeof item === 'string' && item.trim()).join(', ')
    : raw.category
  const store = mapVendorToStore({ ...raw, category })
  return store.id ? store : null
}

/**
 * MithraUserApp vendor search: GET /v1/vendors/search/keyword
 * Same query as the app — service area, keyword, lat/lng, page.
 * Call only when keyword length is at least 4 (SEARCH_API_MIN_CHARS).
 */
export async function searchStoresByKeyword(
  keyword: string,
  location: CustomerLocation,
  pageNumber = 0,
  pageSize = 10,
): Promise<Store[]> {
  const q = keyword.trim()
  if (!isSearchApiReady(q)) return []

  if (!isLiveApi()) {
    await delay()
    return STORES.filter(
      (store) =>
        matchesSearchQuery(store.name, q) ||
        matchesSearchQuery(store.category, q) ||
        store.products.some((product) => matchesSearchQuery(product.name, q)),
    )
  }

  const res = await vendorsService.searchByKeyword({
    service_area: location.serviceArea,
    keyword: q,
    latitude: location.latitude,
    longitude: location.longitude,
    page_number: pageNumber,
    page_size: pageSize,
  })
  return asObjectList(unwrapData(res))
    .map(mapKeywordVendor)
    .filter((store): store is Store => store != null)
}

/**
 * MithraUserApp product search: GET /v1/vendors/{vendor_id}/skus/search
 * Query param is `keyword`, not `q`. Call only when keyword length is at least 4.
 */
export async function searchStoreSkus(
  storeId: string,
  keyword: string,
  pageNumber = 0,
  pageSize = 10,
): Promise<ProductPage> {
  const q = keyword.trim()
  if (!isSearchApiReady(q)) {
    return {
      items: [],
      pageNumber,
      pageSize,
      totalElements: 0,
      totalPages: 0,
      lastPage: true,
    }
  }

  if (!isLiveApi()) {
    await delay()
    const store = getStoreById(storeId) ?? STORES[0]
    const items = (store?.products ?? []).filter((product) =>
      matchesSearchQuery(product.name, q),
    )
    return {
      items,
      pageNumber,
      pageSize,
      totalElements: items.length,
      totalPages: 1,
      lastPage: true,
    }
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

  const res = await vendorsService.searchSkus(vendorId, {
    keyword: q,
    page_number: pageNumber,
    page_size: pageSize,
  })
  return mapStorefrontProductPage(unwrapData(res))
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

const STOREFRONT_RETAIN_MS = 1500
const storefrontById = new Map<string, Promise<Store | null>>()

async function loadLiveStore(storeId: string): Promise<Store | null> {
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

/** GET /v1/vendors/{vendor_id}/storefront — chrome only (products load via listStoreProducts). */
export async function getStore(storeId: string): Promise<Store | null> {
  if (!isLiveApi()) {
    await delay()
    return getStoreById(storeId) ?? null
  }

  const existing = storefrontById.get(storeId)
  if (existing) return existing

  const pending = loadLiveStore(storeId).finally(() => {
    globalThis.setTimeout(() => {
      if (storefrontById.get(storeId) === pending) storefrontById.delete(storeId)
    }, STOREFRONT_RETAIN_MS)
  })
  storefrontById.set(storeId, pending)
  return pending
}

/**
 * GET /v1/vendors/{vendor_id}/checkout_options — delivery/payment choices for customer checkout.
  */
type CheckoutOptionsEntry = {
  promise: Promise<StorefrontCheckoutOptions | null>
}

const checkoutOptionsByStore = new Map<string, CheckoutOptionsEntry>()

/** Long enough for StrictMode remount; short enough that a later cart→checkout shows a GET. */
const CHECKOUT_OPTIONS_RETAIN_MS = 1500

function dropCheckoutOptionsEntry(storeId: string, entry: CheckoutOptionsEntry) {
  if (checkoutOptionsByStore.get(storeId) === entry) {
    checkoutOptionsByStore.delete(storeId)
  }
}

export async function getStoreCheckoutOptions(
  storeId: string,
): Promise<StorefrontCheckoutOptions | null> {
  const existing = checkoutOptionsByStore.get(storeId)
  if (existing) return existing.promise

  const entry: CheckoutOptionsEntry = {
    promise: (async (): Promise<StorefrontCheckoutOptions | null> => {
      if (!isLiveApi()) {
        await delay()
        return null
      }

      const vendorId = await resolveLiveVendorId(storeId)
      if (!vendorId) return null

      const res = await vendorsService.getCheckoutOptions(vendorId)
      return mapStorefrontCheckoutOptions(res)
    })(),
  }

  checkoutOptionsByStore.set(storeId, entry)

  try {
    const result = await entry.promise
    if (result == null) {
      dropCheckoutOptionsEntry(storeId, entry)
      return result
    }
    window.setTimeout(() => dropCheckoutOptionsEntry(storeId, entry), CHECKOUT_OPTIONS_RETAIN_MS)
    return result
  } catch (error) {
    dropCheckoutOptionsEntry(storeId, entry)
    throw error
  }
}

/** GET /v1/vendors/products/{product_id}/skus/{sku_id} — PDP (mithrauserapp fetchSkuDetails). */
export async function getProductSkuDetail(
  productId: string | number,
  skuId: string | number,
): Promise<Product | null> {
  if (!isLiveApi()) {
    await delay()
    for (const store of STORES) {
      const product = store.products.find((p) => p.id === String(productId))
      if (!product) continue
      const variant =
        product.variants?.find((v) => v.id === String(skuId)) ?? product.variants?.[0]
      if (!variant) return product
      return {
        ...product,
        price: variant.price,
        defaultVariantId: variant.id,
        variants: [variant],
        variantsCount: 1,
      }
    }
    return null
  }
  const res = await vendorsService.getSkuDetails(productId, skuId)
  return mapPdpSkuDetail(unwrapData(res))
}

export const catalogService = {
  listStores,
  listLandingStores,
  searchStoresByKeyword,
  searchStoreSkus,
  getStore,
  getStoreCheckoutOptions,
  listStoreProducts,
  getProductSkuDetail,
}
