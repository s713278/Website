// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import fixtures from '../../../../docs/examples/vendor-billing/mock-responses.json'
import { resetBillingPrototypeState } from '@/modules/vendor/hooks/use-billing-prototype'
import { VendorAccountContext, type VendorAccount } from '@/modules/vendor/hooks/use-vendor-account'
import { configureApiClient, mapVendorContext, mapVendorPlan, type VendorContext } from '@/shared/api'
import { resetDemoState } from '@/shared/api/fixtures/demo-state'
import { VendorPlanPage } from './VendorPlanPage'

beforeEach(() => { vi.stubEnv('VITE_USE_API', 'false'); configureApiClient({ useApi: false }) })
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); resetDemoState(); resetBillingPrototypeState() })

function context(scenario: 'trial_active' | 'current_context', vendorId = 'vendor-1') {
  const fixture = fixtures.contexts[scenario]
  return mapVendorContext({ ...fixture, data: { ...fixture.data, vendor_id: vendorId } })
}

function accountFor(value: VendorContext, refreshContext: () => Promise<VendorContext> = vi.fn(async () => value)): VendorAccount {
  return {
    vendorId: value.vendorId, context: value, storeState: 'OPEN', plan: mapVendorPlan(value),
    refreshContext, contextStale: false, reload: () => {},
  }
}

function show(account: VendorAccount) {
  return render(<VendorAccountContext.Provider value={account}><VendorPlanPage /></VendorAccountContext.Provider>, { wrapper: MemoryRouter })
}

/**
 * Plan as a production build loads it. `import.meta.env.DEV` is read when the module loads, so the
 * page, its account context and the demo billing state all come from freshly loaded modules.
 */
async function productionBuild() {
  vi.stubEnv('DEV', false)
  vi.resetModules()
  const [{ VendorPlanPage: Page }, { VendorAccountContext: Context }, api, dashboard] = await Promise.all([
    import('./VendorPlanPage'), import('@/modules/vendor/hooks/use-vendor-account'), import('@/shared/api'), import('@/shared/api/fixtures/vendor-dashboard'),
  ])
  return {
    demoContext: () => api.mapVendorContext(dashboard.demoVendorContext('vendor-1')),
    show: (account: VendorAccount) => render(<Context.Provider value={account}><Page /></Context.Provider>),
  }
}

const removedControls = ['Use local Razorpay Test Mode', 'Show a sample billing status']

describe('VendorPlanPage', () => {
  it('shows the six-state prototype on demo Plan in development, without the old billing controls', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('connection refused') }))
    show(accountFor(context('trial_active')))
    expect(await screen.findByRole('button', { name: 'Free days', pressed: true })).toBeTruthy()
    expect(screen.getAllByRole('button', { pressed: false }).map((button) => button.textContent)).toEqual(['3 days left', 'Paid', 'Payment failed', 'Stopped', 'Shop closed'])
    for (const name of removedControls) expect(screen.queryByRole('button', { name })).toBeNull()
    expect(screen.queryByText('Simulated billing')).toBeNull()
  })

  it('keeps live Plan free of the prototype, its helper and the old billing controls', async () => {
    configureApiClient({ useApi: true })
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    show(accountFor(context('current_context')))
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('Billing unavailable'))
    expect(screen.queryByText('Prototype: try each shop-plan state')).toBeNull()
    for (const name of removedControls) expect(screen.queryByRole('button', { name })).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('keeps the demo billing panel in a production build, with no prototype', async () => {
    (await productionBuild()).show(accountFor(context('trial_active')))
    expect(await screen.findByText('Simulated billing')).toBeTruthy()
    expect(screen.queryByText('Prototype: try each shop-plan state')).toBeNull()
    for (const name of removedControls) expect(screen.queryByRole('button', { name })).toBeNull()
  })

  it('makes an unextended live context unavailable without inventing billing', async () => {
    configureApiClient({ useApi: true })
    show(accountFor(context('current_context')))
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('Billing unavailable'))
    expect(screen.queryByText(/Trial access until|₹299|days remaining/)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Pay Now' })).toBeNull()
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

  describe('production demo build', () => {
    it('shows one billing membership with no usage against limits or competing Free/ACTIVE summary', async () => {
      (await productionBuild()).show(accountFor(context('trial_active')))
      expect(await screen.findByText('TRIAL')).toBeTruthy()
      expect(screen.queryByText('Usage against limits')).toBeNull()
      expect(screen.queryByText(/ of \d+ used/)).toBeNull()
      expect(screen.queryByText('Plan name')).toBeNull()
      expect(screen.queryByText('Free')).toBeNull()
    })

    it('cancels demo AutoPay on Plan through a confirmed simulated journey that keeps the trial expiry', async () => {
      const build = await productionBuild()
      const refreshContext = vi.fn(async () => build.demoContext())
      const initial = await refreshContext()
      build.show(accountFor(initial, refreshContext))
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

    it('rejoins the demo trial on Plan after confirmed cancellation without a new trial', async () => {
      const build = await productionBuild()
      const refreshContext = vi.fn(async () => build.demoContext())
      build.show(accountFor(await refreshContext(), refreshContext))
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

  })
})
