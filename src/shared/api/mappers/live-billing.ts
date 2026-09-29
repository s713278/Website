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
  /** Free days while Razorpay confirms the ₹299 paid early (the early first fee); the free days are kept. */
  | { state: 'free_days_confirming'; shop: 'open'; plan: LiveBillingPlan; trialEndsAt: string; daysLeft: number }
  /** Razorpay is collecting the first fee or a renewal: open, with no dates. */
  | { state: 'collecting'; shop: 'open'; plan: LiveBillingPlan }
  /** A paid period until `paidThrough` (P); `nextChargeAt` is `next_billing_at`, when there is one. */
  | { state: 'paid'; shop: 'open'; plan: LiveBillingPlan; paidThrough: string; nextChargeAt: string | null }
  /** No more charges: the vendor stopped the plan, or AutoPay is off, whoever turned it off. Open until P. */
  | { state: 'stopped'; shop: 'open'; plan: LiveBillingPlan; paidThrough: string; daysLeft: number }
  | { state: 'autopay_off'; shop: 'open'; plan: LiveBillingPlan; paidThrough: string; daysLeft: number }
  /** Renewal failed after every retry. */
  | { state: 'payment_failed'; shop: 'hidden'; plan: LiveBillingPlan }
  /** The shop is hidden because paid days or free days are over. */
  | { state: 'shop_closed'; shop: 'hidden'; plan: LiveBillingPlan; ended: LiveBillingEnded }
  /** Shop closed while Razorpay confirms a payment; `ended` chooses the Shop closed wording. */
  | { state: 'confirming'; shop: 'hidden'; plan: LiveBillingPlan; ended: LiveBillingEnded }
  | { state: 'not_live'; plan: LiveBillingPlan }

/** What ran out before a shop closed: a paid period, or the free days. */
export type LiveBillingEnded = 'paid_days' | 'free_days'

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
  const periodOver = periodEnd !== null && now.getTime() >= Date.parse(periodEnd)

  // Row 1.
  if (status === 'HALTED') return { state: 'payment_failed', shop: 'hidden', plan }
  // Row 2.
  if (status === 'PAST_DUE') return { state: 'collecting', shop: 'open', plan }

  // Rows 3–5: a paid period that has not ended. At now ≥ P the same facts are rows 6 and 6′.
  if (periodEnd !== null) {
    // The flag must be a boolean: missing or null matches no row, so it takes the read error path.
    const cancelAtPeriodEnd = subscription.cancel_at_period_end
    const razorpayCancelled = subscription.razorpay_status === 'cancelled'
    const paid = status === 'ACTIVE' && cancelAtPeriodEnd === false && !razorpayCancelled
    const stopped = status === 'ACTIVE' && cancelAtPeriodEnd === true
    const autoPayOff = status === 'CANCELLED' || status === 'EXPIRED' || (status === 'ACTIVE' && razorpayCancelled && cancelAtPeriodEnd === false)
    // Row 6: a paid period that ends with AutoPay on is a renewal being collected, from P until the
    // charge lands and the backend moves P on. Gap D: a charge later than P shows this for longer.
    if (paid && periodOver) return { state: 'collecting', shop: 'open', plan }
    // Row 6′: only a stopped plan or AutoPay off closes the shop when paid days end.
    if ((stopped || autoPayOff) && periodOver) return { state: 'shop_closed', shop: 'hidden', plan, ended: 'paid_days' }
    // Row 3.
    if (paid) return { state: 'paid', shop: 'open', plan, paidThrough: periodEnd, nextChargeAt: instant(subscription.next_billing_at) }
    const daysLeft = daysUntil(periodEnd, now)
    // Row 4, gap F: dev keeps `next_billing_at` after a stop, so it is ignored.
    if (stopped) return { state: 'stopped', shop: 'open', plan, paidThrough: periodEnd, daysLeft }
    // Row 5, gap H: AutoPay is off. The paid days are kept, even when CANCELLED; that is a product
    // rule. Gap A: a backend that cancels at once reports the vendor's own stop as CANCELLED too.
    if (autoPayOff) return { state: 'autopay_off', shop: 'open', plan, paidThrough: periodEnd, daysLeft }
  }
  // Row 3a, gap B: dev sets ACTIVE when Razorpay activates, before the fee is captured. ACTIVE
  // without a paid period is still being collected.
  if (status === 'ACTIVE' && periodEnd === null) return { state: 'collecting', shop: 'open', plan }

  // Rows 7, 8 and 8b: Razorpay has the payment, the backend has not recorded it yet. Rows 7 and 8
  // need no P: a trial status with AutoPay agreed and P set is unseen, so it takes the read error path.
  const trialStatus = status === 'TRIAL_ACTIVE' || status === 'TRIAL_EXPIRED' || status === 'PAYMENT_PENDING'
  if (trialStatus && autoPayAgreed && trialEndsAt) {
    // Row 7. Gap K: dev has no early first fee yet, so Pay ₹299 with Razorpay makes an AutoPay-only
    // subscription, which reads here until T. Gap C: dev reports it as PAYMENT_PENDING.
    if (status !== 'TRIAL_EXPIRED' && beforeTrialEnd && periodEnd === null) {
      return { state: 'free_days_confirming', shop: 'open', plan, trialEndsAt, daysLeft: daysUntil(trialEndsAt, now) }
    }
    // Row 8, before row 10, so an unconfirmed ₹299 never offers another. Gap J: dev keeps TRIAL_ACTIVE
    // after T. Gap K: dev's AutoPay-only subscription reads here from T until Razorpay charges.
    if (!beforeTrialEnd && periodEnd === null) return { state: 'confirming', shop: 'hidden', plan, ended: 'free_days' }
    // Row 8b, gap C: a payment after paid days, such as after a halt, still PAYMENT_PENDING. A P
    // still ahead matches no row, so it takes the read error path rather than call an open shop closed.
    if (status === 'PAYMENT_PENDING' && !beforeTrialEnd && periodOver) return { state: 'confirming', shop: 'hidden', plan, ended: 'paid_days' }
    throw new LiveBillingUnreadableError()
  }

  // Row 9. A CANCELLED subscription with a paid period belongs to rows 5 and 6′, which come first.
  const freeDaysStatus = status === 'TRIAL_ACTIVE' || status === 'PAYMENT_PENDING' || (status === 'CANCELLED' && periodEnd === null)
  if (freeDaysStatus && !autoPayAgreed && trialEndsAt && beforeTrialEnd) {
    const daysLeft = daysUntil(trialEndsAt, now)
    return { state: daysLeft <= 3 ? 'three_days_left' : 'free_days', shop: 'open', plan, trialEndsAt, daysLeft }
  }
  // Row 10, gap J: dev keeps TRIAL_ACTIVE after T, so row 9's facts past T close the shop as well.
  // Gap I's shape (PAYMENT_PENDING, `created`, no P, after T) lands here too. AutoPay agreed is row 8's.
  if ((status === 'TRIAL_EXPIRED' && !autoPayAgreed) || (freeDaysStatus && !autoPayAgreed && trialEndsAt && !beforeTrialEnd && periodEnd === null)) {
    return { state: 'shop_closed', shop: 'hidden', plan, ended: 'free_days' }
  }
  // Row 11: paying again after paid days, such as after a halt, until Razorpay has the payment.
  if (status === 'PAYMENT_PENDING' && subscription.razorpay_status === 'created' && periodOver) {
    return { state: 'shop_closed', shop: 'hidden', plan, ended: 'paid_days' }
  }

  throw new LiveBillingUnreadableError()
}

/** The subscription row, or `null` before go-live or when the read carries no object. */
function subscriptionRecord(read: LiveSubscriptionRead): WireRecord | null {
  return read.kind === 'subscription' && read.subscription !== null && typeof read.subscription === 'object' ? read.subscription as WireRecord : null
}

/**
 * The vendor's current plan name from `GET …/subscription`, or `null` before go-live or when the
 * row has none. The vendor context no longer carries the plan. Under gap C it names the paid plan
 * as soon as subscribe runs.
 */
export function mapLivePlanName(read: LiveSubscriptionRead): string | null {
  const name = subscriptionRecord(read)?.plan_name
  return typeof name === 'string' && name.trim() ? name.trim() : null
}

/** When the free days started: `trial_started_at` from `GET …/subscription`, or `null` before go-live or without a readable one. */
export function mapLiveTrialStart(read: LiveSubscriptionRead): string | null {
  try {
    return instant(subscriptionRecord(read)?.trial_started_at)
  } catch {
    return null
  }
}

/** One row of "Payments you made". `amount` is in rupees, and only when the event sent one. */
export interface LiveBillingHistoryRow { title: string; at: string; amount: number | null }

/** A Plan stop is a cancellation requested while paid; one in the free days turns off AutoPay. */
const planStopped = (event: WireRecord) => event.event_type === 'CANCELLATION_REQUESTED' && event.previous_status === 'ACTIVE'

/**
 * Maps `GET …/subscription/history` and the subscription's `trial_started_at` to "Payments you made",
 * newest first. Dev records some events twice (G), so an event shows once per type and payment ID, or
 * per type and subscription ID when it has no payment. The oldest copy keeps its time. Dev sends no
 * amounts, so none is inferred. Checkout, authorization, activation and unknown events are ignored.
 */
export function mapLiveBillingHistory(payload: unknown, trialStartedAt: string | null): LiveBillingHistoryRow[] {
  if (!Array.isArray(payload)) throw new LiveBillingUnreadableError()
  const events = payload.map(record)
  const shown = new Set<string>()
  const rows: LiveBillingHistoryRow[] = []
  // Oldest first, so the first copy of a duplicate is kept and a stop is seen before its end.
  for (const event of [...events].reverse()) {
    const title = historyTitle(event, events)
    if (!title) continue
    const key = `${String(event.event_type)}:${String(event.external_payment_id ?? event.external_subscription_id ?? event.event_at)}`
    if (shown.has(key)) continue
    shown.add(key)
    const amount = typeof event.amount === 'number' && Number.isFinite(event.amount) ? event.amount : null
    rows.push({ title, at: eventAt(event), amount })
  }
  if (trialStartedAt) rows.push({ title: 'Free days started', at: trialStartedAt, amount: null })
  return rows.sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
}

/** A shown event's time; one without a readable time makes the history unreadable. */
function eventAt(event: WireRecord): string {
  const at = instant(event.event_at)
  if (at === null) throw new LiveBillingUnreadableError()
  return at
}

function historyTitle(event: WireRecord, events: WireRecord[]): string | null {
  switch (event.event_type) {
    case 'SUBSCRIPTION_CHARGED': return 'Payment received'
    case 'SUBSCRIPTION_AUTHENTICATED': return 'AutoPay set up'
    case 'CANCELLATION_REQUESTED': return planStopped(event) ? 'Plan stopped' : 'AutoPay turned off'
    case 'SUBSCRIPTION_CANCELLED': {
      // A stopped plan's subscription ends at P; the stop already says so.
      const ended = Date.parse(eventAt(event))
      const stoppedFirst = events.some((other) => planStopped(other) && other.external_subscription_id === event.external_subscription_id
        && Date.parse(eventAt(other)) <= ended)
      return stoppedFirst ? null : 'AutoPay ended'
    }
    default: return null
  }
}

/** What Razorpay Checkout opens with, from a subscribe response. */
export interface LiveCheckoutConfig { keyId: string; subscriptionId: string }

/** Maps `POST …/subscription` to Checkout's key ID and subscription ID; `checkout_url` is ignored. */
export function mapLiveCheckout(payload: unknown): LiveCheckoutConfig {
  const response = payload !== null && typeof payload === 'object' ? payload as WireRecord : {}
  const { razorpay_key_id: keyId, razorpay_subscription_id: subscriptionId } = response
  if (typeof keyId !== 'string' || !keyId || typeof subscriptionId !== 'string' || !subscriptionId) {
    throw new Error('Couldn’t start Razorpay Checkout. Try again in a moment.')
  }
  return { keyId, subscriptionId }
}
