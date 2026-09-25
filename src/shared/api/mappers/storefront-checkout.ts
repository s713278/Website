/**
 * Customer checkout: GET /v1/vendors/{id}/checkout_options → storefront UI options.
 * Separate from vendor-onboarding's CheckoutOptionsSnapshot (wizard resume).
 */

export type StorefrontCheckoutSlot = {
  id: string
  label: string
  description?: string
  recommended?: boolean
  date?: string
}

export type StorefrontCheckoutPayment = {
  id: string
  label: string
  type: 'CASH_ON_DELIVERY' | 'ONLINE' | 'PRE_PAID'
  isDefault?: boolean
}

export type StorefrontCheckoutOptions = {
  deliveryMethods: Array<'HOME_DELIVERY' | 'STORE_PICKUP'>
  deliverySlots: StorefrontCheckoutSlot[]
  paymentOptions: StorefrontCheckoutPayment[]
  availableDeliveryDates: string[]
  schedulingStrategy: string | null
  shipping: {
    deliveryCharge: number | null
    freeDeliveryThreshold: number | null
  }
  consentTitle: string | null
  consentText: string | null
  fulfillmentType: string | null
  orderAcceptancePolicy: string | null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function asString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return null
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value)
  return null
}

function paymentLabel(type: StorefrontCheckoutPayment['type']): string {
  if (type === 'CASH_ON_DELIVERY') return 'Cash on Delivery'
  if (type === 'PRE_PAID') return 'Pre-paid'
  return 'UPI / Card / Net Banking'
}

function paymentId(type: StorefrontCheckoutPayment['type']): string {
  if (type === 'CASH_ON_DELIVERY') return 'cod'
  if (type === 'PRE_PAID') return 'prepaid'
  return 'online'
}

function mapTimeSlot(value: unknown, index: number): StorefrontCheckoutSlot | null {
  const text = asString(value)
  if (!text) return null
  return {
    id: `slot-${index}-${text}`,
    label: text,
    description: 'Delivery window',
    recommended: index === 0,
  }
}

function isoDayParts(isoDate: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate)
  if (!match) return null
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  if (Number.isNaN(date.getTime())) return null
  return {
    iso: isoDate,
    day: new Intl.DateTimeFormat('en-IN', { day: 'numeric' }).format(date),
    month: new Intl.DateTimeFormat('en-IN', { month: 'short' }).format(date),
    year: new Intl.DateTimeFormat('en-IN', { year: 'numeric' }).format(date),
  }
}

/** `2026-09-18` → "Thu, 18 Sep". Falls back to the raw ISO date. */
export function formatCheckoutDateLabel(isoDate: string): string {
  const parts = isoDayParts(isoDate)
  if (!parts) return isoDate
  const date = new Date(`${isoDate}T12:00:00`)
  return date.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

/**
 * Eligible-date window for customers — first to last, not a picked day.
 * `['2026-09-26','2026-09-27','2026-09-28']` → `26–28 Sept`.
 */
export function formatDeliveryEstimate(dates: string[]): string {
  const unique = [...new Set(dates.map((item) => item.trim()).filter((item) => isoDayParts(item)))].sort()
  const start = unique[0] ? isoDayParts(unique[0]) : null
  const end = unique[unique.length - 1] ? isoDayParts(unique[unique.length - 1]!) : null
  if (!start) return ''
  if (!end || start.iso === end.iso) return `${start.day} ${start.month}`
  if (start.month === end.month && start.year === end.year) {
    return `${start.day}–${end.day} ${start.month}`
  }
  if (start.year === end.year) return `${start.day} ${start.month}–${end.day} ${end.month}`
  return `${start.day} ${start.month} ${start.year}–${end.day} ${end.month} ${end.year}`
}

function stringList(...candidates: unknown[]): string[] {
  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue
    const values = candidate.map((item) => asString(item)).filter((item): item is string => Boolean(item))
    if (values.length) return values
  }
  return []
}

/** Map OpenAPI `data` (or full envelope) into checkout UI options. */
export function mapStorefrontCheckoutOptions(payload: unknown): StorefrontCheckoutOptions | null {
  const root = asRecord(payload)
  if (!root) return null
  const data = asRecord(root.data) ?? root

  const delivery = asRecord(data.delivery_options) ?? {}
  const shipping = asRecord(delivery.shipping_config) ?? {}

  const methodsRaw = Array.isArray(data.delivery_methods) ? data.delivery_methods : []
  const deliveryMethods = methodsRaw
    .map((item) => asString(item)?.toUpperCase())
    .filter((item): item is 'HOME_DELIVERY' | 'STORE_PICKUP' =>
      item === 'HOME_DELIVERY' || item === 'STORE_PICKUP',
    )

  // Live API currently sends `eligible_delivery_dates`; older examples used `available_delivery_dates`.
  const availableDeliveryDates = stringList(
    delivery.eligible_delivery_dates,
    delivery.available_delivery_dates,
  )

  const deliverySlots = (
    Array.isArray(data.delivery_slots) ? data.delivery_slots : []
  )
    .map(mapTimeSlot)
    .filter((slot): slot is StorefrontCheckoutSlot => slot != null)

  const paymentsRaw = Array.isArray(data.payment_options) ? data.payment_options : []
  const paymentOptions: StorefrontCheckoutPayment[] = []
  for (const entry of paymentsRaw) {
    const row = asRecord(entry)
    if (!row) continue
    const type = asString(row.type)?.toUpperCase()
    if (type !== 'CASH_ON_DELIVERY' && type !== 'ONLINE' && type !== 'PRE_PAID') continue
    paymentOptions.push({
      id: asString(row.id) ?? paymentId(type),
      label: asString(row.label) ?? paymentLabel(type),
      type,
      isDefault: row.default === true || row.is_default === true,
    })
  }

  return {
    deliveryMethods:
      deliveryMethods.length > 0
        ? deliveryMethods
        : (['HOME_DELIVERY'] as StorefrontCheckoutOptions['deliveryMethods']),
    deliverySlots,
    paymentOptions,
    availableDeliveryDates,
    schedulingStrategy: asString(delivery.scheduling_strategy)?.toUpperCase() ?? null,
    shipping: {
      deliveryCharge: asNumber(shipping.delivery_charge ?? shipping.charge),
      freeDeliveryThreshold: asNumber(shipping.free_delivery_threshold),
    },
    consentTitle: asString(data.customer_consent_title),
    consentText: asString(data.customer_consent_text),
    fulfillmentType: asString(data.fulfillment_type)?.toUpperCase() ?? null,
    orderAcceptancePolicy: asString(data.order_acceptance_policy)?.toUpperCase() ?? null,
  }
}
