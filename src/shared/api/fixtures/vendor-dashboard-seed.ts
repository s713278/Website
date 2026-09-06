/**
 * Seed data for demo mode, in **wire shape**.
 *
 * These are not view models. They are what the backend sends, so demo mode can hand them to
 * the same mappers live mode uses. Nothing downstream branches on mode.
 *
 * Every shape here was measured against the deployed dev API. The previous version of this
 * file was not, and that is why it existed: it supplied `customer_name`, `created_date` and
 * a nested `order_amount` on list rows, the mapper read exactly those three, and **live sends
 * none of them**. Demo looked perfect while every live row mapped to nulls. Three of the five
 * shipped bugs came from that single mismatch, so the rule now is: if live does not send it,
 * it does not appear here.
 *
 * Content is invented. No real vendor, customer, or contact detail belongs in this file.
 */

/** Dates are relative so the work queue and date filters always have something to show. */
function day(offset: number): string {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  return date.toISOString().slice(0, 10)
}

/**
 * The order list row — **exactly the 15 keys the deployed API returns**, no more.
 *
 * Note what is absent and must stay absent: no `customer_name`, no `order_amount`, and no
 * creation timestamp of any kind. `mobile` is the only customer identity a list row carries.
 */
export const DEMO_VENDOR_ORDERS: Record<string, unknown>[] = [
  {
    order_id: 4021,
    vendor_id: 262,
    user_id: 17001,
    delivery_date: day(0),
    items_count: 3,
    amount: 320,
    order_status: 'PENDING',
    payment_status: 'DUE',
    delivery_method: 'HOME_DELIVERY',
    mobile: '9000000001',
    gross_amount: 320,
    discount: 30,
    delivery_charges: 30,
    payment_method: 'CASH',
    order_timing_type: 'CUSTOMER_SELECT_DATE',
  },
  // Auto-accepting vendors receive orders already SCHEDULED, never PENDING. A console that
  // keys "new orders" on PENDING shows such a vendor nothing at all.
  {
    order_id: 4020,
    vendor_id: 262,
    user_id: 17002,
    delivery_date: day(0),
    items_count: 1,
    amount: 150,
    order_status: 'SCHEDULED',
    payment_status: 'DUE',
    delivery_method: 'HOME_DELIVERY',
    mobile: '9000000002',
    gross_amount: 120,
    discount: 0,
    delivery_charges: 30,
    payment_method: 'UPI',
    order_timing_type: 'CUSTOMER_SELECT_DATE',
  },
  // Overdue and still unfinished — the row the work queue's 7-day lookback exists to catch.
  {
    order_id: 4019,
    vendor_id: 262,
    user_id: 17003,
    delivery_date: day(-2),
    items_count: 2,
    amount: 640,
    order_status: 'IN_PROCESS',
    payment_status: 'DUE',
    delivery_method: 'HOME_DELIVERY',
    mobile: '9000000003',
    gross_amount: 610,
    discount: 0,
    delivery_charges: 30,
    payment_method: 'CASH',
    order_timing_type: 'CUSTOMER_SELECT_DATE',
  },
  {
    order_id: 4018,
    vendor_id: 262,
    user_id: 17004,
    delivery_date: day(1),
    items_count: 1,
    amount: 850,
    order_status: 'SHIPPED',
    payment_status: 'PAID',
    delivery_method: 'HOME_DELIVERY',
    mobile: '9000000004',
    gross_amount: 850,
    discount: 30,
    delivery_charges: 30,
    payment_method: 'UPI',
    order_timing_type: 'CUSTOMER_SELECT_DATE',
  },
  // Delivered and still unpaid. A single-status list cannot express this at all, and no
  // route can currently move it to PAID.
  {
    order_id: 4009,
    vendor_id: 262,
    user_id: 17005,
    delivery_date: day(-4),
    items_count: 3,
    amount: 1240,
    order_status: 'DELIVERED',
    payment_status: 'DUE',
    delivery_method: 'SELF_PICKUP',
    mobile: '9000000005',
    gross_amount: 1240,
    discount: 30,
    delivery_charges: 30,
    payment_method: 'CASH',
    order_timing_type: 'CUSTOMER_SELECT_DATE',
  },
  // Cancelled and still marked DUE. This row is why the dues figure is not displayed:
  // the backend counts it as money owed and nothing brings it back down.
  {
    order_id: 3998,
    vendor_id: 262,
    user_id: 17006,
    delivery_date: day(-7),
    items_count: 1,
    amount: 160,
    order_status: 'CANCELLED',
    payment_status: 'DUE',
    delivery_method: 'HOME_DELIVERY',
    mobile: '9000000006',
    gross_amount: 130,
    discount: 0,
    delivery_charges: 30,
    payment_method: 'CASH',
    order_timing_type: 'CUSTOMER_SELECT_DATE',
  },
  // `amount` absent entirely. Must render as unknown, never as ₹0.
  {
    order_id: 3995,
    vendor_id: 262,
    user_id: 17007,
    delivery_date: day(2),
    items_count: 2,
    order_status: 'SCHEDULED',
    payment_status: 'DUE',
    delivery_method: 'HOME_DELIVERY',
    mobile: '9000000007',
    gross_amount: 240,
    discount: 0,
    delivery_charges: 30,
    payment_method: 'CASH',
    order_timing_type: 'CUSTOMER_SELECT_DATE',
  },
  // A genuine zero. Must render as ₹0, distinct from the row above.
  {
    order_id: 3994,
    vendor_id: 262,
    user_id: 17008,
    delivery_date: day(3),
    items_count: 1,
    amount: 0,
    order_status: 'SCHEDULED',
    payment_status: 'PAID',
    delivery_method: 'SELF_PICKUP',
    mobile: '9000000008',
    gross_amount: 0,
    discount: 0,
    delivery_charges: 0,
    payment_method: 'CASH',
    order_timing_type: 'CUSTOMER_SELECT_DATE',
  },
  // No mobile. The call and WhatsApp affordances must not appear for this row.
  {
    order_id: 3990,
    vendor_id: 262,
    user_id: 17009,
    delivery_date: day(4),
    items_count: 1,
    amount: 95,
    order_status: 'PENDING',
    payment_status: 'DUE',
    delivery_method: 'SELF_PICKUP',
    gross_amount: 95,
    discount: 0,
    delivery_charges: 0,
    payment_method: 'CASH',
    order_timing_type: 'CUSTOMER_SELECT_DATE',
  },
]

/** Line items for the detail read, keyed by order id. Orders without an entry get one line. */
export const DEMO_ORDER_ITEMS: Record<string, Record<string, unknown>[]> = {
  '4021': [
    {
      order_item_id: 40211,
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
      order_item_id: 40212,
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
}

/** The SKU list, in the paginated container `/products/skus` really answers with. */
export const DEMO_VENDOR_SIZES: Record<string, unknown>[] = [
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
]

/**
 * The vendor record Settings reads.
 *
 * `business_address` is a structured object, not a string. The read also **omits null
 * fields entirely** rather than sending them as null, so a vendor who has set nothing has
 * no `description` key at all — which is why `description` is absent here.
 */
export const DEMO_VENDOR_PROFILE: Record<string, unknown> = {
  vendor_id: '262',
  business_name: 'Green Bowl Grocers',
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
}
