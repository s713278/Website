import type { Store } from '@/modules/storefront/types'
import { storeContactPath } from '@/modules/storefront/lib/store-paths'
import { whatsappHref } from '@/modules/storefront/lib/whatsapp-order'

export function mapsSearchUrl(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
}

/** Preview iframe for the same shop address — no invented coordinates. */
export function mapsEmbedUrl(address: string) {
  return `https://maps.google.com/maps?q=${encodeURIComponent(address)}&z=15&output=embed`
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

export function supportHelpMessage(shopName: string) {
  return `Hi, I need help from ${shopName}`
}

export function orderWhatsappMessage(shopName: string) {
  return `Hi, I would like to order from ${shopName}`
}

export function hasStoreContactFacts(store: Store): boolean {
  return Boolean(findUsAddress(store) || supportWhatsappNumber(store))
}

export function supportWhatsappHref(store: Pick<Store, 'name' | 'supportWhatsapp' | 'phone'>): string | undefined {
  const phone = supportWhatsappNumber(store)
  if (!phone) return undefined
  return whatsappHref(phone, supportHelpMessage(store.name))
}

export function orderWhatsappHref(store: Pick<Store, 'name' | 'phone'>): string | undefined {
  const phone = store.phone?.trim()
  if (!phone) return undefined
  return whatsappHref(phone, orderWhatsappMessage(store.name))
}

export function storeContactHeaderProps(store: Store | null | undefined): {
  contactHref?: string
  orderWhatsappHref?: string
} {
  if (!store) return {}
  return {
    contactHref: hasStoreContactFacts(store) ? storeContactPath(store.id) : undefined,
    orderWhatsappHref: orderWhatsappHref(store),
  }
}
