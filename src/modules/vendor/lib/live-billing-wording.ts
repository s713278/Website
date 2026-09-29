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
  banner: PrototypeBanner | null
  header: string
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

export function liveBillingWording(view: LiveBillingView): LiveBillingWording {
  if (view.state === 'not_live') return { card: null, note: 'Free days start when your shop goes live.', confirming: null, banner: null, header: 'Shop plan' }

  const price = rupees(view.plan.price)
  const planCard = { plan: planLine(view.plan), sample: null, action: null, autoPay: null }
  if (view.state === 'collecting') return {
    card: { ...planCard, tone: 'neutral', eyebrow: 'Shop plan', figure: { headline: 'Shop is open' }, body: 'AutoPay on.' },
    note: null, confirming: null, banner: null, header: 'Shop plan',
  }

  if (view.state === 'paid') {
    const nextCharge = view.nextChargeAt ? ` Next ${price} is charged on ${shortDate(view.nextChargeAt)}.` : ''
    return {
      card: {
        ...planCard, tone: 'neutral', eyebrow: 'Paid', figure: { headline: 'Shop is open' },
        body: `You paid ${price} via Razorpay. Shop stays open until ${lastPaidDay(view.paidThrough)}.${nextCharge}`,
      },
      note: null, confirming: null, banner: null, header: 'Shop plan',
    }
  }
  if (view.state === 'stopped' || view.state === 'autopay_ended') {
    const paidUntil = lastPaidDay(view.paidThrough)
    const keepOpen = `Keep open · ${price}`
    const reason = view.state === 'stopped' ? 'You stopped the plan.' : `AutoPay was cancelled outside MithraDirect, so no more ${price} is charged.`
    return {
      card: {
        ...planCard, tone: 'warning', eyebrow: view.state === 'stopped' ? 'Plan stopped' : 'AutoPay ended', figure: { days: view.daysLeft },
        body: `${reason} Shop stays open until ${paidUntil}. Pay ${price} with Razorpay if you want to keep it after that.`,
      },
      note: null, confirming: null,
      banner: { tone: 'warning', lead: `Shop stays open until ${paidUntil}`, text: 'then customers cannot see it. You can pay again any time with Razorpay.', action: keepOpen },
      header: keepOpen,
    }
  }

  const payNow = `Pay ${price}`
  if (view.state === 'payment_failed' || view.state === 'shop_closed' || view.state === 'confirming') {
    const hidden = { ...planCard, tone: 'danger' as const, figure: { headline: 'Shop is hidden' } }
    const lead = 'Shop is hidden from customers'
    const reopen = `Customers cannot see your shop. Pay ${price} with Razorpay to open it again.`
    if (view.state === 'payment_failed') return {
      card: { ...hidden, eyebrow: 'Payment failed', body: `${reopen} Old orders are still here.` },
      note: null, confirming: null,
      banner: { tone: 'danger', lead, text: `last Razorpay payment did not go through. Pay ${price} to open the shop again.`, action: payNow },
      header: payNow,
    }
    const closedCard = { ...hidden, eyebrow: 'Shop closed', body: `${view.ended === 'paid_days' ? 'Paid' : 'Free'} days are over. ${reopen}` }
    // Confirming offers no payment, so a second ₹299 cannot start while the first is confirmed.
    if (view.state === 'confirming') return {
      card: closedCard, note: null,
      confirming: `Confirming payment… Card payments take about a minute; UPI can take a few hours. Your shop opens once Razorpay confirms the ${price}.`,
      banner: { tone: 'danger', lead, text: `your ${price} payment is being confirmed.`, action: 'Shop plan' },
      header: 'Shop plan',
    }
    return {
      card: closedCard, note: null, confirming: null,
      banner: { tone: 'danger', lead, text: `pay ${price} with Razorpay to open it again.`, action: payNow },
      header: payNow,
    }
  }
  const card = { ...planCard, eyebrow: 'Free days', figure: { days: view.daysLeft } }
  // One wording at every count: AutoPay on stays neutral with 3 days or fewer left.
  if (view.state === 'autopay_on') {
    const firstCharge = shortDate(view.firstChargeAt)
    return {
      card: {
        ...card, tone: 'neutral',
        body: `Free days are unchanged. When they end, Razorpay charges ${price} each month to keep the shop open.`,
        autoPay: `AutoPay on — first ${price} on ${firstCharge}`,
      },
      note: null, confirming: null,
      banner: { tone: 'neutral', lead: freeDaysLead(view.daysLeft), text: `AutoPay is on, so the first ${price} is charged on ${firstCharge}.`, action: 'Shop plan' },
      header: 'Shop plan',
    }
  }
  if (view.state === 'three_days_left') return {
    card: {
      ...card, tone: 'danger',
      body: `Set up AutoPay now so customers can still open your shop when free days end. Free days end on ${dateTime(view.trialEndsAt)}.`,
    },
    note: null, confirming: null,
    banner: { tone: 'danger', lead: freeDaysLead(view.daysLeft), text: 'set up AutoPay now so customers can still open your shop when free days end.', action: payNow },
    header: payNow,
  }
  return {
    card: {
      ...card, tone: 'neutral',
      body: `Your shop is live free until ${dateTime(view.trialEndsAt)}. After that, subscribe with Razorpay — ${price} each month — to keep it open.`,
    },
    note: null, confirming: null,
    banner: { tone: 'neutral', lead: freeDaysLead(view.daysLeft), text: `after that, subscribe with Razorpay (${price} / month) to keep the shop open.`, action: payNow },
    header: payNow,
  }
}
