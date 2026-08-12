import type { Store, StoreTheme } from '@/modules/storefront/types'
import { DEFAULT_ACCENT_COLOR, DEFAULT_PRIMARY_COLOR, normalizeHex } from '@/shared/lib/theme'

/** Wire `theme` object → StoreTheme. */
export function mapVendorTheme(raw: Record<string, unknown>): StoreTheme | undefined {
  const t = raw.theme as Record<string, unknown> | undefined
  if (!t || typeof t !== 'object') return undefined
  const primaryColor = typeof t.primary_color === 'string' ? t.primary_color : undefined
  const accentColor = typeof t.accent_color === 'string' ? t.accent_color : undefined
  const backgroundColor = typeof t.background_color === 'string' ? t.background_color : undefined
  const fontFamily = typeof t.font_family === 'string' ? t.font_family : undefined
  if (!primaryColor && !accentColor && !backgroundColor && !fontFamily) return undefined
  return {
    primaryColor: normalizeHex(primaryColor, DEFAULT_PRIMARY_COLOR),
    accentColor: normalizeHex(accentColor, DEFAULT_ACCENT_COLOR),
    logoImage: typeof t.logo_image === 'string' && t.logo_image ? t.logo_image : undefined,
    // Left unnormalized on purpose — getBgPreset/getFontPreset are the single
    // validation gate, so curated-only stays enforced in exactly one place.
    backgroundColor,
    fontFamily,
  }
}

/** Raw vendor payload → Store. Tolerates the backend's varying field spellings. */
export function mapVendorToStore(raw: Record<string, unknown>): Store {
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
    theme: mapVendorTheme(raw),
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
