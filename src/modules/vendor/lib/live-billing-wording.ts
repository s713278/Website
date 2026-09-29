import type { PrototypeBanner, PrototypeCard } from '@/modules/vendor/lib/billing-prototype-card'
import type { LiveBillingPlan, LiveBillingView } from '@/shared/api'

/**
 * What Plan, the billing banner and the header button say for a Live API billing view. It mirrors
 * the prototype's card, banner and header layout without its demo-only text. Every ₹ amount comes
 * from the plan price.
 */
export interface LiveBillingWording {
  /** Plan's main card; `null` where Plan shows only the note. */
  card: PrototypeCard | null
  note: string | null
  /** Confirming's status line under the card, with Check again; `null` in every other state. */
  confirming: string | null
  /** Stop the plan's confirm step, in Paid only; `null` in every other state, which has no Stop the plan. */
  stopConfirmation: string | null
  /** What the card's Checkout action says while it runs; `null` where the card has no Checkout action. */
  checkout: LiveCheckoutPurpose | null
  banner: PrototypeBanner | null
  header: string
}

/** A Checkout action's wording besides its label and help. */
export interface LiveCheckoutPurpose {
  /** The waiting line while Plan polls for the backend to show the payment. */
  waiting: string
  /** Checkout closed after a failed payment attempt, with Razorpay's reason. */
  failed: (reason: string) => string
  /** Gap E: what subscribe's 409 means while the plan is stopped; absent where a 409 has no known cause. */
  refused?: string
}

/**
 * Whether a read after Checkout is settled: its view is not a Confirming view (its wording has a
 * `confirming` line) and offers no Checkout action. Only a settled read ends the confirmation poll
 * and hold; a changed view that still offers a Checkout action, such as Free days turning into
 * 3 days left, does not.
 */
export function isSettledView(view: LiveBillingView): boolean {
  const { confirming, checkout } = liveBillingWording(view)
  return confirming === null && checkout === null
}

const rupees = (price: number) => `₹${new Intl.NumberFormat('en-IN').format(price)}`
/** The exact moment in IST, such as "12 Oct, 3:34 pm". */
const dateTime = (value: string) => new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
}).format(new Date(value))
/** The day in IST, such as "12 Oct". */
const shortDate = (value: string) => new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' }).format(new Date(value))
/** The IST day of P minus 1 ms: Razorpay ends a cycle at IST midnight, which belongs to the next day. */
const lastPaidDay = (paidThrough: string) => shortDate(new Date(Date.parse(paidThrough) - 1).toISOString())
const planLine = (plan: LiveBillingPlan) => `${plan.name} · ${rupees(plan.price)} / month`
const freeDaysLead = (days: number) => `${days} free ${days === 1 ? 'day' : 'days'} left`
const confirmingPayment = 'Confirming payment… Card payments take about a minute; UPI can take a few hours.'

export function liveBillingWording(view: LiveBillingView): LiveBillingWording {
  if (view.state === 'not_live') return { card: null, note: 'Free days start when your shop goes live.', confirming: null, stopConfirmation: null, checkout: null, banner: null, header: 'Shop plan' }

  const price = rupees(view.plan.price)
  const planCard = { plan: planLine(view.plan), sample: null, action: null, autoPay: null }
  if (view.state === 'collecting') return {
    card: { ...planCard, tone: 'neutral', eyebrow: 'Shop plan', figure: { headline: 'Shop is open' }, body: 'AutoPay on.' },
    note: null, confirming: null, stopConfirmation: null, checkout: null, banner: null, header: 'Shop plan',
  }

  if (view.state === 'paid') {
    const nextCharge = view.nextChargeAt ? ` Next ${price} is charged on ${shortDate(view.nextChargeAt)}.` : ''
    return {
      card: {
        ...planCard, tone: 'neutral', eyebrow: 'Paid', figure: { headline: 'Shop is open' },
        body: `You paid ${price} via Razorpay. Shop stays open until ${lastPaidDay(view.paidThrough)}.${nextCharge}`,
      },
      note: null, confirming: null,
      stopConfirmation: `Stop the plan? No more ${price} is charged. Your shop stays open until ${lastPaidDay(view.paidThrough)}, then customers cannot see it.`,
      checkout: null,
      banner: null, header: 'Shop plan',
    }
  }
  if (view.state === 'stopped' || view.state === 'autopay_off') {
    const paidUntil = lastPaidDay(view.paidThrough)
    const keepOpen = `Keep open · ${price}`
    // AutoPay off is true whoever turned it off: the vendor, the bank or Razorpay.
    const reason = view.state === 'stopped' ? 'You stopped the plan.' : `AutoPay is off, so no more ${price} is charged.`
    return {
      card: {
        ...planCard, tone: 'warning', eyebrow: view.state === 'stopped' ? 'Plan stopped' : 'AutoPay off', figure: { days: view.daysLeft },
        body: `${reason} Shop stays open until ${paidUntil}. Pay ${price} with Razorpay if you want to keep it after that.`,
        action: {
          label: `Keep shop open · ${price}`,
          help: `Opens Razorpay Checkout. Pay ${price} now by card or UPI. Your shop stays open for another month after ${paidUntil}, then AutoPay charges ${price} each month.`,
        },
      },
      note: null, confirming: null, stopConfirmation: null,
      checkout: {
        waiting: confirmingPayment,
        failed: (failure) => `The payment did not go through (${failure}). Nothing changed; the plan is still stopped.`,
        refused: `Couldn’t start the payment right now. Your shop stays open until ${paidUntil}.`,
      },
      banner: { tone: 'warning', lead: `Shop stays open until ${paidUntil}`, text: 'then customers cannot see it. You can pay again any time with Razorpay.', action: keepOpen },
      header: keepOpen,
    }
  }

  const payNow = `Pay ${price}`
  if (view.state === 'payment_failed' || view.state === 'shop_closed' || view.state === 'confirming') {
    const hidden = { ...planCard, tone: 'danger' as const, figure: { headline: 'Shop is hidden' } }
    const payAction = { label: `Pay ${price} with Razorpay`, help: 'Opens Razorpay Checkout. Pay by card or UPI.' }
    const lead = 'Shop is hidden from customers'
    const reopen = `Customers cannot see your shop. Pay ${price} with Razorpay to open it again.`
    const confirmingOpens = `${confirmingPayment} Your shop opens once Razorpay confirms the ${price}.`
    const payCheckout: LiveCheckoutPurpose = {
      waiting: confirmingOpens,
      failed: (reason) => `The payment did not go through (${reason}). Nothing changed; your shop is still hidden.`,
    }
    if (view.state === 'payment_failed') return {
      card: { ...hidden, action: payAction, eyebrow: 'Payment failed', body: `${reopen} Old orders are still here.` },
      note: null, confirming: null, stopConfirmation: null, checkout: payCheckout,
      banner: { tone: 'danger', lead, text: `last Razorpay payment did not go through. Pay ${price} to open the shop again.`, action: payNow },
      header: payNow,
    }
    const closedCard = { ...hidden, eyebrow: 'Shop closed', body: `${view.ended === 'paid_days' ? 'Paid' : 'Free'} days are over. ${reopen}` }
    // Confirming offers no payment, so a second ₹299 cannot start while the first is confirmed.
    if (view.state === 'confirming') return {
      card: closedCard, note: null,
      confirming: confirmingOpens,
      stopConfirmation: null, checkout: null,
      banner: { tone: 'danger', lead, text: `your ${price} payment is being confirmed.`, action: 'Shop plan' },
      header: 'Shop plan',
    }
    return {
      card: { ...closedCard, action: payAction }, note: null, confirming: null, stopConfirmation: null, checkout: payCheckout,
      banner: { tone: 'danger', lead, text: `pay ${price} with Razorpay to open it again.`, action: payNow },
      header: payNow,
    }
  }
  const card = { ...planCard, eyebrow: 'Free days', figure: { days: view.daysLeft } }
  const liveUntil = `Your shop is live free until ${dateTime(view.trialEndsAt)}.`
  // One wording at every count: the vendor has paid, so 3 days left does not apply. No banner, so
  // the shell's own banner shows.
  if (view.state === 'free_days_confirming') return {
    card: { ...card, tone: 'neutral', body: `${liveUntil} Your free days are kept.` },
    note: null, confirming: confirmingPayment, stopConfirmation: null, checkout: null, banner: null, header: 'Shop plan',
  }
  // The early first fee: the backend decides what Checkout charges (gap K).
  const payEarly = {
    label: `Pay ${price} with Razorpay`,
    help: `Opens Razorpay Checkout. Pay ${price} now by card or UPI. Your free days are kept: your paid month starts on ${shortDate(view.trialEndsAt)}, then AutoPay charges ${price} each month.`,
  }
  const payEarlyCheckout: LiveCheckoutPurpose = {
    waiting: confirmingPayment,
    failed: (reason) => `The payment did not go through (${reason}). Nothing changed; your free days are the same.`,
  }
  if (view.state === 'three_days_left') return {
    card: {
      ...card, tone: 'danger', action: payEarly,
      body: `Pay ${price} now so customers can still open your shop when free days end. Free days end on ${dateTime(view.trialEndsAt)}.`,
    },
    note: null, confirming: null, stopConfirmation: null, checkout: payEarlyCheckout,
    banner: { tone: 'danger', lead: freeDaysLead(view.daysLeft), text: `pay ${price} now so customers can still open your shop when free days end.`, action: payNow },
    header: payNow,
  }
  return {
    card: {
      ...card, tone: 'neutral', action: payEarly,
      body: `${liveUntil} After that, subscribe with Razorpay — ${price} each month — to keep it open.`,
    },
    note: null, confirming: null, stopConfirmation: null, checkout: payEarlyCheckout,
    banner: { tone: 'neutral', lead: freeDaysLead(view.daysLeft), text: `after that, subscribe with Razorpay (${price} / month) to keep the shop open.`, action: payNow },
    header: payNow,
  }
}
