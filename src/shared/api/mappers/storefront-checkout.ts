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
    details?: {
    upiAccount?: string
    accountHolderName?: string
  }
}

export type StorefrontPickupStore = {
  /** Vendor store id — sent as `pickup_address_id` on from-cart. */
  id: string
  name: string
  address: string | null
  readyInMinutes: number | null
  /** Configured slots from `pickup_options.stores[].pickup_slots` (e.g. Morning, Evening). */
  pickupSlots: StorefrontCheckoutSlot[]
}

export type StorefrontCheckoutOptions = {
  deliveryMethods: Array<'HOME_DELIVERY' | 'STORE_PICKUP'>
  deliverySlots: StorefrontCheckoutSlot[]
  paymentOptions: StorefrontCheckoutPayment[]
  availableDeliveryDates: string[]
  schedulingStrategy: string | null
  /** `delivery_options.shipping_strategy_type` from checkout_options. */
  shippingStrategyType: string | null
  shipping: {
    deliveryCharge: number | null
    freeDeliveryThreshold: number | null
  }
  /** `pickup_options.stores` — source of pickup_address_id and pickup_slot. */
  pickupStores: StorefrontPickupStore[]
  /** `pickup_options.pickup_message` when the API sends one. */
  pickupMessage: string | null
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

/** `shipping_config` is an object, and some responses send that object as a JSON string. */
function shippingConfig(value: unknown): Record<string, unknown> {
  if (typeof value === 'string' && value.trim()) {
    try {
      return asRecord(JSON.parse(value)) ?? {}
    } catch {
      return {}
    }
  }
  return asRecord(value) ?? {}
}

function firstNumber(record: Record<string, unknown>, ...keys: string[]): number | null {
  for (const key of keys) {
    const value = asNumber(record[key])
    if (value != null) return value
  }
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

function mapPickupSlot(value: unknown, index: number): StorefrontCheckoutSlot | null {
  const text = asString(value)
  if (!text) return null
  return {
    id: `pickup-slot-${index}-${text}`,
    label: text,
    description: 'Pickup window',
    recommended: index === 0,
  }
}

function mapPickupStore(value: unknown, index: number): StorefrontPickupStore | null {
  const row = asRecord(value)
  if (!row) return null
  const id = asString(row.store_id) ?? asString(row.storeId) ?? asString(row.id)
  if (!id) return null
  const slotsRaw = Array.isArray(row.pickup_slots)
    ? row.pickup_slots
    : Array.isArray(row.pickupSlots)
      ? row.pickupSlots
      : []
  return {
    id,
    name: asString(row.name) ?? `Store ${index + 1}`,
    address: asString(row.address),
    readyInMinutes: asNumber(row.ready_in_minutes) ?? asNumber(row.readyInMinutes),
    pickupSlots: slotsRaw
      .map(mapPickupSlot)
      .filter((slot): slot is StorefrontCheckoutSlot => slot != null),
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
 * Delivery line from checkout_options `shipping_config`.
  */
export function deliveryFeeForCheckout(input: {
  subtotal: number
  method?: string | null
  strategy?: string | null
  shipping?: StorefrontCheckoutOptions['shipping'] | null
}): number | null {
  if (input.method?.trim().toUpperCase() !== 'HOME_DELIVERY') return null

  const charge = input.shipping?.deliveryCharge
  if (charge == null || !Number.isFinite(charge)) return null

  const strategy = input.strategy?.trim().toUpperCase()

  if (strategy === 'ORDER_AMOUNT_THRESHOLD') {
    const threshold = input.shipping?.freeDeliveryThreshold ?? 0
    if (threshold > 0 && input.subtotal >= threshold) return 0
    return charge
  }

   if (strategy === 'WEIGHT_BASED' || strategy === 'ZIPCODE_TIERED') return null
  return charge
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
  const shipping = shippingConfig(delivery.shipping_config)

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
    const details = asRecord(row.details)
    const upiAccount =
      asString(details?.upi_account) ?? asString(details?.upiAccount) ?? asString(details?.upi_id)
    const accountHolderName =
      asString(details?.account_holder_name) ??
      asString(details?.accountHolderName) ??
      asString(details?.holder_name)
    paymentOptions.push({
      id: asString(row.id) ?? paymentId(type),
      label: asString(row.label) ?? paymentLabel(type),
      type,
      isDefault: row.default === true || row.is_default === true,
      ...(upiAccount || accountHolderName
        ? {
            details: {
              ...(upiAccount ? { upiAccount } : {}),
              ...(accountHolderName ? { accountHolderName } : {}),
            },
          }
        : {}),
    })
  }

  const pickup = asRecord(data.pickup_options) ?? {}
  const storesRaw = Array.isArray(pickup.stores) ? pickup.stores : []
  const pickupStores = storesRaw
    .map(mapPickupStore)
    .filter((store): store is StorefrontPickupStore => store != null)

  return {
    deliveryMethods:
      deliveryMethods.length > 0
        ? deliveryMethods
        : (['HOME_DELIVERY'] as StorefrontCheckoutOptions['deliveryMethods']),
    deliverySlots,
    paymentOptions,
    availableDeliveryDates,
    schedulingStrategy: asString(delivery.scheduling_strategy)?.toUpperCase() ?? null,
    shippingStrategyType: asString(delivery.shipping_strategy_type)?.toUpperCase() ?? null,
    shipping: {
      deliveryCharge: firstNumber(
        shipping,
        'delivery_charge',
        'deliveryCharge',
        'charge',
        'default_charge',
        'defaultCharge',
      ),
      freeDeliveryThreshold: firstNumber(
        shipping,
        'free_delivery_threshold',
        'freeDeliveryThreshold',
      ),
    },
    pickupStores,
    pickupMessage: asString(pickup.pickup_message) ?? asString(pickup.pickupMessage),
    consentTitle: asString(data.customer_consent_title),
    consentText: asString(data.customer_consent_text),
    fulfillmentType: asString(data.fulfillment_type)?.toUpperCase() ?? null,
    orderAcceptancePolicy: asString(data.order_acceptance_policy)?.toUpperCase() ?? null,
  }
}
