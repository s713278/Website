import { storefrontService, unwrapData, vendorsService } from '@mithra/api-client'
import { getStoreById, STORES } from '@/modules/storefront/data/catalog'
import type { Store } from '@/modules/storefront/types'
import {
  FALLBACK_LOCATION,
  getSavedLocation,
  homeQuery,
  type CustomerLocation,
} from '@/shared/lib/customer-location'
import { mapLandingStore, type LandingStore } from '../mappers/landing-store'
import { liveVendorId, mapProducts, mapVendorToStore } from '../mappers/vendor'
import { isLiveApi } from '../mode'

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

/** GET /v1/vendors/{vendor_id}/storefront (+ SKUs for prices). Demo ids like r1 resolve to the first live vendor. */
export async function getStore(storeId: string): Promise<Store | null> {
  if (!isLiveApi()) {
    await delay()
    return getStoreById(storeId) ?? null
  }

  const vendorId = await resolveLiveVendorId(storeId)
  if (!vendorId) return null

  const [storefrontRes, skusRes] = await Promise.all([
    storefrontService.get(vendorId),
    vendorsService.getProductSkus(vendorId).catch(() => null),
  ])

  const storefront = asRecord(unwrapData(storefrontRes)) || {}
  const skuRows = asObjectList(unwrapData(skusRes))
  const products = skuRows.length
    ? mapProducts(skuRows, vendorId)
    : mapProducts(storefront.products, vendorId)

  const store = mapVendorToStore({
    ...storefront,
    vendor_id: liveVendorId(storefront) || vendorId,
    products,
  })
  return store.id ? store : null
}

export const catalogService = {
  listStores,
  listLandingStores,
  getStore,
}
