/**
 * Demo-mode reads for the vendor dashboard.
 *
 * These build the envelopes the deployed API returns, from the mutable state in
 * `./demo-state`. Services call them exactly where they would otherwise fetch, so demo and
 * live pass through the same mappers and nothing downstream branches on mode.
 *
 * Seed data lives in `./vendor-dashboard-seed`; the mutable store lives in `./demo-state`.
 * The split keeps the dependency one-way: seed → state → reads.
 *
 * Filtering and paging are implemented here rather than stubbed, because a demo list that
 * ignores its own filters cannot show whether the filter UI works.
 */

import {
  consumeDemoFailure,
  demoOrders,
  demoProfile,
  demoSizes,
} from './demo-state'
import { DEMO_ORDER_ITEMS } from './vendor-dashboard-seed'

function envelope<T>(data: T) {
  return { timestamp: new Date().toISOString(), success: true, status: 200, data }
}

export type DemoOrderQuery = {
  status?: string
  startDate?: string | null
  endDate?: string | null
}

/**
 * One page of orders, filtered the way the server filters.
 *
 * Note the date filter runs on `delivery_date` — the only date the backend has. It is not
 * a booking date and the UI must never label it as one.
 */
export function demoVendorOrdersPage(page = 0, size = 20, query: DemoOrderQuery = {}) {
  consumeDemoFailure()

  const filtered = demoOrders().filter((order) => {
    if (query.status && order.order_status !== query.status) return false
    const date = typeof order.delivery_date === 'string' ? order.delivery_date : null
    if (query.startDate && (!date || date < query.startDate)) return false
    if (query.endDate && (!date || date > query.endDate)) return false
    return true
  })

  // Default sort is delivery_date descending, matching the deployed API.
  const sorted = [...filtered].sort((a, b) =>
    String(b.delivery_date ?? '').localeCompare(String(a.delivery_date ?? '')),
  )

  const start = page * size
  const slice = sorted.slice(start, start + size)
  return envelope({
    result: slice,
    page_number: page,
    page_size: size,
    total_elements: sorted.length,
    total_pages: Math.max(1, Math.ceil(sorted.length / size)),
    last_page: start + size >= sorted.length,
  })
}

/**
 * The full order, in the shape `/items` returns.
 *
 * Unlike a list row this read does carry `customer_name` and `customer_mobile`, and its
 * total arrives nested under `order_amount` — both differences the mapper depends on.
 */
export function demoVendorOrderDetail(orderId: string) {
  consumeDemoFailure()

  const order = demoOrders().find((row) => String(row.order_id) === orderId)
  if (!order) return null

  const lines = DEMO_ORDER_ITEMS[orderId] ?? [
    {
      order_item_id: Number(orderId) * 10 + 1,
      sku_id: 501,
      sku_name: 'Fresh Tomatoes',
      size: '1 kg',
      quantity: order.items_count ?? 1,
      list_price: 80,
      sale_price: 70,
      unit_price: 70,
      line_total: 70 * Number(order.items_count ?? 1),
    },
  ]

  return envelope({
    order_id: order.order_id,
    vendor_id: order.vendor_id,
    user_id: order.user_id,
    delivery_date: order.delivery_date,
    customer_name: 'Demo Customer',
    customer_mobile: order.mobile ?? null,
    store_name: 'Green Bowl Grocers',
    order_status: order.order_status,
    payment_status: order.payment_status,
    order_type: 'ONE_TIME',
    order_source: 'APP',
    delivery_method: order.delivery_method,
    order_timing_type: order.order_timing_type,
    notes: null,
    delivery_address: {
      id: 2412,
      type: 'HOME',
      address: {
        address1: '12 Market Road',
        address2: 'Near the bus stand',
        city: 'Mirdoddi',
        district: 'Siddipet',
        state: 'Telangana',
        zipCode: '502108',
      },
    },
    order_amount: {
      items_count: order.items_count,
      gross_amount: order.gross_amount,
      discount: order.discount,
      delivery_charges: order.delivery_charges,
      service_charge: 0,
      tax_amount: 0,
      amount: order.amount,
    },
    order_items: lines,
  })
}

/**
 * Vendor insight counts, derived from the demo orders so they cannot disagree with the list.
 *
 * **Zero-valued statuses are omitted**, exactly as the backend omits them — a status with no
 * orders has no key at all, not a key holding `0`. This was watched appearing and
 * disappearing on the live API within one session, so a consumer that forgets `?? 0` reads
 * `undefined`.
 *
 * `payment_dues` is present because the backend sends it. It is not mapped: the figure
 * counts cancelled orders and never decreases.
 */
export function demoVendorInsights() {
  consumeDemoFailure()

  const counts: Record<string, number> = {}
  for (const order of demoOrders()) {
    const status = String(order.order_status ?? '').toLowerCase()
    if (!status) continue
    counts[`${status}_count`] = (counts[`${status}_count`] ?? 0) + 1
  }

  const due = demoOrders()
    .filter((order) => order.payment_status === 'DUE')
    .reduce((sum, order) => sum + (typeof order.amount === 'number' ? order.amount : 0), 0)

  return envelope({
    total_customers: 1,
    subscriptions_count: {},
    order_status_count: counts,
    payment_dues: { due_amount: due, paid_amount: 850 },
  })
}

/** The SKU list, in the paginated container `/products/skus` really answers with. */
export function demoVendorSizes() {
  consumeDemoFailure()

  const rows = demoSizes()
  return envelope({
    result: rows,
    page_number: 0,
    page_size: 10,
    total_elements: rows.length,
    total_pages: 1,
    last_page: true,
  })
}

/** The vendor record Settings reads, in the shape `GET /v1/vendors/{id}` answers with. */
export function demoVendorStoreProfile(vendorId: string | number) {
  consumeDemoFailure()
  return envelope({ ...demoProfile(), vendor_id: String(vendorId) })
}
