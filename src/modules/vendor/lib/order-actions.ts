import type { DeliveryStatus, PaymentStatus } from '@/modules/vendor/types/dashboard'

/**
 * The one forward step the backend accepts from each state.
 *
 * This is not a UI preference — it is the measured transition graph. `bulk-status-update`
 * accepts exactly one hop along `PENDING → SCHEDULED → IN_PROCESS → SHIPPED → DELIVERED`
 * and rejects every skip, every reversal and every same-state write.
 *
 * `PENDING: 'IN_PROCESS'` stood here and was a live defect: the backend refuses it, and it
 * refuses it as **HTTP 200**, so the button did nothing and said nothing. See
 * `docs/VENDOR_CONSOLE_BACKEND_ASKS.md` §1.2.
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
