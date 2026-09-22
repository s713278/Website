import type { CartLine, CartSummary } from '@/modules/storefront/types'

export type CartSnapshot = {
  cartId: string | null
  vendorId: string | null
  lines: CartLine[]
  summary: CartSummary
  expiresAt: string | null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function asString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return null
}

function asNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : fallback
}

function httpUrl(value: unknown): string | undefined {
  return typeof value === 'string' && /^https?:\/\//.test(value.trim()) ? value.trim() : undefined
}

function mapSummary(raw: unknown): CartSummary {
  const s = asRecord(raw) ?? {}
  return {
    itemsTotal: asNumber(s.items_total),
    deliveryCharges: asNumber(s.delivery_charges),
    discount: asNumber(s.discount),
    serviceCharge: asNumber(s.service_charge),
    grandTotal: asNumber(s.grand_total),
    itemsCount: asNumber(s.items_count),
    totalQuantity: asNumber(s.total_quantity),
  }
}

function mapLine(raw: unknown, storeId: string, storeName: string): CartLine | null {
  const item = asRecord(raw)
  if (!item) return null

  const skuId = asString(item.sku_id)
  const cartItemId = asString(item.cart_item_id)
  if (!skuId) return null
  const imageUrl = httpUrl(item.image_path) || httpUrl(item.image_url) || httpUrl(item.image)

  return {
    itemId: skuId,
    storeId,
    storeName,
    name: asString(item.sku_name) ?? 'Item',
    price: asNumber(item.unit_price),
    qty: Math.max(1, Math.floor(asNumber(item.quantity, 1))),
    lineTotal: asNumber(item.line_total, asNumber(item.unit_price) * asNumber(item.quantity, 1)),
    listPrice: asNumber(item.list_price, asNumber(item.unit_price)),
    discount: asNumber(item.discount),
    cartItemId: cartItemId ?? undefined,
    skuId,
    ...(imageUrl ? { imageUrl } : {}),
  }
}

/** OpenAPI cart `data` → storefront view model. */
export function mapCartPayload(data: unknown, storeName = ''): CartSnapshot {
  const root = asRecord(data) ?? {}
  const vendorId = asString(root.vendor_id)
  const storeId = vendorId ?? ''
  const name = storeName.trim()

  const items = Array.isArray(root.items) ? root.items : []
  const lines = items
    .map((entry) => mapLine(entry, storeId, name || storeId))
    .filter((line): line is CartLine => Boolean(line))

  return {
    cartId: asString(root.cart_id),
    vendorId,
    lines,
    summary: mapSummary(root.cart_summary),
    expiresAt: asString(root.expires_at),
  }
}

export function emptyCartSnapshot(vendorId?: string, _storeName = ''): CartSnapshot {
  return {
    cartId: null,
    vendorId: vendorId ?? null,
    lines: [],
    summary: {
      itemsTotal: 0,
      deliveryCharges: 0,
      discount: 0,
      serviceCharge: 0,
      grandTotal: 0,
      itemsCount: 0,
      totalQuantity: 0,
    },
    expiresAt: null,
  }
}
