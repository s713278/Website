import { afterEach, describe, expect, it, vi } from 'vitest'
import { createVendorBillingPreviewService, type BillingPreviewConfig } from './vendor-billing-preview.service'

const config: BillingPreviewConfig = {
  keyId: 'rzp_test_fixture',
  immediateSubscriptionId: 'sub_immediate',
  futureSubscriptionId: 'sub_future',
}
const callback = { razorpay_payment_id: 'pay_fixture', razorpay_subscription_id: 'sub_immediate', razorpay_signature: 'unverified-fixture' }

afterEach(() => vi.unstubAllEnvs())

describe('development vendor billing service', () => {
  it('preserves the original trial and access after an unverified early payment callback', async () => {
    const service = createVendorBillingPreviewService(config, 'trial')
    const before = await service.getStatus()
    const attempt = await service.prepareCheckout('paid_membership')
    const after = await service.submitCheckout(attempt, callback)

    expect(after.trial).toEqual(before.trial)
    expect(after.accessStatus).toBe('TRIAL')
    expect(after.canAccessPlatform).toBe(true)
    expect(after.payment).toBe('pending')
    expect(after.paidThrough).toBeNull()
    expect((await service.getStatus()).payment).toBe('pending')
    await expect(service.prepareCheckout('paid_membership')).rejects.toThrow()
  })

  it('does not activate the proposed authorised trial from a browser callback', async () => {
    const service = createVendorBillingPreviewService(config, 'setup')
    const attempt = await service.prepareCheckout('trial_authorisation')
    const after = await service.submitCheckout(attempt, { ...callback, razorpay_subscription_id: 'sub_future' })
    expect(after.authorisation).toBe('pending')
    expect(after.trial.status).toBe('not_started')
    expect(after.trial.endsAt).toBeNull()
    expect(after.canAccessPlatform).toBe(false)
    expect(after.payment).toBe('none')
  })

  it('does not grant access after the expired-trial Checkout returns', async () => {
    const service = createVendorBillingPreviewService(config, 'expired')
    const attempt = await service.prepareCheckout('paid_membership')
    const after = await service.submitCheckout(attempt, callback)
    expect(after.accessStatus).toBe('PAYMENT_REQUIRED')
    expect(after.canAccessPlatform).toBe(false)
  })

  it('keeps the trial unchanged when checkout is abandoned and permits an explicit retry', async () => {
    const service = createVendorBillingPreviewService(config, 'trial')
    const before = await service.getStatus()
    await service.prepareCheckout('paid_membership')
    await service.prepareCheckout('paid_membership')
    expect(await service.getStatus()).toEqual(before)
  })

  it('rejects mismatched or incomplete callback data without changing entitlement', async () => {
    const service = createVendorBillingPreviewService(config, 'trial')
    const before = await service.getStatus()
    const attempt = await service.prepareCheckout('paid_membership')
    await expect(service.submitCheckout(attempt, { ...callback, razorpay_subscription_id: 'sub_other' })).rejects.toThrow('mismatched')
    await expect(service.submitCheckout(attempt, { ...callback, razorpay_signature: '' })).rejects.toThrow('incomplete')
    await expect(service.submitCheckout({ ...attempt, attemptId: 'unknown' }, callback)).rejects.toThrow()
    expect(await service.getStatus()).toEqual(before)
  })

  it('refuses early conversion of an existing scheduled subscription without backend orchestration', async () => {
    const service = createVendorBillingPreviewService(config, 'authorised_trial')
    await expect(service.prepareCheckout('paid_membership')).rejects.toThrow('not available')
    expect((await service.getStatus()).earlyConversionRequiresBackend).toBe(true)
  })

  it('refuses live keys, missing subscriptions and a shared immediate/future subscription', async () => {
    await expect(createVendorBillingPreviewService({ ...config, keyId: 'rzp_live_fixture' }, 'trial').prepareCheckout('paid_membership')).rejects.toThrow('Test Mode')
    await expect(createVendorBillingPreviewService({ ...config, futureSubscriptionId: '' }, 'setup').prepareCheckout('trial_authorisation')).rejects.toThrow('future-start')
    await expect(createVendorBillingPreviewService({ ...config, futureSubscriptionId: config.immediateSubscriptionId }, 'setup').prepareCheckout('trial_authorisation')).rejects.toThrow('different subscriptions')
  })

  it('cannot be instantiated in a production build', () => {
    vi.stubEnv('DEV', false)
    expect(() => createVendorBillingPreviewService(config, 'trial')).toThrow('only in development')
  })
})
