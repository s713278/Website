import {
  isShareCrawler,
  productShareCard,
  productShareTarget,
  sharePreviewDocument,
} from './share-preview'

/** Same host as `VITE_API_BASE_URL` when the worker has no `API_BASE_URL`. */
export const DEFAULT_API_BASE = 'https://qa.mithradirect.com/api'

/**
 * HTML for a link-preview crawler. A normal browser gets null and the app.
 * The crawler does not run JavaScript, so the marketing title in index.html
 * would otherwise be the whole preview.
 */
export async function productCrawlerHtml(request: Request, apiBase: string): Promise<string | null> {
  if (request.method !== 'GET' && request.method !== 'HEAD') return null
  const agent = request.headers.get('user-agent') ?? ''
  if (!isShareCrawler(agent)) return null

  const url = new URL(request.url)
  const target = productShareTarget(url.pathname)
  if (!target) return null

  const base = apiBase.replace(/\/+$/, '')
  const productUrl = `${base}/v1/vendors/${encodeURIComponent(target.storeId)}/storefront/products/${encodeURIComponent(target.productId)}`
  const shopUrl = `${base}/v1/vendors/${encodeURIComponent(target.storeId)}/storefront`
  const [product, shop] = await Promise.all([
    readData(productUrl),
    readData(shopUrl).catch(() => null),
  ])
  if (!product) return null

  const name = text(product.product_name)
  if (!name) return null
  const sku = url.searchParams.get('sku')
  const variant = pickVariant(product, sku)
  if (variant?.sku_id != null) url.searchParams.set('sku', String(variant.sku_id))
  url.hash = ''
  const card = productShareCard({
    name,
    storeName: text(shop?.business_name) || 'Shop',
    unit: variant ? sizeLabel(variant) : '',
    priceLabel: variant ? priceLabel(variant) : '',
    description: text(product.product_description),
    image: text(product.product_image_path),
    url: url.toString(),
  })
  return sharePreviewDocument(card)
}

async function readData(url: string): Promise<Record<string, unknown> | null> {
  const response = await fetch(url, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) return null
  const body: unknown = await response.json()
  if (!body || typeof body !== 'object') return null
  const record = body as Record<string, unknown>
  const data = record.data
  if (data && typeof data === 'object' && !Array.isArray(data)) return data as Record<string, unknown>
  return record
}

function pickVariant(product: Record<string, unknown>, sku: string | null) {
  const rows = Array.isArray(product.variants) ? product.variants.filter(isRecord) : []
  if (sku) {
    const exact = rows.find((row) => String(row.sku_id ?? '') === sku)
    if (exact) return exact
    const glued = rows
      .filter((row) => {
        const id = String(row.sku_id ?? '')
        return id.length > 0 && sku.startsWith(id) && /^[A-Za-z]/.test(sku.slice(id.length))
      })
      .sort((a, b) => String(b.sku_id).length - String(a.sku_id).length)[0]
    if (glued) return glued
  }
  const preferred = product.default_sku_id
  if (preferred != null) {
    const match = rows.find((row) => String(row.sku_id ?? '') === String(preferred))
    if (match) return match
  }
  return rows[0] ?? null
}

function sizeLabel(raw: Record<string, unknown>) {
  const unit = text(raw.unit)
  const quantity = numberValue(raw.quantity_value)
  if (!unit) return ''
  if (quantity == null || /\d/.test(unit)) return unit
  const shown = parseFloat(quantity.toFixed(3)).toString()
  return `${shown} ${unit}`
}

function priceLabel(raw: Record<string, unknown>) {
  const amount = numberValue(raw.sale_price) ?? numberValue(raw.list_price)
  if (amount == null) return ''
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  })
    .format(amount)
    .replace(/\u00a0/g, '')
}

function numberValue(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value)
  return null
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}
