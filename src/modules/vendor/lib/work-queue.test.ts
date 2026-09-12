import { describe, expect, it } from 'vitest'
import type { VendorOrderSummary } from '@/modules/vendor/types/dashboard'
import {
  DELIVERY_DATE_LABEL,
  deliveryDayLabel,
  isOverdue,
  isoDay,
  selectWorkQueue,
  workQueueStatusCounts,
  workQueueWindow,
} from './work-queue'

function order(
  id: string,
  deliveryStatus: VendorOrderSummary['deliveryStatus'],
  deliveryDate: string | null,
): VendorOrderSummary {
  return {
    id,
    customerName: null,
    customerMobile: '9000000000',
    total: 100,
    deliveryStatus,
    paymentStatus: 'DUE',
    deliveryDate,
  }
}

describe('workQueueWindow', () => {
  it('looks seven days back and two days forward', () => {
    // The lookback is the whole point: an order whose delivery date passed while still
    // unfinished is exactly what a vendor must not lose. Narrowing this to today fails here.
    expect(workQueueWindow(new Date(2026, 8, 6))).toEqual({
      startDate: '2026-08-30',
      endDate: '2026-09-08',
    })
  })

  it('crosses a year boundary without arithmetic of its own', () => {
    expect(workQueueWindow(new Date(2027, 0, 2))).toEqual({
      startDate: '2026-12-26',
      endDate: '2027-01-04',
    })
  })

  it('reads the local calendar day, not the UTC one', () => {
    // `delivery_date` is a plain calendar date. A vendor in IST opening the console at
    // 02:00 would be given yesterday if this went through `toISOString()`.
    const earlyMorning = new Date(2026, 8, 6, 2, 0, 0)
    expect(isoDay(earlyMorning)).toBe('2026-09-06')
  })
})

describe('selectWorkQueue', () => {
  it('drops the finished statuses, which the server filter cannot exclude', () => {
    const queue = selectWorkQueue([
      order('1', 'PENDING', '2026-09-06'),
      order('2', 'DELIVERED', '2026-09-05'),
      order('3', 'CANCELLED', '2026-09-04'),
      order('4', 'SHIPPED', '2026-09-07'),
    ])
    expect(queue.map((row) => row.id)).toEqual(['1', '4'])
  })

  it('keeps every unfinished status, including SCHEDULED', () => {
    // Auto-accepting vendors receive orders already SCHEDULED and never PENDING. A queue
    // keyed on "new" shows such a vendor an empty screen while orders pile up.
    const queue = selectWorkQueue([
      order('1', 'SCHEDULED', '2026-09-06'),
      order('2', 'IN_PROCESS', '2026-09-06'),
    ])
    expect(queue).toHaveLength(2)
  })

  it('sorts soonest first, so the overdue end of the window leads', () => {
    const queue = selectWorkQueue([
      order('later', 'PENDING', '2026-09-08'),
      order('overdue', 'IN_PROCESS', '2026-09-01'),
      order('today', 'SCHEDULED', '2026-09-06'),
    ])
    expect(queue.map((row) => row.id)).toEqual(['overdue', 'today', 'later'])
  })

  it('sorts undated orders last rather than burying dated work behind them', () => {
    const queue = selectWorkQueue([
      order('undated', 'PENDING', null),
      order('dated', 'PENDING', '2026-09-08'),
    ])
    expect(queue.map((row) => row.id)).toEqual(['dated', 'undated'])
  })

  it('does not mutate the array it was given', () => {
    const input = [order('a', 'PENDING', '2026-09-08'), order('b', 'PENDING', '2026-09-01')]
    selectWorkQueue(input)
    expect(input.map((row) => row.id)).toEqual(['a', 'b'])
  })
})

describe('isOverdue', () => {
  it('marks a passed delivery date', () => {
    expect(isOverdue('2026-09-04', '2026-09-06')).toBe(true)
  })

  it('does not mark today or the future', () => {
    expect(isOverdue('2026-09-06', '2026-09-06')).toBe(false)
    expect(isOverdue('2026-09-07', '2026-09-06')).toBe(false)
  })

  it('never marks an undated order, which has no date to have passed', () => {
    expect(isOverdue(null, '2026-09-06')).toBe(false)
  })
})

describe('deliveryDayLabel', () => {
  it('leads with the word "Overdue" and keeps the date underneath', () => {
    // A date two days past reads as ordinary until something says it is late.
    const late = deliveryDayLabel('2026-09-04', '2026-09-06')
    expect(late.headline).toBe('Overdue')
    expect(late.detail).toBe('Fri 4 Sep')
    expect(late.overdue).toBe(true)
  })

  it('names the near days rather than dating them', () => {
    expect(deliveryDayLabel('2026-09-06', '2026-09-06').headline).toBe('Today')
    expect(deliveryDayLabel('2026-09-07', '2026-09-06').headline).toBe('Tomorrow')
  })

  it('crosses a month end when it counts to tomorrow', () => {
    expect(deliveryDayLabel('2026-10-01', '2026-09-30').headline).toBe('Tomorrow')
  })

  it('writes a further-off day as a weekday and date, with nothing beneath it', () => {
    const later = deliveryDayLabel('2026-09-12', '2026-09-06')
    expect(later.headline).toBe('Sat 12 Sep')
    expect(later.detail).toBeNull()
    expect(later.overdue).toBe(false)
  })

  it('says so when there is no delivery date at all', () => {
    expect(deliveryDayLabel(null, '2026-09-06')).toEqual({
      headline: 'Not set',
      detail: null,
      overdue: false,
    })
  })

  it('labels the column it is read under, because no order read carries a booking date', () => {
    // The cell text is deliberately short — "Today" alone would be read as when the order
    // came in. This constant is what every screen must head the column with.
    expect(DELIVERY_DATE_LABEL).toBe('Delivery date')
  })
})

describe('workQueueStatusCounts', () => {
  it('reports every status as an explicit 0 when the backend omits its key', () => {
    // Zero-valued keys are omitted from the response entirely, in both directions. A blank
    // where "none" belongs tells the vendor nothing.
    const counts = workQueueStatusCounts({ PENDING: 2 })
    expect(counts.map(({ status, count }) => [status, count])).toEqual([
      ['SCHEDULED', 2],
      ['IN_PROCESS', 0],
      ['SHIPPED', 0],
    ])
  })

  it('sums both new wire states and keeps confirmed and out for delivery separate', () => {
    const counts = workQueueStatusCounts({ PENDING: 1, SCHEDULED: 2, IN_PROCESS: 3, SHIPPED: 4 })
    expect(counts.map((entry) => entry.count)).toEqual([3, 3, 4])
    expect(workQueueStatusCounts({ SCHEDULED: 5 }).map((entry) => entry.count)).toEqual([5, 0, 0])
    expect(workQueueStatusCounts({}).map((entry) => entry.count)).toEqual([0, 0, 0])
  })

  it('takes its labels from the shared status vocabulary', () => {
    expect(workQueueStatusCounts({}).map((entry) => entry.label)).toEqual([
      'New',
      'Confirmed',
      'Out for delivery',
    ])
  })

  it('leaves the terminal statuses out of the row', () => {
    const counts = workQueueStatusCounts({ DELIVERED: 9, CANCELLED: 9 })
    expect(counts.some((entry) => entry.status === 'DELIVERED')).toBe(false)
    expect(counts.some((entry) => entry.status === 'CANCELLED')).toBe(false)
  })
})
