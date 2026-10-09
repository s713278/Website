import type { PrototypeBanner, PrototypeCard, PrototypeTone } from '@/modules/vendor/lib/billing-prototype-card'
import type { LiveBillingPlan, LiveBillingView } from '@/shared/api'

/**
 * What Plan, the billing banner, the header button and the rail's badge say for a Live API billing
 * view. It mirrors the prototype's card, banner and header layout without its demo-only text. Every
 * ₹ amount comes from the plan price.
 */
export interface LiveBillingWording {
  /** Plan's main card; `null` where Plan shows only the note. */
  card: PrototypeCard | null
  note: string | null
  /** Confirming's status line under the card, with Check again; `null` in every other state. */
  confirming: string | null
  /** Stop the plan's confirm step, in Paid only; `null` in every other state, which has no Stop the plan. */
  stopConfirmation: string | null
  /** Stop the plan's line above its button, in Paid only; `null` in every other state. */
  stopNote: string | null
  /** What the card's Checkout action says while it runs; `null` where the card has no Checkout action. */
  checkout: LiveCheckoutPurpose | null
  banner: PrototypeBanner | null
  header: string
  /** The rail's badge above View storefront; `null` before go-live, which shows none. */
  badge: { tone: PrototypeTone; text: string } | null
}

/** A Checkout action's wording besides its label. */
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

/** Under the Checkout action, once a read during the confirmation hold reports that hold's payment failed. */
export const livePaymentFailed = 'Payment failed. Try again.'

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
/** The badge in free days, red from 3 days left. */
const daysLeftBadge = (days: number) => ({ tone: days <= 3 ? 'danger' as const : 'neutral' as const, text: `${days} ${days === 1 ? 'day' : 'days'} left` })
/** The badge while paid and open: the plan's fixed name, not the read's plan name. */
const paidBadge = { tone: 'neutral' as const, text: 'Social Starter' }
const closedBadge = { tone: 'danger' as const, text: 'Shop closed' }
const confirmingPayment = 'Confirming your payment…'

export function liveBillingWording(view: LiveBillingView): LiveBillingWording {
  if (view.state === 'not_live') return { card: null, note: 'Free days start when your shop goes live.', confirming: null, stopConfirmation: null, stopNote: null, checkout: null, banner: null, header: 'Shop plan', badge: null }

  const price = rupees(view.plan.price)
  const planCard = { plan: planLine(view.plan), sample: null, action: null, autoPay: null }
  if (view.state === 'collecting') return {
    card: { ...planCard, tone: 'neutral', eyebrow: 'Shop plan', figure: { headline: 'Shop is open' }, body: 'AutoPay on.' },
    note: null, confirming: null, stopConfirmation: null, stopNote: null, checkout: null, banner: null, header: 'Shop plan', badge: paidBadge,
  }

  if (view.state === 'paid') {
    const paidUntil = lastPaidDay(view.paidThrough)
    const nextMonth = view.trialEndsAt || view.nextChargeAt ? ` Next month is another ${price}.` : ''
    const body = `You paid ${price} via Razorpay. Shop stays open until ${paidUntil}.${nextMonth}`
    return {
      card: { ...planCard, tone: 'neutral', eyebrow: 'Paid', figure: { headline: 'Shop is open' }, body },
      note: null, confirming: null,
      stopConfirmation: `Stop the plan? No more ${price} is charged. Your shop stays open until ${paidUntil}, then customers cannot see it.`,
      stopNote: `Stop any time. Your shop stays open until ${paidUntil}.`,
      checkout: null,
      banner: null, header: 'Shop plan', badge: paidBadge,
    }
  }
  if (view.state === 'stopped' || view.state === 'autopay_off') {
    const paidUntil = lastPaidDay(view.paidThrough)
    const keepOpen = `Keep open · ${price}`
    // AutoPay off is true whoever turned it off: the vendor, the bank or Razorpay.
    const reason = view.state === 'stopped' ? 'You stopped the plan.' : `AutoPay is off, so no more ${price} is charged.`
    const eyebrow = view.state === 'stopped' ? 'Plan stopped' : 'AutoPay off'
    const lead = `Shop stays open until ${paidUntil}`
    const badge = { tone: 'warning' as const, text: `Open until ${paidUntil}` }
    // A payment to keep the shop open is being confirmed, so nothing offers another.
    if (view.confirming) return {
      card: { ...planCard, tone: 'warning', eyebrow, figure: { days: view.daysLeft }, body: `${reason} ${lead}.` },
      note: null, confirming: confirmingPayment, stopConfirmation: null, stopNote: null, checkout: null,
      banner: { tone: 'warning', lead, text: `your ${price} payment is being confirmed.`, action: 'Shop plan' },
      header: 'Shop plan', badge,
    }
    return {
      card: {
        ...planCard, tone: 'warning', eyebrow, figure: { days: view.daysLeft },
        body: `${reason} ${lead}. Pay ${price} with Razorpay if you want to keep it after that.`,
        action: { label: `Keep shop open · ${price}` },
      },
      note: null, confirming: null, stopConfirmation: null, stopNote: null,
      checkout: {
        waiting: confirmingPayment,
        failed: (failure) => `The payment did not go through (${failure}). Nothing changed; the plan is still stopped.`,
        refused: `Couldn’t start the payment right now. Your shop stays open until ${paidUntil}.`,
      },
      banner: { tone: 'warning', lead, text: 'then customers cannot see it. You can pay again any time with Razorpay.', action: keepOpen },
      header: keepOpen, badge,
    }
  }

  const payNow = `Pay ${price}`
  if (view.state === 'payment_failed' || view.state === 'shop_closed' || view.state === 'confirming') {
    const hidden = { ...planCard, tone: 'danger' as const, figure: { headline: 'Shop is hidden' } }
    const payAction = { label: `Pay ${price} with Razorpay` }
    const lead = 'Shop is hidden from customers'
    const hiddenShop = 'Customers cannot see your shop.'
    const reopen = `${hiddenShop} Pay ${price} with Razorpay to open it again.`
    const payCheckout: LiveCheckoutPurpose = {
      waiting: confirmingPayment,
      failed: (reason) => `The payment did not go through (${reason}). Nothing changed; your shop is still hidden.`,
    }
    if (view.state === 'payment_failed') return {
      card: { ...hidden, action: payAction, eyebrow: 'Payment failed', body: `${reopen} Old orders are still here.` },
      note: null, confirming: null, stopConfirmation: null, stopNote: null, checkout: payCheckout,
      banner: { tone: 'danger', lead, text: `last Razorpay payment did not go through. Pay ${price} to open the shop again.`, action: payNow },
      header: payNow, badge: closedBadge,
    }
    const closedCard = { ...hidden, eyebrow: 'Shop closed' }
    const ended = `${view.ended === 'paid_days' ? 'Paid' : 'Free'} days are over.`
    // Confirming offers no payment, so a second ₹399 cannot start while the first is confirmed.
    if (view.state === 'confirming') return {
      card: { ...closedCard, body: `${ended} ${hiddenShop}` }, note: null,
      confirming: confirmingPayment,
      stopConfirmation: null, stopNote: null, checkout: null,
      banner: { tone: 'danger', lead, text: `your ${price} payment is being confirmed.`, action: 'Shop plan' },
      header: 'Shop plan', badge: closedBadge,
    }
    return {
      card: { ...closedCard, body: `${ended} ${reopen}`, action: payAction }, note: null, confirming: null, stopConfirmation: null, stopNote: null, checkout: payCheckout,
      banner: { tone: 'danger', lead, text: `pay ${price} with Razorpay to open it again.`, action: payNow },
      header: payNow, badge: closedBadge,
    }
  }
  const card = { ...planCard, eyebrow: 'Free days', figure: { days: view.daysLeft } }
  const liveUntil = `Your shop is live free until ${dateTime(view.trialEndsAt)}.`
  // One wording at every count: the vendor has paid, so 3 days left does not apply. No banner, so
  // the shell's own banner shows.
  if (view.state === 'free_days_confirming') return {
    card: { ...card, tone: 'neutral', body: `${liveUntil} Your free days are kept.` },
    note: null, confirming: confirmingPayment, stopConfirmation: null, stopNote: null, checkout: null, banner: null, header: 'Shop plan',
    badge: daysLeftBadge(view.daysLeft),
  }
  // The early first fee: the backend decides what Checkout charges (gap K).
  const payEarly = { label: `Pay ${price} with Razorpay` }
  const payEarlyCheckout: LiveCheckoutPurpose = {
    waiting: confirmingPayment,
    failed: (reason) => `The payment did not go through (${reason}). Nothing changed; your free days are the same.`,
  }
  if (view.state === 'three_days_left') return {
    card: {
      ...card, tone: 'danger', action: payEarly,
      body: `Pay ${price} with Razorpay now so customers can still open your shop when free days end.`,
    },
    note: null, confirming: null, stopConfirmation: null, stopNote: null, checkout: payEarlyCheckout,
    banner: { tone: 'danger', lead: freeDaysLead(view.daysLeft), text: `pay ${price} with Razorpay now so customers can still open your shop.`, action: payNow },
    header: payNow, badge: daysLeftBadge(view.daysLeft),
  }
  // The trial length, when the read has its start; otherwise the exact end.
  const liveFor = view.trialDays === null ? liveUntil : `Your shop is live for ${view.trialDays} free ${view.trialDays === 1 ? 'day' : 'days'}.`
  return {
    card: {
      ...card, tone: 'neutral', action: payEarly,
      body: `${liveFor} After that, subscribe with Razorpay — ${price} each month — to keep it open.`,
    },
    note: null, confirming: null, stopConfirmation: null, stopNote: null, checkout: payEarlyCheckout,
    banner: { tone: 'neutral', lead: freeDaysLead(view.daysLeft), text: `after that, subscribe with Razorpay (${price} / month) to keep the shop open.`, action: payNow },
    header: payNow, badge: daysLeftBadge(view.daysLeft),
  }
}
