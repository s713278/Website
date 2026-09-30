import { DELIVERY_ESTIMATE_NOTE } from '@/modules/storefront/lib/order-display'
import type { CartLine } from '@/modules/storefront/types'
import { lineAmount } from '@/modules/storefront/lib/cart-utils'
import { formatCurrency } from '@/shared/lib/utils'

type WhatsAppOrderInput = {
  orderId: string
  storeName: string
  location: string
  phone: string
  lines: CartLine[]
  subtotal: number
  deliveryFee: number
  packagingFee: number
  total: number
  deliverySlot: string
  paymentLabel: string
}

export function whatsappHref(phone: string, message: string) {
  const digits = phone.replace(/\D/g, '')
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}

function draftKey(orderId: string) {
  return `md-wa-order:${orderId}`
}

/** Keep the WhatsApp text across the success screen (refresh / missing location state). */
export function saveWhatsAppOrderDraft(orderId: string, message: string) {
  try {
    sessionStorage.setItem(draftKey(orderId), message)
  } catch {
    /* private mode */
  }
}

export function readWhatsAppOrderDraft(orderId: string) {
  try {
    return sessionStorage.getItem(draftKey(orderId)) ?? ''
  } catch {
    return ''
  }
}

export function buildWhatsAppOrderMessage(input: WhatsAppOrderInput) {
  const items = input.lines
    .map((line, index) => `${index + 1}. ${line.name} × ${line.qty} — ${formatCurrency(lineAmount(line))}`)
    .join('\n')

  return [
    `🛒 *New Order — ${input.storeName}*`,
    '',
    `*Order ID:* ${input.orderId}`,
    input.phone ? `*Phone:* +91 ${input.phone}` : '*Phone:* —',
    `*Location:* ${input.location}`,
    `*Estimated delivery:* ${input.deliverySlot}`,
    DELIVERY_ESTIMATE_NOTE,
    `*Payment:* ${input.paymentLabel}`,
    '',
    '*Items:*',
    items,
    '',
    `Subtotal: ${formatCurrency(input.subtotal)}`,
    `*Total: ${formatCurrency(input.total)}*`,
  ].join('\n')
}
