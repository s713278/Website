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

/**
 * One row of the orders list. The list read carries no line items — see `VendorOrderDetail`.
 *
 * There is deliberately **no placed-at field**. No order read in the contract carries a
 * creation timestamp: the list row has 15 keys and the items read has 18, and neither
 * includes one. A nullable property here would only invite a screen to display it, and
 * `deliveryDate` would eventually be relabelled to fill the gap. See
 * `docs/VENDOR_CONSOLE_BACKEND_ASKS.md` §1.1 for the ask.
 */
export type VendorOrderSummary = {
  id: string
  /** Absent from every list row; the items read carries it. Never fall back to the mobile. */
  customerName: string | null
  /** The one identity the list read supplies. Drives the call and WhatsApp affordances. */
  customerMobile: string | null
  /** `null` means unknown, `0` means a genuinely free order. The two must not collapse. */
  total: number | null
  deliveryStatus: DeliveryStatus
  paymentStatus: PaymentStatus | null
  deliveryDate: string | null
}

export type VendorOrderLine = {
  id: string
  name: string
  size: string | null
  quantity: number
  /** What one unit was charged at, as recorded. Never derived from the line total. */
  unitPrice: number | null
  amount: number | null
}

/**
 * The charge breakdown the items read returns, under `order_amount`.
 *
 * Every field is `null` when the response omitted it, and an omitted charge stays omitted:
 * nothing here may be derived from the others to make the arithmetic close. The backend
 * sends what it sends, and a charge invented to reconcile a bill is a charge the vendor
 * would then have to explain to a customer.
 */
export type VendorOrderCharges = {
  gross: number | null
  discount: number | null
  deliveryCharges: number | null
  serviceCharge: number | null
  tax: number | null
}

/** One order with its lines, from the items read. */
export type VendorOrderDetail = VendorOrderSummary & {
  deliveryAddress: string | null
  charges: VendorOrderCharges
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

/**
 * Vendor-level counts.
 *
 * `payment_dues` is **deliberately not mapped**. The backend figure counts cancelled orders
 * and only ever grows: creating one order and then cancelling it raised it by exactly that
 * order's amount, and it never came back down. No route can set `payment_status` away from
 * `DUE`, so nothing reduces it either. Leaving it off the view model is what stops a screen
 * from labelling it "money owed" — a vendor acting on it would chase a customer for an order
 * that customer cancelled. See `docs/VENDOR_CONSOLE_BACKEND_ASKS.md` §2.3.
 *
 * `ordersByStatus` is `Partial` for a measured reason: zero-valued statuses are omitted from
 * the response entirely, and were watched appearing and disappearing within one session.
 * Read every status through `?? 0`.
 */
export type VendorInsights = {
  totalCustomers: number | null
  ordersByStatus: Partial<Record<DeliveryStatus, number>>
}

/** The tier a vendor's account is on, with its limits and what they have used. */
export type VendorPlan = {
  /** The plan's backend identifier, e.g. `BASIC`. `name` is what a vendor should read. */
  code: string | null
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
 * Read-only in the UI only because the editor is not built yet: `PUT /v1/vendors/{id}`
 * works on both approval states. It is a partial merge that ignores explicit `null`, so
 * the editor must not offer to clear a field.
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
