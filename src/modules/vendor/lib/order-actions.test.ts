import { describe, expect, it } from 'vitest'
import type { DeliveryStatus } from '@/modules/vendor/types/dashboard'
import {
  canCancel,
  forwardActionLabel,
  nextDeliveryStatus,
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

describe('nextDeliveryStatus', () => {
  it('walks an order forward one step at a time', () => {
    expect(nextDeliveryStatus('PENDING')).toBe('IN_PROCESS')
    expect(nextDeliveryStatus('IN_PROCESS')).toBe('SHIPPED')
    expect(nextDeliveryStatus('SHIPPED')).toBe('DELIVERED')
  })

  it('rejoins a scheduled order at the preparing step', () => {
    expect(nextDeliveryStatus('SCHEDULED')).toBe('IN_PROCESS')
  })

  it('offers nothing past a finished order', () => {
    expect(nextDeliveryStatus('DELIVERED')).toBeNull()
    expect(nextDeliveryStatus('CANCELLED')).toBeNull()
  })

  it('never skips shipping on the way to delivered', () => {
    // The guided single action exists to stop exactly this.
    expect(nextDeliveryStatus('PENDING')).not.toBe('DELIVERED')
    expect(nextDeliveryStatus('IN_PROCESS')).not.toBe('DELIVERED')
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

describe('presentDeliveryStatus', () => {
  it('labels every state in the contract enum', () => {
    for (const status of ALL) {
      expect(presentDeliveryStatus(status).label).toBeTruthy()
    }
  })
})

describe('forwardActionLabel', () => {
  it('names the step in words a vendor would use', () => {
    expect(forwardActionLabel('IN_PROCESS')).toBe('Start preparing')
    expect(forwardActionLabel('DELIVERED')).toBe('Mark delivered')
  })
})
