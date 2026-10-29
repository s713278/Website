import { presentDeliveryStatus } from '@/modules/vendor/lib/order-actions'
import type { DeliveryStatus, VendorOrderSummary } from '@/modules/vendor/types/dashboard'

/**
 * The Overview work queue: which orders still need doing, and over what window.
 *
 * Why a date range rather than a status filter: `order_status` is a **single-value** server
 * filter, so a queue spanning `PENDING`, `SCHEDULED` and `IN_PROCESS` cannot be one
 * status-filtered request. One request over `delivery_date`, with the finished statuses
 * dropped here, costs one call instead of three.
 *
 * The date is `delivery_date` because it is the only date the contract has — no order read
 * carries a creation timestamp. Nothing built on this may label it a booking or sales date.
 *
 * That last rule is why this module also owns how a delivery date is *written* — see
 * `deliveryDayLabel`. Overview and Orders render the same ledger, and one presenter is what
 * stops the two screens from wording the same date two ways.
 */

/**
 * How far back the queue looks, and this is the point of it.
 *
 * An order whose delivery date passed while it was still unfinished is exactly what a vendor
 * must not lose. A today-only window hides it completely, and the vendor finds out when the
 * customer rings. Narrowing this to `0` is the mutation the tests exist to catch.
 */
export const WORK_QUEUE_LOOKBACK_DAYS = 7

/** Far enough ahead to prepare for, short enough that today's work still leads. */
export const WORK_QUEUE_LOOKAHEAD_DAYS = 2

/** Finished orders. They have no place in a queue of what still needs doing. */
const TERMINAL_STATUSES: DeliveryStatus[] = ['DELIVERED', 'CANCELLED']

/** The three visible buckets, keyed by the wire status their Orders links can filter. */
export const WORK_QUEUE_STATUSES: DeliveryStatus[] = [
  'SCHEDULED',
  'IN_PROCESS',
  'SHIPPED',
]

export type DateWindow = { startDate: string; endDate: string }

/**
 * A calendar day as `YYYY-MM-DD`, read from **local** fields.
 *
 * `toISOString()` would answer in UTC, so a vendor in IST opening the console before 05:30
 * would be given yesterday as today. `delivery_date` is a plain calendar date with no zone,
 * so the local reading is the one that matches what the vendor means by "today".
 */
export function isoDay(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Exported because the Orders date presets need the same calendar arithmetic. */
export function shiftDays(date: Date, days: number): Date {
  const shifted = new Date(date)
  shifted.setDate(shifted.getDate() + days)
  return shifted
}

/** The `[today − lookback, today + lookahead]` window the single queue request covers. */
export function workQueueWindow(today: Date): DateWindow {
  return {
    startDate: isoDay(shiftDays(today, -WORK_QUEUE_LOOKBACK_DAYS)),
    endDate: isoDay(shiftDays(today, WORK_QUEUE_LOOKAHEAD_DAYS)),
  }
}

/**
 * The rows of that window that still need doing, soonest first.
 *
 * Terminal statuses are dropped **here** rather than asked for, because the server cannot
 * express "not delivered and not cancelled" in one request. Rows with no delivery date sort
 * last: they cannot be placed on the calendar, and putting them first would bury dated work.
 */
export function selectWorkQueue(orders: VendorOrderSummary[]): VendorOrderSummary[] {
  return orders
    .filter((order) => !TERMINAL_STATUSES.includes(order.deliveryStatus))
    .sort((a, b) => {
      if (a.deliveryDate === b.deliveryDate) return 0
      if (!a.deliveryDate) return 1
      if (!b.deliveryDate) return -1
      return a.deliveryDate.localeCompare(b.deliveryDate)
    })
}

/** Whether the delivery date has already passed. Undated orders are never overdue. */
export function isOverdue(deliveryDate: string | null, todayIso: string): boolean {
  return deliveryDate != null && deliveryDate < todayIso
}

/** The one word both screens use for this date, on the column head and on the stacked label. */
export const DELIVERY_DATE_LABEL = 'Delivery date'

export type DeliveryDay = {
  /** What the cell leads with: "Today", "Tomorrow", "Overdue", a date, or "Not set". */
  headline: string
  /** The date itself, when the headline replaced it. `null` when the headline is the date. */
  detail: string | null
  overdue: boolean
}

/**
 * `Fri 4 Sep`, spelled out here rather than by `Intl`.
 *
 * `en-IN` writes September as "Sept" and punctuates the weekday, and CLDR has changed both
 * inside a release before now. A three-letter month in a column sized for three letters is
 * not something to leave to an ICU update.
 */
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function writeDay(day: Date): string {
  return `${WEEKDAYS[day.getDay()]} ${day.getDate()} ${MONTHS[day.getMonth()]}`
}

function readIsoDay(iso: string): Date | null {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!parts) return null
  return new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]))
}

/**
 * What the ledger's delivery-date cell says.
 *
 * Short, because the column is headed `DELIVERY_DATE_LABEL` and a cell that repeats its own
 * header is a cell a vendor stops reading. The header is what keeps the date honest: it is the
 * only date the contract has, and an unlabelled "Today" would be read as when the order came
 * in. Nothing may render these words without that label beside them.
 *
 * An overdue order leads with the word, not the date, and keeps the date underneath — a date
 * two days past reads as ordinary until something says it is late.
 */
export function deliveryDayLabel(deliveryDate: string | null, todayIso: string): DeliveryDay {
  if (!deliveryDate) return { headline: 'Not set', detail: null, overdue: false }

  const day = readIsoDay(deliveryDate)
  const written = day ? writeDay(day) : deliveryDate

  if (isOverdue(deliveryDate, todayIso)) {
    return { headline: 'Overdue', detail: written, overdue: true }
  }
  if (deliveryDate === todayIso) return { headline: 'Today', detail: null, overdue: false }

  const today = readIsoDay(todayIso)
  if (today && deliveryDate === isoDay(shiftDays(today, 1))) {
    return { headline: 'Tomorrow', detail: null, overdue: false }
  }

  return { headline: written, detail: null, overdue: false }
}

export type StatusCount = {
  status: DeliveryStatus
  label: string
  count: number
}

/**
 * The three status counts, each one always present. New includes legacy PENDING orders.
 *
 * `?? 0` is not defensive padding: the backend **omits zero-valued keys entirely**, in both
 * directions, and the omission was watched appearing and disappearing within one session.
 * Rendering a missing key as blank tells a vendor nothing where the truth is "none". Labels
 * come from `presentDeliveryStatus` so the console has one vocabulary, not two.
 */
export function workQueueStatusCounts(
  ordersByStatus: Partial<Record<DeliveryStatus, number>>,
): StatusCount[] {
  return WORK_QUEUE_STATUSES.map((status) => ({
    status,
    label: presentDeliveryStatus(status).label,
    count: (ordersByStatus[status] ?? 0) + (status === 'SCHEDULED' ? (ordersByStatus.PENDING ?? 0) : 0),
  }))
}
