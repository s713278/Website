import { describe, expect, it } from 'vitest'
import type { DeliveryStatus } from '@/modules/vendor/types/dashboard'
import {
  canCancel,
  canRecordPayment,
  forwardActionLabel,
  forwardRefusalMessage,
  nextDeliveryStatus,
  nextVendorDeliveryStatus,
  presentDeliveryStatus,
} from './order-actions'

const ALL: DeliveryStatus[] = [
  'PENDING',
  'SCHEDULED',
  'IN_PROCESS',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
]

/**
 * The measured transition graph, one row per state.
 *
 * Every edge here was exercised against the deployed API. `PENDING → SCHEDULED` is the row
 * that matters most: `PENDING → IN_PROCESS` stood here, the backend refuses it, and it
 * refuses it as HTTP 200 — so the button did nothing and reported success.
 */
const EXPECTED: Array<[DeliveryStatus, DeliveryStatus | null]> = [
  ['PENDING', 'SCHEDULED'],
  ['SCHEDULED', 'IN_PROCESS'],
  ['IN_PROCESS', 'SHIPPED'],
  ['SHIPPED', 'DELIVERED'],
  ['DELIVERED', null],
  ['CANCELLED', null],
]

describe('nextDeliveryStatus', () => {
  for (const [from, to] of EXPECTED) {
    it(`offers ${to ?? 'nothing'} from ${from}`, () => {
      expect(nextDeliveryStatus(from)).toBe(to)
    })
  }

  it('never sends a pending order straight to being prepared', () => {
    // The rejected edge. A vendor pressing this got a silent no-op, because a refused
    // transition arrives as HTTP 200 with `success_count: 0`.
    expect(nextDeliveryStatus('PENDING')).not.toBe('IN_PROCESS')
  })

  it('never skips a step on the way to delivered', () => {
    // Asserted against the implementation, not against the table above it: only SHIPPED may
    // offer DELIVERED, and every other state must route through the chain first.
    for (const status of ALL) {
      if (status !== 'SHIPPED') expect(nextDeliveryStatus(status)).not.toBe('DELIVERED')
    }
    expect(nextDeliveryStatus('SHIPPED')).toBe('DELIVERED')
  })
})

describe('canCancel', () => {
  it('allows cancelling anything not already finished', () => {
    expect(canCancel('PENDING')).toBe(true)
    expect(canCancel('SHIPPED')).toBe(true)
  })

  it('refuses to cancel a delivered or already-cancelled order', () => {
    expect(canCancel('DELIVERED')).toBe(false)
    expect(canCancel('CANCELLED')).toBe(false)
  })
})

describe('canRecordPayment', () => {
  it('offers the record at every stage, including before delivery', () => {
    // Prepayment is normal: a customer may pay by UPI the moment they order, and a
    // delivered order can still be unpaid.
    expect(ALL.filter(canRecordPayment)).toEqual([
      'PENDING', 'SCHEDULED', 'IN_PROCESS', 'SHIPPED', 'DELIVERED',
    ])
  })

  it('withholds it on a cancelled order, which would raise a refund question', () => {
    expect(canRecordPayment('CANCELLED')).toBe(false)
  })
})

describe('presentDeliveryStatus', () => {
  it('labels every state in the contract enum', () => {
    expect(ALL.map((status) => presentDeliveryStatus(status).label)).toEqual([
      'New', 'New', 'Confirmed', 'Out for delivery', 'Delivered', 'Cancelled',
    ])
    expect(presentDeliveryStatus('SCHEDULED').tone).toBe('danger')
  })
})

describe('nextVendorDeliveryStatus', () => {
  it('confirms both kinds of new order, then follows the delivery progression', () => {
    expect(ALL.map(nextVendorDeliveryStatus)).toEqual([
      'IN_PROCESS', 'IN_PROCESS', 'SHIPPED', 'DELIVERED', null, null,
    ])
  })
})

describe('forwardActionLabel', () => {
  it('names the step in words a vendor would use', () => {
    expect(forwardActionLabel('IN_PROCESS')).toBe('Confirm order')
    expect(forwardActionLabel('SHIPPED')).toBe('Mark out for delivery')
    expect(forwardActionLabel('DELIVERED')).toBe('Mark delivered')
  })

  it('has a label for every step the map can produce', () => {
    for (const [, to] of EXPECTED) {
      if (to) expect(forwardActionLabel(to)).toBeTruthy()
    }
  })
})

describe('forwardRefusalMessage', () => {
  it('names the step that failed rather than the backend generic', () => {
    const message = forwardRefusalMessage('IN_PROCESS')

    expect(message).toContain('Confirmed')
    // The backend says this for a wrong next status, an order that is not yours, and an
    // order that is already there. It must never reach a vendor.
    expect(message).not.toContain('Please check the input request')
  })

  it('reports a completed hop even when the final state was not reached', () => {
    const message = forwardRefusalMessage('IN_PROCESS', true)
    expect(message).toContain('moved partway')
    expect(message).toContain('Reload to see where it stands')
    expect(message).toContain('Confirmed')
  })

  it('says the change was refused for every step, without inventing a cause', () => {
    for (const [, to] of EXPECTED) {
      if (to) expect(forwardRefusalMessage(to)).toContain('refused')
    }
  })
})
