import type { DeliveryStatus } from '@/modules/vendor/types/dashboard'

/**
 * How an order's state is coloured in the console.
 *
 * Four hues from `design-reference/dashboard.css` — `.dash-status--new`, `--confirmed`,
 * `--out`, `--delivered` — one per step of the delivery walk. The shared `Badge` tones
 * cannot express this: they run neutral/success/warning/danger, which would have to spend
 * "danger" on a brand-new order and reuse a tone across two steps.
 *
 * Reading the row is the job. A vendor scanning a day's deliveries is looking for how far
 * along each one is, and four separable colours answer that at a glance where two shades of
 * amber do not. Every pair here clears 4.5:1.
 *
 * Colour is never the only carrier: each pill also spells its state out, in the words
 * `presentDeliveryStatus` owns.
 */
const PILL: Record<DeliveryStatus, string> = {
  PENDING: 'bg-orange-50 text-orange-700',
  SCHEDULED: 'bg-orange-50 text-orange-700',
  IN_PROCESS: 'bg-blue-50 text-blue-700',
  SHIPPED: 'bg-yellow-100 text-yellow-800',
  DELIVERED: 'bg-[var(--md-green-50)] text-[var(--md-green-800)]',
  /** Not in the reference, which has no cancel. Grey: an end, but not an achievement. */
  CANCELLED: 'bg-slate-100 text-slate-600',
}

const BASE = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.7rem] font-bold'

export function deliveryStatusPillClass(status: DeliveryStatus): string {
  return `${BASE} ${PILL[status]}`
}
