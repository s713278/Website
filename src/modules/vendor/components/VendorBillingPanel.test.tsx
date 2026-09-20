// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createVendorBillingPreviewService } from '@/shared/api'
import * as checkout from '@/shared/payments/razorpay-checkout'
import { VendorBillingPanel } from './VendorBillingPanel'

const config = { keyId: 'rzp_test_fixture', immediateSubscriptionId: 'sub_immediate', futureSubscriptionId: 'sub_future' }
const callback = { razorpay_payment_id: 'pay_fixture', razorpay_subscription_id: 'sub_immediate', razorpay_signature: 'unverified-fixture' }

afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('VendorBillingPanel', () => {
  it('continues a service-confirmed free trial without opening Checkout', async () => {
    const open = vi.spyOn(checkout, 'openSubscriptionCheckout').mockResolvedValue({ status: 'dismissed' })
    const service = createVendorBillingPreviewService(config, 'trial')
    const prepare = vi.spyOn(service, 'prepareCheckout')
    render(<VendorBillingPanel service={service} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Continue free trial' }))
    expect(screen.getByText(/No Checkout is needed/)).toBeTruthy()
    expect(open).not.toHaveBeenCalled()
    expect(prepare).not.toHaveBeenCalled()
  })

  it('requires early-conversion consent and preserves trial access through unverified success', async () => {
    const open = vi.spyOn(checkout, 'openSubscriptionCheckout').mockResolvedValue({ status: 'submitted', callback })
    const service = createVendorBillingPreviewService(config, 'trial')
    const before = await service.getStatus()
    render(<VendorBillingPanel service={service} />)
    const pay = await screen.findByRole('button', { name: /Pay ₹299 now/ })
    expect(pay.hasAttribute('disabled')).toBe(true)
    fireEvent.click(pay)
    expect(open).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(pay)
    await screen.findByText(/Callback received/)
    expect((await service.getStatus()).trial).toEqual(before.trial)
    expect(screen.getByText('TRIAL')).toBeTruthy()
    expect(screen.queryByText('Confirmed paid')).toBeNull()
    expect(open).toHaveBeenCalledTimes(1)
  })

  it('keeps Option B setup pending rather than activating a trial from the callback', async () => {
    vi.spyOn(checkout, 'openSubscriptionCheckout').mockResolvedValue({ status: 'submitted', callback: { ...callback, razorpay_subscription_id: 'sub_future' } })
    render(<VendorBillingPanel service={createVendorBillingPreviewService(config, 'setup')} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Set up AutoPay and start trial' }))
    await screen.findByText(/Callback received/)
    expect(screen.getByText(/Your trial has not started/)).toBeTruthy()
    expect(screen.getByText('Not available')).toBeTruthy()
    expect(screen.queryByText('TRIAL')).toBeNull()
    expect(screen.queryByText('Confirmed paid')).toBeNull()
  })

  it('retains entitlement and allows retry when Checkout fails and is dismissed', async () => {
    vi.spyOn(checkout, 'openSubscriptionCheckout').mockImplementation(async (_config, options) => {
      options?.onPaymentFailure?.('Test card declined')
      return { status: 'dismissed' }
    })
    const service = createVendorBillingPreviewService(config, 'trial')
    const before = await service.getStatus()
    render(<VendorBillingPanel service={service} />)
    const pay = await screen.findByRole('button', { name: /Pay ₹299 now/ })
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(pay)
    await screen.findByText(/closed after a failed attempt/)
    expect(screen.getByRole('alert').textContent).toBe('Test card declined')
    expect(pay.hasAttribute('disabled')).toBe(false)
    expect(await service.getStatus()).toEqual(before)
  })

  it('prevents duplicate opens and ignores a callback after unmount', async () => {
    let resolve!: (result: checkout.SubscriptionCheckoutResult) => void
    const open = vi.spyOn(checkout, 'openSubscriptionCheckout').mockImplementation(() => new Promise((done) => { resolve = done }))
    const service = createVendorBillingPreviewService(config, 'expired')
    const submit = vi.spyOn(service, 'submitCheckout')
    const view = render(<VendorBillingPanel service={service} />)
    const pay = await screen.findByRole('button', { name: /Pay ₹299 now/ })
    fireEvent.click(pay)
    fireEvent.click(pay)
    await waitFor(() => expect(open).toHaveBeenCalledTimes(1))
    view.unmount()
    expect(open.mock.calls[0][1]?.signal?.aborted).toBe(true)
    resolve({ status: 'submitted', callback })
    await Promise.resolve()
    expect(submit).not.toHaveBeenCalled()
  })
})
