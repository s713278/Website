import { describe, expect, it } from 'vitest'
import {
  liveActivatedSubscription, liveCancelledPaidSubscription, liveEarlyFeePaidSubscription, liveEarlyFeeSubscription, liveHaltedSubscription, liveHistoryEvent, liveMonthlyPlan, liveStoppedHistory, livePaidSubscription, livePayingAfterTrialSubscription, livePlans,
  liveStoppedSubscription, liveSubscribeResponse, liveTrialAutoPaySubscription, liveTrialSubscription,
} from '../fixtures/live-billing-wire'
import {
  LiveBillingUnreadableError, confirmingLiveBilling, mapLiveBilling, mapLiveBillingHistory, mapLiveCheckout, mapLiveLatestPayment, mapLivePlanName, mapLiveTrialEnd, mapLiveTrialStart,
  type LiveBillingView,
} from './live-billing'

const trialEnd = '2026-10-12T10:04:16.169Z'
const plan = { code: 'MITHRA_SOCIAL_STARTER_MONTHLY', name: 'Mithra Social Starter', price: 299 }
const subscription = (overrides: Record<string, unknown> = {}) =>
  ({ kind: 'subscription' as const, subscription: liveTrialSubscription(overrides) })
const autoPay = (overrides: Record<string, unknown> = {}) =>
  ({ kind: 'subscription' as const, subscription: liveTrialAutoPaySubscription(overrides) })
/** Gap K's requested read after Pay ₹299 with Razorpay during free days. */
const early = (overrides: Record<string, unknown> = {}) =>
  ({ kind: 'subscription' as const, subscription: liveEarlyFeeSubscription(overrides) })
/** Gap K's requested read once the early first fee is captured. */
const earlyPaid = (overrides: Record<string, unknown> = {}) =>
  ({ kind: 'subscription' as const, subscription: liveEarlyFeePaidSubscription(overrides) })
/** Row 3's free-days-kept variant for `earlyPaid()`: the paid month runs from T to one month later. */
const monthAfterTrialEnd = '2026-11-12T10:04:16.169Z'
const paidFreeDaysKept = { state: 'paid', shop: 'open', plan, paidThrough: monthAfterTrialEnd, nextChargeAt: monthAfterTrialEnd, trialEndsAt: trialEnd }
/** Row 7: free days while the payment is confirmed. */
const confirmingFreeDays = (daysLeft: number) => ({ state: 'free_days_confirming', shop: 'open', plan, trialEndsAt: trialEnd, daysLeft })
/** Row 8: free days over while the payment is confirmed. */
const confirmingAfterFreeDays = { state: 'confirming', shop: 'hidden', plan, ended: 'free_days' }
/** A moment `days` before the trial ends. */
const daysBeforeEnd = (days: number) => new Date(Date.parse(trialEnd) - days * 24 * 60 * 60 * 1000)

describe('mapLiveBilling', () => {
  describe('row 9: free days without AutoPay', () => {
    it('shows free days with the rounded-up count, the exact end and the free days’ length', () => {
      expect(mapLiveBilling(subscription(), livePlans, daysBeforeEnd(12.5))).toEqual({
        state: 'free_days', shop: 'open', plan, trialEndsAt: trialEnd, daysLeft: 13, trialDays: 14,
      })
    })

    it('counts the free days’ length from trial_started_at to T in whole days, rounded, at least 1', () => {
      const started = (daysBefore: number) => subscription({ trial_started_at: daysBeforeEnd(daysBefore).toISOString() })
      expect(mapLiveBilling(started(6.6), livePlans, daysBeforeEnd(2.5))).toMatchObject({ state: 'three_days_left', trialDays: 7 })
      expect(mapLiveBilling(started(6.4), livePlans, daysBeforeEnd(2.5))).toMatchObject({ trialDays: 6 })
      expect(mapLiveBilling(started(1), livePlans, daysBeforeEnd(0.5))).toMatchObject({ trialDays: 1 })
      expect(mapLiveBilling(started(0.2), livePlans, daysBeforeEnd(0.1))).toMatchObject({ trialDays: 1 })
    })

    it('leaves the free days’ length null without a readable trial_started_at, still Free days', () => {
      for (const trialStartedAt of [null, undefined, '28 Sep']) {
        expect(mapLiveBilling(subscription({ trial_started_at: trialStartedAt }), livePlans, daysBeforeEnd(12.5)))
          .toMatchObject({ state: 'free_days', daysLeft: 13, trialDays: null })
      }
    })

    it('turns into 3 days left at a rounded-up count of 3, not 4', () => {
      expect(mapLiveBilling(subscription(), livePlans, daysBeforeEnd(3.5))).toMatchObject({ state: 'free_days', daysLeft: 4 })
      expect(mapLiveBilling(subscription(), livePlans, daysBeforeEnd(2.5))).toMatchObject({ state: 'three_days_left', daysLeft: 3 })
      expect(mapLiveBilling(subscription(), livePlans, daysBeforeEnd(0.01))).toMatchObject({ state: 'three_days_left', daysLeft: 1 })
    })

    it('turns into Shop closed, free days over (row 10) at now = T', () => {
      expect(mapLiveBilling(subscription(), livePlans, new Date(Date.parse(trialEnd) - 1)).state).toBe('three_days_left')
      expect(mapLiveBilling(subscription(), livePlans, new Date(trialEnd))).toEqual({ state: 'shop_closed', shop: 'hidden', plan, ended: 'free_days' })
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

    it('reads absent fields as null, since dev leaves null fields out of the row', () => {
      const { current_period_start, current_period_end, next_billing_at, ...sparse } = liveTrialSubscription({
        status: 'PAYMENT_PENDING', razorpay_subscription_id: 'sub_FakeTrial0005', razorpay_status: 'created',
      })
      expect([current_period_start, current_period_end, next_billing_at]).toEqual([null, null, null])
      const read = { kind: 'subscription' as const, subscription: sparse }
      expect(mapLiveBilling(read, livePlans, daysBeforeEnd(0.5))).toMatchObject({ state: 'three_days_left', daysLeft: 1 })
      expect(mapLiveBilling(read, livePlans, new Date(trialEnd))).toEqual({ state: 'shop_closed', shop: 'hidden', plan, ended: 'free_days' })
    })

    it('ignores the backend days_remaining and display labels', () => {
      const labelled = subscription({ days_remaining: 0, display_status: 'Payment pending' })
      expect(mapLiveBilling(labelled, livePlans, daysBeforeEnd(0.5))).toMatchObject({ state: 'three_days_left', daysLeft: 1 })
    })
  })

  describe('row 7: free days while the payment is confirmed', () => {
    it('shows free days, neutral at every count, for a trial status with AutoPay agreed and no P', () => {
      const agreed = subscription({ razorpay_subscription_id: 'sub_FakeTrial0004', razorpay_status: 'authenticated' })
      expect(mapLiveBilling(agreed, livePlans, daysBeforeEnd(12.5))).toEqual(confirmingFreeDays(13))
      expect(mapLiveBilling(agreed, livePlans, daysBeforeEnd(0.5))).toEqual(confirmingFreeDays(1))
      expect(mapLiveBilling(subscription({ razorpay_subscription_id: 'sub_FakeTrial0004', razorpay_status: 'active' }), livePlans, daysBeforeEnd(2.5)))
        .toEqual(confirmingFreeDays(3))
    })

    it('moves to row 8 at now = T', () => {
      expect(mapLiveBilling(autoPay(), livePlans, new Date(Date.parse(trialEnd) - 1)).state).toBe('free_days_confirming')
      expect(mapLiveBilling(autoPay(), livePlans, new Date(trialEnd))).toEqual(confirmingAfterFreeDays)
    })
  })

  describe('row 8: free days over while the payment is confirmed', () => {
    it('closes the shop with Confirming for each trial status with AutoPay agreed and no P', () => {
      for (const status of ['TRIAL_ACTIVE', 'TRIAL_EXPIRED', 'PAYMENT_PENDING']) {
        expect(mapLiveBilling(autoPay({ status }), livePlans, daysBeforeEnd(-0.5))).toEqual(confirmingAfterFreeDays)
      }
    })
  })

  describe('gap K: Pay ₹299 with Razorpay during free days', () => {
    it('today’s shape (PAYMENT_PENDING, authenticated, no P) reads row 7 before T and row 8 after', () => {
      expect(mapLiveBilling(autoPay(), livePlans, daysBeforeEnd(10))).toEqual(confirmingFreeDays(10))
      expect(mapLiveBilling(autoPay(), livePlans, daysBeforeEnd(-0.5))).toEqual(confirmingAfterFreeDays)
    })

    it('the fixed shape: subscribed with Checkout closed unpaid still reads Free days (row 9)', () => {
      expect(mapLiveBilling(early(), livePlans, daysBeforeEnd(10))).toMatchObject({ state: 'free_days', daysLeft: 10 })
    })

    it('the fixed shape: ₹299 paid, not yet recorded, reads row 9, then row 7 once AutoPay reads agreed', () => {
      expect(mapLiveBilling(early(), livePlans, daysBeforeEnd(2.5)).state).toBe('three_days_left')
      expect(mapLiveBilling(early({ razorpay_status: 'authenticated' }), livePlans, daysBeforeEnd(2.5)))
        .toEqual(confirmingFreeDays(3))
    })

    it('the fixed shape: still unrecorded at T reads row 8', () => {
      expect(mapLiveBilling(early({ razorpay_status: 'authenticated' }), livePlans, new Date(trialEnd)))
        .toEqual(confirmingAfterFreeDays)
    })

    it('the fixed shape: ₹299 captured reads Paid with the free days kept', () => {
      expect(mapLiveBilling(earlyPaid(), livePlans, daysBeforeEnd(10))).toEqual(paidFreeDaysKept)
    })

    it('today’s chain: row 7, then row 8 at T, then Collecting (3a), then Paid', () => {
      const reads = [
        [autoPay(), daysBeforeEnd(10)],
        [autoPay(), new Date(trialEnd)],
        [{ kind: 'subscription' as const, subscription: liveActivatedSubscription() }, new Date('2026-10-13T10:04:30Z')],
        [{ kind: 'subscription' as const, subscription: livePaidSubscription() }, new Date('2026-10-13T10:10:30Z')],
      ] as const
      expect(reads.map(([read, at]) => mapLiveBilling(read, livePlans, at).state))
        .toEqual(['free_days_confirming', 'confirming', 'collecting', 'paid'])
      expect(mapLiveBilling(reads[3][0], livePlans, reads[3][1])).toMatchObject({ trialEndsAt: null })
    })

    it('the fixed chain: Free days, then row 7, then Paid with the free days kept, then the usual Paid after T', () => {
      expect(mapLiveBilling(early(), livePlans, daysBeforeEnd(10)).state).toBe('free_days')
      expect(mapLiveBilling(early({ razorpay_status: 'authenticated' }), livePlans, daysBeforeEnd(10))).toEqual(confirmingFreeDays(10))
      expect(mapLiveBilling(earlyPaid(), livePlans, daysBeforeEnd(10))).toEqual(paidFreeDaysKept)
      expect(mapLiveBilling(earlyPaid(), livePlans, new Date(trialEnd))).toEqual({ ...paidFreeDaysKept, trialEndsAt: null })
    })
  })

  describe('row 3: Paid with the free days kept', () => {
    it('carries T while the free days last, and none from now = T', () => {
      expect(mapLiveBilling(earlyPaid(), livePlans, new Date(Date.parse(trialEnd) - 1))).toEqual(paidFreeDaysKept)
      expect(mapLiveBilling(earlyPaid(), livePlans, new Date(trialEnd))).toMatchObject({ state: 'paid', trialEndsAt: null })
    })

    it('is the usual Paid without trial_ends_at', () => {
      for (const trialEndsAt of [null, undefined]) {
        expect(mapLiveBilling(earlyPaid({ trial_ends_at: trialEndsAt }), livePlans, daysBeforeEnd(10))).toMatchObject({ state: 'paid', trialEndsAt: null })
      }
    })

    it('keeps next_billing_at as sent, which the wording does not use for the next ₹299 (gap D)', () => {
      expect(mapLiveBilling(earlyPaid({ next_billing_at: '2026-11-13T10:04:16Z' }), livePlans, daysBeforeEnd(10)))
        .toEqual({ ...paidFreeDaysKept, nextChargeAt: '2026-11-13T10:04:16.000Z' })
      expect(mapLiveBilling(earlyPaid({ next_billing_at: null }), livePlans, daysBeforeEnd(10)))
        .toEqual({ ...paidFreeDaysKept, nextChargeAt: null })
    })
  })

  describe('gap C: rows 9, 7 and 8 with TRIAL_ACTIVE and with PAYMENT_PENDING', () => {
    for (const status of ['TRIAL_ACTIVE', 'PAYMENT_PENDING']) {
      it(status, () => {
        expect(mapLiveBilling(early({ status }), livePlans, daysBeforeEnd(10)).state).toBe('free_days')
        expect(mapLiveBilling(early({ status, razorpay_status: 'authenticated' }), livePlans, daysBeforeEnd(10)).state).toBe('free_days_confirming')
        expect(mapLiveBilling(early({ status, razorpay_status: 'authenticated' }), livePlans, daysBeforeEnd(-0.5)).state).toBe('confirming')
      })
    }
  })

  describe('gap J: rows 8 and 10 with TRIAL_ACTIVE after T and with TRIAL_EXPIRED', () => {
    for (const status of ['TRIAL_ACTIVE', 'TRIAL_EXPIRED']) {
      it(status, () => {
        expect(mapLiveBilling(early({ status, razorpay_status: 'authenticated' }), livePlans, daysBeforeEnd(-0.5)))
          .toEqual(confirmingAfterFreeDays)
        expect(mapLiveBilling(early({ status }), livePlans, daysBeforeEnd(-0.5)))
          .toEqual({ state: 'shop_closed', shop: 'hidden', plan, ended: 'free_days' })
      })
    }
  })

  describe('unseen trial combinations take the read error path', () => {
    const periodEnd = '2026-11-12T18:30Z'

    it('a trial status with AutoPay agreed and P ahead', () => {
      for (const status of ['TRIAL_ACTIVE', 'TRIAL_EXPIRED', 'PAYMENT_PENDING']) {
        const withPeriod = autoPay({ status, current_period_end: periodEnd })
        expect(() => mapLiveBilling(withPeriod, livePlans, daysBeforeEnd(10))).toThrow(LiveBillingUnreadableError)
        expect(() => mapLiveBilling(withPeriod, livePlans, daysBeforeEnd(-0.5))).toThrow(LiveBillingUnreadableError)
      }
    })

    it('a trial status with AutoPay agreed and P past, other than row 8b', () => {
      const pastPeriod = '2026-10-01T18:30Z'
      for (const status of ['TRIAL_ACTIVE', 'TRIAL_EXPIRED']) {
        expect(() => mapLiveBilling(autoPay({ status, current_period_end: pastPeriod }), livePlans, daysBeforeEnd(-0.5))).toThrow(LiveBillingUnreadableError)
      }
      // Row 8b needs now ≥ T as well.
      expect(() => mapLiveBilling(autoPay({ current_period_end: pastPeriod }), livePlans, daysBeforeEnd(5))).toThrow(LiveBillingUnreadableError)
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
  })

  describe('rows 3–6′: a paid period', () => {
    const periodEnd = '2026-11-12T18:30:00.000Z'
    const paid = (overrides: Record<string, unknown> = {}) => ({ kind: 'subscription' as const, subscription: livePaidSubscription(overrides) })
    const stopped = (overrides: Record<string, unknown> = {}) => ({ kind: 'subscription' as const, subscription: liveStoppedSubscription(overrides) })
    /** A moment `days` before the paid period ends. */
    const daysBeforePeriodEnd = (days: number) => new Date(Date.parse(periodEnd) - days * 24 * 60 * 60 * 1000)
    const now = daysBeforePeriodEnd(20.5)

    it('row 3: shows Paid, the expected "Paid" response, with the paid period and next_billing_at', () => {
      expect(mapLiveBilling(paid(), livePlans, now)).toEqual({
        state: 'paid', shop: 'open', plan, paidThrough: periodEnd, nextChargeAt: periodEnd, trialEndsAt: null,
      })
    })

    it('row 3: leaves the next charge out when next_billing_at is missing', () => {
      expect(mapLiveBilling(paid({ next_billing_at: null }), livePlans, now)).toMatchObject({ state: 'paid', nextChargeAt: null })
    })

    it('row 3: lands the expected "AutoPay back on before the period ends" response on Paid', () => {
      const rejoined = paid({ razorpay_subscription_id: 'sub_FakeRejoin0001', razorpay_status: 'authenticated' })
      expect(mapLiveBilling(rejoined, livePlans, now)).toMatchObject({ state: 'paid', paidThrough: periodEnd, nextChargeAt: periodEnd })
    })

    it('row 4: shows Stopped with the rounded-up days until P, the expected "AutoPay turned off while paid" response', () => {
      expect(mapLiveBilling(stopped({ next_billing_at: null }), livePlans, now)).toEqual({
        state: 'stopped', shop: 'open', plan, paidThrough: periodEnd, daysLeft: 21,
      })
    })

    it('row 4, gap F: ignores next_billing_at while cancel_at_period_end is true', () => {
      const view = mapLiveBilling(stopped(), livePlans, now)
      expect(view).toEqual({ state: 'stopped', shop: 'open', plan, paidThrough: periodEnd, daysLeft: 21 })
      expect(view).not.toHaveProperty('nextChargeAt')
    })

    it('row 5, gap H: keeps today’s CANCELLED shape open until P as AutoPay off, ignoring next_billing_at', () => {
      expect(mapLiveBilling({ kind: 'subscription', subscription: liveCancelledPaidSubscription() }, livePlans, now)).toEqual({
        state: 'autopay_off', shop: 'open', plan, paidThrough: periodEnd, daysLeft: 21,
      })
    })

    it('row 5: keeps a CANCELLED or EXPIRED shop open until P as AutoPay off', () => {
      for (const status of ['CANCELLED', 'EXPIRED']) {
        expect(mapLiveBilling(paid({ status, razorpay_status: 'cancelled', next_billing_at: null }), livePlans, now)).toEqual({
          state: 'autopay_off', shop: 'open', plan, paidThrough: periodEnd, daysLeft: 21,
        })
      }
    })

    it('row 5: shows AutoPay off for ACTIVE with Razorpay cancelled, the expected "AutoPay stopped by the bank or at Razorpay" response', () => {
      expect(mapLiveBilling(paid({ razorpay_status: 'cancelled', next_billing_at: null }), livePlans, now)).toEqual({
        state: 'autopay_off', shop: 'open', plan, paidThrough: periodEnd, daysLeft: 21,
      })
    })

    describe('gap A: stopping the plan', () => {
      it('the fixed shape (ACTIVE, cancel_at_period_end true, P kept) shows Stopped', () => {
        expect(mapLiveBilling(stopped({ next_billing_at: null }), livePlans, now)).toEqual({
          state: 'stopped', shop: 'open', plan, paidThrough: periodEnd, daysLeft: 21,
        })
      })

      it('a backend that reports the vendor’s own stop as CANCELLED with P ahead shows AutoPay off', () => {
        for (const cancelAtPeriodEnd of [false, true]) {
          const cancelledAtOnce = paid({ status: 'CANCELLED', razorpay_status: 'cancelled', cancel_at_period_end: cancelAtPeriodEnd, cancelled_at: '2026-10-14T08:21:47.90412Z' })
          expect(mapLiveBilling(cancelledAtOnce, livePlans, now)).toEqual({
            state: 'autopay_off', shop: 'open', plan, paidThrough: periodEnd, daysLeft: 21,
          })
        }
      })
    })

    it('gap E, the fixed shape: keeps the stopped read until the ₹299 is captured, then Paid for another month', () => {
      expect(mapLiveBilling(stopped(), livePlans, now).state).toBe('stopped')
      expect(mapLiveBilling({ kind: 'subscription', subscription: liveCancelledPaidSubscription() }, livePlans, now).state).toBe('autopay_off')
      const kept = paid({
        razorpay_subscription_id: 'sub_FakeKeepOpen0002', current_period_start: '2026-11-12T18:30Z', current_period_end: '2026-12-12T18:30Z', next_billing_at: '2026-12-12T18:30Z',
      })
      const nextPeriodEnd = '2026-12-12T18:30:00.000Z'
      expect(mapLiveBilling(kept, livePlans, now)).toEqual({ state: 'paid', shop: 'open', plan, paidThrough: nextPeriodEnd, nextChargeAt: nextPeriodEnd, trialEndsAt: null })
    })

    describe('row 6: a renewal is being collected', () => {
      const collecting = { state: 'collecting', shop: 'open', plan }

      it('moves Paid to Collecting, not Shop closed, at now = P', () => {
        expect(mapLiveBilling(paid(), livePlans, new Date(Date.parse(periodEnd) - 1)).state).toBe('paid')
        expect(mapLiveBilling(paid(), livePlans, new Date(periodEnd))).toEqual(collecting)
        expect(mapLiveBilling(paid(), livePlans, new Date('2026-11-20T10:00:00Z'))).toEqual(collecting)
      })

      it('gap D, today’s shape: shows next_billing_at as sent, then Collecting from P until the renewal lands', () => {
        // Measured on 28 Sep: the first charge a day after T, a period ending at IST midnight, and
        // the next ₹299 at P.
        expect(mapLiveBilling(paid(), livePlans, now)).toMatchObject({ state: 'paid', nextChargeAt: periodEnd })
        // A charge date after P, as the 24-hour offset gave, is shown as sent, not replaced by P.
        expect(mapLiveBilling(paid({ next_billing_at: '2026-11-13T18:30Z' }), livePlans, now))
          .toMatchObject({ state: 'paid', paidThrough: periodEnd, nextChargeAt: '2026-11-13T18:30:00.000Z' })
        expect(mapLiveBilling(paid(), livePlans, new Date(Date.parse(periodEnd) + 6 * 60 * 1000))).toEqual(collecting)
        const renewed = paid({
          current_period_start: periodEnd, current_period_end: '2026-12-12T18:30Z', next_billing_at: '2026-12-12T18:30Z', updated_at: '2026-11-12T18:36:12.40117Z',
        })
        expect(mapLiveBilling(renewed, livePlans, new Date(Date.parse(periodEnd) + 7 * 60 * 1000)))
          .toMatchObject({ state: 'paid', paidThrough: '2026-12-12T18:30:00.000Z' })
      })

      it('gap D, the fixed shape: the next ₹299 exactly at P, then Collecting from P until the renewal lands', () => {
        const freeDaysEnd = '2026-10-12T10:04:16.169Z'
        const monthAfter = '2026-11-12T10:04:16.169Z'
        const early = paid({ current_period_start: freeDaysEnd, current_period_end: monthAfter, next_billing_at: monthAfter })
        expect(mapLiveBilling(early, livePlans, new Date('2026-10-20T10:00:00Z')))
          .toEqual({ state: 'paid', shop: 'open', plan, paidThrough: monthAfter, nextChargeAt: monthAfter, trialEndsAt: null })
        expect(mapLiveBilling(early, livePlans, new Date(monthAfter))).toEqual(collecting)
        expect(mapLiveBilling(early, livePlans, new Date(Date.parse(monthAfter) + 60 * 60 * 1000))).toEqual(collecting)
      })
    })

    describe('row 6′: a stopped plan or AutoPay off at now ≥ P', () => {
      const later = new Date('2026-11-20T10:00:00Z')
      const closed = { state: 'shop_closed', shop: 'hidden', plan, ended: 'paid_days' }

      it('closes the shop from row 4’s facts', () => {
        expect(mapLiveBilling(stopped(), livePlans, new Date(Date.parse(periodEnd) - 1)).state).toBe('stopped')
        expect(mapLiveBilling(stopped(), livePlans, new Date(periodEnd))).toEqual(closed)
        expect(mapLiveBilling(stopped(), livePlans, later)).toEqual(closed)
      })

      it('closes the shop from row 5’s facts', () => {
        expect(mapLiveBilling({ kind: 'subscription', subscription: liveCancelledPaidSubscription() }, livePlans, new Date(periodEnd))).toEqual(closed)
        expect(mapLiveBilling({ kind: 'subscription', subscription: liveCancelledPaidSubscription() }, livePlans, later)).toEqual(closed)
        expect(mapLiveBilling(paid({ status: 'EXPIRED', razorpay_status: 'cancelled', next_billing_at: null }), livePlans, later)).toEqual(closed)
        expect(mapLiveBilling(paid({ razorpay_status: 'cancelled', next_billing_at: null }), livePlans, new Date(periodEnd))).toEqual(closed)
      })

      it('lands the expected "Paid period over, no AutoPay" response on Shop closed, paid days over', () => {
        for (const cancelAtPeriodEnd of [true, false]) {
          const over = paid({ status: 'CANCELLED', razorpay_status: 'cancelled', next_billing_at: null, cancel_at_period_end: cancelAtPeriodEnd })
          expect(mapLiveBilling(over, livePlans, later)).toEqual(closed)
        }
      })
    })

    it('counts one day left in the last day before P', () => {
      expect(mapLiveBilling(stopped(), livePlans, daysBeforePeriodEnd(0.01))).toMatchObject({ state: 'stopped', daysLeft: 1 })
    })
  })

  describe('lapsed shops', () => {
    const periodEnd = '2026-11-12T18:30:00.000Z'
    const afterPeriod = new Date('2026-11-20T10:00:00Z')
    const afterTrial = daysBeforeEnd(-0.5)

    it('row 1: shows Payment failed for HALTED, the expected "Renewal failed" response', () => {
      expect(mapLiveBilling({ kind: 'subscription', subscription: liveHaltedSubscription() }, livePlans, afterPeriod))
        .toEqual({ state: 'payment_failed', shop: 'hidden', plan })
    })

    it('row 1: HALTED alone decides, even before P', () => {
      expect(mapLiveBilling({ kind: 'subscription', subscription: liveHaltedSubscription() }, livePlans, new Date(Date.parse(periodEnd) - 1)))
        .toMatchObject({ state: 'payment_failed' })
    })

    describe('row 8b: Confirming', () => {
      it('confirms in paid wording with P, such as a payment after a halt', () => {
        const payingAgain = liveHaltedSubscription({ status: 'PAYMENT_PENDING', razorpay_subscription_id: 'sub_FakePayAgain0001', razorpay_status: 'authenticated' })
        expect(mapLiveBilling({ kind: 'subscription', subscription: payingAgain }, livePlans, afterPeriod))
          .toEqual({ state: 'confirming', shop: 'hidden', plan, ended: 'paid_days' })
        expect(mapLiveBilling({ kind: 'subscription', subscription: { ...payingAgain, razorpay_status: 'active' } }, livePlans, afterPeriod))
          .toMatchObject({ state: 'confirming', ended: 'paid_days' })
      })

      it('takes the read error path while P is still ahead, rather than call an open shop closed', () => {
        const keepingOpen = livePaidSubscription({ status: 'PAYMENT_PENDING', razorpay_subscription_id: 'sub_FakeKeepOpen0001', razorpay_status: 'authenticated' })
        expect(() => mapLiveBilling({ kind: 'subscription', subscription: keepingOpen }, livePlans, new Date('2026-10-22T18:30:00Z')))
          .toThrow(LiveBillingUnreadableError)
      })
    })

    describe('row 10: Shop closed, free days over', () => {
      const closed = { state: 'shop_closed', shop: 'hidden', plan, ended: 'free_days' }

      it('closes the shop for TRIAL_EXPIRED, the expected "Trial ended, not paid" response', () => {
        expect(mapLiveBilling(subscription({ status: 'TRIAL_EXPIRED' }), livePlans, afterTrial)).toEqual(closed)
        const cancelled = subscription({ status: 'TRIAL_EXPIRED', razorpay_subscription_id: 'sub_FakeTrial0006', razorpay_status: 'cancelled' })
        expect(mapLiveBilling(cancelled, livePlans, afterTrial)).toEqual(closed)
      })

      it('closes the shop for today’s gap J shape: TRIAL_ACTIVE after T with no P', () => {
        expect(mapLiveBilling(subscription(), livePlans, afterTrial)).toEqual(closed)
        const turnedOff = subscription({ razorpay_subscription_id: 'sub_FakeTrial0007', razorpay_status: 'cancelled' })
        expect(mapLiveBilling(turnedOff, livePlans, afterTrial)).toEqual(closed)
      })

      it('closes the shop for today’s gap I shape, the expected "Paying now after the trial" response', () => {
        expect(mapLiveBilling({ kind: 'subscription', subscription: livePayingAfterTrialSubscription() }, livePlans, afterTrial)).toEqual(closed)
      })

      it('closes the shop for a CANCELLED checkout with no P after T', () => {
        const cancelled = subscription({ status: 'CANCELLED', razorpay_subscription_id: 'sub_FakeTrial0003', razorpay_status: 'cancelled' })
        expect(mapLiveBilling(cancelled, livePlans, afterTrial)).toEqual(closed)
      })
    })

    it('row 11: closes the shop in paid wording for PAYMENT_PENDING, created, with P in the past', () => {
      const payingAgain = liveHaltedSubscription({ status: 'PAYMENT_PENDING', razorpay_subscription_id: 'sub_FakePayAgain0002', razorpay_status: 'created' })
      expect(mapLiveBilling({ kind: 'subscription', subscription: payingAgain }, livePlans, afterPeriod))
        .toEqual({ state: 'shop_closed', shop: 'hidden', plan, ended: 'paid_days' })
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

describe('mapLivePlanName', () => {
  it('names the plan on the subscription row, which subscribe switches to the paid plan (gap C)', () => {
    expect(mapLivePlanName({ kind: 'subscription', subscription: liveTrialSubscription() })).toBe('Social Starter Trial')
    expect(mapLivePlanName({ kind: 'subscription', subscription: liveTrialAutoPaySubscription() })).toBe('Mithra Social Starter')
  })

  it('has no name before go-live or when the row carries none', () => {
    expect(mapLivePlanName({ kind: 'not-live' })).toBeNull()
    expect(mapLivePlanName({ kind: 'subscription', subscription: liveTrialSubscription({ plan_name: ' ' }) })).toBeNull()
    expect(mapLivePlanName({ kind: 'subscription', subscription: null })).toBeNull()
  })
})

describe('mapLiveCheckout', () => {
  it('takes the key ID and subscription ID from a subscribe response, ignoring checkout_url', () => {
    expect(mapLiveCheckout(liveSubscribeResponse())).toEqual({ keyId: 'rzp_test_FakeKey0001', subscriptionId: 'sub_FakeAutoPay0001' })
  })

  it('rejects a response without either ID, since Checkout cannot open without both', () => {
    const message = 'Couldn’t start Razorpay Checkout. Try again in a moment.'
    expect(() => mapLiveCheckout(liveSubscribeResponse({ razorpay_key_id: null }))).toThrow(message)
    expect(() => mapLiveCheckout(liveSubscribeResponse({ razorpay_subscription_id: '' }))).toThrow(message)
    expect(() => mapLiveCheckout(null)).toThrow(message)
  })
})

describe('mapLiveBillingHistory', () => {
  const trialStartedAt = '2026-09-28T10:04:16.169Z'
  const titles = (payload: unknown, started: string | null = null) => mapLiveBillingHistory(payload, started).map((row) => row.title)

  it('lists the stopped shop once per event, newest first, from "Free days started"', () => {
    expect(mapLiveBillingHistory(liveStoppedHistory(), trialStartedAt)).toEqual([
      { title: 'Plan stopped', at: '2026-10-14T08:21:47.904Z', amount: null },
      { title: 'Payment received', at: '2026-10-13T10:10:02.318Z', amount: null },
      { title: 'Free days started', at: trialStartedAt, amount: null },
    ])
  })

  it('shows a duplicate charge with the same payment ID once', () => {
    const charge = (at: string, payment = 'pay_FakeCharge0001') =>
      liveHistoryEvent('SUBSCRIPTION_CHARGED', { previous_status: 'ACTIVE', new_status: 'ACTIVE', external_payment_id: payment, event_at: at })
    expect(titles([charge('2026-10-13T10:10:05Z'), charge('2026-10-13T10:10:02Z')])).toEqual(['Payment received'])
    expect(titles([charge('2026-11-13T10:10:02Z', 'pay_FakeCharge0002'), charge('2026-10-13T10:10:02Z')])).toEqual(['Payment received', 'Payment received'])
  })

  it('shows cancellations without a payment ID on two subscriptions, a trial turn-off and a later paid stop', () => {
    expect(titles([
      liveHistoryEvent('CANCELLATION_REQUESTED', { previous_status: 'ACTIVE', new_status: 'ACTIVE', external_subscription_id: 'sub_FakeRejoin0001', event_at: '2026-11-02T09:00:00Z' }),
      liveHistoryEvent('CANCELLATION_REQUESTED', { external_payment_id: null, new_status: 'CANCELLED', event_at: '2026-09-28T11:15:02Z' }),
    ])).toEqual(['Plan stopped', 'AutoPay turned off'])
  })

  it('names each event', () => {
    const event = (type: string, previous = 'PAYMENT_PENDING') => titles([liveHistoryEvent(type, { previous_status: previous })])
    expect(event('SUBSCRIPTION_CHARGED', 'ACTIVE')).toEqual(['Payment received'])
    expect(event('SUBSCRIPTION_AUTHENTICATED')).toEqual([])
    expect(event('CANCELLATION_REQUESTED', 'ACTIVE')).toEqual(['Plan stopped'])
    expect(event('CANCELLATION_REQUESTED', 'PAYMENT_PENDING')).toEqual(['AutoPay turned off'])
    expect(event('CANCELLATION_REQUESTED', 'TRIAL_ACTIVE')).toEqual(['AutoPay turned off'])
    expect(event('SUBSCRIPTION_CANCELLED', 'ACTIVE')).toEqual(['AutoPay ended'])
  })

  it('skips "AutoPay ended" when the plan was stopped first on that subscription', () => {
    const stopped = liveHistoryEvent('CANCELLATION_REQUESTED', { previous_status: 'ACTIVE', new_status: 'ACTIVE', event_at: '2026-10-14T08:21:47Z' })
    const ended = (subscription: string, at = '2026-11-12T18:30:05Z') =>
      liveHistoryEvent('SUBSCRIPTION_CANCELLED', { previous_status: 'ACTIVE', new_status: 'CANCELLED', external_subscription_id: subscription, event_at: at })
    expect(titles([ended('sub_FakeAutoPay0001'), stopped])).toEqual(['Plan stopped'])
    // Another subscription's stop, or a trial turn-off, does not hide it.
    expect(titles([ended('sub_FakeRejoin0001'), stopped])).toEqual(['AutoPay ended', 'Plan stopped'])
    const turnedOff = liveHistoryEvent('CANCELLATION_REQUESTED', { new_status: 'CANCELLED', event_at: '2026-09-28T11:15:02Z' })
    expect(titles([ended('sub_FakeAutoPay0001', '2026-09-28T11:15:04Z'), turnedOff])).toEqual(['AutoPay ended', 'AutoPay turned off'])
    // An end recorded before the stop was not caused by it.
    expect(titles([stopped, ended('sub_FakeAutoPay0001', '2026-10-14T08:00:00Z')])).toEqual(['Plan stopped', 'AutoPay ended'])
  })

  it('adds "Free days started" from trial_started_at, in its place by date, and leaves it out without one', () => {
    expect(titles([], trialStartedAt)).toEqual(['Free days started'])
    expect(titles([liveHistoryEvent('SUBSCRIPTION_AUTHENTICATED')], trialStartedAt)).toEqual(['Free days started'])
    expect(titles([liveHistoryEvent('SUBSCRIPTION_AUTHENTICATED')])).toEqual([])
  })

  it('ignores checkout, authentication, authorization, activation and unknown events', () => {
    expect(titles(['CHECKOUT_CREATED', 'SUBSCRIPTION_AUTHENTICATED', 'PAYMENT_AUTHORIZED', 'SUBSCRIPTION_ACTIVATED', 'SUBSCRIPTION_PAUSED'].map((type) => liveHistoryEvent(type)))).toEqual([])
  })

  it('shows an amount only when an event carries one', () => {
    const charge = (overrides: Record<string, unknown>) =>
      mapLiveBillingHistory([liveHistoryEvent('SUBSCRIPTION_CHARGED', { external_payment_id: 'pay_FakeCharge0001', ...overrides })], null)[0].amount
    expect(charge({})).toBeNull()
    expect(charge({ amount: null })).toBeNull()
    expect(charge({ amount: 299 })).toBe(299)
  })

  it('lists newest first whatever order the events arrive in', () => {
    expect(titles([
      liveHistoryEvent('CANCELLATION_REQUESTED', { new_status: 'CANCELLED', event_at: '2026-09-28T11:15:02Z' }),
      liveHistoryEvent('SUBSCRIPTION_CHARGED', { external_payment_id: 'pay_FakeCharge0001', event_at: '2026-10-13T10:10:02Z' }),
    ], trialStartedAt)).toEqual(['Payment received', 'AutoPay turned off', 'Free days started'])
  })

  it('rejects a response that is not a list, or a shown event without a readable time', () => {
    expect(() => mapLiveBillingHistory({ events: [] }, null)).toThrow(LiveBillingUnreadableError)
    expect(() => mapLiveBillingHistory([liveHistoryEvent('SUBSCRIPTION_CHARGED', { event_at: '2026-09-28T10:09:41' })], null)).toThrow(LiveBillingUnreadableError)
    expect(mapLiveBillingHistory([liveHistoryEvent('CHECKOUT_CREATED', { event_at: null })], null)).toEqual([])
  })
})

describe('mapLiveTrialStart', () => {
  it('reads trial_started_at, and null before go-live or when it is missing or unreadable', () => {
    expect(mapLiveTrialStart(subscription())).toBe('2026-09-28T10:04:16.169Z')
    expect(mapLiveTrialStart({ kind: 'not-live' })).toBeNull()
    expect(mapLiveTrialStart(subscription({ trial_started_at: undefined }))).toBeNull()
    expect(mapLiveTrialStart(subscription({ trial_started_at: '28 Sep' }))).toBeNull()
  })
})

describe('mapLiveTrialEnd', () => {
  it('reads trial_ends_at, which stays on the row after subscribe, and null before go-live or when it is missing or unreadable', () => {
    expect(mapLiveTrialEnd(subscription())).toBe(trialEnd)
    expect(mapLiveTrialEnd(earlyPaid())).toBe(trialEnd)
    expect(mapLiveTrialEnd({ kind: 'not-live' })).toBeNull()
    expect(mapLiveTrialEnd(subscription({ trial_ends_at: undefined }))).toBeNull()
    expect(mapLiveTrialEnd(subscription({ trial_ends_at: '12 Oct' }))).toBeNull()
  })
})

describe('mapLiveLatestPayment', () => {
  it('reads latest_payment_id and latest_payment_status when both are present', () => {
    expect(mapLiveLatestPayment(subscription({ latest_payment_id: 'pay_FakePayment0001', latest_payment_status: 'failed' }))).toEqual({ id: 'pay_FakePayment0001', status: 'failed' })
    expect(mapLiveLatestPayment(early({ latest_payment_id: 'pay_FakePayment0001', latest_payment_status: 'authorized' }))).toEqual({ id: 'pay_FakePayment0001', status: 'authorized' })
  })

  it('is null before go-live, without the fields (today’s backend), or when either is null or unreadable', () => {
    expect(mapLiveLatestPayment({ kind: 'not-live' })).toBeNull()
    expect(mapLiveLatestPayment(subscription())).toBeNull()
    expect(mapLiveLatestPayment({ kind: 'subscription', subscription: null })).toBeNull()
    expect(mapLiveLatestPayment(subscription({ latest_payment_id: null, latest_payment_status: null }))).toBeNull()
    expect(mapLiveLatestPayment(subscription({ latest_payment_id: 'pay_FakePayment0001', latest_payment_status: null }))).toBeNull()
    expect(mapLiveLatestPayment(subscription({ latest_payment_id: null, latest_payment_status: 'failed' }))).toBeNull()
    expect(mapLiveLatestPayment(subscription({ latest_payment_id: 42, latest_payment_status: 'failed' }))).toBeNull()
    expect(mapLiveLatestPayment(subscription({ latest_payment_id: ' ', latest_payment_status: 'failed' }))).toBeNull()
  })
})

describe('confirmingLiveBilling', () => {
  const paidThrough = '2026-11-12T18:30:00.000Z'

  it.each<[string, LiveBillingView, LiveBillingView]>([
    ['Free days as row 7', { state: 'free_days', shop: 'open', plan, trialEndsAt: trialEnd, daysLeft: 13, trialDays: 14 },
      { state: 'free_days_confirming', shop: 'open', plan, trialEndsAt: trialEnd, daysLeft: 13 }],
    ['3 days left as row 7', { state: 'three_days_left', shop: 'open', plan, trialEndsAt: trialEnd, daysLeft: 3, trialDays: 14 },
      { state: 'free_days_confirming', shop: 'open', plan, trialEndsAt: trialEnd, daysLeft: 3 }],
    ['Shop closed after free days as row 8', { state: 'shop_closed', shop: 'hidden', plan, ended: 'free_days' }, { state: 'confirming', shop: 'hidden', plan, ended: 'free_days' }],
    ['Shop closed after paid days as row 8b', { state: 'shop_closed', shop: 'hidden', plan, ended: 'paid_days' }, { state: 'confirming', shop: 'hidden', plan, ended: 'paid_days' }],
    ['Payment failed as row 8b', { state: 'payment_failed', shop: 'hidden', plan }, { state: 'confirming', shop: 'hidden', plan, ended: 'paid_days' }],
    ['Stopped as Stopped while confirming', { state: 'stopped', shop: 'open', plan, paidThrough, daysLeft: 21 },
      { state: 'stopped', shop: 'open', plan, paidThrough, daysLeft: 21, confirming: true }],
    ['AutoPay off as AutoPay off while confirming', { state: 'autopay_off', shop: 'open', plan, paidThrough, daysLeft: 21 },
      { state: 'autopay_off', shop: 'open', plan, paidThrough, daysLeft: 21, confirming: true }],
  ])('shows %s', (_, view, confirming) => {
    expect(confirmingLiveBilling(view)).toEqual(confirming)
  })

  it.each<[string, LiveBillingView]>([
    ['Paid', { state: 'paid', shop: 'open', plan, paidThrough, nextChargeAt: paidThrough, trialEndsAt: null }],
    ['Collecting', { state: 'collecting', shop: 'open', plan }],
    ['a shop that is not live', { state: 'not_live', plan }],
    ['row 7', { state: 'free_days_confirming', shop: 'open', plan, trialEndsAt: trialEnd, daysLeft: 13 }],
    ['row 8', { state: 'confirming', shop: 'hidden', plan, ended: 'free_days' }],
  ])('leaves %s as it is', (_, view) => {
    expect(confirmingLiveBilling(view)).toBe(view)
  })
})
