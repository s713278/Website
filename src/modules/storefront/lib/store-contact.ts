import type { Store } from '@/modules/storefront/types'
import { storeContactPath } from '@/modules/storefront/lib/store-paths'

export type MapPoint = {
  /** Street, area, city, state, and PIN, in that order. */
  label?: string
  latitude?: string
  longitude?: string
}

function mapPin(point: MapPoint): string | undefined {
  if (!point.latitude || !point.longitude) return undefined
  const latitude = Number(point.latitude)
  const longitude = Number(point.longitude)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return undefined
  return `${point.latitude},${point.longitude}`
}

/**
 * Pin is the coordinates, same as Swiggy, Zomato, and Meesho.
 * The written address stays on the card. Searching that text in Google Maps
 * returns nearby lookalikes instead of this point.
 */
export function mapsSearchUrl(point: MapPoint): string | undefined {
  const pin = mapPin(point)
  if (pin) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pin)}`
  const label = point.label?.trim()
  if (!label) return undefined
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(label)}`
}

/** Preview iframe for the same pin. */
export function mapsEmbedUrl(point: MapPoint): string | undefined {
  const pin = mapPin(point)
  const query = pin || point.label?.trim()
  if (!query) return undefined
  return `https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=${pin ? 17 : 15}&output=embed`
}

/** Find us uses `business_location` — never the customer delivery pin. */
export function findUsAddress(store: Pick<Store, 'location'>): string | undefined {
  const location = store.location?.trim()
  return location || undefined
}

export function supportWhatsappNumber(store: Pick<Store, 'supportWhatsapp' | 'phone'>): string | undefined {
  const support = store.supportWhatsapp?.trim()
  if (support) return support
  const order = store.phone?.trim()
  return order || undefined
}

export function orderWhatsappNumber(store: Pick<Store, 'supportWhatsapp' | 'phone'>): string | undefined {
  const order = store.phone?.trim()
  if (order) return order
  return store.supportWhatsapp?.trim() || undefined
}

export function supportHelpMessage(shopName: string) {
  return `Hi, I need help from ${shopName}`
}

export function hasStoreContactFacts(store: Store): boolean {
  return Boolean(findUsAddress(store) || supportWhatsappNumber(store))
}

export function storeContactHeaderProps(store: Store | null | undefined): {
  contactHref?: string
} {
  if (!store) return {}
  return {
    contactHref: hasStoreContactFacts(store) ? storeContactPath(store.id) : undefined,
  }
}
