import { describe, expect, it } from 'vitest'
import type { LiveBillingView } from '@/shared/api'
import { isSettledView, liveBillingWording } from './live-billing-wording'

const plan = { code: 'MITHRA_SOCIAL_STARTER_MONTHLY', name: 'Mithra Social Starter', price: 299 }
/** 3:34 pm on 12 Oct in IST. */
const trialEndsAt = '2026-10-12T10:04:16.169Z'
const freeDays = (daysLeft: number, state: 'free_days' | 'three_days_left' = 'free_days'): LiveBillingView =>
  ({ state, shop: 'open', plan, trialEndsAt, daysLeft })

const setUpAutoPay = {
  label: 'Set up AutoPay · ₹299 on 12 Oct',
  help: 'Opens Razorpay Checkout. Approve AutoPay by card or UPI with a small refundable charge now; the first ₹299 is charged on 12 Oct, when free days end.',
}
const setUpAutoPayCheckout = { waiting: 'Confirming AutoPay…', failed: expect.any(Function) }
const payNow = { label: 'Pay ₹299 with Razorpay', help: 'Opens Razorpay Checkout. Pay by card or UPI.' }
const payNowCheckout = {
  waiting: 'Confirming payment… Card payments take about a minute; UPI can take a few hours. Your shop opens once Razorpay confirms the ₹299.',
  failed: expect.any(Function),
}

describe('liveBillingWording', () => {
  it('words Free days with the exact end in IST', () => {
    expect(liveBillingWording(freeDays(13))).toEqual({
      card: {
        tone: 'neutral', eyebrow: 'Free days', figure: { days: 13 },
        body: 'Your shop is live free until 12 Oct, 3:34 pm. After that, subscribe with Razorpay — ₹299 each month — to keep it open.',
        plan: 'Mithra Social Starter · ₹299 / month', sample: null, action: setUpAutoPay, autoPay: null,
      },
      note: null, confirming: null, stopConfirmation: null, checkout: setUpAutoPayCheckout,
      banner: { tone: 'neutral', lead: '13 free days left', text: 'after that, subscribe with Razorpay (₹299 / month) to keep the shop open.', action: 'Pay ₹299' },
      header: 'Pay ₹299',
    })
  })

  it('words 3 days left in the danger tone, still with the exact end', () => {
    expect(liveBillingWording(freeDays(3, 'three_days_left'))).toEqual({
      card: {
        tone: 'danger', eyebrow: 'Free days', figure: { days: 3 },
        body: 'Set up AutoPay now so customers can still open your shop when free days end. Free days end on 12 Oct, 3:34 pm.',
        plan: 'Mithra Social Starter · ₹299 / month', sample: null, action: setUpAutoPay, autoPay: null,
      },
      note: null, confirming: null, stopConfirmation: null, checkout: setUpAutoPayCheckout,
      banner: { tone: 'danger', lead: '3 free days left', text: 'set up AutoPay now so customers can still open your shop when free days end.', action: 'Pay ₹299' },
      header: 'Pay ₹299',
    })
  })

  it('words Set up AutoPay’s failed payment after Checkout closes', () => {
    expect(liveBillingWording(freeDays(13)).checkout?.failed('Your payment was declined by the bank.'))
      .toBe('The payment did not go through (Your payment was declined by the bank.), so AutoPay is not set up. Nothing changed; your free days are the same.')
  })

  it('dates Set up AutoPay at the IST day of the trial end', () => {
    // 11:30 pm on 12 Oct in UTC is already 13 Oct in IST.
    const view: LiveBillingView = { state: 'free_days', shop: 'open', plan, trialEndsAt: '2026-10-12T18:30:00.000Z', daysLeft: 13 }
    expect(liveBillingWording(view).card?.action?.label).toBe('Set up AutoPay · ₹299 on 13 Oct')
  })

  it('says "day" for the last free day', () => {
    expect(liveBillingWording(freeDays(1, 'three_days_left')).banner?.lead).toBe('1 free day left')
  })

  it('takes every ₹ amount from the plan price', () => {
    const wording = liveBillingWording({ ...freeDays(13), plan: { ...plan, price: 349 } })
    expect(wording.card?.body).toContain('₹349 each month')
    expect(wording.card?.plan).toBe('Mithra Social Starter · ₹349 / month')
    expect(wording.card?.action).toEqual({
      label: 'Set up AutoPay · ₹349 on 12 Oct',
      help: 'Opens Razorpay Checkout. Approve AutoPay by card or UPI with a small refundable charge now; the first ₹349 is charged on 12 Oct, when free days end.',
    })
    expect(wording.banner).toMatchObject({ text: 'after that, subscribe with Razorpay (₹349 / month) to keep the shop open.', action: 'Pay ₹349' })
    expect(wording.header).toBe('Pay ₹349')
  })

  it('words free days with AutoPay on, with the first charge date in IST and no action', () => {
    // 11 Oct 11:00 pm in UTC is 12 Oct in IST.
    const view: LiveBillingView = { state: 'autopay_on', shop: 'open', plan, trialEndsAt, daysLeft: 13, firstChargeAt: '2026-10-11T23:00:00Z' }
    expect(liveBillingWording(view)).toEqual({
      card: {
        tone: 'neutral', eyebrow: 'Free days', figure: { days: 13 },
        body: 'Free days are unchanged. When they end, Razorpay charges ₹299 each month to keep the shop open.',
        plan: 'Mithra Social Starter · ₹299 / month', sample: null, action: null, autoPay: 'AutoPay on — first ₹299 on 12 Oct',
      },
      note: null, confirming: null, stopConfirmation: null, checkout: null,
      banner: { tone: 'neutral', lead: '13 free days left', text: 'AutoPay is on, so the first ₹299 is charged on 12 Oct.', action: 'Shop plan' },
      header: 'Shop plan',
    })
  })

  it('keeps AutoPay on neutral with 3 days or fewer left', () => {
    const wording = liveBillingWording({ state: 'autopay_on', shop: 'open', plan, trialEndsAt, daysLeft: 1, firstChargeAt: trialEndsAt })
    expect(wording.card?.tone).toBe('neutral')
    expect(wording.banner).toMatchObject({ tone: 'neutral', lead: '1 free day left' })
  })

  it('words Collecting with no dates, no action, no banner and the Shop plan header', () => {
    expect(liveBillingWording({ state: 'collecting', shop: 'open', plan })).toEqual({
      card: {
        tone: 'neutral', eyebrow: 'Shop plan', figure: { headline: 'Shop is open' }, body: 'AutoPay on.',
        plan: 'Mithra Social Starter · ₹299 / month', sample: null, action: null, autoPay: null,
      },
      note: null, confirming: null, stopConfirmation: null, checkout: null, banner: null, header: 'Shop plan',
    })
  })

  describe('a paid period', () => {
    // IST midnight starting 27 Oct: the last paid day is 26 Oct.
    const paidThrough = '2026-10-26T18:30:00.000Z'

    it('words Paid with the last paid day, the next charge, no action, no banner and the Shop plan header', () => {
      expect(liveBillingWording({ state: 'paid', shop: 'open', plan, paidThrough, nextChargeAt: paidThrough })).toEqual({
        card: {
          tone: 'neutral', eyebrow: 'Paid', figure: { headline: 'Shop is open' },
          body: 'You paid ₹299 via Razorpay. Shop stays open until 26 Oct. Next ₹299 is charged on 27 Oct.',
          plan: 'Mithra Social Starter · ₹299 / month', sample: null, action: null, autoPay: null,
        },
        note: null, confirming: null, checkout: null,
        stopConfirmation: 'Stop the plan? No more ₹299 is charged. Your shop stays open until 26 Oct, then customers cannot see it.',
        banner: null, header: 'Shop plan',
      })
    })

    it('leaves the next-charge sentence out of Paid without next_billing_at', () => {
      expect(liveBillingWording({ state: 'paid', shop: 'open', plan, paidThrough, nextChargeAt: null }).card?.body)
        .toBe('You paid ₹299 via Razorpay. Shop stays open until 26 Oct.')
    })

    it('takes Stop the plan’s ₹ amount from the plan price', () => {
      expect(liveBillingWording({ state: 'paid', shop: 'open', plan: { ...plan, price: 349 }, paidThrough, nextChargeAt: null }).stopConfirmation)
        .toBe('Stop the plan? No more ₹349 is charged. Your shop stays open until 26 Oct, then customers cannot see it.')
    })

    const keepOpen = {
      label: 'Keep shop open · ₹299',
      help: 'Opens Razorpay Checkout. Pay ₹299 now by card or UPI. Your shop stays open for another month after 26 Oct, then AutoPay charges ₹299 each month.',
    }
    const keepOpenCheckout = {
      waiting: 'Confirming payment… Card payments take about a minute; UPI can take a few hours.',
      failed: expect.any(Function),
      refused: 'Couldn’t start the payment right now. Your shop stays open until 26 Oct.',
    }

    it('words Stopped with the days until P, Keep shop open, the warning banner and the Keep open header', () => {
      expect(liveBillingWording({ state: 'stopped', shop: 'open', plan, paidThrough, daysLeft: 21 })).toEqual({
        card: {
          tone: 'warning', eyebrow: 'Plan stopped', figure: { days: 21 },
          body: 'You stopped the plan. Shop stays open until 26 Oct. Pay ₹299 with Razorpay if you want to keep it after that.',
          plan: 'Mithra Social Starter · ₹299 / month', sample: null, action: keepOpen, autoPay: null,
        },
        note: null, confirming: null, stopConfirmation: null, checkout: keepOpenCheckout,
        banner: { tone: 'warning', lead: 'Shop stays open until 26 Oct', text: 'then customers cannot see it. You can pay again any time with Razorpay.', action: 'Keep open · ₹299' },
        header: 'Keep open · ₹299',
      })
    })

    it('words AutoPay off as Stopped, true whoever turned AutoPay off, with Keep shop open', () => {
      expect(liveBillingWording({ state: 'autopay_off', shop: 'open', plan, paidThrough, daysLeft: 21 })).toEqual({
        card: {
          tone: 'warning', eyebrow: 'AutoPay off', figure: { days: 21 },
          body: 'AutoPay is off, so no more ₹299 is charged. Shop stays open until 26 Oct. Pay ₹299 with Razorpay if you want to keep it after that.',
          plan: 'Mithra Social Starter · ₹299 / month', sample: null, action: keepOpen, autoPay: null,
        },
        note: null, confirming: null, stopConfirmation: null, checkout: keepOpenCheckout,
        banner: { tone: 'warning', lead: 'Shop stays open until 26 Oct', text: 'then customers cannot see it. You can pay again any time with Razorpay.', action: 'Keep open · ₹299' },
        header: 'Keep open · ₹299',
      })
    })

    it('words Keep shop open’s failed payment after Checkout closes', () => {
      for (const state of ['stopped', 'autopay_off'] as const) {
        expect(liveBillingWording({ state, shop: 'open', plan, paidThrough, daysLeft: 21 }).checkout?.failed('Your payment was declined by the bank.'))
          .toBe('The payment did not go through (Your payment was declined by the bank.). Nothing changed; the plan is still stopped.')
      }
    })

    it('takes the ₹ amounts of Paid and Stopped from the plan price', () => {
      const pricier = { ...plan, price: 349 }
      expect(liveBillingWording({ state: 'paid', shop: 'open', plan: pricier, paidThrough, nextChargeAt: paidThrough }).card?.body)
        .toBe('You paid ₹349 via Razorpay. Shop stays open until 26 Oct. Next ₹349 is charged on 27 Oct.')
      const stopped = liveBillingWording({ state: 'stopped', shop: 'open', plan: pricier, paidThrough, daysLeft: 1 })
      expect(stopped.card?.body).toContain('Pay ₹349 with Razorpay')
      expect(stopped.banner?.action).toBe('Keep open · ₹349')
      expect(stopped.header).toBe('Keep open · ₹349')
      expect(stopped.card?.action?.label).toBe('Keep shop open · ₹349')
      expect(stopped.card?.action?.help).toBe('Opens Razorpay Checkout. Pay ₹349 now by card or UPI. Your shop stays open for another month after 26 Oct, then AutoPay charges ₹349 each month.')
    })
  })

  describe('lapsed shops', () => {
    const hidden = { plan: 'Mithra Social Starter · ₹299 / month', sample: null, action: payNow, autoPay: null, tone: 'danger', figure: { headline: 'Shop is hidden' } }
    const closedBanner = { tone: 'danger', lead: 'Shop is hidden from customers', text: 'pay ₹299 with Razorpay to open it again.', action: 'Pay ₹299' }

    it('words Payment failed with Pay ₹299, the danger banner and the Pay header', () => {
      expect(liveBillingWording({ state: 'payment_failed', shop: 'hidden', plan })).toEqual({
        card: { ...hidden, eyebrow: 'Payment failed', body: 'Customers cannot see your shop. Pay ₹299 with Razorpay to open it again. Old orders are still here.' },
        note: null, confirming: null, stopConfirmation: null, checkout: payNowCheckout,
        banner: { tone: 'danger', lead: 'Shop is hidden from customers', text: 'last Razorpay payment did not go through. Pay ₹299 to open the shop again.', action: 'Pay ₹299' },
        header: 'Pay ₹299',
      })
    })

    it('words Shop closed after paid days', () => {
      expect(liveBillingWording({ state: 'shop_closed', shop: 'hidden', plan, ended: 'paid_days' })).toEqual({
        card: { ...hidden, eyebrow: 'Shop closed', body: 'Paid days are over. Customers cannot see your shop. Pay ₹299 with Razorpay to open it again.' },
        note: null, confirming: null, stopConfirmation: null, checkout: payNowCheckout, banner: closedBanner, header: 'Pay ₹299',
      })
    })

    it('words Shop closed after free days', () => {
      expect(liveBillingWording({ state: 'shop_closed', shop: 'hidden', plan, ended: 'free_days' })).toEqual({
        card: { ...hidden, eyebrow: 'Shop closed', body: 'Free days are over. Customers cannot see your shop. Pay ₹299 with Razorpay to open it again.' },
        note: null, confirming: null, stopConfirmation: null, checkout: payNowCheckout, banner: closedBanner, header: 'Pay ₹299',
      })
    })

    it('words Confirming as the Shop closed card with the confirming status, its banner and the Shop plan header', () => {
      const confirming = 'Confirming payment… Card payments take about a minute; UPI can take a few hours. Your shop opens once Razorpay confirms the ₹299.'
      expect(liveBillingWording({ state: 'confirming', shop: 'hidden', plan, ended: 'free_days' })).toEqual({
        card: { ...hidden, action: null, eyebrow: 'Shop closed', body: 'Free days are over. Customers cannot see your shop. Pay ₹299 with Razorpay to open it again.' },
        note: null, confirming, stopConfirmation: null, checkout: null,
        banner: { tone: 'danger', lead: 'Shop is hidden from customers', text: 'your ₹299 payment is being confirmed.', action: 'Shop plan' },
        header: 'Shop plan',
      })
      expect(liveBillingWording({ state: 'confirming', shop: 'hidden', plan, ended: 'paid_days' }).card?.body)
        .toBe('Paid days are over. Customers cannot see your shop. Pay ₹299 with Razorpay to open it again.')
    })

    it('words Pay ₹299’s failed payment after Checkout closes, with no gap E message', () => {
      const checkout = liveBillingWording({ state: 'shop_closed', shop: 'hidden', plan, ended: 'paid_days' }).checkout
      expect(checkout?.failed('Your payment was declined by the bank.'))
        .toBe('The payment did not go through (Your payment was declined by the bank.). Nothing changed; your shop is still hidden.')
      expect(checkout?.refused).toBeUndefined()
    })

    it('takes the ₹ amounts of the lapsed states from the plan price', () => {
      const pricier = { ...plan, price: 349 }
      const failed = liveBillingWording({ state: 'payment_failed', shop: 'hidden', plan: pricier })
      expect(failed.card?.body).toContain('Pay ₹349 with Razorpay')
      expect(failed.banner?.text).toContain('Pay ₹349 to open')
      expect(failed.header).toBe('Pay ₹349')
      expect(failed.card?.action?.label).toBe('Pay ₹349 with Razorpay')
      const confirming = liveBillingWording({ state: 'confirming', shop: 'hidden', plan: pricier, ended: 'paid_days' })
      expect(confirming.confirming).toContain('confirms the ₹349.')
      expect(confirming.banner?.text).toBe('your ₹349 payment is being confirmed.')
    })
  })

  it('gives a shop that is not live the note only, no banner and the Shop plan header', () => {
    expect(liveBillingWording({ state: 'not_live', plan })).toEqual({
      card: null, note: 'Free days start when your shop goes live.', confirming: null, stopConfirmation: null, checkout: null, banner: null, header: 'Shop plan',
    })
  })
})

describe('isSettledView', () => {
  const paidThrough = '2026-10-26T18:30:00.000Z'

  it.each<[string, LiveBillingView]>([
    ['Paid', { state: 'paid', shop: 'open', plan, paidThrough, nextChargeAt: paidThrough }],
    ['Collecting', { state: 'collecting', shop: 'open', plan }],
    ['AutoPay on', { state: 'autopay_on', shop: 'open', plan, trialEndsAt, daysLeft: 13, firstChargeAt: trialEndsAt }],
  ])('settles on %s, which is not Confirming and offers no Checkout action', (_, view) => {
    expect(isSettledView(view)).toBe(true)
  })

  it.each<[string, LiveBillingView]>([
    ['Confirming (row 8b)', { state: 'confirming', shop: 'hidden', plan, ended: 'free_days' }],
    ['Free days', freeDays(13)],
    ['3 days left', freeDays(3, 'three_days_left')],
    ['Payment failed', { state: 'payment_failed', shop: 'hidden', plan }],
    ['Shop closed', { state: 'shop_closed', shop: 'hidden', plan, ended: 'paid_days' }],
    ['Stopped', { state: 'stopped', shop: 'open', plan, paidThrough, daysLeft: 21 }],
    ['AutoPay off', { state: 'autopay_off', shop: 'open', plan, paidThrough, daysLeft: 21 }],
  ])('does not settle on %s', (_, view) => {
    expect(isSettledView(view)).toBe(false)
  })
})
