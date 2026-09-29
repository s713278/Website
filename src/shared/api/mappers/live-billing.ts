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

  // Row 9. A CANCELLED subscription with a paid period belongs to rows 5 and 6, which come first.
  const freeDaysStatus = status === 'TRIAL_ACTIVE' || status === 'PAYMENT_PENDING' || (status === 'CANCELLED' && periodEnd === null)
  if (freeDaysStatus && !autoPayAgreed && trialEndsAt && now.getTime() < Date.parse(trialEndsAt)) {
    const daysLeft = daysUntil(trialEndsAt, now)
    return { state: daysLeft <= 3 ? 'three_days_left' : 'free_days', shop: 'open', plan, trialEndsAt, daysLeft }
  }

  throw new LiveBillingUnreadableError()
}
