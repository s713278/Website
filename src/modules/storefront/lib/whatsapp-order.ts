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
  // Self-contained HTML for the reserved tab (about:blank) — no external assets.
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Getting your order ready</title><style>
    body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:Inter,system-ui,sans-serif;background:#f8fafc;color:#0f172a}
    .box{display:flex;flex-direction:column;align-items:center;gap:12px;padding:24px;max-width:20rem;text-align:center}
    .illu{display:flex;align-items:center;justify-content:center;width:5.5rem;height:5.5rem;border-radius:1.5rem;background:color-mix(in srgb,${theme} 16%,#fff);color:${theme};box-shadow:0 1px 0 rgba(15,23,42,.04)}
    .illu svg{width:2.75rem;height:2.75rem}
    .spin{width:2rem;height:2rem;border-radius:999px;border:3px solid #e2e8f0;border-top-color:${theme};animation:spin .7s linear infinite;margin-top:4px}
    .title{margin:0;font-size:1rem;font-weight:700;letter-spacing:-.01em}
    .sub{margin:0;font-size:.8125rem;font-weight:500;line-height:1.45;color:#64748b}
    @keyframes spin{to{transform:rotate(360deg)}}
  </style></head><body><div class="box">
    <div class="illu" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM12.05 21.785h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884zM20.885 3.488A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>
    </div>
    <p class="title">Getting your order ready…</p>
    <p class="sub">Next, we’ll open WhatsApp so you can send the order details to the shop owner.</p>
    <div class="spin" role="status" aria-label="Getting your order ready"></div>
  </div></body></html>`
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
