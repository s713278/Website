// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Options = ConstructorParameters<NonNullable<Window['Razorpay']>>[0]
type FailureHandler = Parameters<InstanceType<NonNullable<Window['Razorpay']>>['on']>[1]

let instances: FakeCheckout[] = []
class FakeCheckout {
  options: Options
  failure: FailureHandler | undefined
  open = vi.fn()
  close = vi.fn(() => this.options.modal.ondismiss())
  constructor(options: Options) {
    this.options = options
    instances.push(this)
  }
  on(_event: 'payment.failed', handler: FailureHandler) { this.failure = handler }
}

const config = { keyId: 'rzp_test_fixture', subscriptionId: 'sub_fixture', name: 'MithraDirect' }
const callback = { razorpay_payment_id: 'pay_fixture', razorpay_subscription_id: 'sub_fixture', razorpay_signature: 'unverified-fixture' }
let integration: typeof import('./razorpay-checkout')

beforeEach(async () => {
  vi.resetModules()
  integration = await import('./razorpay-checkout')
  instances = []
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
  document.querySelectorAll('script').forEach((script) => script.remove())
})

describe('Razorpay subscription Checkout', () => {
  it('loads one official script for concurrent callers and can retry a failed load', async () => {
    const first = integration.loadRazorpayCheckout()
    const second = integration.loadRazorpayCheckout()
    expect(first).toBe(second)
    expect(document.querySelectorAll('script')).toHaveLength(1)
    const rejected = expect(first).rejects.toThrow('Could not load')
    document.querySelector('script')?.dispatchEvent(new Event('error'))
    await rejected
    const retry = integration.loadRazorpayCheckout()
    const script = document.querySelector('script')
    expect(script?.src).toBe('https://checkout.razorpay.com/v1/checkout.js')
    vi.stubGlobal('Razorpay', FakeCheckout)
    script?.dispatchEvent(new Event('load'))
    await retry
  })

  it('times out stalled script loading instead of leaving Checkout busy forever', async () => {
    vi.useFakeTimers()
    const result = expect(integration.loadRazorpayCheckout()).rejects.toThrow('too long')
    await vi.advanceTimersByTimeAsync(15000)
    await result
    expect(document.querySelector('script')).toBeNull()
  })

  it('uses subscription inputs, allows a failed attempt to retry, and settles success once', async () => {
    vi.stubGlobal('Razorpay', FakeCheckout)
    const failure = vi.fn()
    const completed = vi.fn()
    const promise = integration.openSubscriptionCheckout(config, { onPaymentFailure: failure }).then((result) => { completed(result); return result })
    await Promise.resolve()
    const instance = instances[0]
    expect(instance.options).toMatchObject({ key: config.keyId, subscription_id: config.subscriptionId, retry: { enabled: true } })
    expect(instance.options).not.toHaveProperty('order_id')
    expect(instance.options).not.toHaveProperty('amount')
    instance.failure?.({ error: { description: 'Test payment declined' } })
    await Promise.resolve()
    expect(failure).toHaveBeenCalledWith('Test payment declined')
    expect(completed).not.toHaveBeenCalled()
    instance.options.handler(callback)
    instance.options.modal.ondismiss()
    expect(await promise).toEqual({ status: 'submitted', callback })
    expect(completed).toHaveBeenCalledTimes(1)
    instance.failure?.({ error: { description: 'Late failure' } })
    expect(failure).toHaveBeenCalledTimes(1)
  })

  it('returns dismissal without inventing a failed payment or confirmation', async () => {
    vi.stubGlobal('Razorpay', FakeCheckout)
    const promise = integration.openSubscriptionCheckout(config)
    await Promise.resolve()
    instances[0].options.modal.ondismiss()
    expect(await promise).toEqual({ status: 'dismissed' })
  })

  it('closes Checkout on teardown and ignores late callbacks', async () => {
    vi.stubGlobal('Razorpay', FakeCheckout)
    const controller = new AbortController()
    const promise = integration.openSubscriptionCheckout(config, { signal: controller.signal })
    const aborted = expect(promise).rejects.toMatchObject({ name: 'AbortError' })
    await Promise.resolve()
    controller.abort()
    instances[0].options.handler(callback)
    await aborted
    expect(instances[0].close).toHaveBeenCalledTimes(1)
  })

  it('does not open a modal when the page leaves during script loading', async () => {
    const controller = new AbortController()
    const promise = integration.openSubscriptionCheckout(config, { signal: controller.signal })
    const aborted = expect(promise).rejects.toMatchObject({ name: 'AbortError' })
    controller.abort()
    vi.stubGlobal('Razorpay', FakeCheckout)
    document.querySelector('script')?.dispatchEvent(new Event('load'))
    await aborted
    expect(instances).toHaveLength(0)
  })
})
