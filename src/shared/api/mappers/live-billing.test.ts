import { describe, expect, it } from 'vitest'
import { liveActivatedSubscription, liveMonthlyPlan, livePlans, liveTrialAutoPaySubscription, liveTrialSubscription } from '../fixtures/live-billing-wire'
import { LiveBillingUnreadableError, mapLiveBilling } from './live-billing'

const trialEnd = '2026-10-12T10:04:16.169Z'
const plan = { code: 'MITHRA_SOCIAL_STARTER_MONTHLY', name: 'Mithra Social Starter', price: 299 }
const subscription = (overrides: Record<string, unknown> = {}) =>
  ({ kind: 'subscription' as const, subscription: liveTrialSubscription(overrides) })
const autoPay = (overrides: Record<string, unknown> = {}) =>
  ({ kind: 'subscription' as const, subscription: liveTrialAutoPaySubscription(overrides) })
/** A moment `days` before the trial ends. */
const daysBeforeEnd = (days: number) => new Date(Date.parse(trialEnd) - days * 24 * 60 * 60 * 1000)

describe('mapLiveBilling', () => {
  describe('row 9: free days without AutoPay', () => {
    it('shows free days with the rounded-up count and the exact end', () => {
      expect(mapLiveBilling(subscription(), livePlans, daysBeforeEnd(12.5))).toEqual({
        state: 'free_days', shop: 'open', plan, trialEndsAt: trialEnd, daysLeft: 13,
      })
    })

    it('turns into 3 days left at a rounded-up count of 3, not 4', () => {
      expect(mapLiveBilling(subscription(), livePlans, daysBeforeEnd(3.5))).toMatchObject({ state: 'free_days', daysLeft: 4 })
      expect(mapLiveBilling(subscription(), livePlans, daysBeforeEnd(2.5))).toMatchObject({ state: 'three_days_left', daysLeft: 3 })
      expect(mapLiveBilling(subscription(), livePlans, daysBeforeEnd(0.01))).toMatchObject({ state: 'three_days_left', daysLeft: 1 })
    })

    it('stops matching at now = T', () => {
      expect(() => mapLiveBilling(subscription(), livePlans, new Date(trialEnd))).toThrow(LiveBillingUnreadableError)
    })

    it('lands the expected "Trial, AutoPay off" and "Trial, AutoPay turned off" responses on Free days', () => {
      const now = daysBeforeEnd(10)
      expect(mapLiveBilling(subscription({ razorpay_status: null }), livePlans, now).state).toBe('free_days')
      expect(mapLiveBilling(subscription({ razorpay_subscription_id: 'sub_FakeTrial0001', razorpay_status: 'cancelled' }), livePlans, now).state).toBe('free_days')
    })

    it('covers a pending checkout and a cancelled one during the free days', () => {
      const now = daysBeforeEnd(10)
      const pending = subscription({ status: 'PAYMENT_PENDING', razorpay_subscription_id: 'sub_FakeTrial0002', razorpay_status: 'created' })
      const cancelled = subscription({ status: 'CANCELLED', razorpay_subscription_id: 'sub_FakeTrial0003', razorpay_status: 'cancelled' })
      expect(mapLiveBilling(pending, livePlans, now).state).toBe('free_days')
      expect(mapLiveBilling(cancelled, livePlans, now).state).toBe('free_days')
    })

    it('ignores the backend days_remaining and display labels', () => {
      const labelled = subscription({ days_remaining: 0, display_status: 'Payment pending' })
      expect(mapLiveBilling(labelled, livePlans, daysBeforeEnd(0.5))).toMatchObject({ state: 'three_days_left', daysLeft: 1 })
    })
  })

  describe('row 7: free days with AutoPay on', () => {
    it('shows free days with the first ₹299 on next_billing_at', () => {
      const agreed = subscription({ razorpay_subscription_id: 'sub_FakeTrial0004', razorpay_status: 'authenticated', next_billing_at: '2026-10-13T10:04:16Z' })
      expect(mapLiveBilling(agreed, livePlans, daysBeforeEnd(12.5))).toEqual({
        state: 'autopay_on', shop: 'open', plan, trialEndsAt: trialEnd, daysLeft: 13, firstChargeAt: '2026-10-13T10:04:16.000Z',
      })
    })

    it('falls back to T for the first ₹299 without next_billing_at', () => {
      const agreed = subscription({ razorpay_subscription_id: 'sub_FakeTrial0004', razorpay_status: 'active' })
      expect(mapLiveBilling(agreed, livePlans, daysBeforeEnd(12.5))).toMatchObject({ state: 'autopay_on', firstChargeAt: trialEnd })
    })

    it('keeps AutoPay on with 3 days or fewer left', () => {
      expect(mapLiveBilling(autoPay(), livePlans, daysBeforeEnd(0.5))).toMatchObject({ state: 'autopay_on', daysLeft: 1 })
    })

    it('lands today’s gap C shape (PAYMENT_PENDING, authenticated, no next_billing_at) on AutoPay on, dated T', () => {
      expect(mapLiveBilling(autoPay(), livePlans, daysBeforeEnd(10))).toEqual({
        state: 'autopay_on', shop: 'open', plan, trialEndsAt: trialEnd, daysLeft: 10, firstChargeAt: trialEnd,
      })
    })

    it('lands the expected "Trial, AutoPay on" response on AutoPay on', () => {
      const expected = subscription({ razorpay_subscription_id: 'sub_FakeTrial0005', razorpay_status: 'authenticated', next_billing_at: trialEnd })
      expect(mapLiveBilling(expected, livePlans, daysBeforeEnd(10))).toMatchObject({ state: 'autopay_on', firstChargeAt: trialEnd })
    })
  })

  describe('Collecting', () => {
    const now = daysBeforeEnd(-1)

    it('row 2: collects a PAST_DUE renewal, the expected "Renewal being retried" response', () => {
      const retried = autoPay({
        status: 'PAST_DUE', razorpay_subscription_id: 'sub_FakeRenewal0001', razorpay_status: 'pending',
        current_period_start: '2026-09-12T10:04:16Z', current_period_end: '2026-10-11T18:30Z', next_billing_at: null,
      })
      expect(mapLiveBilling(retried, livePlans, now)).toEqual({ state: 'collecting', shop: 'open', plan })
    })

    it('row 3a: collects an ACTIVE subscription with no paid period, today’s gap B shape', () => {
      expect(mapLiveBilling({ kind: 'subscription', subscription: liveActivatedSubscription() }, livePlans, now))
        .toEqual({ state: 'collecting', shop: 'open', plan })
    })

    it('row 8: collects once free days end with AutoPay on and the trial kept', () => {
      const agreed = subscription({ razorpay_subscription_id: 'sub_FakeTrial0004', razorpay_status: 'authenticated', next_billing_at: trialEnd })
      expect(mapLiveBilling(agreed, livePlans, now)).toEqual({ state: 'collecting', shop: 'open', plan })
    })

    it('moves TRIAL_ACTIVE with AutoPay on from row 7 to row 8 at now = T', () => {
      const agreed = subscription({ razorpay_subscription_id: 'sub_FakeTrial0004', razorpay_status: 'authenticated' })
      expect(mapLiveBilling(agreed, livePlans, new Date(Date.parse(trialEnd) - 1)).state).toBe('autopay_on')
      expect(mapLiveBilling(agreed, livePlans, new Date(trialEnd)).state).toBe('collecting')
    })

    it('leaves PAYMENT_PENDING with AutoPay on after T to row 8b, not Collecting', () => {
      expect(() => mapLiveBilling(autoPay(), livePlans, new Date(trialEnd))).toThrow(LiveBillingUnreadableError)
    })
  })

  it('shows the not-live note for a 404', () => {
    expect(mapLiveBilling({ kind: 'not-live' }, livePlans, daysBeforeEnd(10))).toEqual({ state: 'not_live', plan })
  })

  it('takes the read error path for a response that matches no row', () => {
    const now = daysBeforeEnd(10)
    expect(() => mapLiveBilling(subscription({ status: 'SOMETHING_NEW' }), livePlans, now)).toThrow(LiveBillingUnreadableError)
    expect(() => mapLiveBilling(subscription({ trial_ends_at: null }), livePlans, now)).toThrow(LiveBillingUnreadableError)
    expect(() => mapLiveBilling({ kind: 'subscription', subscription: null }, livePlans, now)).toThrow(LiveBillingUnreadableError)
  })

  describe('the plan', () => {
    const yearly = { ...liveMonthlyPlan, plan_id: 3, plan_code: 'MITHRA_SOCIAL_STARTER_YEARLY', plan_name: 'Mithra Social Starter (Yearly)', billing_cycle: 'YEARLY', sale_price: 2999 }

    it('chooses the monthly entry among several', () => {
      expect(mapLiveBilling({ kind: 'not-live' }, [yearly, liveMonthlyPlan], daysBeforeEnd(10))).toEqual({ state: 'not_live', plan })
    })

    it('takes the read error path without a monthly entry', () => {
      expect(() => mapLiveBilling({ kind: 'not-live' }, [yearly], daysBeforeEnd(10))).toThrow(LiveBillingUnreadableError)
      expect(() => mapLiveBilling(subscription(), [], daysBeforeEnd(10))).toThrow(LiveBillingUnreadableError)
      expect(() => mapLiveBilling(subscription(), null, daysBeforeEnd(10))).toThrow(LiveBillingUnreadableError)
    })

    it('reads sale_price in rupees', () => {
      const plans = [{ ...liveMonthlyPlan, sale_price: 349 }]
      expect(mapLiveBilling({ kind: 'not-live' }, plans, daysBeforeEnd(10))).toMatchObject({ plan: { price: 349 } })
    })
  })

  describe('timestamps', () => {
    const now = daysBeforeEnd(10)
    const trialEndsAt = (value: string) => mapLiveBilling(subscription({ trial_ends_at: value }), livePlans, now)

    it('accepts one without seconds', () => {
      expect(trialEndsAt('2026-10-12T10:04Z')).toMatchObject({ trialEndsAt: '2026-10-12T10:04:00.000Z' })
    })

    it('accepts fractions of any length', () => {
      expect(trialEndsAt('2026-10-12T10:04:16.169028Z')).toMatchObject({ trialEndsAt: trialEnd })
      expect(trialEndsAt('2026-10-12T10:04:16.1Z')).toMatchObject({ trialEndsAt: '2026-10-12T10:04:16.100Z' })
    })

    it('accepts an offset', () => {
      expect(trialEndsAt('2026-10-12T15:34:16+05:30')).toMatchObject({ trialEndsAt: '2026-10-12T10:04:16.000Z' })
      expect(trialEndsAt('2026-10-12T15:34:16+0530')).toMatchObject({ trialEndsAt: '2026-10-12T10:04:16.000Z' })
      expect(trialEndsAt('2026-10-12T05:34:16-04:30')).toMatchObject({ trialEndsAt: '2026-10-12T10:04:16.000Z' })
    })

    it('rejects one without a timezone', () => {
      expect(() => trialEndsAt('2026-10-12T10:04:16.169028')).toThrow(LiveBillingUnreadableError)
      expect(() => trialEndsAt('2026-10-12 10:04:16Z')).toThrow(LiveBillingUnreadableError)
    })
  })
})
