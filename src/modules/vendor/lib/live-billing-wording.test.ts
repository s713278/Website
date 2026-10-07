import { describe, expect, it } from 'vitest'
import type { LiveBillingView } from '@/shared/api'
import { isSettledView, liveBillingWording } from './live-billing-wording'

const plan = { code: 'MITHRA_SOCIAL_STARTER_MONTHLY', name: 'Mithra Social Starter', price: 399 }
/** 3:34 pm on 12 Oct in IST. */
const trialEndsAt = '2026-10-12T10:04:16.169Z'
const freeDays = (daysLeft: number, state: 'free_days' | 'three_days_left' = 'free_days', trialDays: number | null = 14): LiveBillingView =>
  ({ state, shop: 'open', plan, trialEndsAt, daysLeft, trialDays })

const payEarly = { label: 'Pay ₹399 with Razorpay' }
const confirmingPayment = 'Confirming your payment…'
const payEarlyCheckout = { waiting: confirmingPayment, failed: expect.any(Function) }
const payNow = { label: 'Pay ₹399 with Razorpay' }
const payNowCheckout = {
  waiting: 'Confirming your payment…',
  failed: expect.any(Function),
}

describe('liveBillingWording', () => {
  it('words Free days with the free days’ length', () => {
    expect(liveBillingWording(freeDays(13))).toEqual({
      card: {
        tone: 'neutral', eyebrow: 'Free days', figure: { days: 13 },
        body: 'Your shop is live for 14 free days. After that, subscribe with Razorpay — ₹399 each month — to keep it open.',
        plan: 'Mithra Social Starter · ₹399 / month', sample: null, action: payEarly, autoPay: null,
      },
      note: null, confirming: null, stopConfirmation: null, stopNote: null, checkout: payEarlyCheckout,
      banner: { tone: 'neutral', lead: '13 free days left', text: 'after that, subscribe with Razorpay (₹399 / month) to keep the shop open.', action: 'Pay ₹399' },
      header: 'Pay ₹399', badge: { tone: 'neutral', text: '13 days left' },
    })
  })

  it('says "1 free day" for a one-day trial, and falls back to the exact end in IST without the trial start', () => {
    expect(liveBillingWording(freeDays(1, 'free_days', 1)).card?.body)
      .toBe('Your shop is live for 1 free day. After that, subscribe with Razorpay — ₹399 each month — to keep it open.')
    expect(liveBillingWording(freeDays(13, 'free_days', null)).card?.body)
      .toBe('Your shop is live free until 12 Oct, 3:34 pm. After that, subscribe with Razorpay — ₹399 each month — to keep it open.')
  })

  it('words 3 days left in the danger tone, with Razorpay in the card and the banner', () => {
    expect(liveBillingWording(freeDays(3, 'three_days_left'))).toEqual({
      card: {
        tone: 'danger', eyebrow: 'Free days', figure: { days: 3 },
        body: 'Pay ₹399 with Razorpay now so customers can still open your shop when free days end.',
        plan: 'Mithra Social Starter · ₹399 / month', sample: null, action: payEarly, autoPay: null,
      },
      note: null, confirming: null, stopConfirmation: null, stopNote: null, checkout: payEarlyCheckout,
      banner: { tone: 'danger', lead: '3 free days left', text: 'pay ₹399 with Razorpay now so customers can still open your shop.', action: 'Pay ₹399' },
      header: 'Pay ₹399', badge: { tone: 'danger', text: '3 days left' },
    })
  })

  it('words Pay ₹399 with Razorpay’s failed payment after Checkout closes, in Free days and 3 days left', () => {
    for (const view of [freeDays(13), freeDays(3, 'three_days_left')]) {
      expect(liveBillingWording(view).checkout?.failed('Your payment was declined by the bank.'))
        .toBe('The payment did not go through (Your payment was declined by the bank.). Nothing changed; your free days are the same.')
    }
  })

  it('gives no Checkout action a help line, in any state that offers one', () => {
    const views: LiveBillingView[] = [freeDays(13), freeDays(3, 'three_days_left')]
    for (const view of views) expect(liveBillingWording(view).card?.action).toEqual({ label: 'Pay ₹399 with Razorpay' })
  })

  it('says "day" for the last free day', () => {
    expect(liveBillingWording(freeDays(1, 'three_days_left')).banner?.lead).toBe('1 free day left')
  })

  it('takes every ₹ amount from the plan price', () => {
    const wording = liveBillingWording({ ...freeDays(13), plan: { ...plan, price: 349 } })
    expect(wording.card?.body).toContain('₹349 each month')
    expect(wording.card?.plan).toBe('Mithra Social Starter · ₹349 / month')
    expect(wording.card?.action).toEqual({ label: 'Pay ₹349 with Razorpay' })
    expect(wording.banner).toMatchObject({ text: 'after that, subscribe with Razorpay (₹349 / month) to keep the shop open.', action: 'Pay ₹349' })
    expect(wording.header).toBe('Pay ₹349')
  })

  describe('Free days while the payment is confirmed (row 7)', () => {
    const confirmingFreeDays = (daysLeft: number): LiveBillingView => ({ state: 'free_days_confirming', shop: 'open', plan, trialEndsAt, daysLeft })

    it('words the Free days card with the free days kept, the confirming status, no action, no banner and the Shop plan header', () => {
      expect(liveBillingWording(confirmingFreeDays(13))).toEqual({
        card: {
          tone: 'neutral', eyebrow: 'Free days', figure: { days: 13 },
          body: 'Your shop is live free until 12 Oct, 3:34 pm. Your free days are kept.',
          plan: 'Mithra Social Starter · ₹399 / month', sample: null, action: null, autoPay: null,
        },
        note: null, confirming: confirmingPayment, stopConfirmation: null, stopNote: null, checkout: null, banner: null, header: 'Shop plan',
        badge: { tone: 'neutral', text: '13 days left' },
      })
    })

    it('stays neutral with 3 days or fewer left', () => {
      for (const daysLeft of [3, 1]) {
        const wording = liveBillingWording(confirmingFreeDays(daysLeft))
        expect(wording.card).toMatchObject({ tone: 'neutral', body: 'Your shop is live free until 12 Oct, 3:34 pm. Your free days are kept.', figure: { days: daysLeft } })
        expect(wording.banner).toBeNull()
        expect(wording.header).toBe('Shop plan')
      }
    })
  })

  it('words Collecting with no dates, no action, no banner and the Shop plan header', () => {
    expect(liveBillingWording({ state: 'collecting', shop: 'open', plan })).toEqual({
      card: {
        tone: 'neutral', eyebrow: 'Shop plan', figure: { headline: 'Shop is open' }, body: 'AutoPay on.',
        plan: 'Mithra Social Starter · ₹399 / month', sample: null, action: null, autoPay: null,
      },
      note: null, confirming: null, stopConfirmation: null, stopNote: null, checkout: null, banner: null, header: 'Shop plan',
      badge: { tone: 'neutral', text: 'Social Starter' },
    })
  })

  describe('a paid period', () => {
    // IST midnight starting 27 Oct: the last paid day is 26 Oct.
    const paidThrough = '2026-10-26T18:30:00.000Z'

    it('words Paid with the payment, the last paid day, next month’s charge, no action, no banner and the Shop plan header', () => {
      expect(liveBillingWording({ state: 'paid', shop: 'open', plan, paidThrough, nextChargeAt: paidThrough, trialEndsAt: null })).toEqual({
        card: {
          tone: 'neutral', eyebrow: 'Paid', figure: { headline: 'Shop is open' },
          body: 'You paid ₹399 via Razorpay. Shop stays open until 26 Oct. Next month is another ₹399.',
          plan: 'Mithra Social Starter · ₹399 / month', sample: null, action: null, autoPay: null,
        },
        note: null, confirming: null, checkout: null,
        stopConfirmation: 'Stop the plan? No more ₹399 is charged. Your shop stays open until 26 Oct, then customers cannot see it.',
        stopNote: 'Stop any time. Your shop stays open until 26 Oct.',
        banner: null, header: 'Shop plan', badge: { tone: 'neutral', text: 'Social Starter' },
      })
    })

    describe('Paid with the free days kept (row 3, now < T)', () => {
      // After an early first fee: the paid month runs from T, 3:34 pm on 12 Oct IST, to one month later.
      const monthAfter = '2026-11-12T10:04:16.169Z'
      const kept = (nextChargeAt: string | null, price = plan.price): LiveBillingView =>
        ({ state: 'paid', shop: 'open', plan: { ...plan, price }, paidThrough: monthAfter, nextChargeAt, trialEndsAt })
      const keptBody = 'You paid ₹399 via Razorpay. Shop stays open until 12 Nov. Next month is another ₹399.'

      it('words the variant with Paid’s eyebrow and figure, no action, Stop the plan, no banner and the Shop plan header', () => {
        expect(liveBillingWording(kept(monthAfter))).toEqual({
          card: {
            tone: 'neutral', eyebrow: 'Paid', figure: { headline: 'Shop is open' }, body: keptBody,
            plan: 'Mithra Social Starter · ₹399 / month', sample: null, action: null, autoPay: null,
          },
          note: null, confirming: null, checkout: null,
          stopConfirmation: 'Stop the plan? No more ₹399 is charged. Your shop stays open until 12 Nov, then customers cannot see it.',
          stopNote: 'Stop any time. Your shop stays open until 12 Nov.',
          banner: null, header: 'Shop plan', badge: { tone: 'neutral', text: 'Social Starter' },
        })
      })

      it('says next month’s charge whatever next_billing_at says (gap D), and when it is absent', () => {
        expect(liveBillingWording(kept('2026-11-13T10:04:16.000Z')).card?.body).toBe(keptBody)
        expect(liveBillingWording(kept(null)).card?.body).toBe(keptBody)
      })

      it('takes the ₹ amounts from the plan price', () => {
        expect(liveBillingWording(kept(monthAfter, 349)).card?.body)
          .toBe('You paid ₹349 via Razorpay. Shop stays open until 12 Nov. Next month is another ₹349.')
      })

      it('settles, like the usual Paid', () => {
        expect(isSettledView(kept(monthAfter))).toBe(true)
      })
    })

    it('leaves the next-month sentence out of Paid without next_billing_at or T', () => {
      expect(liveBillingWording({ state: 'paid', shop: 'open', plan, paidThrough, nextChargeAt: null, trialEndsAt: null }).card?.body)
        .toBe('You paid ₹399 via Razorpay. Shop stays open until 26 Oct.')
    })

    it('takes Stop the plan’s ₹ amount from the plan price', () => {
      expect(liveBillingWording({ state: 'paid', shop: 'open', plan: { ...plan, price: 349 }, paidThrough, nextChargeAt: null, trialEndsAt: null }).stopConfirmation)
        .toBe('Stop the plan? No more ₹349 is charged. Your shop stays open until 26 Oct, then customers cannot see it.')
    })

    const keepOpen = { label: 'Keep shop open · ₹399' }
    const keepOpenCheckout = {
      waiting: 'Confirming your payment…',
      failed: expect.any(Function),
      refused: 'Couldn’t start the payment right now. Your shop stays open until 26 Oct.',
    }

    it('words Stopped with the days until P, Keep shop open, the warning banner and the Keep open header', () => {
      expect(liveBillingWording({ state: 'stopped', shop: 'open', plan, paidThrough, daysLeft: 21 })).toEqual({
        card: {
          tone: 'warning', eyebrow: 'Plan stopped', figure: { days: 21 },
          body: 'You stopped the plan. Shop stays open until 26 Oct. Pay ₹399 with Razorpay if you want to keep it after that.',
          plan: 'Mithra Social Starter · ₹399 / month', sample: null, action: keepOpen, autoPay: null,
        },
        note: null, confirming: null, stopConfirmation: null, stopNote: null, checkout: keepOpenCheckout,
        banner: { tone: 'warning', lead: 'Shop stays open until 26 Oct', text: 'then customers cannot see it. You can pay again any time with Razorpay.', action: 'Keep open · ₹399' },
        header: 'Keep open · ₹399', badge: { tone: 'warning', text: 'Open until 26 Oct' },
      })
    })

    it('words AutoPay off as Stopped, true whoever turned AutoPay off, with Keep shop open', () => {
      expect(liveBillingWording({ state: 'autopay_off', shop: 'open', plan, paidThrough, daysLeft: 21 })).toEqual({
        card: {
          tone: 'warning', eyebrow: 'AutoPay off', figure: { days: 21 },
          body: 'AutoPay is off, so no more ₹399 is charged. Shop stays open until 26 Oct. Pay ₹399 with Razorpay if you want to keep it after that.',
          plan: 'Mithra Social Starter · ₹399 / month', sample: null, action: keepOpen, autoPay: null,
        },
        note: null, confirming: null, stopConfirmation: null, stopNote: null, checkout: keepOpenCheckout,
        banner: { tone: 'warning', lead: 'Shop stays open until 26 Oct', text: 'then customers cannot see it. You can pay again any time with Razorpay.', action: 'Keep open · ₹399' },
        header: 'Keep open · ₹399', badge: { tone: 'warning', text: 'Open until 26 Oct' },
      })
    })

    it.each([
      ['stopped', 'Plan stopped', 'You stopped the plan.'],
      ['autopay_off', 'AutoPay off', 'AutoPay is off, so no more ₹399 is charged.'],
    ] as const)('words %s while a payment is confirming with no Keep shop open, the confirming status and the Shop plan header', (state, eyebrow, reason) => {
      expect(liveBillingWording({ state, shop: 'open', plan, paidThrough, daysLeft: 21, confirming: true })).toEqual({
        card: {
          tone: 'warning', eyebrow, figure: { days: 21 }, body: `${reason} Shop stays open until 26 Oct.`,
          plan: 'Mithra Social Starter · ₹399 / month', sample: null, action: null, autoPay: null,
        },
        note: null, confirming: 'Confirming your payment…', stopConfirmation: null, stopNote: null, checkout: null,
        banner: { tone: 'warning', lead: 'Shop stays open until 26 Oct', text: 'your ₹399 payment is being confirmed.', action: 'Shop plan' },
        header: 'Shop plan', badge: { tone: 'warning', text: 'Open until 26 Oct' },
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
      expect(liveBillingWording({ state: 'paid', shop: 'open', plan: pricier, paidThrough, nextChargeAt: paidThrough, trialEndsAt: null }).card?.body)
        .toBe('You paid ₹349 via Razorpay. Shop stays open until 26 Oct. Next month is another ₹349.')
      const stopped = liveBillingWording({ state: 'stopped', shop: 'open', plan: pricier, paidThrough, daysLeft: 1 })
      expect(stopped.card?.body).toContain('Pay ₹349 with Razorpay')
      expect(stopped.banner?.action).toBe('Keep open · ₹349')
      expect(stopped.header).toBe('Keep open · ₹349')
      expect(stopped.card?.action).toEqual({ label: 'Keep shop open · ₹349' })
      expect(liveBillingWording({ state: 'stopped', shop: 'open', plan: pricier, paidThrough, daysLeft: 1, confirming: true }).banner?.text).toBe('your ₹349 payment is being confirmed.')
    })
  })

  describe('lapsed shops', () => {
    const hidden = { plan: 'Mithra Social Starter · ₹399 / month', sample: null, action: payNow, autoPay: null, tone: 'danger', figure: { headline: 'Shop is hidden' } }
    const closedBanner = { tone: 'danger', lead: 'Shop is hidden from customers', text: 'pay ₹399 with Razorpay to open it again.', action: 'Pay ₹399' }
    const closedBadge = { tone: 'danger', text: 'Shop closed' }

    it('words Payment failed with Pay ₹399, the danger banner and the Pay header', () => {
      expect(liveBillingWording({ state: 'payment_failed', shop: 'hidden', plan })).toEqual({
        card: { ...hidden, eyebrow: 'Payment failed', body: 'Customers cannot see your shop. Pay ₹399 with Razorpay to open it again. Old orders are still here.' },
        note: null, confirming: null, stopConfirmation: null, stopNote: null, checkout: payNowCheckout,
        banner: { tone: 'danger', lead: 'Shop is hidden from customers', text: 'last Razorpay payment did not go through. Pay ₹399 to open the shop again.', action: 'Pay ₹399' },
        header: 'Pay ₹399', badge: closedBadge,
      })
    })

    it('words Shop closed after paid days', () => {
      expect(liveBillingWording({ state: 'shop_closed', shop: 'hidden', plan, ended: 'paid_days' })).toEqual({
        card: { ...hidden, eyebrow: 'Shop closed', body: 'Paid days are over. Customers cannot see your shop. Pay ₹399 with Razorpay to open it again.' },
        note: null, confirming: null, stopConfirmation: null, stopNote: null, checkout: payNowCheckout, banner: closedBanner, header: 'Pay ₹399',
        badge: closedBadge,
      })
    })

    it('words Shop closed after free days', () => {
      expect(liveBillingWording({ state: 'shop_closed', shop: 'hidden', plan, ended: 'free_days' })).toEqual({
        card: { ...hidden, eyebrow: 'Shop closed', body: 'Free days are over. Customers cannot see your shop. Pay ₹399 with Razorpay to open it again.' },
        note: null, confirming: null, stopConfirmation: null, stopNote: null, checkout: payNowCheckout, banner: closedBanner, header: 'Pay ₹399',
        badge: closedBadge,
      })
    })

    it('words Confirming as the Shop closed card with no Pay sentence, the confirming status, its banner and the Shop plan header', () => {
      const confirming = 'Confirming your payment…'
      expect(liveBillingWording({ state: 'confirming', shop: 'hidden', plan, ended: 'free_days' })).toEqual({
        card: { ...hidden, action: null, eyebrow: 'Shop closed', body: 'Free days are over. Customers cannot see your shop.' },
        note: null, confirming, stopConfirmation: null, stopNote: null, checkout: null,
        banner: { tone: 'danger', lead: 'Shop is hidden from customers', text: 'your ₹399 payment is being confirmed.', action: 'Shop plan' },
        header: 'Shop plan', badge: closedBadge,
      })
      expect(liveBillingWording({ state: 'confirming', shop: 'hidden', plan, ended: 'paid_days' }).card?.body)
        .toBe('Paid days are over. Customers cannot see your shop.')
    })

    it('words Pay ₹399’s failed payment after Checkout closes, with no gap E message', () => {
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
      expect(confirming.confirming).toBe('Confirming your payment…')
      expect(confirming.banner?.text).toBe('your ₹349 payment is being confirmed.')
    })
  })

  it('gives a shop that is not live the note only, no banner and the Shop plan header', () => {
    expect(liveBillingWording({ state: 'not_live', plan })).toEqual({
      card: null, note: 'Free days start when your shop goes live.', confirming: null, stopConfirmation: null, stopNote: null, checkout: null, banner: null, header: 'Shop plan',
      badge: null,
    })
  })

  describe('the rail badge', () => {
    it('counts the free days left, singular at 1, red from 3 days left', () => {
      expect(liveBillingWording(freeDays(4)).badge).toEqual({ tone: 'neutral', text: '4 days left' })
      expect(liveBillingWording(freeDays(3, 'three_days_left')).badge).toEqual({ tone: 'danger', text: '3 days left' })
      expect(liveBillingWording(freeDays(1, 'three_days_left')).badge).toEqual({ tone: 'danger', text: '1 day left' })
    })

    it('follows the same rule while a payment is confirmed in free days', () => {
      const confirmingFreeDays = (daysLeft: number): LiveBillingView => ({ state: 'free_days_confirming', shop: 'open', plan, trialEndsAt, daysLeft })
      expect(liveBillingWording(confirmingFreeDays(4)).badge).toEqual({ tone: 'neutral', text: '4 days left' })
      expect(liveBillingWording(confirmingFreeDays(3)).badge).toEqual({ tone: 'danger', text: '3 days left' })
      expect(liveBillingWording(confirmingFreeDays(1)).badge).toEqual({ tone: 'danger', text: '1 day left' })
    })

    it('names the plan Social Starter while paid, whatever the plan is called', () => {
      const renamed = { ...plan, name: 'Social Starter Trial' }
      expect(liveBillingWording({ state: 'paid', shop: 'open', plan: renamed, paidThrough: trialEndsAt, nextChargeAt: null, trialEndsAt: null }).badge)
        .toEqual({ tone: 'neutral', text: 'Social Starter' })
      expect(liveBillingWording({ state: 'collecting', shop: 'open', plan: renamed }).badge).toEqual({ tone: 'neutral', text: 'Social Starter' })
    })
  })
})

describe('isSettledView', () => {
  const paidThrough = '2026-10-26T18:30:00.000Z'

  it.each<[string, LiveBillingView]>([
    ['Paid', { state: 'paid', shop: 'open', plan, paidThrough, nextChargeAt: paidThrough, trialEndsAt: null }],
    ['Collecting', { state: 'collecting', shop: 'open', plan }],
  ])('settles on %s, which is not Confirming and offers no Checkout action', (_, view) => {
    expect(isSettledView(view)).toBe(true)
  })

  it.each<[string, LiveBillingView]>([
    ['Free days, payment confirming (row 7)', { state: 'free_days_confirming', shop: 'open', plan, trialEndsAt, daysLeft: 13 }],
    ['Confirming (row 8)', { state: 'confirming', shop: 'hidden', plan, ended: 'free_days' }],
    ['Confirming (row 8b)', { state: 'confirming', shop: 'hidden', plan, ended: 'paid_days' }],
    ['Free days', freeDays(13)],
    ['3 days left', freeDays(3, 'three_days_left')],
    ['Payment failed', { state: 'payment_failed', shop: 'hidden', plan }],
    ['Shop closed', { state: 'shop_closed', shop: 'hidden', plan, ended: 'paid_days' }],
    ['Stopped', { state: 'stopped', shop: 'open', plan, paidThrough, daysLeft: 21 }],
    ['AutoPay off', { state: 'autopay_off', shop: 'open', plan, paidThrough, daysLeft: 21 }],
    ['Stopped while a payment is confirming', { state: 'stopped', shop: 'open', plan, paidThrough, daysLeft: 21, confirming: true }],
  ])('does not settle on %s', (_, view) => {
    expect(isSettledView(view)).toBe(false)
  })
})
