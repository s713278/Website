import { getStoreById, STORES } from '@/modules/storefront/data/catalog'
import type { Store } from '@/modules/storefront/types'
import { apiGet, unwrapData } from '../client'
import { useLiveApi } from '../mode'
import type { ApiEnvelope } from '../types'

function delay(ms = 250) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function mapVendorToStore(raw: Record<string, unknown>): Store {
  const id = String(raw.id ?? raw.vendorId ?? '')
  const name = String(raw.business_name ?? raw.name ?? 'Store')
  return {
    id,
    name,
    category: String(raw.category ?? raw.cuisine ?? 'Local'),
    rating: Number(raw.rating ?? 4.2),
    etaMins: Number(raw.etaMins ?? raw.eta_mins ?? 30),
    distanceKm: Number(raw.distanceKm ?? raw.distance_km ?? 2),
    image:
      typeof raw.image === 'string' && raw.image
        ? raw.image
        : 'linear-gradient(135deg, #059669 0%, #047857 45%, #0f766e 100%)',
    offer: raw.offer ? String(raw.offer) : undefined,
    products: Array.isArray(raw.products)
      ? (raw.products as Array<Record<string, unknown>>).map((p, index) => ({
          id: String(p.id ?? `${id}-p${index}`),
          name: String(p.name ?? 'Item'),
          description: String(p.description ?? ''),
          price: Number(p.price ?? p.selling_price ?? 0),
          veg: Boolean(p.veg ?? p.is_veg ?? true),
          popular: Boolean(p.popular),
        }))
      : Array.isArray(raw.menu)
        ? (raw.menu as Store['products'])
        : [],
  }
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
