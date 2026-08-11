import { VENDOR_PRODUCTS } from '@/modules/vendor/data/demo'
import type { VendorProduct } from '@/modules/vendor/types'
import { apiGet, apiPatch, unwrapData } from '../client'
import { isLiveApi } from '../mode'
import type { ApiEnvelope } from '../types'

const DEMO_KEY = 'md-vendor-products'

function readDemo(): VendorProduct[] {
  try {
    const raw = localStorage.getItem(DEMO_KEY)
    if (raw) return JSON.parse(raw) as VendorProduct[]
  } catch {
    /* fall through */
  }
  return structuredClone(VENDOR_PRODUCTS)
}

function writeDemo(products: VendorProduct[]) {
  localStorage.setItem(DEMO_KEY, JSON.stringify(products))
}

export async function listVendorProducts(vendorId: string | number): Promise<VendorProduct[]> {
  if (!isLiveApi()) {
    await new Promise((r) => setTimeout(r, 200))
    return readDemo()
  }

  const res = await apiGet<ApiEnvelope<unknown>>(`/v1/vendors/${vendorId}/products`, {
    skipAuth: true,
  })
  const data = unwrapData(res)
  const list = Array.isArray(data)
    ? data
    : Array.isArray((data as { content?: unknown[] })?.content)
      ? (data as { content: unknown[] }).content
      : []

  return list
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map((item) => ({
      id: String(item.id ?? ''),
      name: String(item.name ?? 'Product'),
      price: Number(item.price ?? item.selling_price ?? 0),
      available: item.available !== false && item.status !== 'INACTIVE',
      veg: Boolean(item.veg ?? item.is_veg ?? true),
    }))
}

export async function setProductAvailability(
  vendorId: string | number,
  productId: string,
  available: boolean,
): Promise<VendorProduct | null> {
  if (!isLiveApi()) {
    const products = readDemo()
    const next = products.map((product) =>
      product.id === productId ? { ...product, available } : product,
    )
    writeDemo(next)
    return next.find((product) => product.id === productId) ?? null
  }

  const res = await apiPatch<ApiEnvelope<Record<string, unknown>>>(
    `/v1/vendors/${vendorId}/products/${productId}`,
    { available, status: available ? 'ACTIVE' : 'INACTIVE' },
  )
  const data = unwrapData(res) || {}
  return {
    id: String(data.id ?? productId),
    name: String(data.name ?? 'Product'),
    price: Number(data.price ?? 0),
    available,
    veg: Boolean(data.veg ?? true),
  }
}

export const vendorProductsService = {
  list: listVendorProducts,
  setAvailability: setProductAvailability,
}
