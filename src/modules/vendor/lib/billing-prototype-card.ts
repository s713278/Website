import { daysUntil, type LocalTestAutoPayStatus, type PrototypeEvent, type PrototypeSeed, type PrototypeState } from '@/shared/api'

export type PrototypeTone = 'neutral' | 'danger' | 'warning'

/** The main Plan card for one prototype state, as in its mockup. */
export interface PrototypeCard {
  tone: PrototypeTone
  eyebrow: string
  /** A days-left count, or a headline where the mockup has one. */
  figure: { days: number } | { headline: string }
  body: string
  plan: string
  /** Where the state comes from: the seeded Paid says it took no payment; a real plan's Stopped names its source. */
  sample: string | null
  action: { label: string; help: string } | null
  /** Trial AutoPay that Razorpay Test has confirmed, with its first-fee date. */
  autoPay: string | null
}

const plan = 'Mithra Social Starter · ₹299 / month'
const shortDate = (value: string) => new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' }).format(new Date(value))
/** The last paid day before a paid-through boundary: Razorpay ends cycles at IST midnight, which belongs to the next day. */
const lastPaidDay = (paidThrough: string) => shortDate(new Date(Date.parse(paidThrough) - 1).toISOString())
const payNow = { label: 'Pay ₹299 with Razorpay', help: 'Opens Razorpay Checkout. Pay by card — about a minute.' }
/** A future-start subscription: Razorpay checks the card now and charges the fee at the boundary. */
const futureStart = (label: string, fee: string, when: string) => ({ label, help: `Opens Razorpay Checkout. Your card is checked with a refundable ₹5 charge now; ${fee} is charged on ${when}.` })

/** The free-days states, where trial AutoPay can be set up. */
export const isTrialState = (state: PrototypeState) => state === 'free_days' || state === 'three_days_left'

/** The states whose ₹299 is collected now, through an immediate-start subscription. */
export const isPayNowState = (state: PrototypeState) => state === 'payment_failed' || state === 'shop_closed'

/** Shown after the Checkout callback while Razorpay Test has not yet shown the ₹299 captured. */
export const confirmingPaymentNotice = 'Confirming payment… Razorpay Test has not confirmed the ₹299 yet, so nothing has changed. Check again in a moment.'

/**
 * `now` is the helper's time of the read (or the browser's when the helper is down). `autoPayChargeAt`
 * is the next-fee date of confirmed AutoPay; it changes the free-days states and the sample Paid. `verifiedFee`
 * is a ₹299 that Razorpay Test showed captured, with `stopScheduled` once Razorpay Test accepted its cycle-end
 * stop; it changes Paid, which is otherwise a sample, and Stopped. `retrying` is the collection retry period: the boundary has
 * passed while Razorpay still collects the fee, so the shop stays open and no date or retry is shown.
 */
export function prototypeCard(state: PrototypeState, seed: PrototypeSeed, now: Date, autoPayChargeAt: string | null = null,
  verifiedFee: { nextChargeAt: string | null; stopScheduled?: boolean } | null = null, retrying = false): PrototypeCard {
  if (retrying && (state === 'paid' || isTrialState(state))) return {
    plan, sample: null, tone: 'neutral', eyebrow: 'Shop plan', figure: { headline: 'Shop is open' }, body: 'AutoPay on.', action: null, autoPay: null,
  }
  // Razorpay can collect the first ₹299 before free days end (a Test Dashboard charge); the trial is unchanged.
  if (verifiedFee && isTrialState(state)) {
    const paidOpen = `first ₹299 paid, shop open until ${seed.paidThrough ? lastPaidDay(seed.paidThrough) : ''}`
    return {
      plan, sample: null, tone: 'neutral', eyebrow: 'Free days', figure: { days: daysUntil(seed.trialEndsAt, now) }, action: null,
      body: 'Free days are unchanged. The first ₹299 is already paid, so the shop stays open after they end.',
      autoPay: verifiedFee.nextChargeAt ? `AutoPay on — ${paidOpen}. Next ₹299 on ${shortDate(verifiedFee.nextChargeAt)}.`
        : `F${paidOpen.slice(1)}. AutoPay is off, so no more ₹299 is charged.`,
    }
  }
  if (autoPayChargeAt && isTrialState(state)) return {
    plan, sample: null, tone: 'neutral', eyebrow: 'Free days', figure: { days: daysUntil(seed.trialEndsAt, now) }, action: null,
    body: 'Free days are unchanged. When they end, Razorpay charges ₹299 each month to keep the shop open.',
    autoPay: `AutoPay on — first ₹299 on ${shortDate(autoPayChargeAt)}`,
  }
  const trialEnd = shortDate(seed.trialEndsAt)
  const autoPay = futureStart(`Set up AutoPay · ₹299 on ${trialEnd}`, 'the first ₹299', `${trialEnd}, when free days end`)
  const paidUntil = seed.paidThrough ? lastPaidDay(seed.paidThrough) : ''
  // Stopped by the vendor or, when Razorpay closed the paid agreement from outside, by AutoPay ending; the latest stop decides.
  const lastStop = [...seed.events].reverse().find((event) => event.kind === 'plan_stopped' || event.kind === 'autopay_ended')
  const endedOutside = lastStop?.kind === 'autopay_ended'
  // Razorpay halted collection before the paid days ended, and the helper cancelled AutoPay.
  const halted = lastStop?.kind === 'autopay_ended' && lastStop.reason === 'halted'
  const card = { plan, sample: null, autoPay: null }
  switch (state) {
    case 'free_days': return {
      ...card, tone: 'neutral', eyebrow: 'Free days', figure: { days: daysUntil(seed.trialEndsAt, now) }, action: autoPay,
      body: 'Your shop is live for 14 free days. After that, subscribe with Razorpay — ₹299 each month — to keep it open.',
    }
    case 'three_days_left': return {
      ...card, tone: 'danger', eyebrow: 'Free days', figure: { days: daysUntil(seed.trialEndsAt, now) }, action: autoPay,
      body: 'Set up AutoPay now so customers can still open your shop when free days end.',
    }
    case 'paid': return verifiedFee ? {
      ...card, tone: 'neutral', eyebrow: 'Paid', figure: { headline: 'Shop is open' }, action: null,
      body: `You paid ₹299 via Razorpay. Shop stays open until ${paidUntil}.${verifiedFee.nextChargeAt ? ` Next ₹299 is charged on ${shortDate(verifiedFee.nextChargeAt)}.` : ''}`,
    } : autoPayChargeAt ? {
      ...card, tone: 'neutral', eyebrow: 'Paid', figure: { headline: 'Shop is open' }, action: null,
      body: `You paid ₹299 via Razorpay. Shop stays open until ${paidUntil}. Next ₹299 is charged on ${shortDate(autoPayChargeAt)}.`,
      sample: 'Sample: the paid days are seeded, so no ₹299 was taken. AutoPay for the next ₹299 is set up with Razorpay Test.',
    } : {
      ...card, tone: 'neutral', eyebrow: 'Paid', figure: { headline: 'Shop is open' }, action: null,
      body: `You paid ₹299 via Razorpay. Shop stays open until ${paidUntil}. Next month is another ₹299.`,
      sample: 'Sample: this paid state is seeded for the walkthrough, so no Razorpay payment was taken.',
    }
    case 'payment_failed': return {
      ...card, tone: 'danger', eyebrow: 'Payment failed', figure: { headline: 'Shop is hidden' }, action: payNow,
      body: 'Customers cannot see your shop. Pay ₹299 with Razorpay to open it again. Old orders are still here.',
    }
    case 'stopped': return {
      ...card, tone: 'warning', eyebrow: endedOutside ? 'AutoPay ended' : 'Plan stopped', figure: { days: daysUntil(seed.paidThrough ?? seed.trialEndsAt, now) },
      action: futureStart('Keep shop open · ₹299', '₹299', `${seed.paidThrough ? shortDate(seed.paidThrough) : ''}, when paid days end`),
      body: `${halted ? 'Razorpay could not collect ₹299, so AutoPay ended.' : endedOutside ? 'AutoPay was cancelled outside MithraDirect, so no more ₹299 is charged.' : 'You stopped the plan.'} Shop stays open until ${paidUntil}. Pay ₹299 with Razorpay if you want to keep it after that.`,
      sample: halted ? 'Razorpay Test halted collection after every retry, so the local helper cancelled the subscription. The days you already paid for are kept.'
        : endedOutside ? 'Razorpay Test shows the subscription cancelled, but not from this page — for example by the card issuer. The days you already paid for are kept.'
        : !verifiedFee ? null : verifiedFee.stopScheduled
        ? 'Razorpay Test accepted a stop at the end of the paid days. Its reads cannot show a scheduled stop, so this comes from the local helper\'s record of that acceptance.'
        : 'Razorpay Test shows the stopped subscription cancelled. The days you already paid for are kept.',
    }
    case 'shop_closed': return {
      ...card, tone: 'danger', eyebrow: 'Shop closed', figure: { headline: 'Shop is hidden' }, action: payNow,
      body: 'Paid days are over. Customers cannot see your shop. Pay ₹299 with Razorpay to open it again.',
    }
  }
}

/** The single confirm step before Paid is stopped. */
export const stopPlanConfirmation = (paidThrough: string | null) =>
  `Stop the plan? No more ₹299 is charged. Your shop stays open until ${paidThrough ? lastPaidDay(paidThrough) : 'the paid days end'}, then customers cannot see it.`

/** Shown while Razorpay Test has accepted, but no read has yet confirmed, an immediate stop of Paid. */
export const stopWaitNotice = 'Razorpay Test has not confirmed the stop yet, so the plan is still on. Check again in a moment.'

/** Trial AutoPay that Razorpay Test has not yet confirmed either way; `null` once it has. */
export function autoPayWaitNotice(status: LocalTestAutoPayStatus, chargeAt: string | null): string | null {
  if (status === 'pending') return 'Razorpay Test has not confirmed AutoPay yet, so nothing has changed. Check again in a moment.'
  if (status === 'turning_off') return `Razorpay Test has not confirmed that AutoPay is off yet, so the first ₹299 may still be charged${chargeAt ? ` on ${shortDate(chargeAt)}` : ''}. Check again in a moment.`
  return null
}

/** The state's banner: a bold lead, the rest of the sentence and the label of its link to Plan. */
export interface PrototypeBanner { tone: PrototypeTone; lead: string; text: string; action: string }

/**
 * Paid, and the collection retry period, have no banner. `autoPayChargeAt` and `retrying` are as for `prototypeCard`;
 * `feePaid` is a ₹299 Razorpay Test showed captured.
 */
export function prototypeBanner(state: PrototypeState, seed: PrototypeSeed, now: Date, autoPayChargeAt: string | null = null, feePaid = false,
  retrying = false): PrototypeBanner | null {
  if (retrying && (state === 'paid' || isTrialState(state))) return null
  const freeDays = (tone: PrototypeTone, text: string, action = 'Pay ₹299') => {
    const days = daysUntil(seed.trialEndsAt, now)
    return { tone, lead: `${days} free ${days === 1 ? 'day' : 'days'} left`, text, action }
  }
  if (feePaid && isTrialState(state)) return freeDays('neutral', `the first ₹299 is already paid, so the shop stays open until ${seed.paidThrough ? lastPaidDay(seed.paidThrough) : ''}.`, 'Shop plan')
  if (autoPayChargeAt && isTrialState(state)) return freeDays('neutral', `AutoPay is on, so the first ₹299 is charged on ${shortDate(autoPayChargeAt)}.`, 'Shop plan')
  switch (state) {
    case 'free_days': return freeDays('neutral', 'after that, subscribe with Razorpay (₹299 / month) to keep the shop open.')
    case 'three_days_left': return freeDays('danger', 'set up AutoPay now so customers can still open your shop when free days end.')
    case 'paid': return null
    case 'payment_failed': return { tone: 'danger', lead: 'Shop is hidden from customers', text: 'last Razorpay payment did not go through. Pay ₹299 to open the shop again.', action: 'Pay ₹299' }
    case 'stopped': return { tone: 'warning', lead: `Shop stays open until ${seed.paidThrough ? lastPaidDay(seed.paidThrough) : ''}`, text: 'then customers cannot see it. You can pay again any time with Razorpay.', action: 'Keep open · ₹299' }
    case 'shop_closed': return { tone: 'danger', lead: 'Shop is hidden from customers', text: 'pay ₹299 with Razorpay to open it again.', action: 'Pay ₹299' }
  }
}

const dayMs = 24 * 60 * 60 * 1000
/** India is UTC+5:30 all year, so its calendar day is a fixed offset from UTC. */
const indiaDay = (at: number) => Math.floor((at + 5.5 * 60 * 60 * 1000) / dayMs)

/** How long ago `at` was, in India calendar days from `now` (the helper's read time). */
export function relativeDay(at: string, now: Date): string {
  const days = Math.max(0, indiaDay(now.getTime()) - indiaDay(Date.parse(at)))
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 28) return `${days} days ago`
  if (days < 60) return 'Last month'
  return `${Math.floor(days / 30)} months ago`
}

export interface PrototypeHistoryRow { title: string; detail: string; when: string }

const rupees = (amountMinor: number) => `₹${amountMinor / 100}`

function historyRow(event: PrototypeEvent, now: Date): Omit<PrototypeHistoryRow, 'when'> {
  const ended = (paidThrough: string) => Date.parse(paidThrough) <= now.getTime()
  switch (event.kind) {
    case 'free_days_started': return { title: 'Free days started', detail: `${event.days} free days` }
    case 'paid': return { title: `Paid ${rupees(event.amountMinor)}`, detail: ended(event.paidThrough) ? 'One month' : `Shop open until ${lastPaidDay(event.paidThrough)}` }
    case 'payment_failed': return { title: 'Payment did not go through', detail: 'Shop hidden from customers' }
    case 'plan_stopped': return { title: 'Plan stopped', detail: ended(event.paidThrough) ? 'Paid days ended' : 'Shop stays open until paid days end' }
    case 'autopay_on': return { title: 'AutoPay on', detail: `First ₹299 on ${shortDate(event.chargeAt)}` }
    case 'autopay_off': return { title: 'AutoPay turned off', detail: 'Cancelled with Razorpay' }
    case 'plan_resumed': return { title: 'AutoPay set up again', detail: `Next ₹299 on ${shortDate(event.chargeAt)}` }
    case 'autopay_ended': return { title: 'AutoPay ended', detail: event.reason === 'halted' ? 'Payment could not be collected' : 'Cancelled outside MithraDirect' }
  }
}

/** "Payments you made", newest first, dated from `now`. */
export function prototypeHistory(seed: PrototypeSeed, now: Date): PrototypeHistoryRow[] {
  // Reversed first, so the stable sort keeps a later-appended event above one at the same instant.
  return [...seed.events].reverse().sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .map((event) => ({ ...historyRow(event, now), when: relativeDay(event.at, now) }))
}
