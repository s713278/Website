// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import fixtures from '../../../../docs/examples/vendor-billing/mock-responses.json'
import { resetBillingPrototypeState } from '@/modules/vendor/hooks/use-billing-prototype'
import { VendorAccountContext, type VendorAccount } from '@/modules/vendor/hooks/use-vendor-account'
import { resetLiveBilling } from '@/modules/vendor/store/live-billing'
import {
  ApiError, configureApiClient, liveBillingService, mapVendorContext, mapVendorPlan, type LiveSubscriptionRead, type VendorContext,
} from '@/shared/api'
import { livePlans, liveTrialSubscription } from '@/shared/api/fixtures/live-billing-wire'
import { useAuthStore } from '@/shared/auth/store/auth-store'
import { resetDemoState } from '@/shared/api/fixtures/demo-state'
import { VendorPlanPage } from './VendorPlanPage'

beforeEach(() => { vi.stubEnv('VITE_USE_API', 'false'); configureApiClient({ useApi: false }) })
afterEach(() => {
  cleanup(); vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers()
  resetDemoState(); resetBillingPrototypeState(); useAuthStore.getState().clearSession(); resetLiveBilling()
})

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

  it('keeps the demo billing panel in a production build, with no prototype', async () => {
    (await productionBuild()).show(accountFor(context('trial_active')))
    expect(await screen.findByText('Simulated billing')).toBeTruthy()
    expect(screen.queryByText('Prototype: try each shop-plan state')).toBeNull()
    for (const name of removedControls) expect(screen.queryByRole('button', { name })).toBeNull()
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

  describe('Live API', () => {
    /** 3:34 pm IST on 12 Oct. */
    const trialEnd = '2026-10-12T10:04:16.169Z'
    const daysBeforeEnd = (days: number) => new Date(Date.parse(trialEnd) - days * 24 * 60 * 60 * 1000)
    const trial = (): LiveSubscriptionRead => ({ kind: 'subscription', subscription: liveTrialSubscription() })

    function signIn(vendorId: string) {
      useAuthStore.getState().applySession({
        token: 'test-token', refreshToken: null,
        user: { id: `user-${vendorId}`, name: 'Test Vendor', email: 'vendor@example.test', role: 'vendor', roles: ['vendor'], vendors: [{ vendorId }], vendorId },
      })
    }

    /** Stubs both reads of the shared billing read; nothing reaches the dev backend. */
    function stubReads(subscription: (vendorId: string) => Promise<LiveSubscriptionRead>, plans: () => Promise<unknown> = async () => livePlans) {
      return {
        readSubscription: vi.spyOn(liveBillingService, 'readSubscription').mockImplementation((vendorId) => subscription(String(vendorId))),
        listPaidPlans: vi.spyOn(liveBillingService, 'listPaidPlans').mockImplementation(plans),
      }
    }

    function deferred<T>() {
      let resolve!: (value: T) => void
      const promise = new Promise<T>((res) => { resolve = res })
      return { promise, resolve }
    }

    const page = (vendorId: string) =>
      <VendorAccountContext.Provider value={accountFor(context('trial_active', vendorId))}><VendorPlanPage /></VendorAccountContext.Provider>

    beforeEach(() => {
      configureApiClient({ useApi: true })
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(daysBeforeEnd(12.5))
      signIn('vendor-1')
    })

    it('shows free days with the rounded-up count, the exact end and the sections, but no actions', async () => {
      const reads = stubReads(async () => trial())
      show(accountFor(context('trial_active', 'vendor-1')))
      expect(await screen.findByText('13')).toBeTruthy()
      expect(screen.getByText('Free days')).toBeTruthy()
      expect(screen.getByText('Your shop is live free until 12 Oct, 3:34 pm. After that, subscribe with Razorpay — ₹299 each month — to keep it open.')).toBeTruthy()
      expect(screen.getByText('Mithra Social Starter · ₹299 / month')).toBeTruthy()
      expect(screen.getByRole('region', { name: 'What you get' })).toBeTruthy()
      expect(screen.getByRole('region', { name: 'If you do not pay' })).toBeTruthy()
      expect(screen.queryAllByRole('button')).toEqual([])
      expect(screen.queryByText('Prototype: try each shop-plan state')).toBeNull()
      for (const name of removedControls) expect(screen.queryByRole('button', { name })).toBeNull()
      expect(reads.readSubscription).toHaveBeenCalledWith('vendor-1', expect.anything())
    })

    it('warns with 3 days left', async () => {
      vi.setSystemTime(daysBeforeEnd(2.5))
      stubReads(async () => trial())
      show(accountFor(context('trial_active', 'vendor-1')))
      expect(await screen.findByText('3')).toBeTruthy()
      expect(screen.getByText('Set up AutoPay now so customers can still open your shop when free days end. Free days end on 12 Oct, 3:34 pm.')).toBeTruthy()
    })

    it('shows only the note for a shop that is not live', async () => {
      stubReads(async () => ({ kind: 'not-live' }))
      show(accountFor(context('trial_active', 'vendor-1')))
      expect(await screen.findByText('Free days start when your shop goes live.')).toBeTruthy()
      expect(screen.queryByRole('region')).toBeNull()
      expect(screen.queryAllByRole('button')).toEqual([])
    })

    it('shows a failed read with Try again, which rereads', async () => {
      const reads = stubReads(async () => { throw new ApiError('Billing is down for a moment.', 500, null, '/v1/vendors/vendor-1/subscription', 'server') })
      show(accountFor(context('trial_active', 'vendor-1')))
      expect((await screen.findByRole('alert')).textContent).toBe('Billing is down for a moment.')
      expect(screen.queryByRole('region')).toBeNull()
      expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual(['Try again'])
      reads.readSubscription.mockImplementation(async () => trial())
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
      expect(await screen.findByText('13')).toBeTruthy()
      expect(screen.queryByRole('alert')).toBeNull()
      expect(reads.readSubscription).toHaveBeenCalledTimes(2)
    })

    it('takes the error path when only the plans list fails', async () => {
      stubReads(async () => trial(), async () => { throw new ApiError('Plans are unavailable.', 503, null, '/v1/subscription-plans', 'server') })
      show(accountFor(context('trial_active', 'vendor-1')))
      expect((await screen.findByRole('alert')).textContent).toBe('Plans are unavailable.')
      expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
    })

    it('takes the error path for a response that matches no row', async () => {
      stubReads(async () => ({ kind: 'subscription', subscription: liveTrialSubscription({ status: 'SOMETHING_NEW' }) }))
      show(accountFor(context('trial_active', 'vendor-1')))
      expect((await screen.findByRole('alert')).textContent).toBe('Couldn’t read your shop plan. Try again in a moment.')
      expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
    })

    it('rereads on mount, and a read landing after unmount raises no error', async () => {
      const first = deferred<LiveSubscriptionRead>()
      const reads = stubReads(() => first.promise)
      const errors = vi.spyOn(console, 'error')
      show(accountFor(context('trial_active', 'vendor-1'))).unmount()
      await act(async () => { first.resolve(trial()) })
      expect(errors).not.toHaveBeenCalled()
      reads.readSubscription.mockImplementation(async () => ({ kind: 'not-live' }))
      show(accountFor(context('trial_active', 'vendor-1')))
      expect(await screen.findByText('Free days start when your shop goes live.')).toBeTruthy()
      expect(reads.readSubscription).toHaveBeenCalledTimes(2)
    })

    it('drops the first vendor’s late read after a vendor switch through applySession', async () => {
      const first = deferred<LiveSubscriptionRead>()
      stubReads((vendorId) => vendorId === 'vendor-1' ? first.promise : Promise.resolve({ kind: 'not-live' }))
      const view = render(page('vendor-1'))
      signIn('vendor-2')
      view.rerender(page('vendor-2'))
      expect(await screen.findByText('Free days start when your shop goes live.')).toBeTruthy()
      await act(async () => { first.resolve(trial()) })
      expect(screen.queryByText('Free days')).toBeNull()
      expect(screen.getByText('Free days start when your shop goes live.')).toBeTruthy()
    })

    it('reads again when a new session starts for the same vendor', async () => {
      const reads = stubReads(async () => trial())
      render(page('vendor-1'))
      expect(await screen.findByText('13')).toBeTruthy()
      act(() => { signIn('vendor-1') })
      expect(await screen.findByText('13')).toBeTruthy()
      expect(reads.readSubscription).toHaveBeenCalledTimes(2)
    })

    it('drops a read that lands after sign-out, so the next vendor never sees it', async () => {
      const first = deferred<LiveSubscriptionRead>()
      const second = deferred<LiveSubscriptionRead>()
      stubReads((vendorId) => vendorId === 'vendor-1' ? first.promise : second.promise)
      const view = render(page('vendor-1'))
      act(() => { useAuthStore.getState().clearSession() })
      await act(async () => { first.resolve(trial()) })
      signIn('vendor-2')
      view.rerender(page('vendor-2'))
      expect(screen.getByRole('status').textContent).toBe('Reading shop plan…')
      expect(screen.queryByText('Free days')).toBeNull()
      await act(async () => { second.resolve({ kind: 'not-live' }) })
      expect(screen.getByText('Free days start when your shop goes live.')).toBeTruthy()
    })
  })
})
