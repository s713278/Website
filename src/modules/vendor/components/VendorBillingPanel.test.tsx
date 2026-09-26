// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createVendorBillingMockService, createVendorBillingPreviewService, type VendorBillingService } from '@/shared/api'
import * as checkout from '@/shared/payments/razorpay-checkout'
import { VendorBillingPanel } from './VendorBillingPanel'
import { assertApiSuccess } from '@/shared/api'
import fixtures from '../../../../docs/examples/vendor-billing/mock-responses.json'

const vendorId = '900001'
const config = { keyId: 'rzp_test_fixture', immediateSubscriptionId: 'sub_immediate', futureSubscriptionId: 'sub_future', futureStartAt: '2026-10-15T10:00:00Z' }
const callback = { razorpay_payment_id: 'pay_fixture', razorpay_subscription_id: 'sub_future', razorpay_signature: 'unverified-fixture' }

afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('VendorBillingPanel', () => {
  it('shows independent trial, authorisation and fee facts; simulated setup preserves the trial', async () => {
    const open = vi.spyOn(checkout, 'openSubscriptionCheckout')
    const service = createVendorBillingMockService('trial_active')
    render(<VendorBillingPanel service={service} vendorId={vendorId} />)
    await screen.findByRole('button', { name: 'Pay Now' })
    expect(screen.getByText(/10 days remaining/).textContent).toContain('IST')
    expect(screen.getByText(/first monthly platform fee is scheduled/).textContent).toContain('15 Oct 2026')
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(screen.queryByText(/Option A|Option B|Continue free trial/)).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Pay Now' }))
    await screen.findByText(/Simulated billing acknowledgement received/)
    expect(screen.getByText(/10 days remaining/)).toBeTruthy()
    expect(screen.getByText('TRIAL')).toBeTruthy()
    expect(screen.getByText(/separate payment-method authorisation amount of ₹5/)).toBeTruthy()
    expect(screen.getByText('No confirmed payment')).toBeTruthy()
    expect(open).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Simulate confirmation' }))
    await screen.findByText(/Simulated billing confirmation is complete/)
    expect(screen.getByText('Confirmed')).toBeTruthy()
    expect(screen.getByText(/Next platform fee scheduled/).textContent).toContain('15 Oct 2026')
    expect(screen.getByText('TRIAL')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Pay Now' })).toBeNull()
  })

  it('keeps pending setup and setup-incomplete explanations honest', async () => {
    const view = render(<VendorBillingPanel service={createVendorBillingMockService('approval_pending')} vendorId={vendorId} />)
    await screen.findByText(/Your trial has not started/)
    expect(screen.getByText(/Await store approval/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Pay Now' })).toBeNull()
    expect(screen.queryByText(/Trial access until/)).toBeNull()

    view.rerender(<VendorBillingPanel service={createVendorBillingMockService('trial_ineligible')} vendorId={vendorId} />)
    await screen.findByText(/not eligible for a new trial/)
    expect(screen.getByText(/first ₹299 platform fee is collected now/)).toBeTruthy()
    expect(screen.queryByText(/Trial access until/)).toBeNull()
  })

  it('renders supplied notice text and offers cancellation only where the source lists it', async () => {
    const view = render(<VendorBillingPanel service={createVendorBillingMockService('trial_three_days')} vendorId={vendorId} />)
    await screen.findByText(/Your trial ends in 3 days/)
    expect(screen.queryByRole('button', { name: /cancel/i })).toBeNull()
    view.rerender(<VendorBillingPanel service={createVendorBillingMockService('trial_active')} vendorId={vendorId} />)
    await screen.findByRole('button', { name: 'Pay Now' })
    expect(screen.queryByRole('button', { name: /cancel/i })).toBeNull()
    view.rerender(<VendorBillingPanel service={createVendorBillingMockService('setup_confirmed')} vendorId={vendorId} />)
    await screen.findByText(/Next platform fee scheduled/)
    expect(screen.getByRole('button', { name: 'Cancel AutoPay' })).toBeTruthy()
    expect(screen.getByText('TRIAL')).toBeTruthy()
  })

  it('confirms trial cancellation in a second step, sends one request and keeps the identical expiry', async () => {
    const service = createVendorBillingMockService('setup_confirmed')
    const cancel = vi.spyOn(service, 'requestCancellation')
    render(<VendorBillingPanel service={service} vendorId={vendorId} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel AutoPay' }))
    expect(cancel).not.toHaveBeenCalled()
    const dialog = screen.getByRole('group', { name: 'Confirm cancellation' })
    expect(dialog.textContent).toContain('You keep your trial until 15 Oct 2026')
    expect(dialog.textContent).toMatch(/stop future platform fee collection/)
    expect(dialog.textContent).toMatch(/pending until it is confirmed/)
    expect(dialog.textContent).toMatch(/cannot be undone at the payment provider/)
    expect(dialog.textContent).toMatch(/set up billing again with Pay Now before 15 Oct 2026.*no new trial and no duplicate fee/)
    expect(dialog.textContent).not.toMatch(/current month|30 days|prorated/)

    const confirm = screen.getByRole('button', { name: 'Confirm cancellation' })
    fireEvent.click(confirm)
    fireEvent.click(confirm)
    await screen.findByText('Cancellation requested')
    expect(cancel).toHaveBeenCalledTimes(1)
    expect(cancel).toHaveBeenCalledWith(vendorId, expect.any(String))
    expect(screen.getByText(/Cancellation request acknowledged/)).toBeTruthy()
    expect(screen.getByText(/Stopping future collection is not confirmed yet/)).toBeTruthy()
    expect(screen.queryByText(/Cancellation confirmed/)).toBeNull()
    expect(screen.getByText(/Trial access until/).textContent).toContain('15 Oct 2026')
    expect(screen.getByText('Simulated · cancellation progress')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Cancel AutoPay' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Simulate cancellation confirmed' }))
    await screen.findByText('Cancellation confirmed')
    expect(screen.getByText(/Future collection for this agreement has stopped/)).toBeTruthy()
    expect(screen.getByText(/Trial access until/).textContent).toContain('15 Oct 2026')
    expect(screen.getByText('TRIAL')).toBeTruthy()
    expect(cancel).toHaveBeenCalledTimes(1)
  })

  it('keeps a failed trial cancellation explicitly unconfirmed with refresh available', async () => {
    render(<VendorBillingPanel service={createVendorBillingMockService('setup_confirmed')} vendorId={vendorId} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel AutoPay' }))
    fireEvent.click(screen.getByRole('button', { name: 'Keep AutoPay' }))
    expect(screen.queryByRole('group', { name: 'Confirm cancellation' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel AutoPay' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm cancellation' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Simulate cancellation failure' }))
    await screen.findByText('Cancellation not confirmed')
    expect(screen.getByText(/Cancellation is not confirmed; refresh before retrying/)).toBeTruthy()
    expect(screen.queryByText('Cancellation confirmed')).toBeNull()
    expect(screen.getByText(/Trial access until/).textContent).toContain('15 Oct 2026')
    expect(screen.getByRole('button', { name: 'Refresh billing status' }).hasAttribute('disabled')).toBe(false)
  })

  it('schedules paid renewal cancellation with the supplied paid-through date and no prorated refund', async () => {
    const service = createVendorBillingMockService('paid_active')
    render(<VendorBillingPanel service={service} vendorId={vendorId} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel AutoPay' }))
    const dialog = screen.getByRole('group', { name: 'Confirm cancellation' })
    expect(dialog.textContent).toContain('You keep paid access through 15 Nov 2026')
    expect(dialog.textContent).toMatch(/no automatic prorated refund/)
    expect(dialog.textContent).toMatch(/Pay Now before 15 Nov 2026/)
    fireEvent.click(screen.getByRole('button', { name: 'Confirm cancellation' }))
    await screen.findByText('Renewal cancellation scheduled')
    expect(screen.queryByText('Cancellation requested')).toBeNull()
    expect(screen.queryByText('Cancellation confirmed')).toBeNull()
    expect(screen.getByText('PAID')).toBeTruthy()
    expect(screen.getByText(/Confirmed paid coverage through/).textContent).toContain('15 Nov 2026')
    expect(screen.getByText('No further platform fee is scheduled.')).toBeTruthy()
    expect(screen.queryByText(/Next platform fee scheduled/)).toBeNull()
  })

  it.each([
    ['refund_success', 'Simulate refund completed', 'Refund completed'],
    ['refund_failure', 'Simulate refund failure', 'Refund failed'],
  ])('shows %s progress independently of cancellation and access', async (_journey, finalStep, finalLabel) => {
    const open = vi.spyOn(checkout, 'openSubscriptionCheckout')
    render(<VendorBillingPanel service={createVendorBillingMockService('paid_active')} vendorId={vendorId} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel AutoPay' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm cancellation' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Simulate renewal debit racing the cancellation' }))
    await screen.findByText('Refund owed')
    expect(screen.getByText(/refunded in full/)).toBeTruthy()
    expect(screen.getByText('Cancellation confirmed')).toBeTruthy()
    expect(screen.getByText('PAYMENT_REQUIRED')).toBeTruthy()
    expect(screen.getByText('Last fee confirmed')).toBeTruthy()
    expect(screen.queryByText('Confirmed paid')).toBeNull()
    expect(screen.queryByText(/Confirmed paid coverage through/)).toBeNull()
    expect(screen.getByText(/Last confirmed paid coverage ended/).textContent).toContain('15 Nov 2026')
    expect(screen.getByText(/never add access or change your coverage dates/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Simulate refund started' }))
    await screen.findByText('Refund in progress')
    expect(screen.getByText(/not instant/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: finalStep }))
    await screen.findByText(finalLabel)
    expect(screen.getByText(/Last confirmed paid coverage ended/).textContent).toContain('15 Nov 2026')
    expect(screen.getByText('PAYMENT_REQUIRED')).toBeTruthy()
    if (finalLabel === 'Refund failed') {
      expect(screen.getByText(/₹299 is still owed/)).toBeTruthy()
      expect(screen.getByText('The refund is still owed. Support must retry the refund.')).toBeTruthy()
    }
    expect(screen.queryByText(/instant refund|refunded instantly/i)).toBeNull()
    expect(screen.queryByRole('button', { name: /Simulate refund/ })).toBeNull()
    expect(open).not.toHaveBeenCalled()
  })

  it('renders a backend-supplied combined refund summary without summing a private ledger', async () => {
    // Authorised derivation: two unresolved race refunds reported as one combined, failed summary.
    const base = createVendorBillingMockService('refund_pending')
    const pending = await base.getStatus(vendorId)
    const service: VendorBillingService = { ...base, getStatus: async () => ({ ...pending, refund: { status: 'failed', amountMinor: 59800 } }) }
    render(<VendorBillingPanel service={service} vendorId={vendorId} />)
    await screen.findByText('Refund failed')
    expect(screen.getByText(/₹598 is still owed/)).toBeTruthy()
    expect(screen.getByText(/total across every unintended fee/)).toBeTruthy()
    expect(screen.queryByText(/₹897|₹299 is still owed/)).toBeNull()
    expect(screen.getByText('PAYMENT_REQUIRED')).toBeTruthy()
  })

  it('reconciles a lost cancellation response before recovery and reuses its key', async () => {
    const base = createVendorBillingMockService('setup_confirmed')
    const keys: string[] = []
    let lose = true
    const service: VendorBillingService = { ...base, requestCancellation: async (id, key) => {
      keys.push(key)
      if (lose) { lose = false; throw new Error('cancellation response lost') }
      return base.requestCancellation(id, key)
    } }
    const read = vi.spyOn(service, 'getStatus')
    render(<VendorBillingPanel service={service} vendorId={vendorId} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel AutoPay' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm cancellation' }))
    await screen.findByText(/cancellation outcome is unconfirmed/)
    expect(screen.getAllByRole('alert').some((alert) => alert.textContent === 'cancellation response lost')).toBe(true)
    await waitFor(() => expect(read).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel AutoPay' }).hasAttribute('disabled')).toBe(false))
    expect(screen.queryByText(/Cancellation (requested|confirmed)/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel AutoPay' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm cancellation' }))
    await screen.findByText('Cancellation requested')
    expect(keys).toHaveLength(2)
    expect(keys[0]).toBe(keys[1])
  })

  it('retires a lost cancellation key once a read shows the request landed', async () => {
    const base = createVendorBillingMockService('setup_confirmed')
    const replacement = { ...(await base.getStatus(vendorId)), revision: 50 }
    const keys: string[] = []
    let replaced = false
    const service: VendorBillingService = { ...base,
      getStatus: async (id) => replaced ? replacement : base.getStatus(id),
      requestCancellation: async (id, key) => {
        keys.push(key)
        if (keys.length === 1) { await base.requestCancellation(id, key); throw new Error('landed but lost') }
        return { ...replacement, revision: 51, availableActions: [], cancellation: { status: 'requested', requestedAt: replacement.serverTime, effectiveAt: null } }
      },
    }
    render(<VendorBillingPanel service={service} vendorId={vendorId} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel AutoPay' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm cancellation' }))
    await screen.findByText('Cancellation requested')
    // A later agreement offers cancel again; its cancellation is a new logical request.
    replaced = true
    fireEvent.click(screen.getByRole('button', { name: 'Refresh billing status' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel AutoPay' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm cancellation' }))
    await waitFor(() => expect(keys).toHaveLength(2))
    expect(keys[1]).not.toBe(keys[0])
  })

  it('claims no retained coverage when cancelling without trial or paid access', async () => {
    const base = createVendorBillingMockService('renewal_failed')
    const status = await base.getStatus(vendorId)
    render(<VendorBillingPanel service={{ ...base, getStatus: async () => ({ ...status, availableActions: ['cancel'] }) }} vendorId={vendorId} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel AutoPay' }))
    const dialog = screen.getByRole('group', { name: 'Confirm cancellation' }).textContent
    expect(dialog).toMatch(/does not restore or extend access/)
    expect(dialog).not.toMatch(/You keep|15 Nov 2026|prorated/)
  })

  it('keeps a lost cancellation unconfirmed and mutations disabled while its read fails', async () => {
    const base = createVendorBillingMockService('setup_confirmed')
    const initial = await base.getStatus(vendorId)
    const service: VendorBillingService = { ...base,
      getStatus: vi.fn().mockResolvedValueOnce(initial).mockRejectedValue(new Error('refresh unavailable')),
      requestCancellation: async () => { throw new Error('acknowledgement lost') },
    }
    render(<VendorBillingPanel service={service} vendorId={vendorId} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel AutoPay' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm cancellation' }))
    await screen.findByText('refresh unavailable')
    expect(screen.getByText(/Last confirmed billing snapshot is stale/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Cancel AutoPay' }).hasAttribute('disabled')).toBe(true)
    expect(screen.queryByText(/Cancellation (requested|confirmed)/)).toBeNull()
    expect(screen.getByText(/Trial access until/).textContent).toContain('15 Oct 2026')
  })

  it('requires confirmation when preparation changes the displayed schedule', async () => {
    const base = createVendorBillingMockService('trial_active')
    const service: VendorBillingService = {
      ...base,
      prepareCheckout: async (...args) => {
        const attempt = await base.prepareCheckout(...args)
        return { ...attempt, expected: { ...attempt.expected, chargeAt: '2026-10-16T10:00:00Z' } }
      },
    }
    const submit = vi.spyOn(service, 'submitCheckout')
    render(<VendorBillingPanel service={service} vendorId={vendorId} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Pay Now' }))
    await screen.findByRole('button', { name: 'Confirm updated schedule' })
    expect(submit).not.toHaveBeenCalled()
    expect(screen.getByText(/Prepared first fee/).textContent).toContain('16 Oct 2026')
    fireEvent.click(screen.getByRole('button', { name: 'Confirm updated schedule' }))
    await screen.findByText(/Simulated billing acknowledgement received/)
    expect(submit).toHaveBeenCalledTimes(1)
  })

  it('discloses the supplied authorisation amount separately from the platform fee', async () => {
    const base = createVendorBillingMockService('trial_active')
    const service: VendorBillingService = {
      ...base,
      prepareCheckout: async (...args) => {
        const attempt = await base.prepareCheckout(...args)
        return { ...attempt, expected: { ...attempt.expected, authorisationAmountMinor: 70000 } }
      },
    }
    render(<VendorBillingPanel service={service} vendorId={vendorId} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Pay Now' }))
    await screen.findByText(/separate payment-method authorisation amount of ₹700/)
    expect(screen.getAllByText(/₹299/).length).toBeGreaterThan(0)
  })

  it('keeps a real Test callback pending and never offers simulated verification', async () => {
    const open = vi.spyOn(checkout, 'openSubscriptionCheckout').mockResolvedValue({ status: 'submitted', callback })
    const service = createVendorBillingPreviewService(config, 'trial_active')
    render(<VendorBillingPanel service={service} vendorId={vendorId} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Pay Now' }))
    await screen.findByText(/Test Checkout callback received/)
    expect(open).toHaveBeenCalledTimes(1)
    expect(screen.getByText('TRIAL')).toBeTruthy()
    expect(screen.getByText('No confirmed payment')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Simulate confirmation' })).toBeNull()
  })

  it('opens at most one modal and aborts late Checkout work on teardown', async () => {
    let resolve!: (result: checkout.SubscriptionCheckoutResult) => void
    const open = vi.spyOn(checkout, 'openSubscriptionCheckout').mockImplementation(() => new Promise((done) => { resolve = done }))
    const service = createVendorBillingPreviewService(config, 'trial_active')
    const submit = vi.spyOn(service, 'submitCheckout')
    const view = render(<VendorBillingPanel service={service} vendorId={vendorId} />)
    const pay = await screen.findByRole('button', { name: 'Pay Now' })
    fireEvent.click(pay)
    fireEvent.click(pay)
    await waitFor(() => expect(open).toHaveBeenCalledTimes(1))
    view.unmount()
    expect(open.mock.calls[0][1]?.signal?.aborted).toBe(true)
    resolve({ status: 'submitted', callback })
    await Promise.resolve()
    expect(submit).not.toHaveBeenCalled()
  })

  it('shows billing unavailable with refresh and no mutation after a failed read', async () => {
    const service = createVendorBillingMockService('trial_active')
    vi.spyOn(service, 'getStatus').mockRejectedValue(new Error('Status read failed'))
    render(<VendorBillingPanel service={service} vendorId={vendorId} />)
    await screen.findByRole('alert')
    expect(screen.getByRole('alert').textContent).toContain('Status read failed')
    expect(screen.getByRole('button', { name: 'Refresh billing status' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Pay Now' })).toBeNull()
  })

  it('marks a failed refresh stale and disables mutations until a valid new status arrives', async () => {
    const service = createVendorBillingMockService('trial_active')
    const initial = await service.getStatus(vendorId)
    vi.spyOn(service, 'getStatus').mockResolvedValueOnce(initial).mockRejectedValueOnce(new Error('refresh offline'))
      .mockResolvedValueOnce({ ...initial, revision: initial.revision + 1 })
    render(<VendorBillingPanel service={service} vendorId={vendorId} />)
    const pay = await screen.findByRole('button', { name: 'Pay Now' })
    fireEvent.click(screen.getByRole('button', { name: 'Refresh billing status' }))
    await screen.findByText(/Last confirmed billing snapshot is stale/)
    expect(pay.hasAttribute('disabled')).toBe(true)
    expect(screen.getByText('TRIAL')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Refresh billing status' }))
    await waitFor(() => expect(pay.hasAttribute('disabled')).toBe(false))
    expect(screen.queryByText(/Last confirmed billing snapshot is stale/)).toBeNull()
  })

  it('keeps the newer status when a lower revision arrives', async () => {
    const service = createVendorBillingMockService('trial_active')
    const initial = await service.getStatus(vendorId)
    vi.spyOn(service, 'getStatus').mockResolvedValueOnce({ ...initial, revision: 3 })
      .mockResolvedValueOnce({ ...initial, revision: 2, accessStatus: 'TRIAL_ENDED' })
    render(<VendorBillingPanel service={service} vendorId={vendorId} />)
    await screen.findByText('TRIAL')
    fireEvent.click(screen.getByRole('button', { name: 'Refresh billing status' }))
    await screen.findByText(/Last confirmed billing snapshot is stale/)
    expect(screen.getByText('TRIAL')).toBeTruthy()
    expect(screen.queryByText('TRIAL_ENDED')).toBeNull()
  })

  it('refreshes on focus and stops retrying a failed past-boundary status', async () => {
    const service = createVendorBillingMockService('trial_active')
    const initial = await service.getStatus(vendorId)
    const serverTime = new Date().toISOString()
    const pastBoundary = new Date(Date.now() - 1000).toISOString()
    const read = vi.spyOn(service, 'getStatus').mockResolvedValueOnce({ ...initial, serverTime,
      trial: { ...initial.trial, endsAt: pastBoundary } }).mockRejectedValueOnce(new Error('boundary offline'))
      .mockResolvedValue({ ...initial, serverTime, trial: { ...initial.trial, endsAt: pastBoundary } })
    render(<VendorBillingPanel service={service} vendorId={vendorId} />)
    await screen.findByText(/Last confirmed billing snapshot is stale/)
    expect(read).toHaveBeenCalledTimes(2)
    await new Promise((resolve) => setTimeout(resolve, 30))
    expect(read).toHaveBeenCalledTimes(2)
    fireEvent.focus(window)
    await waitFor(() => expect(read).toHaveBeenCalledTimes(3))
    expect(screen.getByText('TRIAL')).toBeTruthy()
  })

  it('queues the boundary read when a billing action is still in flight', async () => {
    const service = createVendorBillingMockService('trial_active')
    const originalRead = service.getStatus
    const initial = await originalRead(vendorId)
    const serverTime = new Date().toISOString()
    const boundary = new Date(Date.now() + 1000).toISOString()
    const read = vi.spyOn(service, 'getStatus')
      .mockResolvedValueOnce({ ...initial, serverTime, trial: { ...initial.trial, endsAt: boundary } })
      .mockImplementation(originalRead)
    const prepared = await service.prepareCheckout(vendorId, 'setup_autopay', 'held-at-boundary')
    let resolvePrepare!: (attempt: typeof prepared) => void
    vi.spyOn(service, 'prepareCheckout').mockImplementation(() => new Promise((resolve) => { resolvePrepare = resolve }))
    render(<VendorBillingPanel service={service} vendorId={vendorId} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Pay Now' }))
    await screen.findByText(/Last confirmed billing snapshot is stale/)
    expect(read).toHaveBeenCalledTimes(1)
    resolvePrepare({ ...prepared, expected: { ...prepared.expected, chargeAt: boundary } })
    await waitFor(() => expect(read).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.queryByText(/Last confirmed billing snapshot is stale/)).toBeNull())
  })

  it('explains restricted access from the supplied visibility and capabilities', async () => {
    render(<VendorBillingPanel service={createVendorBillingMockService('trial_expired')} vendorId={vendorId} />)
    const explanation = await screen.findByText(/new orders are blocked/)
    expect(explanation.textContent).toContain('Billing and account remain available')
    expect(explanation.textContent).toContain('existing orders can still be viewed')
    expect(explanation.textContent).toContain('orders placed before expiry can still be fulfilled')
  })

  it('keeps expired signup restricted until explicit simulated first-fee reconciliation', async () => {
    const open = vi.spyOn(checkout, 'openSubscriptionCheckout')
    render(<VendorBillingPanel service={createVendorBillingMockService('trial_expired')} vendorId={vendorId} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Pay Now' }))
    await screen.findByText(/Simulated billing acknowledgement received/)
    expect(screen.getByText('TRIAL_ENDED')).toBeTruthy()
    expect(screen.getAllByText('Confirmation pending')).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: 'Simulate failure' }))
    await screen.findByText(/Simulated attempt failed/)
    expect(screen.getByText('TRIAL_ENDED')).toBeTruthy()
    expect(screen.getByText(/retries the failed first ₹299 platform fee/)).toBeTruthy()
    expect(screen.queryByText(/starts an immediate subscription/)).toBeNull()
    expect(screen.queryByText(/Confirmed paid/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Pay Now' }))
    await screen.findByText(/Simulated billing acknowledgement received/)
    fireEvent.click(screen.getByRole('button', { name: 'Simulate confirmation' }))
    await screen.findByText('PAID')
    expect(screen.getByText('Confirmed paid')).toBeTruthy()
    expect(open).not.toHaveBeenCalled()
  })

  it('shows changed fee and now-versus-future schedule before Checkout and respects decline', async () => {
    const base = createVendorBillingMockService('trial_active')
    const service: VendorBillingService = { ...base, prepareCheckout: async (...args) => {
      const prepared = await base.prepareCheckout(...args)
      return { ...prepared, expected: { ...prepared.expected, amountMinor: 39900, chargeAt: null } }
    } }
    const submit = vi.spyOn(service, 'submitCheckout')
    render(<VendorBillingPanel service={service} vendorId={vendorId} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Pay Now' }))
    await screen.findByRole('button', { name: 'Confirm updated schedule' })
    expect(screen.getByText(/Displayed platform fee/).textContent).toContain('₹299')
    expect(screen.getByText(/Displayed platform fee/).textContent).toContain('₹399')
    expect(screen.getByText(/Prepared first fee/).textContent).toContain('collected now')
    fireEvent.click(screen.getByRole('button', { name: 'Keep current status' }))
    expect(submit).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Pay Now' }).hasAttribute('disabled')).toBe(true)
  })

  it('reuses a lost preparation key after a fresh status and an explicit retry', async () => {
    const base = createVendorBillingMockService('trial_active')
    const keys: string[] = []
    let lose = true
    const service: VendorBillingService = { ...base, prepareCheckout: async (id, action, key) => {
      keys.push(key)
      const attempt = await base.prepareCheckout(id, action, key)
      if (lose) { lose = false; throw new Error('response lost') }
      return attempt
    } }
    const read = vi.spyOn(service, 'getStatus')
    render(<VendorBillingPanel service={service} vendorId={vendorId} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Pay Now' }))
    await screen.findByText(/preparation outcome is unconfirmed/)
    // The panel requests fresh status itself; only the vendor's next click prepares again.
    await waitFor(() => expect(read).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Pay Now' }).hasAttribute('disabled')).toBe(false))
    expect(keys).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Pay Now' }))
    await screen.findByText(/Simulated billing acknowledgement received/)
    expect(keys).toHaveLength(2)
    expect(keys[0]).toBe(keys[1])
  })

  it('retries a script failure with the same prepared Test attempt and never prepares another', async () => {
    const open = vi.spyOn(checkout, 'openSubscriptionCheckout').mockRejectedValueOnce(new checkout.CheckoutBeforeOpenError('Script unavailable')).mockResolvedValueOnce({ status: 'dismissed' })
    const service = createVendorBillingPreviewService(config, 'trial_active')
    const prepare = vi.spyOn(service, 'prepareCheckout')
    render(<VendorBillingPanel service={service} vendorId={vendorId} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Pay Now' }))
    await screen.findByRole('button', { name: 'Retry prepared Checkout' })
    expect(screen.getByRole('alert').textContent).toContain('Script unavailable')
    fireEvent.click(screen.getByRole('button', { name: 'Retry prepared Checkout' }))
    await screen.findByText(/Checkout was closed/)
    expect(prepare).toHaveBeenCalledTimes(1)
    expect(open).toHaveBeenCalledTimes(2)
    expect(screen.getByText('TRIAL')).toBeTruthy()
  })

  it('keeps a nonterminal Checkout failure retryable until dismissal and refreshes status', async () => {
    const open = vi.spyOn(checkout, 'openSubscriptionCheckout').mockImplementation(async (_config, options) => {
      options?.onPaymentFailure?.('Card failed')
      return { status: 'dismissed' }
    })
    const service = createVendorBillingPreviewService(config, 'trial_active')
    const read = vi.spyOn(service, 'getStatus')
    render(<VendorBillingPanel service={service} vendorId={vendorId} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Pay Now' }))
    await screen.findByText(/closed after a failed attempt/)
    expect(screen.getByRole('alert').textContent).toContain('Card failed')
    expect(read).toHaveBeenCalledTimes(2)
    expect(open).toHaveBeenCalledTimes(1)
    expect(screen.getByText('TRIAL')).toBeTruthy()
  })

  it('holds the last confirmed status while a dismissal refresh is delayed', async () => {
    const open = vi.spyOn(checkout, 'openSubscriptionCheckout').mockResolvedValue({ status: 'dismissed' })
    const service = createVendorBillingPreviewService(config, 'trial_active')
    const initial = await service.getStatus(vendorId)
    let resolve!: (status: typeof initial) => void
    vi.spyOn(service, 'getStatus').mockResolvedValueOnce(initial).mockImplementationOnce(() => new Promise((done) => { resolve = done }))
    render(<VendorBillingPanel service={service} vendorId={vendorId} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Pay Now' }))
    await waitFor(() => expect(open).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('button', { name: 'Pay Now' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByText('TRIAL')).toBeTruthy()
    resolve(initial)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Pay Now' }).hasAttribute('disabled')).toBe(false))
  })

  it('keeps rejected callback submission unconfirmed and clears the in-memory callback fields', async () => {
    const submitted = { ...callback }
    vi.spyOn(checkout, 'openSubscriptionCheckout').mockResolvedValue({ status: 'submitted', callback: submitted })
    const base = createVendorBillingPreviewService(config, 'trial_active')
    const read = vi.spyOn(base, 'getStatus')
    const service: VendorBillingService = { ...base, submitCheckout: async () => {
      assertApiSuccess(fixtures.errors.INVALID_SIGNATURE)
      throw new Error('unreachable')
    } }
    render(<VendorBillingPanel service={service} vendorId={vendorId} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Pay Now' }))
    await screen.findByText(/Checkout verification failed/)
    await waitFor(() => expect(read).toHaveBeenCalledTimes(2))
    expect(screen.getByText('TRIAL')).toBeTruthy()
    expect(screen.getByText('No confirmed payment')).toBeTruthy()
    expect(submitted).toEqual({ razorpay_payment_id: '', razorpay_subscription_id: '', razorpay_signature: '' })
  })

  it('shows an envelope retry delay and disables recovery without automatic preparation', async () => {
    const base = createVendorBillingMockService('trial_active')
    const service: VendorBillingService = { ...base, prepareCheckout: async () => {
      assertApiSuccess({ ...fixtures.errors.RATE_LIMITED, status: 200 })
      throw new Error('unreachable')
    } }
    const prepare = vi.spyOn(service, 'prepareCheckout')
    render(<VendorBillingPanel service={service} vendorId={vendorId} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Pay Now' }))
    await screen.findByText(/Wait 5 seconds before retrying/)
    expect(screen.getByRole('button', { name: 'Refresh billing status' }).hasAttribute('disabled')).toBe(true)
    expect(prepare).toHaveBeenCalledTimes(1)
  })

  it('keeps a failed post-submit read visibly stale with mutations disabled', async () => {
    const base = createVendorBillingMockService('trial_active')
    const initial = await base.getStatus(vendorId)
    const service: VendorBillingService = { ...base,
      getStatus: vi.fn().mockResolvedValueOnce(initial).mockRejectedValue(new Error('refresh unavailable')),
      submitCheckout: async () => { throw new Error('acknowledgement lost') },
    }
    render(<VendorBillingPanel service={service} vendorId={vendorId} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Pay Now' }))
    await screen.findByText(/Last confirmed billing snapshot is stale/)
    expect(screen.getByText('TRIAL')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Pay Now' }).hasAttribute('disabled')).toBe(true)
  })

  it('treats the same instant in another offset as the same scheduled date', async () => {
    const base = createVendorBillingMockService('trial_active')
    const service: VendorBillingService = { ...base, prepareCheckout: async (...args) => {
      const prepared = await base.prepareCheckout(...args)
      return { ...prepared, expected: { ...prepared.expected, chargeAt: '2026-10-15T15:30:00+05:30' } }
    } }
    render(<VendorBillingPanel service={service} vendorId={vendorId} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Pay Now' }))
    await screen.findByText(/Simulated billing acknowledgement received/)
    expect(screen.queryByRole('button', { name: 'Confirm updated schedule' })).toBeNull()
  })

  it('submits once after a failed card attempt succeeds in the same modal and clears the stale failure', async () => {
    const open = vi.spyOn(checkout, 'openSubscriptionCheckout').mockImplementation(async (_config, options) => {
      options?.onPaymentFailure?.('Card declined')
      // Fresh fields: the panel blanks each submitted callback object in place.
      return { status: 'submitted', callback: { razorpay_payment_id: 'pay_fixture', razorpay_subscription_id: 'sub_future', razorpay_signature: 'unverified-fixture' } }
    })
    const service = createVendorBillingPreviewService(config, 'trial_active')
    const submit = vi.spyOn(service, 'submitCheckout')
    render(<VendorBillingPanel service={service} vendorId={vendorId} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Pay Now' }))
    await screen.findByText(/Test Checkout callback received/)
    expect(open).toHaveBeenCalledTimes(1)
    expect(submit).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Card declined')).toBeNull()
    expect(screen.getByText('TRIAL')).toBeTruthy()
    expect(screen.getByText('No confirmed payment')).toBeTruthy()
  })

  it('stops an expired preparation before Checkout and uses a new key only after fresh status', async () => {
    const base = createVendorBillingMockService('trial_active')
    const keys: string[] = []
    let expire = true
    const service: VendorBillingService = { ...base, prepareCheckout: async (id, action, key) => {
      keys.push(key)
      const attempt = await base.prepareCheckout(id, action, key)
      if (!expire) return attempt
      expire = false
      return { ...attempt, expiresAt: new Date(Date.now() - 1000).toISOString() }
    } }
    const submit = vi.spyOn(service, 'submitCheckout')
    const open = vi.spyOn(checkout, 'openSubscriptionCheckout')
    render(<VendorBillingPanel service={service} vendorId={vendorId} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Pay Now' }))
    await screen.findByText(/prepared attempt expired/)
    expect(submit).not.toHaveBeenCalled()
    expect(open).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Pay Now' }).hasAttribute('disabled')).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Refresh billing status' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Pay Now' }).hasAttribute('disabled')).toBe(false))
    fireEvent.click(screen.getByRole('button', { name: 'Pay Now' }))
    await screen.findByText(/Simulated billing acknowledgement received/)
    expect(keys).toHaveLength(2)
    expect(keys[1]).not.toBe(keys[0])
    expect(submit).toHaveBeenCalledTimes(1)
  })

  it('retries failed AutoPay setup through the same logical attempt and ignores a double click', async () => {
    const service = createVendorBillingMockService('trial_active')
    const prepare = vi.spyOn(service, 'prepareCheckout')
    const submit = vi.spyOn(service, 'submitCheckout')
    render(<VendorBillingPanel service={service} vendorId={vendorId} />)
    const pay = await screen.findByRole('button', { name: 'Pay Now' })
    fireEvent.click(pay)
    fireEvent.click(pay)
    await screen.findByText(/Simulated billing acknowledgement received/)
    expect(prepare).toHaveBeenCalledTimes(1)
    expect(submit).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Simulate failure' }))
    await screen.findByText(/retries the failed AutoPay setup/)
    expect(screen.getByText(/10 days remaining/)).toBeTruthy()
    expect(screen.getByText('Failed')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Pay Now' }))
    await screen.findByText(/Simulated billing acknowledgement received/)
    expect(prepare.mock.calls[1][2]).toBe(prepare.mock.calls[0][2])
    expect(submit.mock.calls[1][0].attemptId).toBe(submit.mock.calls[0][0].attemptId)
  })

  it.each(Object.entries(fixtures.errors))('shows %s safely, opens nothing and reconciles before any new preparation', async (_code, envelope) => {
    const base = createVendorBillingMockService('trial_active')
    const service: VendorBillingService = { ...base, prepareCheckout: async () => {
      assertApiSuccess({ ...envelope, status: 200 })
      throw new Error('unreachable')
    } }
    const prepare = vi.spyOn(service, 'prepareCheckout')
    const read = vi.spyOn(service, 'getStatus')
    const open = vi.spyOn(checkout, 'openSubscriptionCheckout')
    render(<VendorBillingPanel service={service} vendorId={vendorId} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Pay Now' }))
    await waitFor(() => expect(screen.getAllByRole('alert').some((alert) => alert.textContent?.includes(envelope.message))).toBe(true))
    expect(screen.getByText(/preparation outcome is unconfirmed/)).toBeTruthy()
    if ('retry_after_seconds' in envelope) {
      expect(screen.getByRole('button', { name: 'Refresh billing status' }).hasAttribute('disabled')).toBe(true)
      expect(read).toHaveBeenCalledTimes(1)
    } else {
      await waitFor(() => expect(read).toHaveBeenCalledTimes(2))
    }
    expect(prepare).toHaveBeenCalledTimes(1)
    expect(open).not.toHaveBeenCalled()
    expect(screen.getByText('TRIAL')).toBeTruthy()
  })

  describe('rejoining and renewal recovery', () => {
    const text = () => document.body.textContent ?? ''

    it('runs paid_rejoin: replacement waits for reconciliation and quotes the retained paid-through date', async () => {
      const open = vi.spyOn(checkout, 'openSubscriptionCheckout')
      render(<VendorBillingPanel service={createVendorBillingMockService('paid_active')} vendorId={vendorId} />)
      fireEvent.click(await screen.findByRole('button', { name: 'Cancel AutoPay' }))
      fireEvent.click(screen.getByRole('button', { name: 'Confirm cancellation' }))
      await screen.findByText('Renewal cancellation scheduled')
      // The old agreement is not yet confirmed stopped, so no replacement can be offered.
      expect(screen.queryByRole('button', { name: 'Pay Now' })).toBeNull()

      fireEvent.click(screen.getByRole('button', { name: 'Simulate cancellation confirmed' }))
      await screen.findByText('Cancellation confirmed')
      const payNow = await screen.findByRole('button', { name: 'Pay Now' })
      const copy = payNow.previousElementSibling?.textContent ?? ''
      expect(copy).toContain('15 Nov 2026')
      expect(copy).toMatch(/no new trial and no duplicate fee/)
      expect(copy).not.toMatch(/charged now|collected now|immediate/)

      fireEvent.click(payNow)
      await screen.findByText(/Simulated billing acknowledgement received/)
      expect(screen.queryByText('Cancellation confirmed')).toBeNull()
      expect(screen.queryByText(/Confirm updated schedule/)).toBeNull()
      expect(screen.getByText(/Confirmed paid coverage through/).textContent).toContain('15 Nov 2026')
      expect(screen.getByText(/Next platform fee scheduled for/).textContent).toContain('15 Nov 2026')
      expect(screen.getByText('Confirmation pending')).toBeTruthy()
      expect(open).not.toHaveBeenCalled()

      fireEvent.click(screen.getByRole('button', { name: 'Simulate confirmation' }))
      await screen.findByText(/Simulated billing confirmation is complete/)
      expect(screen.getByText(/Confirmed paid coverage through/).textContent).toContain('15 Nov 2026')
      expect(screen.queryByText(/Cancellation (requested|confirmed)/)).toBeNull()
    })

    it('rejoins a cancelled trial with setup_autopay at the unchanged trial expiry', async () => {
      render(<VendorBillingPanel service={createVendorBillingMockService('cancel_confirmed_trial')} vendorId={vendorId} />)
      const payNow = await screen.findByRole('button', { name: 'Pay Now' })
      const copy = payNow.previousElementSibling?.textContent ?? ''
      expect(copy).toMatch(/sets up AutoPay again during your existing trial; it does not start a new trial/)
      expect(copy).toContain('15 Oct 2026')
      fireEvent.click(payNow)
      await screen.findByText(/Simulated billing acknowledgement received/)
      expect(screen.queryByText('Cancellation confirmed')).toBeNull()
      expect(screen.getByText(/10 days remaining/).textContent).toContain('15 Oct 2026')
      expect(text()).not.toMatch(/Confirmed paid/)
    })

    it('requires explicit confirmation when a replacement is prepared with a changed date', async () => {
      const base = createVendorBillingMockService('rejoin_paid_ready')
      const submit = vi.fn(base.submitCheckout)
      const service: VendorBillingService = { ...base, submitCheckout: submit,
        prepareCheckout: async (...args) => {
          const attempt = await base.prepareCheckout(...args)
          return { ...attempt, expected: { ...attempt.expected, chargeAt: '2026-11-17T10:00:00Z' } }
        },
      }
      render(<VendorBillingPanel service={service} vendorId={vendorId} />)
      fireEvent.click(await screen.findByRole('button', { name: 'Pay Now' }))
      await screen.findByRole('button', { name: 'Confirm updated schedule' })
      expect(text()).toMatch(/Displayed first fee: 15 Nov 2026/)
      expect(text()).toMatch(/Prepared first fee: 17 Nov 2026/)
      expect(submit).not.toHaveBeenCalled()
      fireEvent.click(screen.getByRole('button', { name: 'Confirm updated schedule' }))
      await waitFor(() => expect(submit).toHaveBeenCalledTimes(1))
    })

    it('keeps an outstanding refund visible across a replacement without showing paid access', async () => {
      render(<VendorBillingPanel service={createVendorBillingMockService('refund_pending')} vendorId={vendorId} />)
      const payNow = await screen.findByRole('button', { name: 'Pay Now' })
      expect(payNow.previousElementSibling?.textContent).toMatch(/paid coverage has ended, so Pay Now starts a new subscription.*No new trial/)
      expect(text()).not.toMatch(/first platform fee/)
      fireEvent.click(payNow)
      await screen.findByText(/Simulated billing acknowledgement received/)
      expect(screen.getByText('Refund in progress')).toBeTruthy()
      expect(screen.getByText(/Access stays limited until the fee is confirmed; there is no grace period/)).toBeTruthy()
      expect(text()).not.toMatch(/Confirmed paid/)
      expect(screen.getByText('Limited')).toBeTruthy()

      fireEvent.click(screen.getByRole('button', { name: 'Simulate refund completed' }))
      await screen.findByText('Refund completed')
      expect(screen.getByText('Limited')).toBeTruthy()
      expect(text()).not.toMatch(/Confirmed paid/)
    })

    it('keeps a derived outstanding refund visible across a paid setup_autopay replacement', async () => {
      const outstandingRefund = (await createVendorBillingMockService('refund_pending').getStatus(vendorId)).refund
      render(<VendorBillingPanel service={createVendorBillingMockService('rejoin_paid_ready', 'mock', undefined, { outstandingRefund })} vendorId={vendorId} />)
      fireEvent.click(await screen.findByRole('button', { name: 'Pay Now' }))
      await screen.findByText(/Simulated billing acknowledgement received/)
      expect(screen.getByText('Refund in progress')).toBeTruthy()
      expect(screen.getByText(/Confirmed paid coverage through/).textContent).toContain('15 Nov 2026')
      fireEvent.click(screen.getByRole('button', { name: 'Simulate confirmation' }))
      await screen.findByText(/Simulated billing confirmation is complete/)
      expect(screen.getByText('Refund in progress')).toBeTruthy()
      expect(screen.getByText(/Confirmed paid coverage through/).textContent).toContain('15 Nov 2026')
    })

    it('keeps the store open while a renewal is retried, and the original renewal date after the retry succeeds', async () => {
      render(<VendorBillingPanel service={createVendorBillingMockService('paid_active')} vendorId={vendorId} />)
      fireEvent.click(await screen.findByRole('button', { name: 'Simulate renewal fee due' }))
      await screen.findByText(/is awaiting confirmation/)
      expect(screen.getByText(/Platform fee due/).textContent).toMatch(/15 Nov 2026.*The store stays open while it is being collected, retries included\./)
      expect(screen.getByText('Available')).toBeTruthy()
      expect(text()).not.toMatch(/no grace period|store is hidden/)
      expect(screen.queryByRole('button', { name: 'Pay Now' })).toBeNull()

      fireEvent.click(screen.getByRole('button', { name: 'Simulate successful retry' }))
      await screen.findByText(/Next platform fee scheduled for/)
      expect(screen.getByText(/Confirmed paid coverage through/).textContent).toContain('15 Dec 2026')
      expect(screen.getByText(/Next platform fee scheduled for/).textContent).toContain('15 Dec 2026')
      expect(text()).not.toMatch(/17 Dec 2026|16 Dec 2026|Jan 2027/)
      expect(screen.queryByRole('button', { name: /Simulate renewal|Simulate successful retry|Simulate collection halted/ })).toBeNull()
    })

    it('restricts access with no grace only once collection halts, offering a new paid period', async () => {
      render(<VendorBillingPanel service={createVendorBillingMockService('paid_active')} vendorId={vendorId} />)
      fireEvent.click(await screen.findByRole('button', { name: 'Simulate renewal fee due' }))
      fireEvent.click(await screen.findByRole('button', { name: 'Simulate collection halted' }))
      await screen.findByText(/Collection halted after every retry/)
      expect(screen.getByText('Limited')).toBeTruthy()
      expect(screen.getByText(/Your paid coverage has ended. There is no grace period/)).toBeTruthy()
      expect(screen.getByText(/Last confirmed paid coverage ended/).textContent).toContain('15 Nov 2026')
      expect(screen.getByText(/Your paid coverage has ended, so Pay Now starts a new subscription/)).toBeTruthy()
      expect(screen.queryByRole('button', { name: /Simulate successful retry/ })).toBeNull()
    })

    it.each([
      ['authorisation_revoked', 'No confirmed payment', /10 days remaining/],
      ['authorisation_revoked_paid', 'Confirmed paid', /Confirmed paid coverage through 15 Nov 2026/],
    ] as const)('shows %s as revoked while keeping its supplied coverage and actions', async (scenario, payment, coverage) => {
      render(<VendorBillingPanel service={createVendorBillingMockService(scenario)} vendorId={vendorId} />)
      await screen.findByRole('button', { name: 'Pay Now' })
      expect(screen.getByText('Revoked')).toBeTruthy()
      expect(screen.getByText(payment)).toBeTruthy()
      expect(text()).toMatch(coverage)
      expect(screen.getByText('Available')).toBeTruthy()
      expect(screen.queryByText('Failed')).toBeNull()
      expect(screen.queryByRole('button', { name: 'Cancel AutoPay' })).toBeNull()
    })

    it('shows a pending or failed fee due at a retained paid boundary: collection keeps the store open, a failure grants no grace', async () => {
      const paid = await createVendorBillingMockService('paid_active').getStatus(vendorId)
      for (const [paymentStatus, outcome, after] of [
        ['failed', 'was not collected', /15 Nov 2026.*Paid coverage still ends .*15 Nov 2026.*no grace period/],
        ['pending', 'is awaiting confirmation', /15 Nov 2026.*The store stays open while it is being collected, retries included\./],
      ] as const) {
        const service: VendorBillingService = { ...createVendorBillingMockService('paid_active'), getStatus: async () => ({ ...paid, membership: { ...paid.membership, paymentStatus } }) }
        const view = render(<VendorBillingPanel service={service} vendorId={vendorId} />)
        const line = await screen.findByText(new RegExp(`Platform fee due .* ${outcome}`))
        expect(line.textContent).toMatch(after)
        expect(screen.getByText('PAID')).toBeTruthy()
        expect(screen.queryByText(/Next platform fee scheduled/)).toBeNull()
        view.unmount()
      }
    })

    it('shows schedule_completed with its notice, restricted access and no unlisted actions', async () => {
      render(<VendorBillingPanel service={createVendorBillingMockService('schedule_completed')} vendorId={vendorId} />)
      await screen.findByText('The finite test schedule has ended.')
      expect(screen.getByText('Limited')).toBeTruthy()
      expect(screen.getByText(/store is hidden from the marketplace/)).toBeTruthy()
      expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual(['Refresh billing status'])
    })
  })
})
