import type { Product, ProductPage, ProductVariant, SkuType } from '@/modules/storefront/types'
import { mapSkuMeasurement } from './sku-measurement'

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

/** sku_type values — never use these as the product title. */
const GENERIC_TYPE_LABELS = new Set(['ITEM', 'SERVICE', 'DIGITAL'])

/**
 * SKU search (`GET .../skus/search`) returns `sku_name`, not `product_name`.
 * Using only `product_name` / `name` made every hit render as "Item".
 */
function pickProductName(raw: Record<string, unknown>): string {
  const candidates = [raw.product_name, raw.sku_name, raw.item_name, raw.title, raw.name]
  for (const value of candidates) {
    if (typeof value !== 'string') continue
    const name = value.trim()
    if (!name) continue
    if (GENERIC_TYPE_LABELS.has(name.toUpperCase())) continue
    return name
  }
  return ''
}

function sizeFromName(value: unknown): string {
  if (typeof value !== 'string') return ''
  const dash = value.match(/[-–—]\s*(\d[\d.,]*\s*[a-zA-Z]+)\s*$/)
  return dash?.[1]?.replace(/\s+/g, ' ').trim() ?? ''
}

/**
 * Pack size for chips and cart lines. Prefer the vendor size label when
 * quantity_value is shared across SKUs (e.g. both say 1 kg but sku_size is 2 kg).
 */
function formatSkuSizeLabel(raw: Record<string, unknown>): string {
  const skuSize = typeof raw.sku_size === 'string' ? raw.sku_size.trim() : ''
  if (skuSize) return skuSize

  const skuVariant = typeof raw.sku_variant === 'string' ? raw.sku_variant.trim() : ''
  if (skuVariant && /\d/.test(skuVariant) && !GENERIC_TYPE_LABELS.has(skuVariant.toUpperCase())) {
    return skuVariant
  }

  const measured = mapSkuMeasurement(raw)
  if (measured.quantity != null && measured.unit) {
    // `unit` is already a full size ("2 kg") — do not prefix quantity_value.
    if (/\d/.test(measured.unit) && /[a-zA-Z]/.test(measured.unit)) {
      return measured.unit
    }
    return `${parseFloat(measured.quantity.toFixed(3)).toString()} ${measured.unit}`
  }

  const fromName = sizeFromName(raw.sku_name) || sizeFromName(raw.sku_code) || sizeFromName(raw.name)
  if (fromName) return fromName

  // API sometimes sends the full size in `unit` ("2 kg") without quantity_value.
  if (measured.unit && /\d/.test(measured.unit)) return measured.unit
  return ''
}

function mapStorefrontProductVariant(raw: Record<string, unknown>): ProductVariant | null {
  if (raw.active === false || raw.is_active === false) return null
  const id = raw.sku_id ?? raw.id
  if (id == null) return null
  const price = asNumber(raw.sale_price) ?? asNumber(raw.list_price) ?? 0
  return {
    id: String(id),
    unit: formatSkuSizeLabel(raw),
    price,
    listPrice: asNumber(raw.list_price),
    onSale: raw.on_sale === true,
    skuType: asSkuType(raw.sku_type),
    discount: asNumber(raw.discount),
    active: raw.active !== false && raw.is_active !== false,
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
  if (raw.active === false || raw.is_active === false) return null
  const id = raw.vendor_product_id ?? raw.product_id ?? raw.id ?? raw.sku_id
  if (id == null) return null

  const variantRows = Array.isArray(raw.variants) ? raw.variants : []
  let variants = variantRows
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map(mapStorefrontProductVariant)
    .filter((item): item is ProductVariant => item != null)

  // SKU search returns a flat SKU row, not a product with a `variants` array.
  if (!variants.length && (raw.sku_id != null || raw.sale_price != null || raw.list_price != null)) {
    const skuVariant = mapStorefrontProductVariant({
      ...raw,
      sku_id: raw.sku_id ?? raw.id,
    })
    if (skuVariant) variants = [skuVariant]
  }

  const defaultVariant = pickDefaultVariant(variants, raw.default_sku_id ?? raw.sku_id)
  const minPrice = asNumber(raw.min_sale_price)
  const maxPrice = asNumber(raw.max_sale_price)
  const startingAt = asNumber(raw.starting_at)
  const price = defaultVariant?.price ?? startingAt ?? minPrice ?? 0

  const categoryId = asNumber(raw.category_id)
  const categoryName = String(raw.category_name ?? raw.category ?? '').trim()
  const name = pickProductName(raw)

  return {
    id: String(id),
    name: name || 'Item',
    description: String(raw.product_description ?? raw.description ?? raw.sku_description ?? ''),
    price,
    veg: Boolean(raw.veg ?? raw.is_veg ?? true),
    imageUrl: httpUrl(raw.product_image_path) || httpUrl(raw.image_path) || httpUrl(raw.image),
    category: categoryName || undefined,
    categoryId,
    minPrice,
    maxPrice,
    startingAt,
    inStock: raw.active !== false && raw.is_active !== false,
    defaultVariantId:
      raw.default_sku_id != null
        ? String(raw.default_sku_id)
        : defaultVariant?.id,
    variantsCount: asNumber(raw.variants_count) ?? variants.length,
    variants: variants.length ? variants : undefined,
  }
}

function dedupeVariants(variants: ProductVariant[]): ProductVariant[] {
  const seen = new Set<string>()
  const unique: ProductVariant[] = []
  for (const variant of variants) {
    if (seen.has(variant.id)) continue
    seen.add(variant.id)
    unique.push(variant)
  }
  return unique
}

/** Two SKU rows of the same vendor_product_id become one product with both sizes. */
export function mergeProductRecords(existing: Product, incoming: Product): Product {
  const variants = dedupeVariants([...(existing.variants ?? []), ...(incoming.variants ?? [])])
  const prices = [existing.price, incoming.price, existing.minPrice, incoming.minPrice].filter(
    (value): value is number => value != null && Number.isFinite(value),
  )
  const maxes = [existing.price, incoming.price, existing.maxPrice, incoming.maxPrice].filter(
    (value): value is number => value != null && Number.isFinite(value),
  )
  return {
    ...existing,
    ...incoming,
    id: existing.id,
    name: existing.name && existing.name !== 'Item' ? existing.name : incoming.name,
    variants: variants.length ? variants : existing.variants,
    defaultVariantId: existing.defaultVariantId ?? incoming.defaultVariantId,
    variantsCount: Math.max(
      existing.variantsCount ?? 0,
      incoming.variantsCount ?? 0,
      variants.length,
    ),
    minPrice: prices.length ? Math.min(...prices) : existing.minPrice,
    maxPrice: maxes.length ? Math.max(...maxes) : existing.maxPrice,
  }
}

export function collapseStorefrontProducts(items: Product[]): Product[] {
  const order: string[] = []
  const byId = new Map<string, Product>()
  for (const item of items) {
    const current = byId.get(item.id)
    if (!current) {
      byId.set(item.id, item)
      order.push(item.id)
      continue
    }
    byId.set(item.id, mergeProductRecords(current, item))
  }
  return order.map((id) => byId.get(id)!)
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

  const items = collapseStorefrontProducts(
    rows
      .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
      .map(mapStorefrontProduct)
      .filter((item): item is Product => item != null),
  )

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


/**
 * GET /v1/vendors/products/{product_id}/skus/{sku_id} → Product.
 * Inactive SKUs still map so PDP can show "Out of stock" (list APIs keep filtering them out).
 */
export function mapPdpSkuDetail(data: unknown): Product | null {
  const raw = asRecord(data)
  if (!raw) return null

  const inStock = raw.is_active !== false && raw.active !== false

  // Bypass list-style "skip inactive" so the page can render an unavailable SKU.
  const mapped = mapStorefrontProduct({
    vendor_product_id: raw.vendor_product_id,
    product_name: raw.product_name ?? raw.sku_name,
    product_description: raw.description,
    image_path: raw.image_path,
    default_sku_id: raw.sku_id,
    is_active: true,
    active: true,
    variants: [{ ...raw, is_active: true, active: true }],
  })
  if (!mapped) return null

  return {
    ...mapped,
    inStock,
    variants: mapped.variants?.map((variant) => ({ ...variant, active: inStock })),
  }
}
