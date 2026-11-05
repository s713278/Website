import type { DeliveryStatus, PaymentStatus } from '@/modules/vendor/types/dashboard'

/**
 * TEMP(vendor-orders-read-only): whether a vendor may change an order from the console.
 *
 * Product decision, 2026-11-03: once an order is placed over WhatsApp, what happens next is
 * between the customer and the vendor, and the platform plays no part in it. So the vendor's
 * orders are read-only while the team decides how status handling should work — most likely
 * for a while, not for good.
 *
 * `false` hides the forward step ("Confirm order", "Mark out for delivery", "Mark delivered"),
 * "Cancel order", "Mark paid" / "Mark unpaid" with the sentence saying that record stays on
 * this device, and the "Payment due" / "Paid" badge — on the Orders list and the order detail.
 *
 * Only the controls are hidden. The service writes, the page handlers and their busy state,
 * and the helpers below are kept on purpose; do not delete them as dead code.
 *
 * Every gated site carries this marker: `grep -rn "TEMP(vendor-orders-read-only)" src`.
 * To revert: set this to `true`; in the page tests, drop the read-only tests and the mocked
 * switch that forces the older tests on.
 */
export const VENDOR_ORDER_WRITES_ENABLED = false

/**
 * TEMP(vendor-orders-minimal-rows): whether the console shows an order's status and delivery
 * date.
 *
 * Product decision, 2026-11-04: on top of the read-only switch above, the vendor's order rows
 * show only the order (number and item count), the customer (name, number, Call and WhatsApp)
 * and the amount — likely for a while, not for good.
 *
 * `false` hides the status pill and the delivery date in the order rows; on Orders, the status
 * chips, the delivery-date filter and the subtotal; on Overview, the status tiles and the
 * "What needs doing" queue, which give way to "Latest orders" and an Orders total tile; and on
 * the order detail, the delivery date (its status pill stays).
 *
 * Only the display is hidden. The filters, reads, helpers and the full row are kept on
 * purpose; do not delete them as dead code. Independent of `VENDOR_ORDER_WRITES_ENABLED`:
 * either may be turned back on without the other.
 *
 * Every gated site carries this marker: `grep -rn "TEMP(vendor-orders-minimal-rows)" src`.
 * To revert: set this to `true`; drop the minimal-mode tests, and in the page tests the mocked
 * switch that forces the older tests on.
 */
export const VENDOR_ORDER_DETAILS_SHOWN = false

/**
 * The one forward step the backend accepts from each state.
 *
 * This is not a UI preference — it is the measured transition graph. `bulk-status-update`
 * accepts exactly one hop along `PENDING → SCHEDULED → IN_PROCESS → SHIPPED → DELIVERED`
 * and rejects every skip, every reversal and every same-state write.
 *
 * `PENDING: 'IN_PROCESS'` stood here and was a live defect: the backend refuses it, and it
 * refuses it as **HTTP 200**, so the button did nothing and said nothing.
 *
 * `DELIVERED` and `CANCELLED` are ends — cancelling has its own endpoint and is not
 * reachable by stepping forward.
 */
const FORWARD: Partial<Record<DeliveryStatus, DeliveryStatus>> = {
  PENDING: 'SCHEDULED',
  SCHEDULED: 'IN_PROCESS',
  IN_PROCESS: 'SHIPPED',
  SHIPPED: 'DELIVERED',
}

export function nextDeliveryStatus(status: DeliveryStatus): DeliveryStatus | null {
  return FORWARD[status] ?? null
}

/** The visible destination; legacy New orders need two wire hops to reach Confirmed. */
export function nextVendorDeliveryStatus(status: DeliveryStatus): DeliveryStatus | null {
  return status === 'PENDING' ? 'IN_PROCESS' : nextDeliveryStatus(status)
}

/** Whether an order can still be cancelled. A finished order cannot. */
export function canCancel(status: DeliveryStatus): boolean {
  return status !== 'DELIVERED' && status !== 'CANCELLED'
}

/**
 * Whether a vendor may record a payment against this order.
 *
 * Everywhere except a cancelled one. Marking a cancelled order paid raises a refund
 * question v1 has no answer for, and `REFUNDED` is not in the backend's enum. A delivered
 * order stays open to it — an order can be delivered and still unpaid — and so does an
 * order that has not shipped, because prepayment is normal: a customer may pay by UPI the
 * moment they order.
 */
export function canRecordPayment(status: DeliveryStatus): boolean {
  return status !== 'CANCELLED'
}

export type StatusPresentation = {
  label: string
  tone: 'neutral' | 'success' | 'warning' | 'danger'
}

/**
 * Display only — these words never become state. The backend enum in
 * `types/dashboard.ts` stays the wire vocabulary; this owns the vendor-facing vocabulary.
 */
export function presentDeliveryStatus(status: DeliveryStatus): StatusPresentation {
  switch (status) {
    case 'PENDING':
    case 'SCHEDULED':
      return { label: 'New', tone: 'danger' }
    case 'IN_PROCESS':
      return { label: 'Confirmed', tone: 'warning' }
    case 'SHIPPED':
      return { label: 'Out for delivery', tone: 'success' }
    case 'DELIVERED':
      return { label: 'Delivered', tone: 'neutral' }
    case 'CANCELLED':
      return { label: 'Cancelled', tone: 'neutral' }
  }
}

/** The label on the button that moves an order forward. */
export function forwardActionLabel(next: DeliveryStatus): string {
  switch (next) {
    case 'IN_PROCESS':
      return 'Confirm order'
    case 'SHIPPED':
      return 'Mark out for delivery'
    case 'DELIVERED':
      return 'Mark delivered'
    default:
      return `Mark ${presentDeliveryStatus(next).label.toLowerCase()}`
  }
}

/**
 * What a vendor is told when the store refuses a step.
 *
 * The backend's own reason is the same generic sentence — "Please check the input request
 * and try again" — for a wrong next status, an order that is not yours, and an order that
 * is already there. Passing it through would tell a vendor to check an input they never
 * typed. So this names the step that failed, admits no reason was given, and points at the
 * one thing that helps: reloading to see where the order actually stands.
 */
export function forwardRefusalMessage(next: DeliveryStatus, partialProgress = false): string {
  const label = presentDeliveryStatus(next).label
  if (partialProgress) {
    return `This order moved partway, but the move to "${label}" could not be completed. Reload to see where it stands before trying again.`
  }
  return `Could not move this order to "${label}". The store refused the change without giving a reason — the order may have already moved on. Reload to see where it stands.`
}

export function presentPaymentStatus(status: PaymentStatus): StatusPresentation {
  return status === 'PAID'
    ? { label: 'Paid', tone: 'success' }
    : { label: 'Payment due', tone: 'warning' }
}
