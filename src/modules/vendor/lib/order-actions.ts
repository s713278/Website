import type { DeliveryStatus, PaymentStatus } from '@/modules/vendor/types/dashboard'

/**
 * The one sensible forward step from each state.
 *
 * A guided single action rather than a free status picker: the states are ordered, and
 * offering every jump invites a vendor to mark an order delivered before it ships.
 *
 * `SCHEDULED` rejoins the line at `IN_PROCESS`. `DELIVERED` and `CANCELLED` are ends —
 * cancelling has its own endpoint and is not reachable by stepping forward.
 */
const FORWARD: Partial<Record<DeliveryStatus, DeliveryStatus>> = {
  PENDING: 'IN_PROCESS',
  SCHEDULED: 'IN_PROCESS',
  IN_PROCESS: 'SHIPPED',
  SHIPPED: 'DELIVERED',
}

export function nextDeliveryStatus(status: DeliveryStatus): DeliveryStatus | null {
  return FORWARD[status] ?? null
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
 * `types/dashboard.ts` is the vocabulary; this is how it reads on screen.
 */
export function presentDeliveryStatus(status: DeliveryStatus): StatusPresentation {
  switch (status) {
    case 'PENDING':
      return { label: 'New', tone: 'danger' }
    case 'SCHEDULED':
      return { label: 'Scheduled', tone: 'warning' }
    case 'IN_PROCESS':
      return { label: 'Being prepared', tone: 'warning' }
    case 'SHIPPED':
      return { label: 'On the way', tone: 'success' }
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
      return 'Start preparing'
    case 'SHIPPED':
      return 'Mark on the way'
    case 'DELIVERED':
      return 'Mark delivered'
    default:
      return `Mark ${presentDeliveryStatus(next).label.toLowerCase()}`
  }
}

export function presentPaymentStatus(status: PaymentStatus): StatusPresentation {
  return status === 'PAID'
    ? { label: 'Paid', tone: 'success' }
    : { label: 'Payment due', tone: 'warning' }
}
