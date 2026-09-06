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

/** The four statuses the count row reports, in the order work moves through them. */
export const WORK_QUEUE_STATUSES: DeliveryStatus[] = [
  'PENDING',
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

function shiftDays(date: Date, days: number): Date {
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

/**
 * What the row says about its delivery date.
 *
 * Always names the date as a delivery date. An order two days late must not read the same as
 * one due tomorrow, so lateness is stated in words as well as marked in colour.
 */
export function dueDescription(deliveryDate: string | null, todayIso: string): string {
  if (!deliveryDate) return 'No delivery date'
  if (deliveryDate < todayIso) return `Overdue — delivery date ${deliveryDate}`
  if (deliveryDate === todayIso) return 'Delivery date today'
  return `Delivery date ${deliveryDate}`
}

export type StatusCount = {
  status: DeliveryStatus
  label: string
  count: number
}

/**
 * The four status counts, each one always present.
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
    count: ordersByStatus[status] ?? 0,
  }))
}
