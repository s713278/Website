/**
 * Demo-mode payloads for the vendor dashboard, in **wire shape**.
 *
 * These are not view models. They are what the backend sends, so demo mode can hand them
 * to the same mappers live mode uses — `isLiveApi()` then chooses only between fetching
 * and returning a fixture, and nothing downstream branches. A fixture that stops matching
 * the mapper fails a test rather than quietly drifting.
 *
 * Shapes are copied from responses measured against the deployed dev API (the paginated
 * `result` container, `price_id` beside the prices, insight groups that omit rather than
 * zero). The content is invented: no real vendor, customer, or contact detail belongs
 * here.
 */

function envelope<T>(data: T) {
  return { timestamp: new Date().toISOString(), success: true, status: 200, data }
}

/**
 * A demo vendor with a modest amount of history, so the dashboard has something to show.
 * Deliberately includes a delivered-but-unpaid order, because that combination is real
 * and the previous single-status UI could not express it.
 */
export const DEMO_VENDOR_ORDERS = [
  {
    order_id: 4021,
    customer_name: 'Asha Reddy',
    order_status: 'PENDING',
    payment_status: 'DUE',
    delivery_date: '2026-09-06',
    created_date: '2026-09-04T09:12:00',
    order_amount: { items_count: 2, amount: 320 },
  },
  {
    order_id: 4018,
    customer_name: 'Vikram Rao',
    order_status: 'IN_PROCESS',
    payment_status: 'PAID',
    delivery_date: '2026-09-05',
    created_date: '2026-09-03T17:40:00',
    order_amount: { items_count: 1, amount: 850 },
  },
  {
    order_id: 4009,
    customer_name: 'Meera Nair',
    order_status: 'DELIVERED',
    payment_status: 'DUE',
    delivery_date: '2026-09-02',
    created_date: '2026-09-01T08:05:00',
    order_amount: { items_count: 3, amount: 1240 },
  },
  {
    order_id: 3998,
    customer_name: 'Sanjay Kumar',
    order_status: 'CANCELLED',
    payment_status: 'DUE',
    delivery_date: '2026-08-30',
    created_date: '2026-08-29T11:20:00',
    order_amount: { items_count: 1, amount: 150 },
  },
]

export function demoVendorOrdersPage(page = 0, size = 20, status?: string) {
  const filtered = status
    ? DEMO_VENDOR_ORDERS.filter((order) => order.order_status === status)
    : DEMO_VENDOR_ORDERS
  const start = page * size
  const slice = filtered.slice(start, start + size)
  return envelope({
    result: slice,
    page_number: page,
    page_size: size,
    total_elements: filtered.length,
    total_pages: Math.max(1, Math.ceil(filtered.length / size)),
    last_page: start + size >= filtered.length,
  })
}

export function demoVendorOrderDetail(orderId: string) {
  const order = DEMO_VENDOR_ORDERS.find((row) => String(row.order_id) === orderId)
  if (!order) return null
  return envelope({
    ...order,
    customer_mobile: '9000000000',
    delivery_address: {
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
    order_items: [
      {
        order_item_id: order.order_id * 10 + 1,
        sku_id: 501,
        sku_name: 'Fresh Tomatoes',
        size: '1 kg',
        quantity: 2,
        list_price: 80,
        sale_price: 70,
        unit_price: 70,
        line_total: 140,
      },
      {
        order_item_id: order.order_id * 10 + 2,
        sku_id: 502,
        sku_name: 'Organic Rice',
        size: '5 kg',
        quantity: 1,
        list_price: 200,
        sale_price: 180,
        unit_price: 180,
        line_total: 180,
      },
    ],
  })
}

/**
 * Insight groups the backend omits rather than zeroes. `subscriptions_count` stays `{}`
 * on purpose: it counts customer repeat-order subscriptions, which the dashboard does
 * not show, and leaving it empty keeps the fixture honest about what a vendor has.
 */
export function demoVendorInsights() {
  return envelope({
    total_customers: 3,
    subscriptions_count: {},
    order_status_count: {
      pending_count: 1,
      in_process_count: 1,
      delivered_count: 1,
      cancelled_count: 1,
    },
    payment_dues: { due_amount: 1710, paid_amount: 850 },
  })
}

/** The SKU list, in the paginated container `/products/skus` really answers with. */
export function demoVendorSizes() {
  return envelope({
    result: [
      {
        vendor_product_id: 201,
        sku_id: 501,
        sku_name: 'Fresh Tomatoes',
        sku_size: '1 kg',
        sku_type: 'ITEM',
        is_active: true,
        price_id: 901,
        list_price: 80,
        sale_price: 70,
        discount: 10,
        on_sale: true,
        image_path: null,
        description: 'Vine-ripened, picked the same morning.',
      },
      {
        vendor_product_id: 201,
        sku_id: 503,
        sku_name: 'Fresh Tomatoes',
        sku_size: '500 g',
        sku_type: 'ITEM',
        is_active: true,
        price_id: 903,
        list_price: 45,
        sale_price: 40,
        discount: 5,
        on_sale: true,
        image_path: null,
      },
      {
        vendor_product_id: 202,
        sku_id: 502,
        sku_name: 'Organic Rice',
        sku_size: '5 kg',
        sku_type: 'ITEM',
        is_active: true,
        price_id: 902,
        list_price: 200,
        sale_price: 180,
        discount: 20,
        on_sale: true,
        image_path: null,
      },
      {
        vendor_product_id: 203,
        sku_id: 504,
        sku_name: 'Cold-pressed Groundnut Oil',
        sku_size: '1 L',
        sku_type: 'ITEM',
        is_active: false,
        price_id: 904,
        list_price: 320,
        sale_price: 320,
        discount: 0,
        on_sale: false,
        image_path: null,
      },
    ],
    page_number: 0,
    page_size: 10,
    total_elements: 4,
    total_pages: 1,
    last_page: true,
  })
}

/**
 * The vendor record Settings reads, in the shape `GET /v1/vendors/{id}` answers with.
 *
 * `business_address` is a structured object, not a string — measured on the deployed API,
 * and the reason `mapAddress` flattens rather than reads a field. Kept here rather than
 * inline in the service so it passes through the same mapper guard as every other fixture.
 */
export function demoVendorStoreProfile(vendorId: string | number) {
  return envelope({
    vendor_id: String(vendorId),
    business_name: 'Green Bowl Grocers',
    description: 'Daily fruit, vegetables and staples from around Mirdoddi.',
    business_type: 'Grocery & Staples',
    owner_name: 'Demo Owner',
    contact_person: 'Demo Owner',
    contact_number: '9000000000',
    communication_email: 'owner@example.com',
    business_address: {
      address1: '12 Market Road',
      city: 'Mirdoddi',
      district: 'Siddipet',
      state: 'Telangana',
      zipCode: '502108',
    },
    store_identifier: 'green-bowl-grocers',
  })
}
