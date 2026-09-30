import { ApiError, vendorBillingService as apiBillingService } from '@mithra/api-client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { liveBillingService } from './live-billing.service'

afterEach(() => {
  vi.restoreAllMocks()
})

const trialSubscription = {
  status: 'TRIAL',
  trial_started_at: '2026-09-12T10:00:00Z',
  trial_ends_at: '2026-10-26T18:30Z',
  auto_renew: false,
}

describe('liveBillingService.readSubscription', () => {
  it('returns the payload in wire shape for the session vendor', async () => {
    const request = vi.spyOn(apiBillingService, 'getSubscription').mockResolvedValue({
      success: true,
      data: trialSubscription,
    })
    const controller = new AbortController()

    await expect(
      liveBillingService.readSubscription('91', { signal: controller.signal }),
    ).resolves.toEqual({ kind: 'subscription', subscription: trialSubscription })
    expect(request).toHaveBeenCalledWith('91', { signal: controller.signal })
  })

  it('reports a 404 as a shop that is not live yet', async () => {
    vi.spyOn(apiBillingService, 'getSubscription').mockRejectedValue(
      new ApiError('Subscription not found', 404, {}, '/v1/vendors/91/subscription', 'not_found'),
    )

    await expect(liveBillingService.readSubscription('91')).resolves.toEqual({ kind: 'not-live' })
  })

  it.each([
    [400, 'validation'],
    [401, 'unauthorized'],
    [409, 'client'],
    [500, 'server'],
    [502, 'server'],
    [503, 'server'],
    [0, 'network'],
  ] as const)('keeps the normalized error for a %i', async (status, kind) => {
    const failure = new ApiError('Request failed', status, {}, '/v1/vendors/91/subscription', kind)
    vi.spyOn(apiBillingService, 'getSubscription').mockRejectedValue(failure)

    await expect(liveBillingService.readSubscription('91')).rejects.toBe(failure)
  })

  it('rejects a 200 envelope whose success is false', async () => {
    vi.spyOn(apiBillingService, 'getSubscription').mockResolvedValue({
      success: false,
      message: 'Billing is unavailable',
    })

    await expect(liveBillingService.readSubscription('91')).rejects.toMatchObject({
      name: 'ApiError',
      message: 'Billing is unavailable',
    })
  })
})

describe('liveBillingService writes and lists', () => {
  it('sends the plan code on subscribe and returns the checkout payload unmapped', async () => {
    const checkout = {
      status: 'PAYMENT_PENDING',
      razorpay_key_id: 'rzp_test_example',
      razorpay_subscription_id: 'sub_example',
      checkout_url: 'https://example.test/checkout',
    }
    const request = vi.spyOn(apiBillingService, 'subscribe').mockResolvedValue({
      success: true,
      data: checkout,
    })

    await expect(liveBillingService.subscribe('91', 'PLATFORM_MONTHLY')).resolves.toEqual(checkout)
    expect(request).toHaveBeenCalledWith('91', { plan_code: 'PLATFORM_MONTHLY' })
  })

  it('sends the three Checkout values on confirm', async () => {
    const payment = {
      razorpay_payment_id: 'pay_example',
      razorpay_subscription_id: 'sub_example',
      razorpay_signature: 'signature_example',
    }
    const request = vi.spyOn(apiBillingService, 'confirm').mockResolvedValue({
      success: true,
      data: { status: 'PAYMENT_PENDING' },
    })

    await expect(liveBillingService.confirm('91', payment)).resolves.toEqual({
      status: 'PAYMENT_PENDING',
    })
    expect(request).toHaveBeenCalledWith('91', payment)
  })

  it('returns the cancelled subscription, history and plans in wire shape', async () => {
    const cancelled = { status: 'ACTIVE', cancel_at_period_end: true }
    const history = [{ event_type: 'SUBSCRIPTION_CANCELLED' }]
    const plans = [{ plan_code: 'PLATFORM_MONTHLY', billing_cycle: 'MONTHLY', sale_price: 299 }]
    vi.spyOn(apiBillingService, 'cancel').mockResolvedValue({ success: true, data: cancelled })
    vi.spyOn(apiBillingService, 'getHistory').mockResolvedValue({ success: true, data: history })
    vi.spyOn(apiBillingService, 'listPaidPlans').mockResolvedValue({ success: true, data: plans })

    await expect(liveBillingService.cancel('91')).resolves.toEqual(cancelled)
    await expect(liveBillingService.readHistory('91')).resolves.toEqual(history)
    await expect(liveBillingService.listPaidPlans()).resolves.toEqual(plans)
  })

  it('keeps the normalized error when a write fails, even with a 404', async () => {
    const failure = new ApiError('Not found', 404, {}, '/v1/vendors/91/subscription/cancel', 'not_found')
    vi.spyOn(apiBillingService, 'cancel').mockRejectedValue(failure)

    await expect(liveBillingService.cancel('91')).rejects.toBe(failure)
  })

  it('rejects a write whose 200 envelope reports failure', async () => {
    vi.spyOn(apiBillingService, 'subscribe').mockResolvedValue({ success: false, message: 'No plan' })

    await expect(liveBillingService.subscribe('91', 'PLATFORM_MONTHLY')).rejects.toMatchObject({
      message: 'No plan',
    })
  })
})
