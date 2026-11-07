import type { Store } from '@/modules/storefront/types'
import { orderWhatsappNumber } from '@/modules/storefront/lib/store-contact'
import { whatsappHref } from '@/modules/storefront/lib/whatsapp-order'

/** Chat with Owner is for open orders only */
export function canChatAboutOrder(status: string): boolean {
  const key = status.trim().toUpperCase().replace(/[\s-]+/g, '_')
  return key !== 'DELIVERED' && key !== 'CANCELLED' && key !== 'CANCELED'
}

export function orderOwnerChatMessage(orderId: string): string {
  return `Hi! This is about Order #${orderId.trim()}.`
}

/**
 * Order-scoped WhatsApp: `order_whatsapp_number` (`store.phone`), same wa.me helper as Contact us.
 */
export function orderOwnerChatHref(
  store: Pick<Store, 'supportWhatsapp' | 'phone'> | null | undefined,
  orderId: string,
): string | null {
  const phone = store ? orderWhatsappNumber(store) : undefined
  if (!phone) return null
  return whatsappHref(phone, orderOwnerChatMessage(orderId))
}
