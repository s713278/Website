import { afterEach, describe, expect, it, vi } from 'vitest'
import fixtures from '../../../../docs/examples/vendor-billing/mock-responses.json'
import { demoVendorContext } from '../fixtures/vendor-dashboard'
import { resetDemoState } from '../fixtures/demo-state'
import { mapVendorContext } from '../mappers/vendor-onboarding'
import { createVendorBillingContextService } from './vendor-billing-context.service'

afterEach(() => resetDemoState())

describe('createVendorBillingContextService', () => {
  it('maps a fresh demo context and rereads it after an acknowledged simulated write', async () => {
    const snapshots = [] as ReturnType<typeof mapVendorContext>[]
    const refreshContext = vi.fn(async () => {
      const context = mapVendorContext(demoVendorContext('demo-vendor'))
      snapshots.push(context)
      return context
    })
    const service = createVendorBillingContextService(refreshContext)
    const first = await service.getStatus('demo-vendor')
    expect(first.source).toBe('demo')
    expect(first.trial.status).toBe('active')
    expect(first.availableActions).toContain('setup_autopay')
    const attempt = await service.prepareCheckout('demo-vendor', 'setup_autopay', 'one-request')
    expect(attempt.mode).toBe('simulated')
    expect(attempt.config).toBeNull()
    expect(attempt.expected.chargeAt).toBe(first.trial.endsAt)
    const beforeWriteReads = refreshContext.mock.calls.length
    const pending = await service.submitCheckout(attempt, null)
    expect(refreshContext.mock.calls.length).toBeGreaterThan(beforeWriteReads)
    expect(pending.revision).toBeGreaterThan(first.revision)
    expect(pending.authorisation.status).toBe('pending')
    expect(snapshots.at(-1)?.billing).toMatchObject({ revision: pending.revision, autopay_status: 'pending' })
    expect(snapshots.at(-1)?.subscription.planName).toBe(pending.plan.name)
    expect(snapshots.at(-1)?.eligibleFeatures).toEqual(pending.capabilities)
    const confirmed = await service.reconcileSimulatedCheckout?.('demo-vendor')
    expect(confirmed?.authorisation.status).toBe('confirmed')
    expect(confirmed?.trial.endsAt).toBe(first.trial.endsAt)
  })

  it('retries failed demo AutoPay with its original preparation and a monotonic revision', async () => {
    const service = createVendorBillingContextService(async () => mapVendorContext(demoVendorContext('demo-vendor')))
    const first = await service.getStatus('demo-vendor')
    const attempt = await service.prepareCheckout('demo-vendor', 'setup_autopay', 'retry-key')
    const pending = await service.submitCheckout(attempt, null)
    const failed = await service.reconcileSimulatedCheckout!('demo-vendor', 'failed')
    expect(failed.authorisation.status).toBe('failed')
    expect(failed.trial.endsAt).toBe(first.trial.endsAt)
    expect(failed.accessStatus).toBe('TRIAL')
    expect(failed.revision).toBeGreaterThan(pending.revision)
    expect(await service.prepareCheckout('demo-vendor', 'setup_autopay', 'retry-key')).toEqual(attempt)
    const again = await service.submitCheckout(attempt, null)
    expect(again.revision).toBeGreaterThan(failed.revision)
    expect((await service.reconcileSimulatedCheckout!('demo-vendor')).authorisation.status).toBe('confirmed')
  })

  it('records one demo cancellation per key, rereads context and confirms only on an explicit simulated outcome', async () => {
    const refreshContext = vi.fn(async () => mapVendorContext(demoVendorContext('demo-vendor')))
    const service = createVendorBillingContextService(refreshContext)
    const attempt = await service.prepareCheckout('demo-vendor', 'setup_autopay', 'setup-key')
    const pending = await service.submitCheckout(attempt, null)
    expect(pending.availableActions).toEqual([])
    const setUp = await service.reconcileSimulatedCheckout!('demo-vendor')
    expect(setUp.availableActions).toEqual(['cancel'])
    const readsBeforeCancel = refreshContext.mock.calls.length
    const [requested, repeated] = await Promise.all([
      service.requestCancellation('demo-vendor', 'cancel-key'),
      service.requestCancellation('demo-vendor', 'cancel-key'),
    ])
    expect(refreshContext.mock.calls.length).toBeGreaterThan(readsBeforeCancel)
    expect(requested.cancellation?.status).toBe('requested')
    expect(requested.cancellation?.requestedAt).toBeTruthy()
    expect(repeated.revision).toBe(requested.revision)
    expect(requested.revision).toBeGreaterThan(setUp.revision)
    expect(requested.trial).toEqual(setUp.trial)
    expect(requested.availableActions).toEqual([])
    await expect(service.requestCancellation('other-vendor', 'cancel-key')).rejects.toThrow('cannot be reused')

    const failed = await service.simulateCancellationProgress!('demo-vendor', 'cancellation_failed')
    expect(failed.cancellation?.status).toBe('failed')
    expect(failed.trial).toEqual(setUp.trial)
    expect(failed.notice).toMatch(/not confirmed/)
    await expect(service.simulateCancellationProgress!('demo-vendor', 'cancellation_confirmed')).rejects.toThrow('not available')
  })

  it('confirms a requested demo cancellation without shortening the trial', async () => {
    const service = createVendorBillingContextService(async () => mapVendorContext(demoVendorContext('demo-vendor')))
    await expect(service.requestCancellation('demo-vendor', 'too-early')).rejects.toThrow('not available')
    const attempt = await service.prepareCheckout('demo-vendor', 'setup_autopay', 'setup-key')
    await service.submitCheckout(attempt, null)
    const setUp = await service.reconcileSimulatedCheckout!('demo-vendor')
    await service.requestCancellation('demo-vendor', 'cancel-key')
    await expect(service.simulateCancellationProgress!('demo-vendor', 'refund_started')).rejects.toThrow('not available')
    const confirmed = await service.simulateCancellationProgress!('demo-vendor', 'cancellation_confirmed')
    expect(confirmed.cancellation?.status).toBe('confirmed')
    expect(confirmed.authorisation.status).toBe('revoked')
    expect(confirmed.membership.nextChargeAt).toBeNull()
    expect(confirmed.trial).toEqual(setUp.trial)
    expect(confirmed.accessStatus).toBe('TRIAL')
  })

  it('returns a fresh shared context after injected submit and cancellation acknowledgements', async () => {
    let current = mapVendorContext(fixtures.contexts.trial_active)
    const refreshContext = vi.fn(async () => current)
    const submitCheckout = vi.fn(async () => { current = mapVendorContext(fixtures.contexts.setup_pending) })
    const requestCancellation = vi.fn(async () => {
      const next = mapVendorContext(fixtures.contexts.cancel_requested_trial)
      current = { ...next, eligibleFeatures: ['VIEW'], subscription: {
        ...next.subscription, usage: { ...next.subscription.usage, products: 7 },
      } }
    })
    const service = createVendorBillingContextService(refreshContext, { submitCheckout, requestCancellation })
    const attempt = await service.prepareCheckout(current.vendorId, 'setup_autopay', 'prepare-key')
    const readsBeforeSubmit = refreshContext.mock.calls.length
    const pending = await service.submitCheckout(attempt, null)
    expect(submitCheckout).toHaveBeenCalledTimes(1)
    expect(refreshContext.mock.calls.length).toBeGreaterThan(readsBeforeSubmit)
    expect(pending.revision).toBe(2)
    const readsBeforeCancel = refreshContext.mock.calls.length
    const cancelled = await service.requestCancellation(current.vendorId, 'cancel-key')
    expect(requestCancellation).toHaveBeenCalledWith(current.vendorId, 'cancel-key')
    expect(refreshContext.mock.calls.length).toBeGreaterThan(readsBeforeCancel)
    expect(cancelled.revision).toBe(4)
    expect(cancelled.cancellation?.status).toBe('requested')
    expect(cancelled.capabilities).toEqual(['VIEW'])
    expect(current.subscription.usage.products).toBe(7)
  })

  it('rejoins the demo trial with setup_autopay after confirmed cancellation and clears that cancellation', async () => {
    const service = createVendorBillingContextService(async () => mapVendorContext(demoVendorContext('demo-vendor')))
    const first = await service.getStatus('demo-vendor')
    await service.submitCheckout(await service.prepareCheckout('demo-vendor', 'setup_autopay', 'setup'), null)
    await service.reconcileSimulatedCheckout!('demo-vendor')
    await service.requestCancellation('demo-vendor', 'cancel')
    const cancelled = await service.simulateCancellationProgress!('demo-vendor', 'cancellation_confirmed')
    expect(cancelled.availableActions).toEqual(['setup_autopay'])
    expect(cancelled.cancellation?.status).toBe('confirmed')

    const attempt = await service.prepareCheckout('demo-vendor', 'setup_autopay', 'rejoin')
    expect(attempt.expected.chargeAt).toBe(first.trial.endsAt)
    const prepared = await service.getStatus('demo-vendor')
    expect(prepared.cancellation).toBeNull()
    expect(prepared.authorisation.status).toBe('revoked')
    expect(prepared.revision).toBeGreaterThan(cancelled.revision)
    const pending = await service.submitCheckout(attempt, null)
    expect(pending.cancellation).toBeNull()
    expect(pending.trial).toEqual(first.trial)
    expect(pending.authorisation.status).toBe('pending')
  })
})
