import type {
  DeliveryStatus,
  PaymentStatus,
  VendorInsights,
  VendorOrderDetail,
  VendorOrderLine,
  VendorOrderPage,
  VendorOrderSummary,
  VendorPlan,
  VendorSize,
  VendorStoreProfile,
} from '@/modules/vendor/types/dashboard'
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
 * Rows out of a paginated container.
 *
 * The backend is inconsistent about this: `/orders/` and `/products/skus` answer
 * `{result: []}`, `/products` answers a bare array, and other reads use Spring's
 * `content`. All three are accepted rather than assumed.
 */
function rows(data: unknown): UnknownRecord[] {
  const list = Array.isArray(data)
    ? data
    : isRecord(data) && Array.isArray(data.result)
      ? data.result
      : isRecord(data) && Array.isArray(data.content)
        ? data.content
        : []
  return list.filter(isRecord)
}

/**
 * Vendor-level insights.
 *
 * The response omits groups entirely rather than zeroing them — a vendor with no orders
 * gets `order_status_count: {}`, not a set of zeroed keys — so every field is read
 * through here rather than reached for directly.
 */
export function mapVendorInsights(payload: unknown): VendorInsights {
  const data = isRecord(payload) && isRecord(payload.data) ? payload.data : isRecord(payload) ? payload : {}
  const statusCounts = isRecord(data.order_status_count) ? data.order_status_count : {}
  const dues = isRecord(data.payment_dues) ? data.payment_dues : {}

  const ordersByStatus: Partial<Record<DeliveryStatus, number>> = {}
  for (const status of DELIVERY_STATUSES) {
    const count = num(statusCounts[`${status.toLowerCase()}_count`])
    if (count != null) ordersByStatus[status] = count
  }

  return {
    totalCustomers: num(data.total_customers),
    ordersByStatus,
    dueAmount: num(dues.due_amount),
    paidAmount: num(dues.paid_amount),
  }
}

/**
 * One row of the orders list.
 *
 * No deployed vendor has orders yet, so the exact spellings here are taken from the
 * operation description rather than a measured response, and alternates are accepted.
 * Recorded in `docs/API_GAPS.md` — do not treat this mapping as verified.
 */
function mapOrderSummary(row: UnknownRecord): VendorOrderSummary {
  const amount = isRecord(row.order_amount) ? row.order_amount : null
  return {
    id: str(row.order_id) ?? str(row.id) ?? '',
    customerName: str(row.customer_name),
    total: num(amount?.amount) ?? num(row.total_amount) ?? num(row.total),
    deliveryStatus: toDeliveryStatus(row.order_status ?? row.delivery_status ?? row.status),
    paymentStatus: toPaymentStatus(row.payment_status),
    placedAt: str(row.created_date) ?? str(row.created_at) ?? str(row.order_date),
    deliveryDate: str(row.delivery_date),
  }
}

export function mapVendorOrderPage(payload: unknown): VendorOrderPage {
  const data = isRecord(payload) && 'data' in payload ? payload.data : payload
  const container = isRecord(data) ? data : {}
  return {
    orders: rows(data).map(mapOrderSummary),
    page: num(container.page_number) ?? 0,
    totalPages: num(container.total_pages) ?? 0,
    totalElements: num(container.total_elements) ?? 0,
    lastPage: container.last_page !== false,
  }
}

function mapOrderLine(row: UnknownRecord): VendorOrderLine {
  return {
    id: str(row.order_item_id) ?? str(row.sku_id) ?? '',
    name: str(row.sku_name) ?? 'Item',
    size: str(row.size),
    quantity: num(row.quantity) ?? 1,
    amount: num(row.line_total) ?? num(row.unit_price) ?? num(row.sale_price),
  }
}

/** Flattens the delivery address, whose shape is a free-form map inside a wrapper. */
function mapDeliveryAddress(value: unknown): string | null {
  if (!isRecord(value)) return null
  const address = isRecord(value.address) ? value.address : value
  const parts = ['address1', 'address2', 'city', 'district', 'state', 'zipCode']
    .map((key) => str(address[key]))
    .filter((part): part is string => part !== null)
  return parts.length ? parts.join(', ') : null
}

export function mapVendorOrderDetail(payload: unknown): VendorOrderDetail {
  const data = isRecord(payload) && isRecord(payload.data) ? payload.data : isRecord(payload) ? payload : {}
  return {
    ...mapOrderSummary(data),
    customerMobile: str(data.customer_mobile),
    deliveryAddress: mapDeliveryAddress(data.delivery_address),
    lines: rows(data.order_items).map(mapOrderLine),
  }
}

/**
 * One purchasable size.
 *
 * `price_id` matters: it identifies the price record, and it is the only handle a price
 * edit can be written against. The SKU update endpoint is broken (417, JDBC error), so
 * name, size and active-state are read-only here.
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
  const data = isRecord(payload) && 'data' in payload ? payload.data : payload
  return rows(data).map(mapSize).filter((size) => size.skuId !== '')
}

/** The vendor's plan, lifted out of the context read the shell already performs. */
export function mapVendorPlan(context: VendorContext): VendorPlan {
  const subscription = context.subscription
  return {
    tier: subscription.tier,
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
 * The record carries more than `docs/API_GAPS.md` once claimed: `business_address`,
 * `communication_email`, `description` and `user_id` are all present, measured against
 * the deployed API. `communication_email` is skipped when it holds the literal
 * placeholder `"string"`, which unconfigured dev records really do contain.
 */
export function mapVendorStoreProfile(payload: unknown): VendorStoreProfile {
  const data = isRecord(payload) && isRecord(payload.data) ? payload.data : isRecord(payload) ? payload : {}
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
    address: mapDeliveryAddress(data.business_address),
    bannerImage: str(data.banner_image),
    storeIdentifier: str(data.store_identifier),
  }
}
