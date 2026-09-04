/**
 * View-model types for the vendor dashboard.
 *
 * The vocabulary here is the backend's, deliberately: see `CONTEXT.md` under "Store
 * operations". The older `new/accepted/preparing/ready/completed` vocabulary in
 * `./index.ts` belonged to the mock restaurant fixtures and exists nowhere in the API.
 */

/** How far an order has progressed toward the customer. */
export type DeliveryStatus =
  | 'PENDING'
  | 'SCHEDULED'
  | 'IN_PROCESS'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'

/** Whether an order has been paid for. Independent of delivery status. */
export type PaymentStatus = 'DUE' | 'PAID'

/**
 * The single derived condition of a vendor's store.
 *
 * Derived rather than read: no one backend field carries it. See `lib/store-state.ts`.
 */
export type StoreState = 'SETTING_UP' | 'UNDER_REVIEW' | 'OPEN' | 'REJECTED' | 'SUSPENDED'

/** One row of the orders list. The list read carries no line items — see `VendorOrderDetail`. */
export type VendorOrderSummary = {
  id: string
  customerName: string | null
  total: number | null
  deliveryStatus: DeliveryStatus
  paymentStatus: PaymentStatus | null
  placedAt: string | null
  deliveryDate: string | null
}

export type VendorOrderLine = {
  id: string
  name: string
  size: string | null
  quantity: number
  amount: number | null
}

/** One order with its lines, from the items read. */
export type VendorOrderDetail = VendorOrderSummary & {
  customerMobile: string | null
  deliveryAddress: string | null
  lines: VendorOrderLine[]
}

export type VendorOrderPage = {
  orders: VendorOrderSummary[]
  page: number
  totalPages: number
  totalElements: number
  lastPage: boolean
}

/** One purchasable size of a vendor product, with the price record backing it. */
export type VendorSize = {
  skuId: string
  /** The vendor product this size belongs to. Sizes are grouped under it. */
  productId: string | null
  /** Identifies the price record, which is what a price edit writes to. */
  priceId: string | null
  name: string
  size: string | null
  listPrice: number | null
  salePrice: number | null
  active: boolean
  imagePath: string | null
}

export type VendorInsights = {
  totalCustomers: number | null
  ordersByStatus: Partial<Record<DeliveryStatus, number>>
  dueAmount: number | null
  paidAmount: number | null
}

/** The tier a vendor's account is on, with its limits and what they have used. */
export type VendorPlan = {
  tier: string | null
  name: string | null
  /** Raw backend billing state. `null` until the backend models one. */
  status: string | null
  currency: string | null
  monthlyPrice: number | null
  yearlyPrice: number | null
  /**
   * Absent from every deployed response so far — the backend models no trial yet.
   * Rendered only when present, never computed from a hardcoded trial length.
   */
  trialEndsAt: string | null
  trialDays: number | null
  limits: { categories: number | null; products: number | null; skus: number | null; images: number | null }
  usage: { categories: number | null; products: number | null; skus: number | null; images: number | null }
}

/**
 * The vendor's own store details, as Settings displays them.
 *
 * Read-only: `PUT /v1/vendors/{id}` is the only write for these fields and it fails with
 * a JPA transaction error for every body shape tried. See `docs/API_GAPS.md`.
 *
 * Distinct from the narrower `VendorProfile` in the onboarding mappers, which carries
 * only the five fields setup needs.
 */
export type VendorStoreProfile = {
  vendorId: string
  businessName: string | null
  description: string | null
  businessType: string | null
  ownerName: string | null
  contactPerson: string | null
  contactNumber: string | null
  email: string | null
  address: string | null
  bannerImage: string | null
  storeIdentifier: string | null
}
