import { describe, expect, it } from 'vitest'
import type { VendorOrderCharges } from '@/modules/vendor/types/dashboard'
import { chargeLines, chargesReconcile } from './order-charges'

function charges(partial: Partial<VendorOrderCharges> = {}): VendorOrderCharges {
  return {
    gross: null,
    discount: null,
    deliveryCharges: null,
    serviceCharge: null,
    tax: null,
    ...partial,
  }
}

describe('chargeLines', () => {
  it('lists only the charges the response carried, in the order a bill reads', () => {
    const lines = chargeLines(charges({ gross: 320, discount: 30, deliveryCharges: 30 }))

    expect(lines.map((line) => line.label)).toEqual([
      // Not "Items": the lines above it are post-discount and this figure is not.
      'Items before discount',
      'Discount',
      'Delivery',
    ])
  })

  it('signs a discount as the subtraction it is', () => {
    const [, discount] = chargeLines(charges({ gross: 320, discount: 30 }))

    expect(discount.amount).toBe(-30)
  })

  it('shows a charge the store really set to zero, and omits one it never sent', () => {
    const lines = chargeLines(charges({ gross: 95, deliveryCharges: 0 }))

    expect(lines.map((line) => line.key)).toEqual(['gross', 'delivery'])
  })

  it('invents nothing when the response carried no breakdown at all', () => {
    expect(chargeLines(charges())).toEqual([])
  })
})

describe('chargesReconcile', () => {
  it('confirms a breakdown that adds up to the total', () => {
    expect(chargesReconcile(charges({ gross: 320, discount: 30, deliveryCharges: 30 }), 320)).toBe(
      true,
    )
  })

  it('reports a breakdown that does not add up, rather than closing the gap', () => {
    // The mutation this exists to catch: deriving the missing charge as `total - sum` and
    // rendering it as if the backend had sent it.
    expect(chargesReconcile(charges({ gross: 320, discount: 30 }), 320)).toBe(false)
  })

  it('claims nothing either way when there is nothing to compare', () => {
    expect(chargesReconcile(charges({ gross: 320 }), null)).toBeNull()
    expect(chargesReconcile(charges(), 320)).toBeNull()
  })

  it('tolerates rounding rather than calling a paise difference a mismatch', () => {
    expect(chargesReconcile(charges({ gross: 100.1, deliveryCharges: 0.2 }), 100.3)).toBe(true)
  })
})
