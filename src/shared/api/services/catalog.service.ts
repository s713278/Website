import { getStoreById, STORES } from '@/modules/storefront/data/catalog'
import type { Store } from '@/modules/storefront/types'
import { apiGet, unwrapData } from '../client'
import { mapVendorToStore } from '../mappers/vendor'
import { useLiveApi } from '../mode'
import type { ApiEnvelope } from '../types'

function delay(ms = 250) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function listStores(query?: string): Promise<Store[]> {
  if (!useLiveApi()) {
    await delay()
    const q = query?.trim().toLowerCase()
    if (!q) return STORES
    return STORES.filter(
      (s) => s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q),
    )
  }

  const res = await apiGet<ApiEnvelope<unknown>>('/v1/vendors/', { skipAuth: true })
  const data = unwrapData(res)
  const list = Array.isArray(data)
    ? data
    : Array.isArray((data as { content?: unknown[] })?.content)
      ? (data as { content: unknown[] }).content
      : []

  let stores = list
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map(mapVendorToStore)

  const q = query?.trim().toLowerCase()
  if (q) {
    stores = stores.filter(
      (s) => s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q),
    )
  }
  return stores
}

export async function getStore(storeId: string): Promise<Store | null> {
  if (!useLiveApi()) {
    await delay()
    return getStoreById(storeId) ?? null
  }

  const [vendorRes, productsRes] = await Promise.all([
    apiGet<ApiEnvelope<Record<string, unknown>>>(`/v1/vendors/${storeId}`, {
      skipAuth: true,
    }),
    apiGet<ApiEnvelope<unknown>>(`/v1/vendors/${storeId}/products`, {
      skipAuth: true,
    }).catch(() => null),
  ])

  const vendor = unwrapData(vendorRes) || {}
  const products = productsRes ? unwrapData(productsRes) : []
  return mapVendorToStore({
    ...vendor,
    products: Array.isArray(products)
      ? products
      : Array.isArray((products as { content?: unknown[] })?.content)
        ? (products as { content: unknown[] }).content
        : [],
  })
}

export const catalogService = {
  listStores,
  getStore,
}
