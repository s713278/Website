// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import fixtures from '../../../../docs/examples/vendor-billing/mock-responses.json'
import { VendorAccountContext, type VendorAccount } from '@/modules/vendor/hooks/use-vendor-account'
import { configureApiClient, mapVendorContext, mapVendorPlan, type VendorContext } from '@/shared/api'
import { resetDemoState } from '@/shared/api/fixtures/demo-state'
import { demoVendorContext } from '@/shared/api/fixtures/vendor-dashboard'
import * as checkout from '@/shared/payments/razorpay-checkout'
import { VendorPlanPage } from './VendorPlanPage'

beforeEach(() => { vi.stubEnv('VITE_USE_API', 'false'); configureApiClient({ useApi: false }) })
afterEach(() => { cleanup(); localStorage.removeItem('md-local-billing-test-vendor'); vi.restoreAllMocks(); vi.unstubAllEnvs(); resetDemoState() })

function context(scenario: 'trial_active' | 'current_context', vendorId = 'vendor-1') {
  const fixture = fixtures.contexts[scenario]
  return mapVendorContext({ ...fixture, data: { ...fixture.data, vendor_id: vendorId } })
}

function accountFor(value: VendorContext, refreshContext: () => Promise<VendorContext> = vi.fn(async () => value)): VendorAccount {
  return {
    vendorId: value.vendorId, context: value, storeState: 'OPEN', plan: mapVendorPlan(value),
    refreshContext, contextStale: false, reload: () => {}, demo: null,
  }
}

function show(account: VendorAccount) {
  return render(<VendorAccountContext.Provider value={account}><VendorPlanPage /></VendorAccountContext.Provider>)
}

describe('VendorPlanPage', () => {
  it('selects a local Test scenario without changing ordinary billing or shared context', async () => {
    const refreshContext = vi.fn(async () => context('trial_active'))
    const record = { vendorId: 'vendor-1', scenario: 'active_trial', revision: 1, serverTime: '2026-09-23T10:00:00Z', trialStatus: 'active', trialEndsAt: '2026-10-07T10:00:00Z', paidThrough: null, daysRemaining: 14, accessStatus: 'TRIAL', storeVisible: true, attempts: [], associations: [], availableActions: ['setup_autopay'], authorisationStatus: 'not_configured', paymentStatus: 'none', nextChargeAt: null, providerVerified: { authorisation: false, payment: false }, providerCheck: 'current' }
    let selected = false
    const requests: string[] = []
    const open = vi.spyOn(checkout, 'openSubscriptionCheckout')
    vi.stubGlobal('fetch', vi.fn(async (url: string, options?: RequestInit) => {
      requests.push(`${options?.method ?? 'GET'} ${url}`)
      if (options?.method === 'POST') selected = true
      return { ok: true, json: async () => ({ record: selected ? record : null }) }
    }))
    const view = show(accountFor(context('trial_active'), refreshContext))
    expect(await screen.findByText('TRIAL')).toBeTruthy()
    const ordinaryReads = refreshContext.mock.calls.length
    fireEvent.click(screen.getByRole('button', { name: 'Use local Razorpay Test Mode' }))
    expect(await screen.findByRole('button', { name: 'Active trial' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Active trial' }))
    expect(await screen.findByText('Local Test scenario · trial and access simulated')).toBeTruthy()
    expect(screen.getByText(/no provider authorisation or platform fee has been verified/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Pay Now' })).toBeTruthy()
    expect(refreshContext).toHaveBeenCalledTimes(ordinaryReads)
    view.unmount()
    show(accountFor(context('trial_active'), refreshContext))
    expect(await screen.findByText('Local Test scenario · trial and access simulated')).toBeTruthy()
    expect(requests.filter((request) => request.startsWith('POST'))).toHaveLength(1)
    expect(open).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Return to ordinary billing' }))
    expect(await screen.findByText('Simulated billing')).toBeTruthy()
  })

  it('shows an actionable helper error and never falls back to a prior vendor’s Test status', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('connection refused') }))
    const first = accountFor(context('trial_active'))
    const second = accountFor(context('trial_active', 'vendor-2'))
    const view = show(first)
    fireEvent.click(screen.getByRole('button', { name: 'Use local Razorpay Test Mode' }))
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('Start npm run dev:billing-helper'))
    view.rerender(<VendorAccountContext.Provider value={second}><VendorPlanPage /></VendorAccountContext.Provider>)
    expect(await screen.findByText('Simulated billing')).toBeTruthy()
    expect(screen.queryByText('Local Test scenario · trial and access simulated')).toBeNull()
  })

  it('keeps a backend-authenticated account unavailable while Test mode shows only its local scenario', async () => {
    configureApiClient({ useApi: true })
    const refreshContext = vi.fn(async () => context('current_context'))
    const record = { vendorId: 'vendor-1', scenario: 'expired_trial', revision: 1, serverTime: '2026-09-23T10:00:00Z', trialStatus: 'ended', trialEndsAt: '2026-09-16T10:00:00Z', paidThrough: null, daysRemaining: 0, accessStatus: 'TRIAL_ENDED', storeVisible: false, attempts: [], associations: [], availableActions: ['pay_first_fee'], authorisationStatus: 'not_configured', paymentStatus: 'none', nextChargeAt: null, providerVerified: { authorisation: false, payment: false }, providerCheck: 'current' }
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ record }) })))
    show(accountFor(context('current_context'), refreshContext))
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('Billing unavailable'))
    const ordinaryReads = refreshContext.mock.calls.length
    fireEvent.click(screen.getByRole('button', { name: 'Use local Razorpay Test Mode' }))
    expect(await screen.findByText('Local Test scenario · trial and access simulated')).toBeTruthy()
    expect(screen.getByText(/Local demonstration only: a restricted vendor's store is hidden from the marketplace/)).toHaveProperty('textContent', expect.stringContaining('does not gate your real storefront'))
    expect(refreshContext).toHaveBeenCalledTimes(ordinaryReads)
    fireEvent.click(screen.getByRole('button', { name: 'Return to ordinary billing' }))
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('Billing unavailable'))
  })

  it('labels provider-verified Test facts apart from simulated access and never writes shared context', async () => {
    configureApiClient({ useApi: true })
    const refreshContext = vi.fn(async () => context('current_context'))
    const record = {
      vendorId: 'vendor-1', scenario: 'expired_trial', revision: 5, serverTime: '2026-09-23T10:00:00Z', trialStatus: 'ended', trialEndsAt: '2026-09-16T10:00:00Z',
      paidThrough: '2026-10-23T10:00:00.000Z', daysRemaining: 0, accessStatus: 'PAID', storeVisible: true, availableActions: [], associations: [],
      attempts: [{ action: 'pay_first_fee', state: 'fee_confirmed', associationId: 'sub_helper2', problem: null, fee: { amountMinor: 29900, currency: 'INR', periodStart: '2026-09-23T10:00:00.000Z', periodEnd: '2026-10-23T10:00:00.000Z' } }],
      authorisationStatus: 'confirmed', paymentStatus: 'confirmed', nextChargeAt: null, providerVerified: { authorisation: true, payment: true, coverage: true }, providerCheck: 'current',
    }
    const requests: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string) => { requests.push(url); return { ok: true, json: async () => ({ record }) } }))
    show(accountFor(context('current_context'), refreshContext))
    await screen.findByRole('alert')
    const ordinaryReads = refreshContext.mock.calls.length
    fireEvent.click(screen.getByRole('button', { name: 'Use local Razorpay Test Mode' }))
    expect(await screen.findByText('PAID')).toBeTruthy()
    expect(screen.getByText('Local Test scenario · trial and access simulated')).toBeTruthy()
    expect(screen.getAllByText('Razorpay Test verified')).toHaveLength(2)
    expect(screen.getByText(/Razorpay Test verified fee period through/)).toBeTruthy()
    expect(screen.getByText(/Trial dates, access and restrictions are simulated locally; real account access is unchanged/)).toBeTruthy()
    expect(refreshContext).toHaveBeenCalledTimes(ordinaryReads)
    expect(requests.every((url) => url.startsWith('/__local_vendor_billing_test/'))).toBe(true)
  })

  it('ignores a local helper result that arrives after the selected vendor changes', async () => {
    let finishRead!: (value: { ok: boolean; json: () => Promise<unknown> }) => void
    vi.stubGlobal('fetch', vi.fn(() => new Promise((resolve) => { finishRead = resolve })))
    const first = accountFor(context('trial_active'))
    const second = accountFor(context('trial_active', 'vendor-2'))
    const view = show(first)
    fireEvent.click(screen.getByRole('button', { name: 'Use local Razorpay Test Mode' }))
    expect(await screen.findByText('Reading local Test scenario…')).toBeTruthy()
    view.rerender(<VendorAccountContext.Provider value={second}><VendorPlanPage /></VendorAccountContext.Provider>)
    finishRead({ ok: true, json: async () => ({ record: { vendorId: 'vendor-1', scenario: 'active_trial' } }) })
    expect(await screen.findByText('Simulated billing')).toBeTruthy()
    expect(screen.queryByText('Local Test scenario · trial and access simulated')).toBeNull()
  })

  it('shows one billing membership with no usage against limits or competing Free/ACTIVE summary', async () => {
    show(accountFor(context('trial_active')))
    expect(await screen.findByText('TRIAL')).toBeTruthy()
    expect(screen.queryByText('Usage against limits')).toBeNull()
    expect(screen.queryByText(/ of \d+ used/)).toBeNull()
    expect(screen.queryByText('Plan name')).toBeNull()
    expect(screen.queryByText('Free')).toBeNull()
  })

  it('makes an unextended live context unavailable without inventing billing', async () => {
    configureApiClient({ useApi: true })
    show(accountFor(context('current_context')))
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('Billing unavailable'))
    expect(screen.queryByText(/Trial access until|₹299|days remaining/)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Pay Now' })).toBeNull()
  })

  it('uses a DEV sample for this panel without refreshing the shared account', async () => {
    configureApiClient({ useApi: true })
    const refreshContext = vi.fn(async () => context('current_context'))
    show(accountFor(context('current_context'), refreshContext))
    await screen.findByRole('alert')
    const reads = refreshContext.mock.calls.length
    fireEvent.click(screen.getByRole('button', { name: 'Show a sample billing status' }))
    expect(await screen.findByText('TRIAL')).toBeTruthy()
    expect(screen.getByText('Simulated billing')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Sample billing phase'), { target: { value: 'trial_expired' } })
    expect(await screen.findByText('TRIAL_ENDED')).toBeTruthy()
    expect(screen.getByText(/first ₹299 platform fee is collected now/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Pay Now' }))
    await screen.findByText(/Simulated billing acknowledgement received/)
    expect(screen.getByText('TRIAL_ENDED')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Simulate confirmation' }))
    expect(await screen.findByText('PAID')).toBeTruthy()
    expect(refreshContext).toHaveBeenCalledTimes(reads)
    fireEvent.click(screen.getByRole('button', { name: 'Return to account billing' }))
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('Billing unavailable'))
  })

  it('cancels demo AutoPay on Plan through a confirmed simulated journey that keeps the trial expiry', async () => {
    const refreshContext = vi.fn(async () => mapVendorContext(demoVendorContext('vendor-1')))
    const initial = await refreshContext()
    show(accountFor(initial, refreshContext))
    fireEvent.click(await screen.findByRole('button', { name: 'Pay Now' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Simulate confirmation' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel AutoPay' }))
    const trialEnd = screen.getByText(/Trial access until/).textContent
    expect(screen.getByRole('group', { name: 'Confirm cancellation' }).textContent).toContain(trialEnd?.match(/until (.+ IST)/)?.[1])
    const reads = refreshContext.mock.calls.length
    fireEvent.click(screen.getByRole('button', { name: 'Confirm cancellation' }))
    expect(await screen.findByText('Cancellation requested')).toBeTruthy()
    expect(refreshContext.mock.calls.length).toBeGreaterThan(reads)
    expect(screen.getByText('Simulated billing')).toBeTruthy()
    expect(screen.getByText('Simulated · cancellation progress')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Simulate cancellation confirmed' }))
    expect(await screen.findByText('Cancellation confirmed')).toBeTruthy()
    expect(screen.getByText(/Trial access until/).textContent).toBe(trialEnd)
    expect(screen.getByText('TRIAL')).toBeTruthy()
  })

  it('walks a sampled paid cancellation into a failed race refund without extending coverage', async () => {
    configureApiClient({ useApi: true })
    const refreshContext = vi.fn(async () => context('current_context'))
    show(accountFor(context('current_context'), refreshContext))
    await screen.findByRole('alert')
    fireEvent.click(screen.getByRole('button', { name: 'Show a sample billing status' }))
    fireEvent.change(await screen.findByLabelText('Sample billing phase'), { target: { value: 'paid_active' } })
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel AutoPay' }))
    expect(screen.getByRole('group', { name: 'Confirm cancellation' }).textContent).toMatch(/through 15 Nov 2026.*no automatic prorated refund/)
    fireEvent.click(screen.getByRole('button', { name: 'Confirm cancellation' }))
    expect(await screen.findByText('Renewal cancellation scheduled')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Simulate renewal debit racing the cancellation' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Simulate refund started' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Simulate refund failure' }))
    expect(await screen.findByText('Refund failed')).toBeTruthy()
    expect(screen.getByText(/₹299 is still owed/)).toBeTruthy()
    expect(screen.getByText('PAYMENT_REQUIRED')).toBeTruthy()
    expect(screen.getByText(/Last confirmed paid coverage ended/).textContent).toContain('15 Nov 2026')
    expect(screen.getByText('Simulated · refund progress')).toBeTruthy()
  })

  it('rejoins the demo trial on Plan after confirmed cancellation without a new trial', async () => {
    const refreshContext = vi.fn(async () => mapVendorContext(demoVendorContext('vendor-1')))
    show(accountFor(await refreshContext(), refreshContext))
    fireEvent.click(await screen.findByRole('button', { name: 'Pay Now' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Simulate confirmation' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel AutoPay' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm cancellation' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Simulate cancellation confirmed' }))
    await screen.findByText('Cancellation confirmed')
    const trialEnd = screen.getByText(/Trial access until/).textContent
    expect(screen.getByText(/sets up AutoPay again during your existing trial; it does not start a new trial/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Pay Now' }))
    await screen.findByText(/Simulated billing acknowledgement received/)
    expect(screen.queryByText('Cancellation confirmed')).toBeNull()
    expect(screen.getByText(/Trial access until/).textContent).toBe(trialEnd)
  })

  it('walks sampled paid_rejoin and renewal_retry on Plan through explicit simulated outcomes', async () => {
    configureApiClient({ useApi: true })
    const refreshContext = vi.fn(async () => context('current_context'))
    show(accountFor(context('current_context'), refreshContext))
    await screen.findByRole('alert')
    const reads = refreshContext.mock.calls.length
    fireEvent.click(screen.getByRole('button', { name: 'Show a sample billing status' }))
    fireEvent.change(await screen.findByLabelText('Sample billing phase'), { target: { value: 'paid_active' } })
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel AutoPay' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm cancellation' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Simulate cancellation confirmed' }))
    expect((await screen.findByText(/sets up AutoPay again for your paid membership/)).textContent).toContain('15 Nov 2026')
    fireEvent.click(screen.getByRole('button', { name: 'Pay Now' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Simulate confirmation' }))
    expect((await screen.findByText(/Next platform fee scheduled for/)).textContent).toContain('15 Nov 2026')

    fireEvent.click(screen.getByRole('button', { name: 'Simulate renewal fee due' }))
    expect(await screen.findByText('PAYMENT_REQUIRED')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Simulate renewal failure' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Simulate successful retry' }))
    expect((await screen.findByText(/Confirmed paid coverage through/)).textContent).toContain('15 Dec 2026')
    expect(screen.getByText('PAID')).toBeTruthy()
    expect(refreshContext).toHaveBeenCalledTimes(reads)
  })

  it('re-keys on the selected vendor and ignores the first vendor’s late read', async () => {
    configureApiClient({ useApi: true })
    let resolveFirst!: (value: VendorContext) => void
    const first = accountFor(context('trial_active'), () => new Promise((resolve) => { resolveFirst = resolve }))
    const second = accountFor(context('current_context', 'second_vendor'))
    const view = show(first)
    view.rerender(<VendorAccountContext.Provider value={second}><VendorPlanPage /></VendorAccountContext.Provider>)
    await screen.findByRole('alert')
    resolveFirst(first.context)
    await waitFor(() => expect(screen.queryByText('TRIAL')).toBeNull())
  })
})
