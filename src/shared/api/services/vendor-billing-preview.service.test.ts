import { afterEach, describe, expect, it, vi } from 'vitest'
import { createVendorBillingPreviewService, type BillingPreviewConfig } from './vendor-billing-preview.service'

const vendorId = '900001'
const config: BillingPreviewConfig = {
  keyId: 'rzp_test_fixture',
  immediateSubscriptionId: 'sub_immediate',
  futureSubscriptionId: 'sub_future',
  futureStartAt: '2026-10-15T10:00:00Z',
}
const callback = { razorpay_payment_id: 'pay_fixture', razorpay_subscription_id: 'sub_future', razorpay_signature: 'unverified-fixture' }

afterEach(() => vi.unstubAllEnvs())

describe('development vendor billing preview service', () => {
  it('stamps preview provenance and keeps an unconfigured setup simulated', async () => {
    const service = createVendorBillingPreviewService({ ...config, keyId: '', futureStartAt: '' }, 'trial_active')
    const before = await service.getStatus(vendorId)
    const attempt = await service.prepareCheckout(vendorId, 'setup_autopay', 'simulated')
    expect(before.source).toBe('preview')
    expect(attempt.mode).toBe('simulated')
    expect(attempt.config).toBeNull()
    const pending = await service.submitCheckout(attempt, null)
    expect(pending.trial).toEqual(before.trial)
    expect(pending.authorisation.status).toBe('pending')
    expect((await service.reconcileSimulatedCheckout!(vendorId, 'failed')).authorisation.status).toBe('failed')
    await service.submitCheckout(attempt, null)
    expect((await service.reconcileSimulatedCheckout!(vendorId)).authorisation.status).toBe('confirmed')
  })

  it('uses a separate future-start Test object only when its inspected date matches the trial expiry', async () => {
    const mismatched = createVendorBillingPreviewService({ ...config, futureStartAt: '2026-10-16T10:00:00Z' }, 'trial_active')
    expect((await mismatched.prepareCheckout(vendorId, 'setup_autopay', 'mismatch')).mode).toBe('simulated')

    const service = createVendorBillingPreviewService(config, 'trial_active')
    const before = await service.getStatus(vendorId)
    const attempt = await service.prepareCheckout(vendorId, 'setup_autopay', 'matched')
    expect(attempt.mode).toBe('provider')
    expect(attempt.config?.subscriptionId).toBe('sub_future')
    const pending = await service.submitCheckout(attempt, callback)
    expect(pending.trial).toEqual(before.trial)
    expect(pending.authorisation.status).toBe('pending')
    expect(pending.membership.paymentStatus).toBe('none')
    await expect(service.reconcileSimulatedCheckout!(vendorId)).rejects.toThrow('cannot be simulated')
  })

  it('cannot pretend to cancel a real Test subscription or advance refunds from its callback', async () => {
    const service = createVendorBillingPreviewService(config, 'trial_active')
    const attempt = await service.prepareCheckout(vendorId, 'setup_autopay', 'provider-setup')
    const pending = await service.submitCheckout(attempt, callback)
    await expect(service.requestCancellation(vendorId, 'cancel')).rejects.toThrow('cannot cancel a Razorpay Test subscription')
    await expect(service.simulateCancellationProgress!(vendorId, 'cancellation_confirmed')).rejects.toThrow('cannot be simulated')
    expect(await service.getStatus(vendorId)).toEqual(pending)

    const fixtureOnly = createVendorBillingPreviewService(config, 'setup_confirmed')
    const requested = await fixtureOnly.requestCancellation(vendorId, 'fixture-cancel')
    expect(requested.source).toBe('preview')
    expect(requested.cancellation?.status).toBe('requested')
  })

  it('uses immediate-start Test Checkout only for an expired first fee and leaves access unconfirmed', async () => {
    const service = createVendorBillingPreviewService(config, 'trial_expired')
    const attempt = await service.prepareCheckout(vendorId, 'pay_first_fee', 'expired')
    expect(attempt.mode).toBe('provider')
    expect(attempt.expected.chargeAt).toBeNull()
    expect(attempt.config?.subscriptionId).toBe('sub_immediate')
    const pending = await service.submitCheckout(attempt, { ...callback, razorpay_subscription_id: 'sub_immediate' })
    expect(pending.accessStatus).toBe('TRIAL_ENDED')
    expect(pending.membership.paymentStatus).toBe('pending')
  })

  it('rejects live keys, shared subscriptions and mismatched callbacks without changing status', async () => {
    await expect(createVendorBillingPreviewService({ ...config, keyId: 'rzp_live_fixture' }, 'trial_active').prepareCheckout(vendorId, 'setup_autopay', 'live')).rejects.toThrow('Test Mode')
    await expect(createVendorBillingPreviewService({ ...config, futureSubscriptionId: config.immediateSubscriptionId }, 'trial_active').prepareCheckout(vendorId, 'setup_autopay', 'shared')).rejects.toThrow('different subscriptions')
    const service = createVendorBillingPreviewService(config, 'trial_active')
    const before = await service.getStatus(vendorId)
    const attempt = await service.prepareCheckout(vendorId, 'setup_autopay', 'valid')
    await expect(service.submitCheckout(attempt, { ...callback, razorpay_subscription_id: 'sub_other' })).rejects.toThrow('mismatched')
    expect(await service.getStatus(vendorId)).toEqual(before)
  })

  it('cannot be instantiated in a production build', () => {
    vi.stubEnv('DEV', false)
    expect(() => createVendorBillingPreviewService(config, 'trial_active')).toThrow('only in development')
  })
})
