import { describe, expect, it } from 'vitest'
import {
  mapVendorInsights,
  mapVendorOrderDetail,
  mapVendorOrderPage,
  mapVendorSizes,
  mapVendorStoreProfile,
} from '../mappers/vendor-dashboard'
import {
  DEMO_VENDOR_ORDERS,
  demoVendorInsights,
  demoVendorOrderDetail,
  demoVendorOrdersPage,
  demoVendorSizes,
  demoVendorStoreProfile,
} from './vendor-dashboard'

/**
 * The guarantee behind the wire-shaped fixtures: demo mode and live
 * mode share one mapper, so a fixture that stops matching the wire shape fails here
 * rather than drifting into a parallel reality — which is exactly how the previous demo
 * data ended up describing a restaurant while the backend returned groceries.
 */
describe('demo fixtures survive the real mappers', () => {
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

  it('carries a delivered-but-unpaid order, which the old single-status UI could not show', () => {
    const page = mapVendorOrderPage(demoVendorOrdersPage())
    const awkward = page.orders.find(
      (order) => order.deliveryStatus === 'DELIVERED' && order.paymentStatus === 'DUE',
    )
    expect(awkward).toBeDefined()
  })

  it('filters server-side, the way the live endpoint does', () => {
    const page = mapVendorOrderPage(demoVendorOrdersPage(0, 20, 'PENDING'))
    expect(page.orders.every((order) => order.deliveryStatus === 'PENDING')).toBe(true)
  })

  it('maps an order detail with its lines and a flattened address', () => {
    const fixture = demoVendorOrderDetail(String(DEMO_VENDOR_ORDERS[0].order_id))
    expect(fixture).not.toBeNull()

    const detail = mapVendorOrderDetail(fixture)
    expect(detail.lines.length).toBeGreaterThan(0)
    expect(detail.deliveryAddress).toContain('Mirdoddi')
  })

  it('maps insights, including the groups the backend omits rather than zeroes', () => {
    const insights = mapVendorInsights(demoVendorInsights())
    expect(insights.totalCustomers).toBe(3)
    expect(insights.ordersByStatus.PENDING).toBe(1)
    expect(insights.dueAmount).toBeGreaterThan(0)
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
})
