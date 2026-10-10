import type { Store } from '@/modules/storefront/types'
import { orderWhatsappNumber } from '@/modules/storefront/lib/store-contact'
import { whatsappHref } from '@/modules/storefront/lib/whatsapp-order'

/** Chat with Owner is for open orders only */
export function canChatAboutOrder(status: string): boolean {
  const key = status.trim().toUpperCase().replace(/[\s-]+/g, '_')
  return key !== 'DELIVERED' && key !== 'CANCELLED' && key !== 'CANCELED'
}

export function orderOwnerChatMessage(orderId: string, storeName: string): string {
  const id = orderId.trim()
  const shop = storeName.trim() || 'the store'
  return `Hi! This is about Order #${id} from ${shop}.`
}

/**
 * Order-scoped WhatsApp: `order_whatsapp_number` (`store.phone`), same wa.me helper as Contact us.
  */
export function orderOwnerChatHref(
  store: Pick<Store, 'supportWhatsapp' | 'phone'> | null | undefined,
  orderId: string,
  storeName: string,
): string | null {
  const phone = store ? orderWhatsappNumber(store) : undefined
  if (!phone) return null
  return whatsappHref(phone, orderOwnerChatMessage(orderId, storeName))
}
