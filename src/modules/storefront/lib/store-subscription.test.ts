import { describe, expect, it } from 'vitest'
import { mapVendorToStore } from '@/shared/api/mappers/vendor'
import { isStoreClosedForSubscription, storeClosedMessage } from './store-subscription'

describe('store subscription gate', () => {
  it('reads subscription status from the public storefront payload', () => {
    expect(
      mapVendorToStore({
        vendor_id: 273,
        business_name: 'SRK Traditional Foods and Pickles',
        subscription: { status: 'expired' },
      }).subscriptionStatus,
    ).toBe('EXPIRED')
    expect(
      mapVendorToStore({
        vendor_id: 273,
        subscription_status: 'HALTED',
      }).subscriptionStatus,
    ).toBe('HALTED')
    expect(
      mapVendorToStore({
        vendor_id: 273,
        business_name: 'SRK Traditional Foods and Pickles',
      }).subscriptionStatus,
    ).toBeUndefined()
  })

  it('closes the shop only for halted, cancelled, or expired plans', () => {
    expect(isStoreClosedForSubscription('HALTED')).toBe(true)
    expect(isStoreClosedForSubscription('cancelled')).toBe(true)
    expect(isStoreClosedForSubscription('EXPIRED')).toBe(true)
    expect(isStoreClosedForSubscription('ACTIVE')).toBe(false)
    expect(isStoreClosedForSubscription(undefined)).toBe(false)
  })

  it('uses customer copy instead of the raw status', () => {
    expect(storeClosedMessage({ name: 'SRK', subscriptionStatus: 'EXPIRED' }).title).toBe(
      "This shop isn't taking orders",
    )
    expect(storeClosedMessage({ name: 'SRK', subscriptionStatus: 'CANCELLED' }).title).toBe(
      'This shop is closed',
    )
    expect(storeClosedMessage({ name: 'SRK', subscriptionStatus: 'HALTED' }).body).toContain(
      "isn't accepting orders",
    )
  })
})
