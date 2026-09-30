/**
 * The six demo Plan prototype states. This is their single seed definition: the local Test helper
 * stores it when a state is selected, and Plan renders it directly when the helper is down, so the
 * two paths cannot disagree. Plain erasable TypeScript without imports, so the helper can load it in Node.
 */

/** The helper vendor key for every prototype scenario; vendor `r1` holds a parked Test subscription. */
export const PROTOTYPE_VENDOR_KEY = 'r1-prototype'

export const prototypeStates = ['free_days', 'three_days_left', 'paid', 'payment_failed', 'stopped', 'shop_closed'] as const
export type PrototypeState = typeof prototypeStates[number]

export const prototypeStateLabels: Record<PrototypeState, string> = {
  free_days: 'Free days',
  three_days_left: '3 days left',
  paid: 'Paid',
  payment_failed: 'Payment failed',
  stopped: 'Stopped',
  shop_closed: 'Shop closed',
}

export interface PrototypeSeed {
  trialEndsAt: string
  /** The paid boundary: a labelled sample, never a provider-verified fee. */
  paidThrough: string | null
  /** AutoPay as seeded: never set up, on (Paid sample) or cancelled by the vendor. */
  autoPay: 'none' | 'on' | 'cancelled'
  /** When Razorpay halted collection after every retry: Payment failed. */
  failedPaymentAt: string | null
  /** Plan's "Payments you made", oldest first. Seeded per state; later transitions append to it. */
  events: PrototypeEvent[]
}

/** One dated billing event. The helper stores it with the scenario, so every date is absolute. */
export type PrototypeEvent =
  | { kind: 'free_days_started'; at: string; days: number }
  | { kind: 'paid'; at: string; amountMinor: number; paidThrough: string }
  | { kind: 'payment_failed'; at: string }
  | { kind: 'plan_stopped'; at: string; paidThrough: string }
  /** Appended by the helper once Razorpay Test shows trial AutoPay authorised, or closed again. */
  | { kind: 'autopay_on'; at: string; chargeAt: string }
  | { kind: 'autopay_off'; at: string }
  /** Appended once Razorpay Test shows Keep shop open's AutoPay authorised in Stopped. */
  | { kind: 'plan_resumed'; at: string; chargeAt: string }
  /**
   * Appended when Razorpay Test shows Paid's agreement closed without Stop the plan, moving Paid to Stopped: from outside,
   * or `halted` when the helper cancelled it after Razorpay halted collection before the paid days ended.
   */
  | { kind: 'autopay_ended'; at: string; paidThrough: string; reason?: 'halted' }

const trialDays = 14
const feeMinor = 29900
/** Razorpay retries a declined scheduled fee on T+1, T+2 and T+3, then halts collection. */
const retryDays = 3

const dayMs = 24 * 60 * 60 * 1000

export const isPrototypeState = (value: unknown): value is PrototypeState => prototypeStates.includes(value as PrototypeState)

const addDays = (at: Date, days: number) => new Date(at.getTime() + days * dayMs)
const addMonths = (at: Date, months: number) => new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + months, at.getUTCDate(), at.getUTCHours(), at.getUTCMinutes(), at.getUTCSeconds()))

/** Whole days left until `end`, as the helper counts them; never negative. */
export const daysUntil = (end: string, now: Date) => Math.max(0, Math.ceil((Date.parse(end) - now.getTime()) / dayMs))

/** Dates are relative to the moment the state is selected. */
export function prototypeSeed(state: PrototypeState, now: Date): PrototypeSeed {
  const seed = (trialEndsAt: Date, paidThrough: Date | null, autoPay: PrototypeSeed['autoPay'], events: PrototypeEvent[], failedPaymentAt: Date | null = null): PrototypeSeed => ({
    trialEndsAt: trialEndsAt.toISOString(), paidThrough: paidThrough?.toISOString() ?? null, autoPay, failedPaymentAt: failedPaymentAt?.toISOString() ?? null, events,
  })
  const freeDaysStarted = (trialEndsAt: Date): PrototypeEvent => ({ kind: 'free_days_started', at: addDays(trialEndsAt, -trialDays).toISOString(), days: trialDays })
  const paid = (at: Date, paidThrough: Date): PrototypeEvent => ({ kind: 'paid', at: at.toISOString(), amountMinor: feeMinor, paidThrough: paidThrough.toISOString() })
  const stopped = (at: Date, paidThrough: Date): PrototypeEvent => ({ kind: 'plan_stopped', at: at.toISOString(), paidThrough: paidThrough.toISOString() })
  // Paid states began when the free days ended, one month before their paid-through date.
  const paidStart = (paidThrough: Date) => addMonths(paidThrough, -1)
  switch (state) {
    case 'free_days': return seed(addDays(now, 12), null, 'none', [freeDaysStarted(addDays(now, 12))])
    case 'three_days_left': return seed(addDays(now, 3), null, 'none', [freeDaysStarted(addDays(now, 3))])
    case 'paid': {
      const through = addMonths(now, 1)
      return seed(paidStart(through), through, 'on', [freeDaysStarted(paidStart(through)), paid(paidStart(through), through)])
    }
    // AutoPay's first ₹299 was due when free days ended; Razorpay retried for three days, then halted collection.
    case 'payment_failed': {
      const trialEnd = addDays(now, -retryDays)
      return seed(trialEnd, null, 'none', [
        freeDaysStarted(trialEnd),
        { kind: 'autopay_on', at: addDays(trialEnd, -5).toISOString(), chargeAt: trialEnd.toISOString() },
        { kind: 'payment_failed', at: now.toISOString() },
      ], now)
    }
    // As in their mockups, the stopped states list only the fee and the stop.
    case 'stopped': {
      const through = addDays(now, 8)
      return seed(paidStart(through), through, 'cancelled', [paid(paidStart(through), through), stopped(now, through)])
    }
    case 'shop_closed': {
      const through = addDays(now, -2)
      return seed(paidStart(through), through, 'cancelled', [paid(paidStart(through), through), stopped(through, through)])
    }
  }
}
