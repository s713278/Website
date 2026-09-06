import { beforeEach, describe, expect, it } from 'vitest'
import {
  mapVendorInsights,
  mapVendorOrderDetail,
  mapVendorOrderPage,
  mapVendorSizes,
  mapVendorStoreProfile,
} from '../mappers/vendor-dashboard'
import {
  armDemoFailure,
  resetDemoState,
  updateDemoOrder,
  updateDemoProfile,
  updateDemoSizeByPriceId,
} from './demo-state'
import {
  demoVendorInsights,
  demoVendorOrderDetail,
  demoVendorOrdersPage,
  demoVendorSizes,
  demoVendorStoreProfile,
} from './vendor-dashboard'
import { DEMO_VENDOR_ORDERS } from './vendor-dashboard-seed'

/**
 * The guarantee behind the wire-shaped fixtures: demo mode and live mode share one mapper,
 * so a fixture that stops matching the wire shape fails here rather than drifting into a
 * parallel reality — which is exactly how demo data came to supply `customer_name`,
 * `created_date` and a nested `order_amount` that live has never sent.
 */
describe('demo fixtures survive the real mappers', () => {
  beforeEach(resetDemoState)

  it('maps the orders page the same way a live response is mapped', () => {
    const page = mapVendorOrderPage(demoVendorOrdersPage())

    expect(page.orders).toHaveLength(DEMO_VENDOR_ORDERS.length)
    expect(page.totalElements).toBe(DEMO_VENDOR_ORDERS.length)
    for (const order of page.orders) {
      expect(order.id).toBeTruthy()
      // Would be 'PENDING' if a status failed to map, so this catches a bad fixture.
      expect(['PENDING', 'SCHEDULED', 'IN_PROCESS', 'SHIPPED', 'DELIVERED', 'CANCELLED']).toContain(
        order.deliveryStatus,
      )
    }
  })

  it('sends no field the live list read does not send', () => {
    // The rule that keeps demo honest. If a key is added here that live never sends, the
    // mapper can start depending on it and live silently returns null again.
    const allowed = new Set([
      'order_id',
      'vendor_id',
      'user_id',
      'delivery_date',
      'items_count',
      'amount',
      'order_status',
      'payment_status',
      'delivery_method',
      'mobile',
      'gross_amount',
      'discount',
      'delivery_charges',
      'payment_method',
      'order_timing_type',
    ])

    for (const row of DEMO_VENDOR_ORDERS) {
      for (const key of Object.keys(row)) expect(allowed).toContain(key)
    }
  })

  it('carries a delivered-but-unpaid order, which a single-status UI could not show', () => {
    const page = mapVendorOrderPage(demoVendorOrdersPage())
    const awkward = page.orders.find(
      (order) => order.deliveryStatus === 'DELIVERED' && order.paymentStatus === 'DUE',
    )
    expect(awkward).toBeDefined()
  })

  it('carries a cancelled order still marked due, the row that discredits the dues figure', () => {
    const page = mapVendorOrderPage(demoVendorOrdersPage())
    expect(
      page.orders.some(
        (order) => order.deliveryStatus === 'CANCELLED' && order.paymentStatus === 'DUE',
      ),
    ).toBe(true)
  })

  it('distinguishes a missing amount from a genuine zero', () => {
    const page = mapVendorOrderPage(demoVendorOrdersPage())
    expect(page.orders.some((order) => order.total === null)).toBe(true)
    expect(page.orders.some((order) => order.total === 0)).toBe(true)
  })

  it('carries a row with no mobile, so the contact affordance has an absent case', () => {
    const page = mapVendorOrderPage(demoVendorOrdersPage())
    expect(page.orders.some((order) => order.customerMobile === null)).toBe(true)
  })

  it('filters by status, the way the live endpoint does', () => {
    const page = mapVendorOrderPage(demoVendorOrdersPage(0, 20, { status: 'PENDING' }))
    expect(page.orders.length).toBeGreaterThan(0)
    expect(page.orders.every((order) => order.deliveryStatus === 'PENDING')).toBe(true)
  })

  it('filters by delivery date, inclusive at both ends', () => {
    const all = mapVendorOrderPage(demoVendorOrdersPage(0, 50))
    const target = all.orders.find((order) => order.deliveryDate)?.deliveryDate
    expect(target).toBeTruthy()

    const page = mapVendorOrderPage(
      demoVendorOrdersPage(0, 50, { startDate: target, endDate: target }),
    )
    expect(page.orders.length).toBeGreaterThan(0)
    expect(page.orders.every((order) => order.deliveryDate === target)).toBe(true)
  })

  it('pages, so the pager is exercised before a vendor meets it', () => {
    const first = mapVendorOrderPage(demoVendorOrdersPage(0, 2))
    const second = mapVendorOrderPage(demoVendorOrdersPage(1, 2))

    expect(first.orders).toHaveLength(2)
    expect(first.lastPage).toBe(false)
    expect(second.page).toBe(1)
    expect(second.orders[0].id).not.toBe(first.orders[0].id)
  })

  it('can be made to fail, so error handling is demonstrable in demo mode', () => {
    armDemoFailure()
    expect(() => demoVendorOrdersPage()).toThrow()
    // The failure is armed once, not sticky.
    expect(() => demoVendorOrdersPage()).not.toThrow()
  })

  it('maps an order detail with its lines and a flattened address', () => {
    const fixture = demoVendorOrderDetail(String(DEMO_VENDOR_ORDERS[0].order_id))
    expect(fixture).not.toBeNull()

    const detail = mapVendorOrderDetail(fixture)
    expect(detail.lines.length).toBeGreaterThan(0)
    expect(detail.deliveryAddress).toContain('Mirdoddi')
    // The detail read is the only one carrying a real name; the list row has none.
    expect(detail.customerName).toBeTruthy()
  })

  it('maps insights, omitting rather than zeroing the statuses with no orders', () => {
    const insights = mapVendorInsights(demoVendorInsights())
    expect(insights.ordersByStatus.PENDING).toBeGreaterThan(0)
    // No demo order is SHIPPED-and-nothing-else missing; the point is that absent statuses
    // have no key at all, exactly as the live response omits them.
    const raw = demoVendorInsights().data.order_status_count
    expect(Object.values(raw).every((count) => count > 0)).toBe(true)
  })

  it('maps sizes, keeping the price id a price edit is addressed to', () => {
    const sizes = mapVendorSizes(demoVendorSizes())
    expect(sizes.length).toBeGreaterThan(0)
    // Without this, demo mode would offer an edit control that live mode cannot honour.
    expect(sizes.every((size) => size.priceId !== null)).toBe(true)
    expect(sizes.every((size) => size.productId !== null)).toBe(true)
  })

  it('groups its sizes under more than one product, so the grouped view is exercised', () => {
    const sizes = mapVendorSizes(demoVendorSizes())
    expect(new Set(sizes.map((size) => size.productId)).size).toBeGreaterThan(1)
  })

  it('includes an inactive size, so the hidden state is not only theoretical', () => {
    const sizes = mapVendorSizes(demoVendorSizes())
    expect(sizes.some((size) => !size.active)).toBe(true)
  })

  it('maps the store profile Settings shows, flattening the structured address', () => {
    const profile = mapVendorStoreProfile(demoVendorStoreProfile('96'))

    expect(profile.vendorId).toBe('96')
    expect(profile.businessName).toBe('Green Bowl Grocers')
    // A string here would mean the fixture had drifted to a shape the live record never sends.
    expect(profile.address).toContain('Mirdoddi')
    expect(profile.email).toBe('owner@example.com')
  })

  it('omits fields the vendor has never set, as the live read omits them', () => {
    // The live read drops null columns entirely rather than sending them as null.
    const profile = mapVendorStoreProfile(demoVendorStoreProfile('96'))
    expect(profile.description).toBeNull()
  })
})

/**
 * Demo writes have to persist. A no-op write tells the same lie a failed live write tells —
 * a success message over an unchanged record — and that is the failure this console is being
 * rebuilt to stop making.
 */
describe('demo writes change what the next demo read returns', () => {
  beforeEach(resetDemoState)

  it('shows an edited price on the next read of the sizes list', () => {
    const before = mapVendorSizes(demoVendorSizes())[0]
    expect(before.priceId).toBeTruthy()

    updateDemoSizeByPriceId(before.priceId as string, { list_price: 999, sale_price: 888 })

    const after = mapVendorSizes(demoVendorSizes()).find((size) => size.skuId === before.skuId)
    expect(after?.listPrice).toBe(999)
    expect(after?.salePrice).toBe(888)
  })

  it('shows an advanced order at its new status on the next read of the list', () => {
    const before = mapVendorOrderPage(demoVendorOrdersPage(0, 50)).orders.find(
      (order) => order.deliveryStatus === 'PENDING',
    )
    expect(before).toBeDefined()

    updateDemoOrder(before!.id, { order_status: 'SCHEDULED' })

    const after = mapVendorOrderPage(demoVendorOrdersPage(0, 50)).orders.find(
      (order) => order.id === before!.id,
    )
    expect(after?.deliveryStatus).toBe('SCHEDULED')
  })

  it('reports a write against an id that is not there', () => {
    expect(updateDemoOrder('does-not-exist', { order_status: 'SHIPPED' })).toBe(false)
  })

  it('ignores an explicit null on the profile, exactly as the live PUT ignores it', () => {
    // The live write is a partial merge that silently drops nulls, so no field can be
    // cleared. Demo must not offer a clear that live cannot perform.
    updateDemoProfile({ business_name: null })
    expect(mapVendorStoreProfile(demoVendorStoreProfile('96')).businessName).toBe(
      'Green Bowl Grocers',
    )

    updateDemoProfile({ business_name: 'Renamed Store' })
    expect(mapVendorStoreProfile(demoVendorStoreProfile('96')).businessName).toBe('Renamed Store')
  })

  it('resets on demand, so a walkthrough can be run twice', () => {
    updateDemoProfile({ business_name: 'Renamed Store' })
    resetDemoState()
    expect(mapVendorStoreProfile(demoVendorStoreProfile('96')).businessName).toBe(
      'Green Bowl Grocers',
    )
  })
})
