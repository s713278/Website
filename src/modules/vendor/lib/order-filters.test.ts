import { describe, expect, it } from 'vitest'
import {
  describeDeliveryRange,
  hasDeliveryRange,
  matchingPreset,
  ORDER_STATUS_FILTERS,
  parseStatusFilter,
  presetRange,
  RANGE_PRESETS,
  rangeError,
  readOrdersQuery,
  subtotalHeading,
  writeOrdersQuery,
} from './order-filters'

/** A Wednesday, so the week preset has days on both sides of it. */
const TODAY = new Date(2026, 8, 9, 14, 30)

describe('presetRange', () => {
  it('reads today from local calendar fields, not from UTC', () => {
    // `toISOString()` would hand a vendor in IST yesterday's date before 05:30.
    const beforeDawn = new Date(2026, 8, 9, 2, 0)

    expect(presetRange('today', beforeDawn)).toEqual({
      startDate: '2026-09-09',
      endDate: '2026-09-09',
    })
  })

  it('runs the week from Monday to Sunday around today', () => {
    expect(presetRange('this-week', TODAY)).toEqual({
      startDate: '2026-09-07',
      endDate: '2026-09-13',
    })
  })

  it('keeps a Sunday inside the week it ends, not the one it precedes', () => {
    const sunday = new Date(2026, 8, 13, 9, 0)

    expect(presetRange('this-week', sunday)).toEqual({
      startDate: '2026-09-07',
      endDate: '2026-09-13',
    })
  })

  it('counts the next seven days from today inclusive', () => {
    expect(presetRange('next-7', TODAY)).toEqual({
      startDate: '2026-09-09',
      endDate: '2026-09-15',
    })
  })

  it('crosses a month boundary without arithmetic of its own', () => {
    expect(presetRange('next-7', new Date(2026, 8, 30, 9, 0))).toEqual({
      startDate: '2026-09-30',
      endDate: '2026-10-06',
    })
  })
})

describe('matchingPreset', () => {
  it('lights the chip whose range is applied', () => {
    expect(matchingPreset(presetRange('this-week', TODAY), TODAY)).toBe('this-week')
  })

  it('lights nothing for a range typed by hand', () => {
    expect(matchingPreset({ startDate: '2026-09-01', endDate: '2026-09-03' }, TODAY)).toBeNull()
  })

  it('lights nothing when no range is applied, because there is no default', () => {
    expect(matchingPreset({ startDate: null, endDate: null }, TODAY)).toBeNull()
  })

  it('covers every chip it offers', () => {
    for (const preset of RANGE_PRESETS) {
      expect(matchingPreset(presetRange(preset.key, TODAY), TODAY)).toBe(preset.key)
    }
  })
})

describe('describeDeliveryRange', () => {
  it('names a single day once', () => {
    expect(describeDeliveryRange({ startDate: '2026-09-08', endDate: '2026-09-08' })).toBe('8 Sep')
  })

  it('names a range inside one month without repeating it', () => {
    expect(describeDeliveryRange({ startDate: '2026-09-08', endDate: '2026-09-14' })).toBe(
      '8–14 Sep',
    )
  })

  it('names both months when the range crosses one', () => {
    expect(describeDeliveryRange({ startDate: '2026-08-28', endDate: '2026-09-03' })).toBe(
      '28 Aug – 3 Sep',
    )
  })

  it('adds the years when the range crosses one, because Dec–Jan is otherwise ambiguous', () => {
    expect(describeDeliveryRange({ startDate: '2026-12-28', endDate: '2027-01-03' })).toBe(
      '28 Dec 2026 – 3 Jan 2027',
    )
  })

  it('says which end is open when only one is set', () => {
    expect(describeDeliveryRange({ startDate: '2026-09-08', endDate: null })).toBe('from 8 Sep')
    expect(describeDeliveryRange({ startDate: null, endDate: '2026-09-14' })).toBe('up to 14 Sep')
  })

  it('describes nothing when nothing is applied', () => {
    expect(describeDeliveryRange({ startDate: null, endDate: null })).toBeNull()
  })
})

describe('subtotalHeading', () => {
  it('says what the figure is a total of, and calls the date a delivery date', () => {
    const heading = subtotalHeading({ startDate: '2026-09-08', endDate: '2026-09-14' }, null)

    expect(heading).toBe('Orders delivering 8–14 Sep')
    // No creation timestamp exists anywhere in the contract, so nothing here may read as
    // a booking or sales figure.
    expect(heading).not.toMatch(/sales|revenue|earned|booked/i)
  })

  it('names the status filter too, so the figure cannot look like the whole range', () => {
    expect(subtotalHeading({ startDate: '2026-09-08', endDate: '2026-09-14' }, 'PENDING')).toBe(
      'New orders delivering 8–14 Sep',
    )
  })
})

describe('rangeError', () => {
  it('accepts an ordered range and an open-ended one', () => {
    expect(rangeError({ startDate: '2026-09-08', endDate: '2026-09-14' })).toBeNull()
    expect(rangeError({ startDate: '2026-09-08', endDate: null })).toBeNull()
    expect(rangeError({ startDate: null, endDate: null })).toBeNull()
  })

  it('refuses a range that ends before it starts', () => {
    expect(rangeError({ startDate: '2026-09-14', endDate: '2026-09-08' })).toBeTruthy()
  })

  it('accepts a single-day range', () => {
    expect(rangeError({ startDate: '2026-09-08', endDate: '2026-09-08' })).toBeNull()
  })
})

describe('parseStatusFilter', () => {
  it('offers five chips and keeps legacy pending orders under All only', () => {
    expect(ORDER_STATUS_FILTERS).toEqual([
      'SCHEDULED', 'IN_PROCESS', 'SHIPPED', 'DELIVERED', 'CANCELLED',
    ])
    expect(parseStatusFilter('PENDING')).toBeNull()
  })

  it('accepts every status the chips offer', () => {
    for (const status of ORDER_STATUS_FILTERS) {
      expect(parseStatusFilter(status)).toBe(status)
    }
  })

  it('falls back to no filter rather than sending the server a status it does not have', () => {
    expect(parseStatusFilter('READY')).toBeNull()
    expect(parseStatusFilter(null)).toBeNull()
    expect(parseStatusFilter('pending')).toBeNull()
  })
})

describe('readOrdersQuery', () => {
  it('reads status, both dates and the page out of the URL', () => {
    const params = new URLSearchParams({
      status: 'SCHEDULED',
      start: '2026-09-08',
      end: '2026-09-14',
      page: '2',
    })

    expect(readOrdersQuery(params)).toEqual({
      status: 'SCHEDULED',
      range: { startDate: '2026-09-08', endDate: '2026-09-14' },
      page: 2,
    })
  })

  it('applies no range at all when the URL carries none', () => {
    expect(readOrdersQuery(new URLSearchParams())).toEqual({
      status: null,
      range: { startDate: null, endDate: null },
      page: 0,
    })
  })

  it('drops a date that is not a calendar day', () => {
    const params = new URLSearchParams({ start: 'last-tuesday', end: '2026-13-40' })

    expect(readOrdersQuery(params).range).toEqual({ startDate: null, endDate: null })
  })

  it('reads a nonsense page as the first one', () => {
    expect(readOrdersQuery(new URLSearchParams({ page: '-3' })).page).toBe(0)
    expect(readOrdersQuery(new URLSearchParams({ page: 'two' })).page).toBe(0)
  })
})

describe('writeOrdersQuery', () => {
  it('round-trips a query through the URL, so a filter survives leaving the page', () => {
    const query = {
      status: 'IN_PROCESS' as const,
      range: { startDate: '2026-09-08', endDate: '2026-09-14' },
      page: 3,
    }

    expect(readOrdersQuery(new URLSearchParams(writeOrdersQuery(query)))).toEqual(query)
  })

  it('leaves out what is not applied, so the URL shows only real filters', () => {
    expect(
      writeOrdersQuery({ status: null, range: { startDate: null, endDate: null }, page: 0 }),
    ).toEqual({})
  })
})

describe('hasDeliveryRange', () => {
  it('is true as soon as either end is set', () => {
    expect(hasDeliveryRange({ startDate: '2026-09-08', endDate: null })).toBe(true)
    expect(hasDeliveryRange({ startDate: null, endDate: '2026-09-08' })).toBe(true)
    expect(hasDeliveryRange({ startDate: null, endDate: null })).toBe(false)
  })
})
