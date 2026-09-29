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
const planLine = (plan: LiveBillingPlan) => `${plan.name} · ${rupees(plan.price)} / month`
const freeDaysLead = (days: number) => `${days} free ${days === 1 ? 'day' : 'days'} left`

export function liveBillingWording(view: LiveBillingView): LiveBillingWording {
  if (view.state === 'not_live') return { card: null, note: 'Free days start when your shop goes live.', banner: null, header: 'Shop plan' }

  const price = rupees(view.plan.price)
  if (view.state === 'collecting') return {
    card: {
      tone: 'neutral', eyebrow: 'Shop plan', figure: { headline: 'Shop is open' }, body: 'AutoPay on.',
      plan: planLine(view.plan), sample: null, action: null, autoPay: null,
    },
    note: null, banner: null, header: 'Shop plan',
  }

  const payNow = `Pay ${price}`
  const card = { eyebrow: 'Free days', figure: { days: view.daysLeft }, plan: planLine(view.plan), sample: null, action: null, autoPay: null }
  // One wording at every count: AutoPay on stays neutral with 3 days or fewer left.
  if (view.state === 'autopay_on') {
    const firstCharge = shortDate(view.firstChargeAt)
    return {
      card: {
        ...card, tone: 'neutral',
        body: `Free days are unchanged. When they end, Razorpay charges ${price} each month to keep the shop open.`,
        autoPay: `AutoPay on — first ${price} on ${firstCharge}`,
      },
      note: null,
      banner: { tone: 'neutral', lead: freeDaysLead(view.daysLeft), text: `AutoPay is on, so the first ${price} is charged on ${firstCharge}.`, action: 'Shop plan' },
      header: 'Shop plan',
    }
  }
  if (view.state === 'three_days_left') return {
    card: {
      ...card, tone: 'danger',
      body: `Set up AutoPay now so customers can still open your shop when free days end. Free days end on ${dateTime(view.trialEndsAt)}.`,
    },
    note: null,
    banner: { tone: 'danger', lead: freeDaysLead(view.daysLeft), text: 'set up AutoPay now so customers can still open your shop when free days end.', action: payNow },
    header: payNow,
  }
  return {
    card: {
      ...card, tone: 'neutral',
      body: `Your shop is live free until ${dateTime(view.trialEndsAt)}. After that, subscribe with Razorpay — ${price} each month — to keep it open.`,
    },
    note: null,
    banner: { tone: 'neutral', lead: freeDaysLead(view.daysLeft), text: `after that, subscribe with Razorpay (${price} / month) to keep the shop open.`, action: payNow },
    header: payNow,
  }
}
