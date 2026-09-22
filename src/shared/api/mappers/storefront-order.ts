/**
 * Customer checkout: POST /v1/orders/from-cart (CreateOrderFromCartRequest).
 * Only documented OpenAPI fields — do not invent keys.
 */

export type CreateOrderFromCartBody = {
  vendor_id: number
  delivery_method: 'HOME_DELIVERY' | 'STORE_PICKUP' | 'BOTH'
  address_id?: number
  delivery_date?: string
  order_timing_type?: 'INSTANT' | 'FIXED_WINDOW' | 'CUSTOMER_SELECT_DATE' | 'PREDEFINED_DAYS'
  pickup_address_id?: number
  pickup_slot?: 'Morning' | 'Evening'
  payment_type_id?: number
  clear_cart?: boolean
  notes?: string
  order_source?: 'APP' | 'WHATSAPP' | 'ADMIN' | 'VENDOR' | 'CUSTOMER_CARE'
}

export type PlaceOrderDraft = {
  vendorId: string
  deliveryMethod?: string | null
  addressId?: number | null
  deliveryDate?: string | null
  orderTimingType?: string | null
  paymentTypeId?: string | null
  notes?: string | null
  pickupSlot?: string | null
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

export function asNumericId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return Math.trunc(value)
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    const n = Number(value.trim())
    return n > 0 ? n : null
  }
  return null
}

function asMoney(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value)
  return null
}

const TIMING = new Set(['INSTANT', 'FIXED_WINDOW', 'CUSTOMER_SELECT_DATE', 'PREDEFINED_DAYS'])

function deliveryMethod(
  value: string | null | undefined,
): CreateOrderFromCartBody['delivery_method'] {
  const method = value?.trim().toUpperCase()
  if (method === 'STORE_PICKUP') return 'STORE_PICKUP'
  if (method === 'BOTH') return 'BOTH'
  return 'HOME_DELIVERY'
}

function isoDate(value: string | null | undefined): string | undefined {
  const text = value?.trim()
  if (text && /^\d{4}-\d{2}-\d{2}$/.test(text)) return text
  const fromId = /^date-(\d{4}-\d{2}-\d{2})$/.exec(text ?? '')
  return fromId?.[1]
}

function timingType(
  value: string | null | undefined,
): CreateOrderFromCartBody['order_timing_type'] | undefined {
  const timing = value?.trim().toUpperCase()
  return timing && TIMING.has(timing)
    ? (timing as CreateOrderFromCartBody['order_timing_type'])
    : undefined
}

function pickupSlot(value: string | null | undefined): 'Morning' | 'Evening' | undefined {
  const slot = value?.trim()
  if (slot === 'Morning' || slot === 'Evening') return slot
  const upper = slot?.toUpperCase()
  if (upper === 'MORNING') return 'Morning'
  if (upper === 'EVENING') return 'Evening'
  return undefined
}

export type CheckoutAddressDraft = {
  name?: string | null
  location: string
  lat?: number | null
  lng?: number | null
  city?: string | null
  country?: string | null
  zipCode?: string | null
}

export type ParsedLocationParts = {
  city?: string
  state?: string
  country?: string
  zipCode?: string
}

/** Pull city / state / country / 6-digit pin from a Google-style label. */
export function parseLocationParts(location: string): ParsedLocationParts {
  const parts = location
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
  const zipCode = location.match(/\b(\d{6})\b/)?.[1]
  const country = parts.find((part) => /^india$/i.test(part))
  const placeParts = parts
    .map((part) => part.replace(/\b\d{6}\b/g, '').trim())
    .filter((part) => part && !/^india$/i.test(part))
  const city = placeParts.length >= 2 ? placeParts[placeParts.length - 2] : placeParts[0]
  const state = placeParts.length >= 2 ? placeParts[placeParts.length - 1] : undefined
  return {
    ...(city ? { city } : {}),
    ...(state ? { state } : {}),
    ...(country ? { country } : {}),
    ...(zipCode ? { zipCode } : {}),
  }
}

/**
 * Live add-address requires address1, city, country, latitude, longitude, zipCode
 * (verified 19 Sep 2026). OpenAPI's "valid keys" list is incomplete.
 */
export function mapNameAndAddressRequest(input: CheckoutAddressDraft): {
  name?: string
  address: Record<string, string>
} {
  const parsed = parseLocationParts(input.location)
  const address1 = input.location.trim()
  const city = asString(input.city) ?? parsed.city
  const country = asString(input.country) ?? parsed.country ?? 'India'
  const zipCode = asString(input.zipCode) ?? parsed.zipCode
  const state = parsed.state
  const lat = input.lat
  const lng = input.lng

  if (
    !address1 ||
    !city ||
    !country ||
    !zipCode ||
    lat == null ||
    lng == null ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    throw new Error(
      'We need a full delivery address including city, pincode, and map pin. Search or move the pin and try again.',
    )
  }

  const address: Record<string, string> = {
    address1,
    city,
    country,
    zipCode,
    latitude: String(lat),
    longitude: String(lng),
  }
  if (state) address.state = state

  const name = asString(input.name)
  return name ? { name, address } : { address }
}

/** Build the documented from-cart body. Omits optional fields the API can default. */
export function mapCreateOrderFromCartBody(draft: PlaceOrderDraft): CreateOrderFromCartBody {
  const vendorId = asNumericId(draft.vendorId)
  if (!vendorId) {
    throw new Error('This store cannot accept an order right now.')
  }

  const method = deliveryMethod(draft.deliveryMethod)
  const body: CreateOrderFromCartBody = {
    vendor_id: vendorId,
    delivery_method: method,
    clear_cart: true,
    order_source: 'APP',
  }

  const notes = asString(draft.notes)
  if (notes) body.notes = notes

  const paymentTypeId = asNumericId(draft.paymentTypeId)
  if (paymentTypeId) body.payment_type_id = paymentTypeId

  const orderTimingType = timingType(draft.orderTimingType)
  if (orderTimingType) body.order_timing_type = orderTimingType

  if (method === 'STORE_PICKUP') {
    body.pickup_address_id = vendorId
    const slot = pickupSlot(draft.pickupSlot)
    if (slot) body.pickup_slot = slot
    return body
  }

  const addressId = asNumericId(draft.addressId)
  if (addressId) body.address_id = addressId

  const deliveryDate = isoDate(draft.deliveryDate)
  if (deliveryDate && orderTimingType !== 'INSTANT') body.delivery_date = deliveryDate

  return body
}

function looksLikeAddress(row: Record<string, unknown>): boolean {
  return Boolean(
    row.address1 ||
      row.address_1 ||
      row.type ||
      row.city ||
      row.zipCode ||
      row.latitude ||
      row.address_id ||
      asRecord(row.address),
  )
}

function isDefaultAddress(row: Record<string, unknown>): boolean {
  return (
    row.defaultOne === true ||
    row.default_one === true ||
    row.default === true ||
    row.is_default === true
  )
}

function idFromAddressRow(row: Record<string, unknown> | null): number | null {
  if (!row) return null
  return asNumericId(row.id ?? row.address_id)
}

function idFromAddressList(list: unknown): number | null {
  if (!Array.isArray(list) || list.length === 0) return null
  const rows = list
    .map((item) => asRecord(item))
    .filter((item): item is Record<string, unknown> => item != null)
  const preferred = rows.find(isDefaultAddress)
  const fromPreferred = idFromAddressRow(preferred ?? null)
  if (fromPreferred) return fromPreferred
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const id = idFromAddressRow(rows[i])
    if (id) return id
  }
  return null
}

export function extractAddressId(payload: unknown): number | null {
  const root = asRecord(payload)
  const data = asRecord(root?.data) ?? root
  if (!data) return null

  const fromAddressId = asNumericId(data.address_id)
  if (fromAddressId) return fromAddressId

  const nested = asRecord(data.address)
  const fromNested = idFromAddressRow(nested)
  if (fromNested) return fromNested

  for (const key of ['addresses', 'user_addresses', 'delivery_addresses'] as const) {
    const fromList = idFromAddressList(data[key])
    if (fromList) return fromList
  }

  // `id` only when this row is an address — user profiles also have `id`.
  return looksLikeAddress(data) ? asNumericId(data.id) : null
}

export function mapPlacedOrder(
  payload: unknown,
  fallback: { storeId: string; storeName: string; total: number },
): {
  id: string
  storeId: string
  storeName: string
  total: number
  status: string
  placedAt: string
} {
  const root = asRecord(payload)
  const data = asRecord(root?.data) ?? root ?? {}
  const amount = asRecord(data.order_amount)
  const total = asMoney(amount?.amount ?? data.total ?? data.grand_total) ?? fallback.total

  return {
    id: asString(data.order_id ?? data.id) ?? `ORD-${Date.now()}`,
    storeId: asString(data.vendor_id) ?? fallback.storeId,
    storeName: asString(data.store_name) ?? fallback.storeName,
    total,
    status: asString(data.order_status ?? data.status) ?? 'placed',
    placedAt: asString(data.order_date ?? data.created_at) ?? new Date().toISOString(),
  }
}
