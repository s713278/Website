import { describe, expect, it } from 'vitest'
import type { LiveBillingView } from '@/shared/api'
import { liveBillingWording } from './live-billing-wording'

const plan = { code: 'MITHRA_SOCIAL_STARTER_MONTHLY', name: 'Mithra Social Starter', price: 299 }
/** 3:34 pm on 12 Oct in IST. */
const trialEndsAt = '2026-10-12T10:04:16.169Z'
const freeDays = (daysLeft: number, state: 'free_days' | 'three_days_left' = 'free_days'): LiveBillingView =>
  ({ state, shop: 'open', plan, trialEndsAt, daysLeft })

describe('liveBillingWording', () => {
  it('words Free days with the exact end in IST', () => {
    expect(liveBillingWording(freeDays(13))).toEqual({
      card: {
        tone: 'neutral', eyebrow: 'Free days', figure: { days: 13 },
        body: 'Your shop is live free until 12 Oct, 3:34 pm. After that, subscribe with Razorpay — ₹299 each month — to keep it open.',
        plan: 'Mithra Social Starter · ₹299 / month', sample: null, action: null, autoPay: null,
      },
      note: null,
      banner: { tone: 'neutral', lead: '13 free days left', text: 'after that, subscribe with Razorpay (₹299 / month) to keep the shop open.', action: 'Pay ₹299' },
      header: 'Pay ₹299',
    })
  })

  it('words 3 days left in the danger tone, still with the exact end', () => {
    expect(liveBillingWording(freeDays(3, 'three_days_left'))).toEqual({
      card: {
        tone: 'danger', eyebrow: 'Free days', figure: { days: 3 },
        body: 'Set up AutoPay now so customers can still open your shop when free days end. Free days end on 12 Oct, 3:34 pm.',
        plan: 'Mithra Social Starter · ₹299 / month', sample: null, action: null, autoPay: null,
      },
      note: null,
      banner: { tone: 'danger', lead: '3 free days left', text: 'set up AutoPay now so customers can still open your shop when free days end.', action: 'Pay ₹299' },
      header: 'Pay ₹299',
    })
  })

  it('says "day" for the last free day', () => {
    expect(liveBillingWording(freeDays(1, 'three_days_left')).banner?.lead).toBe('1 free day left')
  })

  it('takes every ₹ amount from the plan price', () => {
    const wording = liveBillingWording({ ...freeDays(13), plan: { ...plan, price: 349 } })
    expect(wording.card?.body).toContain('₹349 each month')
    expect(wording.card?.plan).toBe('Mithra Social Starter · ₹349 / month')
    expect(wording.banner).toMatchObject({ text: 'after that, subscribe with Razorpay (₹349 / month) to keep the shop open.', action: 'Pay ₹349' })
    expect(wording.header).toBe('Pay ₹349')
  })

  it('gives a shop that is not live the note only, no banner and the Shop plan header', () => {
    expect(liveBillingWording({ state: 'not_live', plan })).toEqual({
      card: null, note: 'Free days start when your shop goes live.', banner: null, header: 'Shop plan',
    })
  })
})
