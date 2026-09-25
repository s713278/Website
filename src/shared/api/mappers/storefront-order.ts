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

function asNonNegativeInt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return Math.trunc(value)
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) return Number(value.trim())
  return null
}

/** Documented default for GET /v1/users/{id}/orders/history/paged `size`. */
export const CUSTOMER_ORDER_HISTORY_PAGE_SIZE = 20

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

export type MappedCustomerOrder = {
  id: string
  storeId?: string
  storeName: string
  total: number
  status: string
  placedAt: string
  items: Array<{
    name: string
    qty: number
    itemId?: string
    imageUrl?: string
    size?: string
    unitPrice?: number
    listPrice?: number
    lineTotal?: number
    discount?: number
  }>
  paymentStatus?: string
  deliveryDate?: string
  deliveryMethod?: string
  notes?: string
  customerName?: string
  customerMobile?: string
  addressLine?: string
  bill?: {
    itemsCount: number
    grossAmount: number
    discount: number
    deliveryCharges: number
    serviceCharge: number
    taxAmount: number
    amount: number
  }
}

function mapCustomerOrderItem(raw: unknown): MappedCustomerOrder['items'][number] {
  const line = asRecord(raw) ?? {}
  const name = asString(line.sku_name ?? line.name ?? line.product_name) ?? 'Item'
  const size = asString(line.size)
  const imageUrl = asString(line.image_path ?? line.image_url)
  const unitPrice = asMoney(line.unit_price ?? line.sale_price)
  const listPrice = asMoney(line.list_price)
  const lineTotal = asMoney(line.line_total)
  const discount = asMoney(line.discount)
  return {
    name,
    qty: Math.max(1, Math.floor(asMoney(line.quantity ?? line.qty) ?? 1)),
    ...(asString(line.sku_id) ? { itemId: asString(line.sku_id)! } : {}),
    ...(imageUrl ? { imageUrl } : {}),
    ...(size ? { size } : {}),
    ...(unitPrice != null ? { unitPrice } : {}),
    ...(listPrice != null ? { listPrice } : {}),
    ...(lineTotal != null ? { lineTotal } : {}),
    ...(discount != null && discount > 0 ? { discount } : {}),
  }
}

function mapDeliveryAddressLine(data: Record<string, unknown>): string | undefined {
  const block = asRecord(data.delivery_address)
  const addr = asRecord(block?.address) ?? block
  if (!addr) return undefined
  const line = asString(addr.address1)
  if (line) return line
  return (
    [asString(addr.city), asString(addr.state), asString(addr.zipCode), asString(addr.country)]
      .filter(Boolean)
      .join(', ') || undefined
  )
}

function mapOrderBill(raw: Record<string, unknown> | null) {
  if (!raw) return undefined
  const amount = asMoney(raw.amount)
  if (amount == null && asMoney(raw.gross_amount) == null) return undefined
  return {
    itemsCount: Math.max(0, Math.floor(asMoney(raw.items_count) ?? 0)),
    grossAmount: asMoney(raw.gross_amount) ?? 0,
    discount: asMoney(raw.discount) ?? 0,
    deliveryCharges: asMoney(raw.delivery_charges) ?? 0,
    serviceCharge: asMoney(raw.service_charge) ?? 0,
    taxAmount: asMoney(raw.tax_amount) ?? 0,
    amount: amount ?? asMoney(raw.gross_amount) ?? 0,
  }
}

function historyItems(raw: Record<string, unknown>) {
  if (Array.isArray(raw.order_items)) return raw.order_items
  if (Array.isArray(raw.items)) return raw.items
  return []
}

/** GET /v1/users/{id}/orders/history row, or GET /v1/users/{id}/orders/{order_id} data. */
export function mapCustomerOrder(raw: unknown): MappedCustomerOrder | null {
  const item = asRecord(raw)
  if (!item) return null
  const id = asString(item.order_id ?? item.id)
  if (!id) return null
  const amount = asRecord(item.order_amount)
  const bill = mapOrderBill(amount)
  const addressLine = mapDeliveryAddressLine(item)
  return {
    id,
    storeId: asString(item.vendor_id) ?? undefined,
    storeName: asString(item.vendor_name ?? item.store_name ?? item.storeName) ?? 'Store',
    total: asMoney(amount?.amount ?? item.amount ?? item.total) ?? 0,
    status: asString(item.order_status ?? item.status) ?? 'placed',
    placedAt:
      asString(item.created_at ?? item.order_date ?? item.placedAt ?? item.delivery_date) ??
      new Date().toISOString(),
    items: historyItems(item).map(mapCustomerOrderItem),
    ...(asString(item.payment_status) ? { paymentStatus: asString(item.payment_status)! } : {}),
    ...(asString(item.delivery_date) ? { deliveryDate: asString(item.delivery_date)! } : {}),
    ...(asString(item.delivery_method) ? { deliveryMethod: asString(item.delivery_method)! } : {}),
    ...(asString(item.notes) ? { notes: asString(item.notes)! } : {}),
    ...(asString(item.customer_name) ? { customerName: asString(item.customer_name)! } : {}),
    ...(asString(item.customer_mobile) ? { customerMobile: asString(item.customer_mobile)! } : {}),
    ...(addressLine ? { addressLine } : {}),
    ...(bill ? { bill } : {}),
  }
}

export function mapCustomerOrderDetail(payload: unknown): MappedCustomerOrder | null {
  const root = asRecord(payload)
  const data = asRecord(root?.data) ?? root
  return mapCustomerOrder(data)
}

export function mapCustomerOrderHistory(payload: unknown): MappedCustomerOrder[] {
  const root = asRecord(payload)
  const data = root?.data ?? root
  const list = Array.isArray(data)
    ? data
    : Array.isArray(asRecord(data)?.content)
      ? (asRecord(data)?.content as unknown[])
      : Array.isArray(asRecord(data)?.result)
        ? (asRecord(data)?.result as unknown[])
        : []
  return list
    .map(mapCustomerOrder)
    .filter((order): order is MappedCustomerOrder => Boolean(order))
}

export type MappedCustomerOrderHistoryPage = {
  orders: MappedCustomerOrder[]
  pageNumber: number
  pageSize: number
  totalElements: number | null
  totalPages: number | null
  lastPage: boolean
}

/** GET /v1/users/{id}/orders/history/paged — documented `result` + page fields. */
export function mapCustomerOrderHistoryPage(payload: unknown): MappedCustomerOrderHistoryPage {
  const orders = mapCustomerOrderHistory(payload)
  const root = asRecord(payload)
  const data = asRecord(root?.data)
  if (!data) {
    return {
      orders,
      pageNumber: 0,
      pageSize: orders.length,
      totalElements: orders.length,
      totalPages: 1,
      lastPage: true,
    }
  }

  const pageNumber = asNonNegativeInt(data.page_number) ?? 0
  const pageSize = asNonNegativeInt(data.page_size) ?? orders.length
  const totalElements = asNonNegativeInt(data.total_elements)
  const totalPages = asNonNegativeInt(data.total_pages)
  const lastPageFlag = data.last_page
  const lastPage =
    typeof lastPageFlag === 'boolean'
      ? lastPageFlag
      : totalPages != null
        ? pageNumber >= Math.max(0, totalPages - 1)
        : pageSize === 0 || orders.length < pageSize

  return { orders, pageNumber, pageSize, totalElements, totalPages, lastPage }
}
