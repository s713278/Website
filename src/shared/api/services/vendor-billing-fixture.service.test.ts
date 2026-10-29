import { describe, expect, it } from 'vitest'
import { createVendorBillingMockService, billingFixtureVendorId, type BillingFixtureScenario } from './vendor-billing-fixture.service'
import type { VendorBillingService } from './vendor-billing.service'
import fixtures from '../../../../docs/examples/vendor-billing/mock-responses.json'
import { assertApiSuccess } from '../errors'
import { billingFailure } from './vendor-billing-error'

describe('vendor billing fixture service', () => {
  it('stamps mock and demo provenance at the service boundary', async () => {
    const vendorId = billingFixtureVendorId('trial_active')
    expect((await createVendorBillingMockService('trial_active').getStatus(vendorId)).source).toBe('mock')
    expect((await createVendorBillingMockService('trial_active', 'demo').getStatus(vendorId)).source).toBe('demo')
  })

  it('keeps ten trial days through acknowledgement and advances only on explicit reconciliation', async () => {
    const vendorId = billingFixtureVendorId('trial_active')
    const service = createVendorBillingMockService('trial_active')
    const before = await service.getStatus(vendorId)
    const attempt = await service.prepareCheckout(vendorId, 'setup_autopay', 'one-logical-action')
    expect(attempt.mode).toBe('simulated')
    expect(attempt.config).toBeNull()
    expect(attempt.expected).toEqual({ amountMinor: 29900, currency: 'INR', chargeAt: before.trial.endsAt, authorisationAmountMinor: 500 })
    expect(await service.prepareCheckout(vendorId, 'setup_autopay', 'one-logical-action')).toEqual(attempt)

    const pending = await service.submitCheckout(attempt, null)
    expect(pending.trial).toEqual(before.trial)
    expect(pending.authorisation.status).toBe('pending')
    expect(pending.accessStatus).toBe('TRIAL')
    expect(pending.membership.paymentStatus).toBe('none')

    const confirmed = await service.reconcileSimulatedCheckout!(vendorId)
    expect(confirmed.trial).toEqual(before.trial)
    expect(confirmed.authorisation.status).toBe('confirmed')
    expect(confirmed.membership.nextChargeAt).toBe(before.trial.endsAt)
    expect(confirmed.accessStatus).toBe('TRIAL')
    expect(confirmed.availableActions).not.toContain('setup_autopay')
  })

  it('preserves the separate immediate-start path after trial expiry', async () => {
    const service = createVendorBillingMockService('trial_expired')
    const vendorId = billingFixtureVendorId('trial_expired')
    const attempt = await service.prepareCheckout(vendorId, 'pay_first_fee', 'expired-signup')
    expect(attempt.expected.chargeAt).toBeNull()
    const pending = await service.submitCheckout(attempt, null)
    expect(pending.accessStatus).toBe('TRIAL_ENDED')
    expect(pending.membership.paymentStatus).toBe('pending')
    expect(pending.trial.status).toBe('ended')
  })

  it('keeps first-day and reminder-day trial time through optional setup', async () => {
    for (const scenario of ['trial_start', 'trial_three_days', 'trial_last_day'] as const) {
      const service = createVendorBillingMockService(scenario)
      const vendorId = billingFixtureVendorId(scenario)
      const before = await service.getStatus(vendorId)
      const attempt = await service.prepareCheckout(vendorId, 'setup_autopay', scenario)
      const pending = await service.submitCheckout(attempt, null)
      const confirmed = await service.reconcileSimulatedCheckout!(vendorId)
      expect(pending.trial).toEqual(before.trial)
      expect(confirmed.trial).toEqual(before.trial)
      expect(pending.serverTime).toBe(before.serverTime)
      expect(confirmed.serverTime).toBe(before.serverTime)
      expect(pending.revision).toBeGreaterThan(before.revision)
      expect(confirmed.revision).toBeGreaterThan(pending.revision)
    }
  })

  it('does not invent an ended trial for an ineligible identity after a simulated first-fee acknowledgement', async () => {
    const service = createVendorBillingMockService('trial_ineligible')
    const vendorId = billingFixtureVendorId('trial_ineligible')
    const attempt = await service.prepareCheckout(vendorId, 'pay_first_fee', 'ineligible-signup')
    const pending = await service.submitCheckout(attempt, null)
    expect(pending.trial).toEqual({ status: 'ineligible', endsAt: null, daysRemaining: null })
    expect(pending.accessStatus).toBe('PAYMENT_REQUIRED')
    expect(pending.membership.paymentStatus).toBe('pending')
  })

  it('rejects an unused stale attempt after another attempt advances the fixture', async () => {
    const service = createVendorBillingMockService('trial_active')
    const vendorId = billingFixtureVendorId('trial_active')
    const first = await service.prepareCheckout(vendorId, 'setup_autopay', 'first')
    const stale = await service.prepareCheckout(vendorId, 'setup_autopay', 'second')
    await service.submitCheckout(first, null)
    await service.reconcileSimulatedCheckout!(vendorId)
    await expect(service.submitCheckout(stale, null)).rejects.toThrow('missing')
    expect((await service.getStatus(vendorId)).authorisation.status).toBe('confirmed')
  })

  it('restores expired signup only after explicit reconciliation and retries a failed first fee with the same key', async () => {
    const service = createVendorBillingMockService('trial_expired')
    const vendorId = billingFixtureVendorId('trial_expired')
    const before = await service.getStatus(vendorId)
    const first = await service.prepareCheckout(vendorId, 'pay_first_fee', 'one-expired-signup')
    const pending = await service.submitCheckout(first, null)
    expect(pending.accessStatus).toBe('TRIAL_ENDED')
    expect(pending.membership.paymentStatus).toBe('pending')
    const failed = await service.reconcileSimulatedCheckout!(vendorId, 'failed')
    expect(failed.accessStatus).toBe(before.accessStatus)
    expect(failed.trial.endsAt).toBe(before.trial.endsAt)
    expect(failed.availableActions).toContain('pay_first_fee')
    expect(await service.prepareCheckout(vendorId, 'pay_first_fee', 'one-expired-signup')).toEqual(first)
    await service.submitCheckout(first, null)
    const paid = await service.reconcileSimulatedCheckout!(vendorId)
    expect(paid.accessStatus).toBe('PAID')
    expect(paid.membership.paymentStatus).toBe('confirmed')
    expect(paid.membership.paidThrough).toBeTruthy()
  })

  it('binds a repeated preparation key to its vendor/action even while preparation is in flight', async () => {
    const service = createVendorBillingMockService('trial_active')
    const vendorId = billingFixtureVendorId('trial_active')
    const [first, repeated] = await Promise.all([
      service.prepareCheckout(vendorId, 'setup_autopay', 'same-request'),
      service.prepareCheckout(vendorId, 'setup_autopay', 'same-request'),
    ])
    expect(first).toEqual(repeated)
    await expect(service.prepareCheckout(vendorId, 'pay_first_fee', 'same-request')).rejects.toThrow('cannot be reused')
    await expect(service.prepareCheckout('another-vendor', 'setup_autopay', 'same-request')).rejects.toThrow('cannot be reused')
  })

  it('cancels a trial agreement once per key, keeps the identical expiry and confirms only explicitly', async () => {
    const service = createVendorBillingMockService('setup_confirmed')
    const vendorId = billingFixtureVendorId('setup_confirmed')
    const before = await service.getStatus(vendorId)
    expect(before.availableActions).toContain('cancel')
    const [requested, repeated] = await Promise.all([
      service.requestCancellation(vendorId, 'cancel-once'),
      service.requestCancellation(vendorId, 'cancel-once'),
    ])
    expect(requested.cancellation?.status).toBe('requested')
    expect(repeated.cancellation?.status).toBe('requested')
    expect(requested.trial).toEqual(before.trial)
    expect(requested.revision).toBeGreaterThan(before.revision)
    expect(requested.availableActions).not.toContain('cancel')
    // A lost response is retried with the same key and reconciles without a second transition.
    expect((await service.requestCancellation(vendorId, 'cancel-once')).revision).toBe(requested.revision)
    await expect(service.requestCancellation('another-vendor', 'cancel-once')).rejects.toThrow('cannot be reused')
    await expect(service.requestCancellation(vendorId, 'new-key')).rejects.toThrow('not available')

    const confirmed = await service.simulateCancellationProgress!(vendorId, 'cancellation_confirmed')
    expect(confirmed.cancellation?.status).toBe('confirmed')
    expect(confirmed.trial).toEqual(before.trial)
    expect(confirmed.accessStatus).toBe('TRIAL')
    expect(confirmed.membership.nextChargeAt).toBeNull()
    expect(confirmed.revision).toBeGreaterThan(requested.revision)
  })

  it('keeps a failed trial cancellation unconfirmed with its original expiry', async () => {
    const service = createVendorBillingMockService('setup_confirmed')
    const vendorId = billingFixtureVendorId('setup_confirmed')
    const before = await service.getStatus(vendorId)
    await service.requestCancellation(vendorId, 'cancel-fails')
    const failed = await service.simulateCancellationProgress!(vendorId, 'cancellation_failed')
    expect(failed.cancellation?.status).toBe('failed')
    expect(failed.trial).toEqual(before.trial)
    expect(failed.notice).toMatch(/not confirmed/)
    await expect(service.simulateCancellationProgress!(vendorId, 'cancellation_confirmed')).rejects.toThrow('not available')
  })

  it('offers cancel only in phases with a simulated cancellation journey', async () => {
    for (const scenario of ['authorisation_failed', 'first_fee_failed', 'renewal_failed', 'setup_pending'] as const) {
      const status = await createVendorBillingMockService(scenario).getStatus(billingFixtureVendorId(scenario))
      expect(status.availableActions, scenario).not.toContain('cancel')
    }
    const service = createVendorBillingMockService('trial_active')
    const vendorId = billingFixtureVendorId('trial_active')
    const pending = await service.submitCheckout(await service.prepareCheckout(vendorId, 'setup_autopay', 'setup'), null)
    expect(pending.availableActions).not.toContain('cancel')
  })

  it('refuses cancellation where the source lists none', async () => {
    const service = createVendorBillingMockService('trial_active')
    await expect(service.requestCancellation(billingFixtureVendorId('trial_active'), 'nothing-to-stop')).rejects.toThrow('not available')
  })

  it.each([
    ['refund_success', 'refund_completed'],
    ['refund_failure', 'refund_failed'],
  ] as const)('schedules paid cancellation and advances %s independently of coverage', async (_journey, last) => {
    const service = createVendorBillingMockService('paid_active')
    const vendorId = billingFixtureVendorId('paid_active')
    const paid = await service.getStatus(vendorId)
    const scheduled = await service.requestCancellation(vendorId, 'paid-cancel')
    expect(scheduled.cancellation?.status).toBe('scheduled')
    expect(scheduled.accessStatus).toBe('PAID')
    expect(scheduled.membership.paidThrough).toBe(paid.membership.paidThrough)
    expect(scheduled.membership.nextChargeAt).toBeNull()
    expect(scheduled.refund).toBeNull()

    const owed = await service.simulateCancellationProgress!(vendorId, 'renewal_debit_collected')
    const pending = await service.simulateCancellationProgress!(vendorId, 'refund_started')
    const done = await service.simulateCancellationProgress!(vendorId, last)
    expect([owed, pending, done].map((status) => status.refund)).toEqual([
      { status: 'owed', amountMinor: 29900 },
      { status: 'pending', amountMinor: 29900 },
      { status: last === 'refund_completed' ? 'completed' : 'failed', amountMinor: 29900 },
    ])
    for (const status of [owed, pending, done]) {
      expect(status.membership.paidThrough).toBe(paid.membership.paidThrough)
      expect(status.accessStatus).toBe('PAYMENT_REQUIRED')
      expect(status.cancellation?.status).toBe('confirmed')
    }
    expect(done.revision).toBeGreaterThan(pending.revision)
    if (last === 'refund_failed') expect(done.notice).toMatch(/still owed/)
  })

  it('runs paid_rejoin from paid coverage to a pending replacement at the retained paid-through date', async () => {
    const service = createVendorBillingMockService('paid_active')
    const vendorId = billingFixtureVendorId('paid_active')
    const paid = await service.getStatus(vendorId)
    const scheduled = await service.requestCancellation(vendorId, 'paid-cancel')
    expect(scheduled.cancellation?.status).toBe('scheduled')
    // An unconfirmed old agreement cannot be bypassed by a replacement.
    expect(scheduled.availableActions).not.toContain('setup_autopay')
    await expect(service.prepareCheckout(vendorId, 'setup_autopay', 'too-early')).rejects.toThrow('not available')

    const ready = await service.simulateCancellationProgress!(vendorId, 'cancellation_confirmed')
    expect(ready.cancellation?.status).toBe('confirmed')
    expect(ready.availableActions).toEqual(['setup_autopay'])
    expect(ready.membership.paidThrough).toBe(paid.membership.paidThrough)
    expect(ready.accessStatus).toBe('PAID')

    const attempt = await service.prepareCheckout(vendorId, 'setup_autopay', 'rejoin-paid')
    expect(attempt.expected).toEqual({ amountMinor: 29900, currency: 'INR', chargeAt: paid.membership.paidThrough, authorisationAmountMinor: 500 })
    const prepared = await service.getStatus(vendorId)
    expect(prepared.cancellation).toBeNull()
    expect(prepared.revision).toBeGreaterThan(ready.revision)
    expect(prepared.membership.paidThrough).toBe(paid.membership.paidThrough)
    expect(await service.prepareCheckout(vendorId, 'setup_autopay', 'rejoin-paid')).toEqual(attempt)

    const pending = await service.submitCheckout(attempt, null)
    expect(pending.cancellation).toBeNull()
    expect(pending.authorisation.status).toBe('pending')
    expect(pending.membership).toEqual({ paymentStatus: 'confirmed', paidThrough: paid.membership.paidThrough, nextChargeAt: paid.membership.paidThrough })
    expect(pending.trial).toEqual(paid.trial)
    expect(pending.accessStatus).toBe('PAID')
    expect(pending.revision).toBeGreaterThan(prepared.revision)

    const confirmed = await service.reconcileSimulatedCheckout!(vendorId)
    expect(confirmed.authorisation.status).toBe('confirmed')
    expect(confirmed.membership).toEqual(pending.membership)
    expect(confirmed.cancellation).toBeNull()
    expect(confirmed.revision).toBeGreaterThan(pending.revision)
  })

  it('derives a trial rejoin after confirmed trial cancellation with the unchanged trial expiry', async () => {
    const service = createVendorBillingMockService('cancel_confirmed_trial')
    const vendorId = billingFixtureVendorId('cancel_confirmed_trial')
    const cancelled = await service.getStatus(vendorId)
    expect(cancelled.availableActions).toContain('setup_autopay')
    const attempt = await service.prepareCheckout(vendorId, 'setup_autopay', 'rejoin-trial')
    expect(attempt.attemptId).toMatch(/^mock_attempt_rejoin_trial_/)
    expect(attempt.expected.chargeAt).toBe(cancelled.trial.endsAt)
    expect((await service.getStatus(vendorId)).cancellation).toBeNull()

    const pending = await service.submitCheckout(attempt, null)
    const confirmed = await service.reconcileSimulatedCheckout!(vendorId)
    for (const status of [pending, confirmed]) {
      expect(status.trial).toEqual(cancelled.trial)
      expect(status.accessStatus).toBe('TRIAL')
      expect(status.cancellation).toBeNull()
      expect(status.membership.paymentStatus).toBe('none')
    }
    expect(confirmed.membership.nextChargeAt).toBe(cancelled.trial.endsAt)
  })

  it.each(['cancel_requested_trial', 'cancel_failed', 'cancel_scheduled_paid', 'schedule_completed'] as const)('offers no replacement from %s', async (scenario) => {
    const service = createVendorBillingMockService(scenario)
    const vendorId = billingFixtureVendorId(scenario)
    const status = await service.getStatus(vendorId)
    expect(status.availableActions).not.toContain('setup_autopay')
    expect(status.availableActions).not.toContain('pay_first_fee')
    await expect(service.prepareCheckout(vendorId, 'setup_autopay', scenario)).rejects.toThrow('not available')
  })

  it('keeps an outstanding refund visible across a replacement without creating paid coverage', async () => {
    const service = createVendorBillingMockService('refund_pending')
    const vendorId = billingFixtureVendorId('refund_pending')
    const before = await service.getStatus(vendorId)
    const attempt = await service.prepareCheckout(vendorId, 'pay_first_fee', 'replacement-with-refund')
    const pending = await service.submitCheckout(attempt, null)
    expect(pending.refund).toEqual(before.refund)
    expect(pending.cancellation).toBeNull()
    expect(pending.accessStatus).toBe('PAYMENT_REQUIRED')
    expect(pending.membership.paymentStatus).toBe('pending')
    // The obligation still advances only through its own explicit simulated steps.
    const refunded = await service.simulateCancellationProgress!(vendorId, 'refund_completed')
    expect(refunded.refund).toEqual({ status: 'completed', amountMinor: 29900 })
    expect(refunded.accessStatus).toBe('PAYMENT_REQUIRED')
    expect(refunded.membership.paymentStatus).toBe('pending')
    expect(refunded.revision).toBeGreaterThan(pending.revision)
  })

  it('carries a derived outstanding refund through a setup_autopay replacement without extending coverage', async () => {
    const vendorId = billingFixtureVendorId('rejoin_paid_ready')
    const outstandingRefund = (await createVendorBillingMockService('refund_pending').getStatus(vendorId)).refund
    const service = createVendorBillingMockService('rejoin_paid_ready', 'mock', undefined, { outstandingRefund })
    const ready = await service.getStatus(vendorId)
    expect(ready.refund).toEqual({ status: 'pending', amountMinor: 29900 })
    const pending = await service.submitCheckout(await service.prepareCheckout(vendorId, 'setup_autopay', 'rejoin-with-refund'), null)
    const confirmed = await service.reconcileSimulatedCheckout!(vendorId)
    for (const status of [pending, confirmed]) {
      expect(status.refund).toEqual(ready.refund)
      expect(status.membership.paidThrough).toBe(ready.membership.paidThrough)
      expect(status.cancellation).toBeNull()
    }
    const refunded = await service.simulateCancellationProgress!(vendorId, 'refund_completed')
    expect(refunded.refund?.status).toBe('completed')
    expect(refunded.membership.paidThrough).toBe(ready.membership.paidThrough)
  })

  it('returns a failed paid-revocation replacement to its own context without inventing a cancellation', async () => {
    const service = createVendorBillingMockService('authorisation_revoked_paid')
    const vendorId = billingFixtureVendorId('authorisation_revoked_paid')
    const revoked = await service.getStatus(vendorId)
    const attempt = await service.prepareCheckout(vendorId, 'setup_autopay', 'revoked-replacement')
    const pending = await service.submitCheckout(attempt, null)
    expect(Date.parse(pending.serverTime)).toBeGreaterThanOrEqual(Date.parse(revoked.serverTime))
    const failed = await service.reconcileSimulatedCheckout!(vendorId, 'failed')
    expect(failed.cancellation).toBeNull()
    expect(failed.authorisation.status).toBe('revoked')
    expect(failed.membership).toEqual(revoked.membership)
    expect(failed.availableActions).toEqual(['setup_autopay'])
    expect(Date.parse(failed.serverTime)).toBeGreaterThanOrEqual(Date.parse(pending.serverTime))
  })

  it('does not confirm a new fee after earlier paid coverage into an already-elapsed period', async () => {
    const service = createVendorBillingMockService('refund_pending')
    const vendorId = billingFixtureVendorId('refund_pending')
    await service.submitCheckout(await service.prepareCheckout(vendorId, 'pay_first_fee', 'returning'), null)
    await expect(service.reconcileSimulatedCheckout!(vendorId)).rejects.toThrow('no confirmed context')
    const failed = await service.reconcileSimulatedCheckout!(vendorId, 'failed')
    expect(failed.accessStatus).not.toBe('PAID')
  })

  it('keeps the store open while a renewal is retried and restores only the original cycle at retry time', async () => {
    const service = createVendorBillingMockService('paid_active')
    const vendorId = billingFixtureVendorId('paid_active')
    const paid = await service.getStatus(vendorId)
    expect(paid.simulatedRenewalSteps).toEqual(['renewal_due'])
    const due = await service.simulateRenewalProgress!(vendorId, 'renewal_due')
    expect(due.membership.paymentStatus).toBe('pending')
    expect(due.membership.paidThrough).toBe(paid.membership.paidThrough)
    expect(due.accessStatus).toBe('PAID')
    expect(due.storeVisible).toBe(true)
    expect(due.simulatedRenewalSteps).toEqual(['renewal_retry_confirmed', 'renewal_failed'])
    await expect(service.simulateRenewalProgress!(vendorId, 'renewal_due')).rejects.toThrow('not available')

    const recovered = await service.simulateRenewalProgress!(vendorId, 'renewal_retry_confirmed')
    expect(recovered.accessStatus).toBe('PAID')
    // Retry lands two days after the boundary; coverage still ends on the original cycle's anchor.
    expect(Date.parse(recovered.serverTime) - Date.parse(paid.membership.paidThrough!)).toBe(2 * 24 * 60 * 60 * 1000)
    expect(recovered.membership.paidThrough).toBe('2026-12-15T10:00:00Z')
    expect(recovered.membership.nextChargeAt).toBe(recovered.membership.paidThrough)
    expect(recovered.simulatedRenewalSteps).toBeUndefined()
    expect(recovered.revision).toBeGreaterThan(due.revision)
  })

  it('fails a renewal only when collection halts: the store is hidden, AutoPay cancelled and Pay Now offered', async () => {
    const service = createVendorBillingMockService('paid_active')
    const vendorId = billingFixtureVendorId('paid_active')
    const paid = await service.getStatus(vendorId)
    await service.simulateRenewalProgress!(vendorId, 'renewal_due')
    const halted = await service.simulateRenewalProgress!(vendorId, 'renewal_failed')
    expect(halted.membership.paymentStatus).toBe('failed')
    expect(halted.membership.paidThrough).toBe(paid.membership.paidThrough)
    expect(halted.membership.nextChargeAt).toBeNull()
    expect(halted.authorisation.status).toBe('revoked')
    expect(halted.accessStatus).toBe('PAYMENT_REQUIRED')
    expect(halted.storeVisible).toBe(false)
    expect(halted.availableActions).toEqual(['pay_first_fee'])
    // A halted renewal is not retried: recovery is a new paid period.
    expect(halted.simulatedRenewalSteps).toBeUndefined()
  })

  it('keeps revoked authorisation distinct and retains trial or paid coverage', async () => {
    const trial = createVendorBillingMockService('authorisation_revoked')
    const trialStatus = await trial.getStatus(billingFixtureVendorId('authorisation_revoked'))
    const paid = createVendorBillingMockService('authorisation_revoked_paid')
    const vendorId = billingFixtureVendorId('authorisation_revoked_paid')
    const paidStatus = await paid.getStatus(vendorId)
    expect(trialStatus).toMatchObject({ accessStatus: 'TRIAL', authorisation: { status: 'revoked' }, membership: { paymentStatus: 'none' }, availableActions: ['setup_autopay'] })
    expect(paidStatus).toMatchObject({ accessStatus: 'PAID', authorisation: { status: 'revoked' }, membership: { paymentStatus: 'confirmed', paidThrough: '2026-11-15T10:00:00Z', nextChargeAt: null }, availableActions: ['setup_autopay'] })

    const attempt = await paid.prepareCheckout(vendorId, 'setup_autopay', 'revoked-paid')
    expect(attempt.expected.chargeAt).toBe(paidStatus.membership.paidThrough)
    const pending = await paid.submitCheckout(attempt, null)
    expect(pending.membership.paidThrough).toBe(paidStatus.membership.paidThrough)
    expect(pending.accessStatus).toBe('PAID')
  })

  it('exercises all eight named journeys through explicit simulated service outcomes', async () => {
    const advance = async (service: VendorBillingService, vendorId: string, from: BillingFixtureScenario, to: BillingFixtureScenario) => {
      if (to === 'cancel_requested_trial' || (from === 'paid_active' && to === 'cancel_scheduled_paid')) return service.requestCancellation(vendorId, `${from}-${to}`)
      if (to === 'setup_pending' || to === 'rejoin_paid_pending') return service.submitCheckout(await service.prepareCheckout(vendorId, 'setup_autopay', to), null)
      if (to === 'first_fee_pending') return service.submitCheckout(await service.prepareCheckout(vendorId, 'pay_first_fee', to), null)
      if (to === 'setup_confirmed' || to === 'paid_after_expiry') return service.reconcileSimulatedCheckout!(vendorId)
      if (to === 'renewal_pending') return service.simulateRenewalProgress!(vendorId, 'renewal_due')
      if (to === 'renewal_failed') return service.simulateRenewalProgress!(vendorId, 'renewal_failed')
      if (to === 'retry_recovered') return service.simulateRenewalProgress!(vendorId, 'renewal_retry_confirmed')
      const step = ({ cancel_confirmed_trial: 'cancellation_confirmed', rejoin_paid_ready: 'cancellation_confirmed', refund_owed: 'renewal_debit_collected',
        refund_pending: 'refund_started', refund_completed: 'refund_completed', refund_failed: 'refund_failed' } as const)[to as string]
      if (!step) throw new Error(`No explicit outcome for ${from} -> ${to}`)
      return service.simulateCancellationProgress!(vendorId, step)
    }
    expect(fixtures.journeys).toHaveLength(8)
    for (const journey of fixtures.journeys) {
      const contexts = journey.contexts as BillingFixtureScenario[]
      const service = createVendorBillingMockService(contexts[0])
      const vendorId = billingFixtureVendorId(contexts[0])
      let revision = (await service.getStatus(vendorId)).revision
      for (let index = 1; index < contexts.length; index++) {
        const status = await advance(service, vendorId, contexts[index - 1], contexts[index])
        const expected = await createVendorBillingMockService(contexts[index]).getStatus(vendorId)
        expect({ ...status, revision: 0 }, `${journey.name}: ${contexts[index]}`).toEqual({ ...expected, revision: 0 })
        expect(status.revision).toBeGreaterThan(revision)
        revision = status.revision
      }
    }
  })

  it.each(Object.entries(fixtures.errors))('turns %s into a safe observable failure with any retry delay', (_code, envelope) => {
    let failure: unknown
    try { assertApiSuccess(envelope) } catch (cause) { failure = cause }
    expect(failure).toBeTruthy()
    const shown = billingFailure(failure)
    expect(shown.message).toContain(envelope.message)
    expect(shown.message).not.toContain('razorpay_signature')
    expect(shown.retryAfterSeconds).toBe('retry_after_seconds' in envelope ? envelope.retry_after_seconds : 0)
  })
})
