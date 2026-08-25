import type { Product, Store, StoreCategory, StoreTheme } from '@/modules/storefront/types'
import { DEFAULT_ACCENT_COLOR, DEFAULT_PRIMARY_COLOR, normalizeHex } from '@/shared/lib/theme'

const FALLBACK_COVER = 'linear-gradient(135deg, #059669 0%, #047857 45%, #0f766e 100%)'

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function httpUrl(value: unknown): string | undefined {
  return typeof value === 'string' && /^https?:\/\//.test(value) ? value : undefined
}

function coverImage(raw: Record<string, unknown>): string {
  const url = httpUrl(raw.banner_image) || httpUrl(raw.thumbnail_image) || httpUrl(raw.image)
  if (url) return `center / cover no-repeat url("${url.replace(/"/g, '%22')}")`
  if (typeof raw.image === 'string' && raw.image.includes('gradient')) return raw.image
  return FALLBACK_COVER
}

export function mapVendorTheme(raw: Record<string, unknown>): StoreTheme | undefined {
  const t = asRecord(raw.theme)
  const logoImage =
    (t && httpUrl(t.logo_image)) || httpUrl(raw.thumbnail_image) || httpUrl(raw.logo_image)
  const primaryColor = typeof t?.primary_color === 'string' ? t.primary_color : undefined
  const accentColor = typeof t?.accent_color === 'string' ? t.accent_color : undefined
  const backgroundColor = typeof t?.background_color === 'string' ? t.background_color : undefined
  const fontFamily = typeof t?.font_family === 'string' ? t.font_family : undefined
  if (!primaryColor && !accentColor && !backgroundColor && !fontFamily && !logoImage) return undefined
  return {
    primaryColor: normalizeHex(primaryColor, DEFAULT_PRIMARY_COLOR),
    accentColor: normalizeHex(accentColor, DEFAULT_ACCENT_COLOR),
    logoImage,
    backgroundColor,
    fontFamily,
  }
}

function mapProduct(raw: Record<string, unknown>, index: number, vendorId: string): Product {
  return {
    id: String(raw.sku_id ?? raw.id ?? `${vendorId}-p${index}`),
    name: String(raw.name ?? raw.sku_name ?? 'Item'),
    description: String(raw.description ?? raw.sku_description ?? ''),
    price: Number(raw.sale_price ?? raw.selling_price ?? raw.list_price ?? raw.price ?? 0),
    veg: Boolean(raw.veg ?? raw.is_veg ?? true),
    popular: Boolean(raw.popular),
  }
}

/** Live vendors use `vendor_id`. `id` alone can be a different row key. */
export function liveVendorId(raw: Record<string, unknown>): string {
  const id = raw.vendor_id ?? raw.vendorId ?? raw.id
  return id == null ? '' : String(id)
}

export function mapProducts(raw: unknown, vendorId: string): Product[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map((item, index) => mapProduct(item, index, vendorId))
}

function mapCategory(raw: Record<string, unknown>, index: number): StoreCategory | null {
  const label = String(raw.name ?? raw.label ?? '').trim()
  if (!label) return null
  const id = String(raw.id ?? raw.category_id ?? raw.slug ?? label)
    .trim()
    .toLowerCase()
  const imagePath =
    (typeof raw.image_path === 'string' && raw.image_path) ||
    (typeof raw.imagePath === 'string' && raw.imagePath) ||
    httpUrl(raw.image) ||
    undefined
  return { id: id || `cat-${index}`, label, imagePath }
}

export function mapCategories(raw: unknown): StoreCategory[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const categories = raw
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map(mapCategory)
    .filter((item): item is StoreCategory => item != null)
  return categories.length ? categories : undefined
}

/** Raw vendor / storefront payload → Store. */
export function mapVendorToStore(raw: Record<string, unknown>): Store {
  const id = liveVendorId(raw)
  const categorySource = raw.tagline ?? raw.category ?? raw.cuisine ?? raw.business_location
  return {
    id,
    name: String(raw.business_name ?? raw.name ?? 'Store').trim() || 'Store',
    category: String(categorySource ?? 'Local'),
    rating: Number(raw.rating ?? 4.2),
    etaMins: Number(raw.etaMins ?? raw.eta_mins ?? 30),
    distanceKm: Number(raw.distanceKm ?? raw.distance_km ?? 2),
    image: coverImage(raw),
    offer: raw.announcement_bar
      ? String(raw.announcement_bar)
      : raw.offer
        ? String(raw.offer)
        : undefined,
    theme: mapVendorTheme(raw),
    categories: mapCategories(raw.categories),
    products: Array.isArray(raw.products)
      ? mapProducts(raw.products, id)
      : Array.isArray(raw.menu)
        ? (raw.menu as Store['products'])
        : [],
  }
}
