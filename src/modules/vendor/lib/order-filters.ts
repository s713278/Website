import { presentDeliveryStatus } from '@/modules/vendor/lib/order-actions'
import { isoDay, shiftDays } from '@/modules/vendor/lib/work-queue'
import type { DeliveryStatus } from '@/modules/vendor/types/dashboard'

/**
 * What the Orders screen is filtered by, and how that filter reads on screen.
 *
 * Every date here is a **delivery date**. It is the only date the contract has — no order
 * read in the API carries a creation timestamp of any kind — so nothing built on this may
 * present it as a booking date, an order date or a sales date. The labels in this module
 * exist to make that impossible to get wrong by accident.
 *
 * All of it is pure so the page keeps only the effect: `docs/TESTING.md` says push a test
 * as far down as it goes.
 */

/** A delivery-date window. Either end may be open; both open means no range is applied. */
export type DeliveryRange = { startDate: string | null; endDate: string | null }

export type OrdersQuery = {
  status: DeliveryStatus | null
  range: DeliveryRange
  page: number
}

export const NO_RANGE: DeliveryRange = { startDate: null, endDate: null }

/** The statuses the chips offer, in the order work moves through them. */
export const ORDER_STATUS_FILTERS: DeliveryStatus[] = [
  'PENDING',
  'SCHEDULED',
  'IN_PROCESS',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
]

export type RangePresetKey = 'today' | 'this-week' | 'next-7'

/**
 * The shortcuts, beside the two free inputs rather than instead of them.
 *
 * There is deliberately **no default range**. A screen that opens on "this week" answers a
 * question the vendor did not ask, and the money figure below it would then total a window
 * nobody chose.
 */
export const RANGE_PRESETS: Array<{ key: RangePresetKey; label: string }> = [
  { key: 'today', label: 'Today' },
  { key: 'this-week', label: 'This week' },
  { key: 'next-7', label: 'Next 7 days' },
]

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

/**
 * A `YYYY-MM-DD` string as a local calendar day, or `null` if it is not one.
 *
 * `new Date('2026-09-08')` parses as **UTC midnight**, which renders as the 7th anywhere
 * west of Greenwich. `delivery_date` is a zoneless calendar date, so it is built from local
 * fields instead — the same reason `isoDay` reads local fields on the way out.
 */
export function parseIsoDay(value: string | null | undefined): Date | null {
  if (!value || !ISO_DAY.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  // Rejects 2026-13-40 and friends, which `Date` would happily roll over into next year.
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null
  }
  return date
}

/** The Monday of the week containing `date`. Sunday belongs to the week it ends. */
function startOfWeek(date: Date): Date {
  const weekday = date.getDay()
  return shiftDays(date, weekday === 0 ? -6 : 1 - weekday)
}

export function presetRange(key: RangePresetKey, today: Date): DeliveryRange {
  switch (key) {
    case 'today':
      return { startDate: isoDay(today), endDate: isoDay(today) }
    case 'this-week': {
      const monday = startOfWeek(today)
      return { startDate: isoDay(monday), endDate: isoDay(shiftDays(monday, 6)) }
    }
    case 'next-7':
      return { startDate: isoDay(today), endDate: isoDay(shiftDays(today, 6)) }
  }
}

/** Which chip, if any, the applied range corresponds to. A hand-typed range lights none. */
export function matchingPreset(range: DeliveryRange, today: Date): RangePresetKey | null {
  if (!hasDeliveryRange(range)) return null
  const match = RANGE_PRESETS.find(({ key }) => {
    const preset = presetRange(key, today)
    return preset.startDate === range.startDate && preset.endDate === range.endDate
  })
  return match?.key ?? null
}

export function hasDeliveryRange(range: DeliveryRange): boolean {
  return range.startDate != null || range.endDate != null
}

function dayLabel(date: Date, withYear: boolean): string {
  const stem = `${date.getDate()} ${MONTHS[date.getMonth()]}`
  return withYear ? `${stem} ${date.getFullYear()}` : stem
}

/**
 * The applied range in words, for the label beside the subtotal.
 *
 * Years appear only when the range crosses one, because "28 Dec – 3 Jan" is otherwise
 * ambiguous in exactly the case a vendor is most likely to be looking at it.
 */
export function describeDeliveryRange(range: DeliveryRange): string | null {
  const start = parseIsoDay(range.startDate)
  const end = parseIsoDay(range.endDate)

  if (start && end) {
    if (range.startDate === range.endDate) return dayLabel(start, false)
    if (start.getFullYear() !== end.getFullYear()) {
      return `${dayLabel(start, true)} – ${dayLabel(end, true)}`
    }
    if (start.getMonth() === end.getMonth()) {
      return `${start.getDate()}–${end.getDate()} ${MONTHS[end.getMonth()]}`
    }
    return `${dayLabel(start, false)} – ${dayLabel(end, false)}`
  }

  if (start) return `from ${dayLabel(start, false)}`
  if (end) return `up to ${dayLabel(end, false)}`
  return null
}

/**
 * What the one money figure on the console is a total of.
 *
 * It names the delivery range and, when one is applied, the status — because a subtotal of
 * the scheduled orders in a week, labelled only with the week, reads as the week's whole
 * takings. It is never called takings: no order read carries a creation date, so the console
 * cannot say what was sold in a period and must not imply it.
 */
export function subtotalHeading(range: DeliveryRange, status: DeliveryStatus | null): string | null {
  const described = describeDeliveryRange(range)
  if (!described) return null
  const prefix = status ? `${presentDeliveryStatus(status).label} orders` : 'Orders'
  return `${prefix} delivering ${described}`
}

/** The reason a range cannot be applied, or `null` when it can. */
export function rangeError(range: DeliveryRange): string | null {
  const start = parseIsoDay(range.startDate)
  const end = parseIsoDay(range.endDate)
  if (start && end && range.startDate! > range.endDate!) {
    return 'The last delivery date is before the first one. Swap them to see results.'
  }
  return null
}

/**
 * The filter carried in `?status=`, or none.
 *
 * An unknown value falls back to "All" rather than being sent to the server as an
 * `order_status` the enum does not contain — Overview's status counts link straight in here
 * with the filter already chosen, so the URL is a real input, not just internal state.
 */
export function parseStatusFilter(raw: string | null): DeliveryStatus | null {
  return ORDER_STATUS_FILTERS.find((status) => status === raw) ?? null
}

/**
 * The whole filter state, read from the URL.
 *
 * All of it lives in the URL, page included, so that opening an order and coming back
 * restores the exact view — browser history is what carries it, not component state that
 * unmounts on the way out.
 */
export function readOrdersQuery(params: URLSearchParams): OrdersQuery {
  const page = Number(params.get('page'))
  return {
    status: parseStatusFilter(params.get('status')),
    range: {
      startDate: parseIsoDay(params.get('start')) ? params.get('start') : null,
      endDate: parseIsoDay(params.get('end')) ? params.get('end') : null,
    },
    page: Number.isInteger(page) && page > 0 ? page : 0,
  }
}

/** The same state on the way back out. Anything not applied is left out of the URL. */
export function writeOrdersQuery(query: OrdersQuery): Record<string, string> {
  const params: Record<string, string> = {}
  if (query.status) params.status = query.status
  if (query.range.startDate) params.start = query.range.startDate
  if (query.range.endDate) params.end = query.range.endDate
  if (query.page > 0) params.page = String(query.page)
  return params
}
