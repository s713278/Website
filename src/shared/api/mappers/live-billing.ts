import { daysUntil } from '../fixtures/billing-prototype'
import type { LiveSubscriptionRead } from '../services/live-billing.service'

/** The one monthly paid plan: its name, code for subscribe, and price in rupees. */
export interface LiveBillingPlan { code: string; name: string; price: number }

/**
 * The billing state Plan and the chrome show for a Live API vendor. The backend's statuses and
 * dates decide it; the browser clock only compares them with now.
 */
export type LiveBillingView =
  | { state: 'free_days' | 'three_days_left'; shop: 'open'; plan: LiveBillingPlan; trialEndsAt: string; daysLeft: number }
  /** Free days with AutoPay agreed; `firstChargeAt` is when Razorpay charges the first fee. */
  | { state: 'autopay_on'; shop: 'open'; plan: LiveBillingPlan; trialEndsAt: string; daysLeft: number; firstChargeAt: string }
  /** Razorpay is collecting the first fee or a renewal: open, with no dates. */
  | { state: 'collecting'; shop: 'open'; plan: LiveBillingPlan }
  /** A paid period until `paidThrough` (P); `nextChargeAt` is `next_billing_at`, when there is one. */
  | { state: 'paid'; shop: 'open'; plan: LiveBillingPlan; paidThrough: string; nextChargeAt: string | null }
  /** No more charges: the vendor stopped the plan, or AutoPay ended outside MithraDirect. Open until P. */
  | { state: 'stopped'; shop: 'open'; plan: LiveBillingPlan; paidThrough: string; daysLeft: number }
  | { state: 'autopay_ended'; shop: 'open'; plan: LiveBillingPlan; paidThrough: string; daysLeft: number }
  | { state: 'not_live'; plan: LiveBillingPlan }

/** A billing read that matches no mapping row. Plan shows it as a read error with Try again. */
export class LiveBillingUnreadableError extends Error {
  constructor(message = 'Couldn’t read your shop plan. Try again in a moment.') {
    super(message)
    this.name = 'LiveBillingUnreadableError'
  }
}

type WireRecord = Record<string, unknown>

function record(value: unknown): WireRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new LiveBillingUnreadableError()
  return value as WireRecord
}

function text(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new LiveBillingUnreadableError()
  return value
}

/** Seconds and fractions are optional (period boundaries arrive as `2026-10-26T18:30Z`); the timezone is not. */
const timestampPattern = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(?::(\d{2})(?:\.(\d+))?)?(?:(Z)|([+-]\d{2}):?(\d{2}))$/i

/** An ISO instant, or `null` when the field is absent. */
function instant(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const match = typeof value === 'string' ? timestampPattern.exec(value) : null
  if (!match) throw new LiveBillingUnreadableError()
  const [, minutes, seconds = '00', fraction = '', utc, offsetHours, offsetMinutes] = match
  const zone = utc ? 'Z' : `${offsetHours}:${offsetMinutes}`
  const at = Date.parse(`${minutes}:${seconds}.${fraction.padEnd(3, '0').slice(0, 3)}${zone}`)
  if (!Number.isFinite(at)) throw new LiveBillingUnreadableError()
  return new Date(at).toISOString()
}

/** The `billing_cycle: MONTHLY` entry of `GET /v1/subscription-plans`. `sale_price` is rupees, not the documented paise (G). */
function monthlyPlan(payload: unknown): LiveBillingPlan {
  if (!Array.isArray(payload)) throw new LiveBillingUnreadableError()
  const entry = payload.find((item) => record(item).billing_cycle === 'MONTHLY')
  if (!entry) throw new LiveBillingUnreadableError()
  const plan = record(entry)
  const price = plan.sale_price
  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) throw new LiveBillingUnreadableError()
  return { code: text(plan.plan_code), name: text(plan.plan_name), price }
}

/**
 * Maps `GET …/subscription` (or its 404) and the plans list to a billing view. The first matching
 * row of the spec's mapping table wins; a response matching none throws `LiveBillingUnreadableError`.
 * The backend's `days_remaining` (which rounds down, G) and its display labels are ignored.
 */
export function mapLiveBilling(read: LiveSubscriptionRead, plans: unknown, now: Date): LiveBillingView {
  const plan = monthlyPlan(plans)
  if (read.kind === 'not-live') return { state: 'not_live', plan }

  const subscription = record(read.subscription)
  const status = subscription.status
  const autoPayAgreed = subscription.razorpay_status === 'authenticated' || subscription.razorpay_status === 'active'
  const trialEndsAt = instant(subscription.trial_ends_at)
  const periodEnd = instant(subscription.current_period_end)

  const beforeTrialEnd = trialEndsAt !== null && now.getTime() < Date.parse(trialEndsAt)

  // Row 2.
  if (status === 'PAST_DUE') return { state: 'collecting', shop: 'open', plan }

  // Rows 3–5: a paid period that has not ended. At now ≥ P they stop matching (row 6).
  if (periodEnd !== null && now.getTime() < Date.parse(periodEnd)) {
    // The flag must be a boolean: missing or null matches no row, so it takes the read error path.
    const cancelAtPeriodEnd = subscription.cancel_at_period_end
    const razorpayCancelled = subscription.razorpay_status === 'cancelled'
    // Row 3.
    if (status === 'ACTIVE' && cancelAtPeriodEnd === false && !razorpayCancelled) {
      return { state: 'paid', shop: 'open', plan, paidThrough: periodEnd, nextChargeAt: instant(subscription.next_billing_at) }
    }
    const daysLeft = daysUntil(periodEnd, now)
    // Row 4, gap F: dev keeps `next_billing_at` after a stop, so it is ignored.
    if (status === 'ACTIVE' && cancelAtPeriodEnd === true) return { state: 'stopped', shop: 'open', plan, paidThrough: periodEnd, daysLeft }
    // Row 5, gap H: AutoPay ended at the bank or at Razorpay. The paid days are kept, even when
    // CANCELLED; that is a product rule.
    if (status === 'CANCELLED' || status === 'EXPIRED' || (status === 'ACTIVE' && razorpayCancelled && cancelAtPeriodEnd === false)) {
      return { state: 'autopay_ended', shop: 'open', plan, paidThrough: periodEnd, daysLeft }
    }
  }
  // Row 3a, gap B: dev sets ACTIVE when Razorpay activates, before the fee is captured. ACTIVE
  // without a paid period is still being collected.
  if (status === 'ACTIVE' && periodEnd === null) return { state: 'collecting', shop: 'open', plan }

  // Row 7. Gap C: dev reports trial AutoPay as PAYMENT_PENDING with no `next_billing_at`, so the date
  // falls back to T. Gap D: Razorpay charges 24 h after T, so until D is fixed this date is a day early.
  if ((status === 'TRIAL_ACTIVE' || status === 'PAYMENT_PENDING') && autoPayAgreed && trialEndsAt && beforeTrialEnd) {
    const firstChargeAt = instant(subscription.next_billing_at) ?? trialEndsAt
    return { state: 'autopay_on', shop: 'open', plan, trialEndsAt, daysLeft: daysUntil(trialEndsAt, now), firstChargeAt }
  }
  // Row 8, gap D: free days have ended and Razorpay has not charged yet. PAYMENT_PENDING here is row 8b.
  if (status === 'TRIAL_ACTIVE' && autoPayAgreed && trialEndsAt && !beforeTrialEnd) return { state: 'collecting', shop: 'open', plan }

  // Row 9. A CANCELLED subscription with a paid period belongs to rows 5 and 6, which come first.
  const freeDaysStatus = status === 'TRIAL_ACTIVE' || status === 'PAYMENT_PENDING' || (status === 'CANCELLED' && periodEnd === null)
  if (freeDaysStatus && !autoPayAgreed && trialEndsAt && beforeTrialEnd) {
    const daysLeft = daysUntil(trialEndsAt, now)
    return { state: daysLeft <= 3 ? 'three_days_left' : 'free_days', shop: 'open', plan, trialEndsAt, daysLeft }
  }

  throw new LiveBillingUnreadableError()
}
