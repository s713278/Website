import type { CartLine } from '@/modules/storefront/types'
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

export function buildWhatsAppOrderMessage(input: WhatsAppOrderInput) {
  const items = input.lines
    .map((line, index) => `${index + 1}. ${line.name} × ${line.qty} — ${formatCurrency(line.price * line.qty)}`)
    .join('\n')

  return [
    `🛒 *New Order — ${input.storeName}*`,
    '',
    `*Order ID:* ${input.orderId}`,
    input.phone ? `*Phone:* +91 ${input.phone}` : '*Phone:* —',
    `*Location:* ${input.location}`,
    `*Delivery slot:* ${input.deliverySlot}`,
    `*Payment:* ${input.paymentLabel}`,
    '',
    '*Items:*',
    items,
    '',
    `Subtotal: ${formatCurrency(input.subtotal)}`,
    `Delivery: ${formatCurrency(input.deliveryFee)}`,
    `Packaging: ${formatCurrency(input.packagingFee)}`,
    `*Total: ${formatCurrency(input.total)}*`,
  ].join('\n')
}
