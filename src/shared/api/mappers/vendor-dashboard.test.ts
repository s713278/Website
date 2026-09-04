import { describe, expect, it } from 'vitest'
import {
  mapVendorInsights,
  mapVendorOrderDetail,
  mapVendorOrderPage,
  mapVendorSizes,
  toDeliveryStatus,
} from './vendor-dashboard'

describe('mapVendorInsights', () => {
  it('survives the bare {} groups a new vendor really gets', () => {
    // Measured against the deployed API for user 10603: empty groups come back as `{}`,
    // not as zeroed keys, so reaching for `.delivered_count` directly throws or yields
    // undefined.
    const insights = mapVendorInsights({
      data: {
        total_customers: 0,
        subscriptions_count: {},
        order_status_count: {},
        payment_dues: {},
      },
    })

    expect(insights.totalCustomers).toBe(0)
    expect(insights.ordersByStatus).toEqual({})
    expect(insights.dueAmount).toBeNull()
    expect(insights.paidAmount).toBeNull()
  })

  it('reads the counts that are present without inventing the ones that are not', () => {
    const insights = mapVendorInsights({
      data: {
        total_customers: 27,
        order_status_count: { delivered_count: 4, scheduled_count: 8 },
        payment_dues: { due_amount: 1466, paid_amount: 231 },
      },
    })

    expect(insights.ordersByStatus).toEqual({ DELIVERED: 4, SCHEDULED: 8 })
    expect(insights.ordersByStatus.PENDING).toBeUndefined()
    expect(insights.dueAmount).toBe(1466)
  })

  it('does not fall over on a response with no data at all', () => {
    expect(mapVendorInsights(null).ordersByStatus).toEqual({})
  })
})

describe('toDeliveryStatus', () => {
  it('accepts every state in the contract enum', () => {
    for (const status of ['PENDING', 'SCHEDULED', 'IN_PROCESS', 'SHIPPED', 'DELIVERED', 'CANCELLED']) {
      expect(toDeliveryStatus(status)).toBe(status)
    }
  })

  it('refuses to pass through the retired kitchen vocabulary', () => {
    // These were the app's old statuses. They are not backend states, so they must not
    // survive mapping as if they were.
    for (const legacy of ['new', 'accepted', 'preparing', 'ready', 'completed']) {
      expect(toDeliveryStatus(legacy)).toBe('PENDING')
    }
  })
})

describe('mapVendorOrderPage', () => {
  it('reads the paginated container the orders endpoint really returns', () => {
    // Measured shape: `{result: [], page_number, page_size, total_elements, ...}`.
    const page = mapVendorOrderPage({
      data: { result: [], page_number: 0, page_size: 5, total_elements: 0, total_pages: 0, last_page: true },
    })

    expect(page.orders).toEqual([])
    expect(page.totalElements).toBe(0)
    expect(page.lastPage).toBe(true)
  })

  it('maps a row onto the two independent status axes', () => {
    const page = mapVendorOrderPage({
      data: {
        result: [
          {
            order_id: 5001,
            customer_name: 'Asha',
            order_status: 'DELIVERED',
            payment_status: 'DUE',
            delivery_date: '2026-09-02',
            order_amount: { amount: 450 },
          },
        ],
        page_number: 0,
        total_pages: 1,
        total_elements: 1,
        last_page: true,
      },
    })

    const [order] = page.orders
    // Delivered but unpaid is a real state the old single-status UI could not express.
    expect(order.deliveryStatus).toBe('DELIVERED')
    expect(order.paymentStatus).toBe('DUE')
    expect(order.total).toBe(450)
    expect(order.id).toBe('5001')
  })

  it('accepts a bare array, since sibling endpoints answer that way', () => {
    const page = mapVendorOrderPage({ data: [{ order_id: 1, order_status: 'PENDING' }] })
    expect(page.orders).toHaveLength(1)
  })
})

describe('mapVendorOrderDetail', () => {
  it('flattens the nested address and the line items', () => {
    const detail = mapVendorOrderDetail({
      data: {
        order_id: 7,
        customer_name: 'Asha',
        customer_mobile: '9912149049',
        order_status: 'IN_PROCESS',
        payment_status: 'PAID',
        delivery_address: {
          address: { address1: 'Survey No#190', city: 'Mirdoddi', state: 'Telangana', zipCode: '502108' },
        },
        order_items: [
          { order_item_id: 11, sku_name: 'Jagruthi Weekly', size: 'Yearly', quantity: 2, line_total: 1700 },
        ],
      },
    })

    expect(detail.deliveryAddress).toBe('Survey No#190, Mirdoddi, Telangana, 502108')
    expect(detail.lines).toHaveLength(1)
    expect(detail.lines[0]).toMatchObject({ name: 'Jagruthi Weekly', quantity: 2, amount: 1700 })
  })
})

describe('mapVendorSizes', () => {
  it('maps the real SKU payload, keeping the price id an edit needs', () => {
    // Recorded from vendor 96 on the deployed API.
    const sizes = mapVendorSizes({
      data: {
        result: [
          {
            vendor_product_id: 111,
            sku_id: 756,
            sku_name: 'Jagruthi Weekly-Yearly Subscription',
            sku_size: 'Yearly Subscription',
            is_active: true,
            price_id: 58,
            list_price: 1000,
            sale_price: 850,
          },
        ],
        page_number: 0,
        last_page: true,
      },
    })

    expect(sizes).toHaveLength(1)
    // Without `price_id` there is no way to write a price at all.
    expect(sizes[0].priceId).toBe('58')
    expect(sizes[0]).toMatchObject({ skuId: '756', listPrice: 1000, salePrice: 850, active: true })
  })

  it('drops a row with no SKU id rather than rendering a size that cannot be edited', () => {
    expect(mapVendorSizes({ data: { result: [{ sku_name: 'Orphan' }] } })).toEqual([])
  })
})
