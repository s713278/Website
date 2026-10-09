import type { CartLine } from '@/modules/storefront/types'
import { displayLineName, lineAmount, lineUnitPrice, parseLineUnit } from '@/modules/storefront/lib/cart-utils'
import { formatCurrency } from '@/shared/lib/utils'

type WhatsAppOrderInput = {
  orderId: string
  storeName: string
  customerName?: string
  location: string
  phone: string
  address1?: string
  address2?: string
  city?: string
  district?: string
  state?: string
  zipCode?: string
  lines: CartLine[]
  subtotal: number
  deliveryFee: number
  packagingFee: number
  discount?: number
  serviceFee?: number
  total: number
  paymentLabel: string
  deliveryMethodLabel?: string
  deliverySlotLabel?: string
  deliveryDateLabel?: string
}

export function whatsappHref(phone: string, message: string) {
  const digits = phone.replace(/\D/g, '')
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}

/**
 * Chat link opened after the order exists.
 * Desktop goes straight to WhatsApp Web. A wa.me hop lands on api.whatsapp.com and stays blank.
 * Phones use the app handoff without that extra redirect.
 */
export function whatsappSendHref(phone: string, message: string) {
  const digits = phone.replace(/\D/g, '')
  const params = new URLSearchParams({ phone: digits, text: message })
  const mobile =
    typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  const base = mobile ? 'https://api.whatsapp.com/send' : 'https://web.whatsapp.com/send'
  return `${base}?${params.toString()}`
}

function themeHex(color?: string) {
  const value = color?.trim() ?? ''
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value) ? value : '#10b981'
}

function orderWaitPage(color?: string) {
  const theme = themeHex(color)
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Creating your order</title><style>
    body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:Inter,system-ui,sans-serif;background:#f8fafc;color:#0f172a}
    .box{display:flex;flex-direction:column;align-items:center;gap:14px}
    .spin{width:42px;height:42px;border-radius:999px;border:3px solid #e2e8f0;border-top-color:${theme};animation:spin .7s linear infinite}
    p{margin:0;font-size:15px;font-weight:600}
    @keyframes spin{to{transform:rotate(360deg)}}
  </style></head><body><div class="box"><div class="spin" role="status" aria-label="Creating your order"></div><p>Creating your order…</p></div></body></html>`
}

/** Open a tab during the click so the later API response can still reach WhatsApp. */
export function reserveWhatsAppWindow(themeColor?: string) {
  const popup = window.open('', '_blank')
  if (!popup) return null
  try {
    popup.document.open()
    popup.document.write(orderWaitPage(themeColor))
    popup.document.close()
  } catch {
    /* popup blocked the document write */
  }
  return popup
}

/** Replace the wait tab with the chat. Do not clear opener first; that cancels the load. */
export function openWhatsAppChat(url: string, reserved?: Window | null) {
  if (reserved && !reserved.closed) {
    try {
      if (typeof reserved.location.replace === 'function') reserved.location.replace(url)
      else reserved.location.href = url
      return true
    } catch {
      reserved.close()
    }
  }
  return window.open(url, '_blank', 'noopener,noreferrer') != null
}

function formatCustomerPhone(phone: string) {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) return `+91 ${digits}`
  if (digits.length === 12 && digits.startsWith('91')) return `+91 ${digits.slice(2)}`
  const trimmed = phone.trim()
  return trimmed || '—'
}

function labeledAddressLines(input: WhatsAppOrderInput) {
  return [
    input.address1?.trim() ? `Address: ${input.address1.trim()}` : null,
    input.address2?.trim() ? `Locality: ${input.address2.trim()}` : null,
    input.city?.trim() ? `City: ${input.city.trim()}` : null,
    input.district?.trim() ? `District: ${input.district.trim()}` : null,
    input.state?.trim() ? `State: ${input.state.trim()}` : null,
    input.zipCode?.trim() ? `ZIP: ${input.zipCode.trim()}` : null,
  ].filter((line): line is string => Boolean(line))
}

function addressBlock(input: WhatsAppOrderInput) {
  const labeled = labeledAddressLines(input)
  const location = input.location.trim()
  // A saved checkout form has a street. A map pin often has only city and ZIP,
  // with the full formatted address kept on location.
  if (input.address1?.trim()) return labeled.length > 0 ? [labeled.join(' · ')] : location ? [location] : ['—']
  if (!location) return labeled.length > 0 ? [labeled.join(' · ')] : ['—']

  const extras = labeled.filter((line) => {
    const value = line.slice(line.indexOf(':') + 1).trim()
    return value.length > 0 && !location.toLowerCase().includes(value.toLowerCase())
  })
  return extras.length > 0 ? [location, extras.join(' · ')] : [location]
}

function itemBlock(line: CartLine, index: number) {
  const product = displayLineName(line.name) || line.name
  const variant = parseLineUnit(line.name)
  const sku = line.skuId?.trim() || line.itemId.trim()
  return [
    `${index + 1}. ${product}`,
    variant ? `Variant: ${variant}` : null,
    sku ? `SKU: ${sku}` : null,
    `Qty: ${line.qty}`,
    `Price: ${formatCurrency(lineUnitPrice(line))}`,
    `Amount: ${formatCurrency(lineAmount(line))}`,
  ]
    .filter((row): row is string => Boolean(row))
    .join(' · ')
}

function paymentBlock(input: WhatsAppOrderInput) {
  const fees = [
    `Item total (MRP): ${formatCurrency(input.subtotal)}`,
    input.deliveryFee > 0 ? `Delivery: ${formatCurrency(input.deliveryFee)}` : null,
    input.packagingFee > 0 ? `Packaging: ${formatCurrency(input.packagingFee)}` : null,
    (input.serviceFee ?? 0) > 0 ? `Service charge: ${formatCurrency(input.serviceFee ?? 0)}` : null,
    (input.discount ?? 0) > 0 ? `Discount: −${formatCurrency(input.discount ?? 0)}` : null,
  ]
    .filter((row): row is string => Boolean(row))
    .join(' · ')
  return [`Method: ${input.paymentLabel}`, fees, `*Total: ${formatCurrency(input.total)}*`].join('\n')
}

function fulfillmentBlock(input: WhatsAppOrderInput) {
  const rows = [
    input.deliveryMethodLabel?.trim() ? `Method: ${input.deliveryMethodLabel.trim()}` : null,
    input.deliverySlotLabel?.trim() ? `Slot: ${input.deliverySlotLabel.trim()}` : null,
    input.deliveryDateLabel?.trim() ? `Date: ${input.deliveryDateLabel.trim()}` : null,
  ].filter((row): row is string => Boolean(row))
  return rows.length > 0 ? rows.join(' · ') : null
}

export function buildWhatsAppOrderMessage(input: WhatsAppOrderInput) {
  const customer = [
    input.customerName?.trim() ? `Name: ${input.customerName.trim()}` : null,
    `Phone: ${formatCustomerPhone(input.phone)}`,
  ]
    .filter((row): row is string => Boolean(row))
    .join(' · ')

  const items = input.lines.map((line, index) => itemBlock(line, index)).join('\n')
  const fulfillment = fulfillmentBlock(input)
  const addressHeading = input.deliveryMethodLabel?.trim().toLowerCase().includes('pickup')
    ? '*Pickup*'
    : '*Delivery address*'

  return [
    `🛒 *New Order — ${input.storeName}*`,
    `*Order ID:* ${input.orderId}`,
    '*Customer*',
    customer,
    addressHeading,
    addressBlock(input).join('\n'),
    fulfillment,
    '*Items*',
    items,
    '*Payment*',
    paymentBlock(input),
  ]
    .filter((row): row is string => Boolean(row))
    .join('\n')
}
