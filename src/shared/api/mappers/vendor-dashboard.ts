import type {
  DeliveryStatus,
  PaymentStatus,
  SubscriptionStatus,
  VendorInsights,
  VendorOrderCharges,
  VendorOrderDetail,
  VendorOrderLine,
  VendorOrderPage,
  VendorOrderSummary,
  VendorPlan,
  VendorSize,
  VendorStoreProfile,
  VendorSubscription,
  VendorSubscriptionPage,
} from '@/modules/vendor/types/dashboard'
import { vendorCollectionRows } from './vendor'
import type { VendorContext } from './vendor-onboarding'

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function str(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return null
}

function num(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    return Number(value)
  }
  return null
}

const DELIVERY_STATUSES: DeliveryStatus[] = [
  'PENDING',
  'SCHEDULED',
  'IN_PROCESS',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
]

/** Anything outside the contract's enum becomes `PENDING`, never an invented state. */
export function toDeliveryStatus(value: unknown): DeliveryStatus {
  const raw = str(value)?.toUpperCase()
  return DELIVERY_STATUSES.find((status) => status === raw) ?? 'PENDING'
}

export function toPaymentStatus(value: unknown): PaymentStatus | null {
  const raw = str(value)?.toUpperCase()
  if (raw === 'DUE' || raw === 'PAID') return raw
  return null
}

/**
 * The record inside a success envelope, or the payload itself when it is already unwrapped.
 *
 * Every dashboard read is wrapped in `{timestamp, success, status, data}`, but the mappers
 * are also called directly on fixtures and in tests, so both are accepted.
 */
function envelopeRecord(payload: unknown): UnknownRecord {
  if (isRecord(payload) && isRecord(payload.data)) return payload.data
  return isRecord(payload) ? payload : {}
}

/** As above, but for reads whose `data` is a collection rather than a record. */
function envelopeData(payload: unknown): unknown {
  return isRecord(payload) && 'data' in payload ? payload.data : payload
}

/**
 * Vendor-level insights.
 *
 * The response omits groups entirely rather than zeroing them — a vendor with no orders
 * gets `order_status_count: {}`, not a set of zeroed keys — so every field is read
 * through here rather than reached for directly.
 */
export function mapVendorInsights(payload: unknown): VendorInsights {
  const data = envelopeRecord(payload)
  const statusCounts = isRecord(data.order_status_count) ? data.order_status_count : {}

  const ordersByStatus: Partial<Record<DeliveryStatus, number>> = {}
  for (const status of DELIVERY_STATUSES) {
    const count = num(statusCounts[`${status.toLowerCase()}_count`])
    if (count != null) ordersByStatus[status] = count
  }

  // `payment_dues` is read and dropped on purpose. See the note on `VendorInsights`:
  // the figure counts cancelled orders and cannot decrease, so it is not money owed.
  return {
    totalCustomers: num(data.total_customers),
    ordersByStatus,
  }
}

/**
 * One row of the orders list, and the header of the items read.
 *
 * The list row was measured on the deployed API and carries exactly these 15 keys:
 * `order_id, vendor_id, user_id, delivery_date, items_count, amount, order_status,
 * payment_status, delivery_method, mobile, gross_amount, discount, delivery_charges,
 * payment_method, order_timing_type`.
 *
 * Three consequences, each of which was a live bug before it was measured:
 *
 * - The total is a **flat `amount`**. `order_amount` is a nested object that appears only
 *   on the items read, so reading it first mapped every list row to `null`.
 * - There is **no customer name** on a list row, only `mobile`. The two are kept apart:
 *   a phone number rendered where a name belongs reads as a mistake to the vendor.
 * - There is **no creation timestamp on either read**, so none is mapped.
 *
 * `num()` returns `null` for absent values and `0` for a real zero, and that distinction is
 * carried through — an unknown total must not render as a free order.
 */
function mapOrderSummary(row: UnknownRecord): VendorOrderSummary {
  const amount = isRecord(row.order_amount) ? row.order_amount : null
  return {
    id: str(row.order_id) ?? str(row.id) ?? '',
    customerName: str(row.customer_name),
    customerMobile: str(row.mobile) ?? str(row.customer_mobile),
    total: num(row.amount) ?? num(amount?.amount) ?? num(row.total_amount) ?? num(row.total),
    deliveryStatus: toDeliveryStatus(row.order_status ?? row.delivery_status ?? row.status),
    paymentStatus: toPaymentStatus(row.payment_status),
    deliveryDate: str(row.delivery_date),
  }
}

export function mapVendorOrderPage(payload: unknown): VendorOrderPage {
  const data = envelopeData(payload)
  const container = isRecord(data) ? data : {}
  return {
    orders: vendorCollectionRows(data).map(mapOrderSummary),
    page: num(container.page_number) ?? 0,
    totalPages: num(container.total_pages) ?? 0,
    totalElements: num(container.total_elements) ?? 0,
    lastPage: container.last_page !== false,
  }
}

const SUBSCRIPTION_STATUSES: SubscriptionStatus[] = [
  'PENDING',
  'ACTIVE',
  'PAUSED',
  'CANCELLED',
  'EXPIRED',
  'DELETED',
]

function toSubscriptionStatus(value: unknown): SubscriptionStatus | null {
  const raw = str(value)?.toUpperCase()
  return SUBSCRIPTION_STATUSES.find((status) => status === raw) ?? null
}

function mapSubscription(row: UnknownRecord): VendorSubscription {
  return {
    id: str(row.sub_id) ?? '',
    mobile: str(row.mobile),
    customerId: str(row.customer_id),
    skuName: str(row.sku_name),
    quantity: num(row.quantity),
    frequency: str(row.frequency),
    deliveryMode: str(row.delivery_mode),
    paymentType: str(row.payment_type),
    startDate: str(row.start_date),
    nextDelivery: str(row.next_delivery),
    status: toSubscriptionStatus(row.status),
  }
}

/**
 * The vendor subscriptions read is paginated under `data.result`.
 *
 * Unlike the legacy orders mapper, an omitted `last_page` is not treated as proof that
 * this is the last page. The live envelope supplies the flag; an unreadable envelope
 * fails closed instead of quietly hiding a possible next page.
 */
export function mapVendorSubscriptionPage(payload: unknown): VendorSubscriptionPage {
  const data = envelopeData(payload)
  const container = isRecord(data) ? data : {}
  return {
    subscriptions: vendorCollectionRows(data).map(mapSubscription),
    page: num(container.page_number) ?? 0,
    totalPages: num(container.total_pages) ?? 0,
    totalElements: num(container.total_elements) ?? 0,
    lastPage: container.last_page === true,
  }
}

function mapOrderLine(row: UnknownRecord): VendorOrderLine {
  return {
    id: str(row.order_item_id) ?? str(row.sku_id) ?? '',
    name: str(row.sku_name) ?? 'Item',
    size: str(row.size),
    quantity: num(row.quantity) ?? 1,
    unitPrice: num(row.unit_price) ?? num(row.sale_price),
    amount: num(row.line_total) ?? num(row.unit_price) ?? num(row.sale_price),
  }
}

/**
 * Flattens an address to one line. Used for both the order's `delivery_address` and the
 * vendor record's `business_address` — the backend gives them the same free-form shape,
 * optionally nested under `address`.
 */
function mapAddress(value: unknown): string | null {
  if (!isRecord(value)) return null
  const address = isRecord(value.address) ? value.address : value
  const parts = ['address1', 'address2', 'city', 'district', 'state', 'zipCode']
    .map((key) => str(address[key]))
    .filter((part): part is string => part !== null)
  return parts.length ? parts.join(', ') : null
}

/**
 * The charge breakdown, from the `order_amount` object the items read nests it under.
 *
 * Read field by field and never derived. The tempting move — inferring a delivery charge
 * from `amount - gross_amount + discount` — invents a figure the backend never sent, and
 * the vendor would be the one asked to justify it. A charge the response omits stays `null`
 * and simply does not appear.
 */
function mapOrderCharges(value: unknown): VendorOrderCharges {
  const charges = isRecord(value) ? value : {}
  return {
    gross: num(charges.gross_amount),
    discount: num(charges.discount),
    deliveryCharges: num(charges.delivery_charges),
    serviceCharge: num(charges.service_charge),
    tax: num(charges.tax_amount),
  }
}

/**
 * The full order. This read carries `customer_name` and `customer_mobile`, which the list
 * read does not — both are picked up by `mapOrderSummary`, so a detail screen shows a real
 * name where the list can only show a number.
 *
 * The charge breakdown is read from `order_amount`, which only this read carries. A list row
 * has flat copies of some of those keys, but nothing maps a list row through here, and a
 * branch with no caller is a branch nothing keeps honest.
 */
export function mapVendorOrderDetail(payload: unknown): VendorOrderDetail {
  const data = envelopeRecord(payload)
  return {
    ...mapOrderSummary(data),
    deliveryAddress: mapAddress(data.delivery_address),
    charges: mapOrderCharges(data.order_amount),
    lines: vendorCollectionRows(data.order_items).map(mapOrderLine),
  }
}

/** One order the bulk status write refused, and the reason it gave. */
export type BulkStatusFailure = { orderId: string | null; reason: string | null }

export type BulkStatusResult = {
  successCount: number
  failed: BulkStatusFailure[]
}

/**
 * What `POST /v1/vendors/{v}/orders/bulk-status-update` actually reports.
 *
 * **A refused transition is not an error.** It is `HTTP 200`, `success: true`, and
 * `data.success_count: 0` with the order listed under `failed_orders`. A caller that reads
 * only the status code reports a silent no-op as a success — which is exactly what the
 * advance button did before this existed.
 *
 * `successCount` defaults to `0`, not to the number of ids sent: an unreadable response must
 * fail closed. `reason` is mapped so it can be logged, and is **not** for display — the
 * backend sends the same generic sentence for a wrong next status, an order that is not
 * yours, and an order that is already there.
 */
export function mapBulkStatusResult(payload: unknown): BulkStatusResult {
  const data = envelopeRecord(payload)
  const failed = Array.isArray(data.failed_orders) ? data.failed_orders : []
  return {
    successCount: num(data.success_count) ?? 0,
    failed: failed.filter(isRecord).map((row) => ({
      orderId: str(row.order_id),
      reason: str(row.reason),
    })),
  }
}

/**
 * One purchasable size.
 *
 * `price_id` matters: it identifies the price record, and it is the only handle a price
 * edit can be written against — the price read is keyed by SKU id, the write by price id.
 *
 * Name and active-state are read-only here because no control writes them yet, not because
 * the endpoint refuses. `PATCH /vendors/{v}/skus/{id}` works when `features` is echoed back
 * from a fresh per-SKU read; it 417s only when `features` is omitted, and sending `{}` or
 * `null` destroys whatever the vendor had there.
 */
function mapSize(row: UnknownRecord): VendorSize {
  return {
    skuId: str(row.sku_id) ?? '',
    productId: str(row.vendor_product_id),
    priceId: str(row.price_id),
    name: str(row.sku_name) ?? 'Size',
    size: str(row.sku_size),
    listPrice: num(row.list_price),
    salePrice: num(row.sale_price),
    active: row.is_active !== false,
    imagePath: str(row.image_path),
  }
}

export function mapVendorSizes(payload: unknown): VendorSize[] {
  return vendorCollectionRows(envelopeData(payload)).map(mapSize).filter((size) => size.skuId !== '')
}

/** The vendor's plan, lifted out of the context read the shell already performs. */
export function mapVendorPlan(context: VendorContext): VendorPlan {
  const subscription = context.subscription
  return {
    code: subscription.tier,
    name: subscription.planName,
    status: subscription.status,
    currency: subscription.currency,
    monthlyPrice: subscription.monthlyPrice,
    yearlyPrice: subscription.yearlyPrice,
    trialEndsAt: subscription.trialEndsAt,
    trialDays: subscription.trialDays,
    limits: {
      categories: subscription.limits.maxCategories,
      products: subscription.limits.maxProducts,
      skus: subscription.limits.maxSkus,
      images: subscription.limits.maxImages,
    },
    usage: {
      categories: subscription.usage.categories,
      products: subscription.usage.products,
      skus: subscription.usage.skus,
      images: subscription.usage.images,
    },
  }
}

/**
 * The vendor's own store details.
 *
 * The record can carry `business_address`, `communication_email`, `description` and
 * `user_id` — but **only once the vendor has set them**. The read omits null columns
 * entirely rather than sending them as null, so a fresh vendor's response simply has no
 * such keys. An earlier note here said they "are all present", which held only for the one
 * account it was measured on.
 *
 * `communication_email` is skipped when it holds the literal placeholder `"string"`, which
 * unconfigured dev records really do contain.
 */
export function mapVendorStoreProfile(payload: unknown): VendorStoreProfile {
  const data = envelopeRecord(payload)
  const email = str(data.communication_email)
  return {
    vendorId: str(data.vendor_id) ?? '',
    businessName: str(data.business_name),
    description: str(data.description),
    businessType: str(data.business_type),
    ownerName: str(data.owner_name),
    contactPerson: str(data.contact_person),
    contactNumber: str(data.contact_number),
    email: email === 'string' ? null : email,
    address: mapAddress(data.business_address),
    bannerImage: str(data.banner_image),
    storeIdentifier: str(data.store_identifier),
  }
}
