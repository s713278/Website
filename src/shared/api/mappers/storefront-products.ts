import type { Product, ProductPage, ProductVariant, SkuType } from '@/modules/storefront/types'

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function httpUrl(value: unknown): string | undefined {
  return typeof value === 'string' && /^https?:\/\//.test(value) ? value : undefined
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value)
  return undefined
}

function asSkuType(value: unknown): SkuType {
  const raw = String(value ?? 'ITEM').toUpperCase()
  if (raw === 'SERVICE' || raw === 'DIGITAL') return raw
  return 'ITEM'
}

function mapStorefrontProductVariant(raw: Record<string, unknown>): ProductVariant | null {
  if (raw.active === false) return null
  const id = raw.sku_id ?? raw.id
  if (id == null) return null
  const price = asNumber(raw.sale_price) ?? asNumber(raw.list_price) ?? 0
  return {
    id: String(id),
    unit: String(raw.sku_size ?? raw.unit ?? '').trim(),
    price,
    listPrice: asNumber(raw.list_price),
    onSale: raw.on_sale === true,
    skuType: asSkuType(raw.sku_type),
    discount: asNumber(raw.discount),
    active: raw.active !== false,
  }
}

function pickDefaultVariant(
  variants: ProductVariant[],
  defaultSkuId: unknown,
): ProductVariant | undefined {
  if (!variants.length) return undefined
  if (defaultSkuId != null) {
    const match = variants.find((variant) => variant.id === String(defaultSkuId))
    if (match) return match
  }
  return variants[0]
}

function mapStorefrontProduct(raw: Record<string, unknown>): Product | null {
  if (raw.active === false) return null
  const id = raw.vendor_product_id ?? raw.id
  if (id == null) return null

  const variantRows = Array.isArray(raw.variants) ? raw.variants : []
  const variants = variantRows
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map(mapStorefrontProductVariant)
    .filter((item): item is ProductVariant => item != null)

  const defaultVariant = pickDefaultVariant(variants, raw.default_sku_id)
  const minPrice = asNumber(raw.min_sale_price)
  const maxPrice = asNumber(raw.max_sale_price)
  const startingAt = asNumber(raw.starting_at)
  const price = defaultVariant?.price ?? startingAt ?? minPrice ?? 0

  const categoryId = asNumber(raw.category_id)
  const categoryName = String(raw.category_name ?? raw.category ?? '').trim()

  return {
    id: String(id),
    name: String(raw.product_name ?? raw.name ?? 'Item').trim() || 'Item',
    description: String(raw.product_description ?? raw.description ?? ''),
    price,
    veg: Boolean(raw.veg ?? raw.is_veg ?? true),
    imageUrl: httpUrl(raw.product_image_path) || httpUrl(raw.image_path) || httpUrl(raw.image),
    category: categoryName || undefined,
    categoryId,
    minPrice,
    maxPrice,
    startingAt,
    defaultVariantId:
      raw.default_sku_id != null ? String(raw.default_sku_id) : defaultVariant?.id,
    variantsCount: asNumber(raw.variants_count) ?? variants.length,
    variants: variants.length ? variants : undefined,
  }
}

/**
 * Map paginated GET /v1/vendors/{id}/storefront/products payload
 * (after unwrapData — the `data` object with `result` + page meta).
 */
export function mapStorefrontProductPage(payload: unknown): ProductPage {
  const rec = asRecord(payload)
  const rows = Array.isArray(rec?.result)
    ? rec.result
    : Array.isArray(payload)
      ? payload
      : []

  const items = rows
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map(mapStorefrontProduct)
    .filter((item): item is Product => item != null)

  const pageNumber = asNumber(rec?.page_number) ?? 0
  const pageSize = asNumber(rec?.page_size) ?? items.length
  const totalElements = asNumber(rec?.total_elements) ?? items.length
  const totalPages = asNumber(rec?.total_pages) ?? 1
  const lastPage =
    typeof rec?.last_page === 'boolean' ? rec.last_page : pageNumber >= Math.max(totalPages - 1, 0)

  return {
    items,
    pageNumber,
    pageSize,
    totalElements,
    totalPages,
    lastPage,
  }
}
