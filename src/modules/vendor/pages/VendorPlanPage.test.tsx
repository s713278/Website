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
import {
  liveActivatedSubscription, liveHaltedSubscription, livePaidSubscription, livePlans, liveStoppedSubscription, liveTrialAutoPayCancelledSubscription,
  liveTrialAutoPaySubscription, liveTrialSubscription,
} from '@/shared/api/fixtures/live-billing-wire'
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

    it('shows free days with its AutoPay-on line and Turn off AutoPay as its only action', async () => {
      stubReads(async () => ({ kind: 'subscription', subscription: liveTrialAutoPaySubscription() }))
      show(accountFor(context('trial_active', 'vendor-1')))
      expect(await screen.findByText('AutoPay on — first ₹299 on 12 Oct')).toBeTruthy()
      expect(screen.getByText('13')).toBeTruthy()
      expect(screen.getByText('Free days are unchanged. When they end, Razorpay charges ₹299 each month to keep the shop open.')).toBeTruthy()
      expect(screen.getByRole('region', { name: 'If you do not pay' })).toBeTruthy()
      expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual(['Turn off AutoPay'])
    })

    it('shows Collecting with no action, no dates and no "If you do not pay"', async () => {
      vi.setSystemTime(daysBeforeEnd(-1))
      stubReads(async () => ({ kind: 'subscription', subscription: liveActivatedSubscription() }))
      const { container } = show(accountFor(context('trial_active', 'vendor-1')))
      expect(await screen.findByText('Shop is open')).toBeTruthy()
      expect(screen.getByText('AutoPay on.')).toBeTruthy()
      expect(screen.getByRole('region', { name: 'What you get' })).toBeTruthy()
      expect(screen.queryByRole('region', { name: 'If you do not pay' })).toBeNull()
      expect(container.textContent).not.toMatch(/Oct/)
      expect(screen.queryAllByRole('button')).toEqual([])
    })

    it('shows Paid with the last paid day and next charge, the "Stop the plan" section, and no "If you do not pay"', async () => {
      vi.setSystemTime(new Date('2026-10-22T18:30:00Z'))
      stubReads(async () => ({ kind: 'subscription', subscription: livePaidSubscription() }))
      show(accountFor(context('trial_active', 'vendor-1')))
      expect(await screen.findByText('Shop is open')).toBeTruthy()
      expect(screen.getByText('Paid')).toBeTruthy()
      expect(screen.getByText('You paid ₹299 via Razorpay. Shop stays open until 12 Nov. Next ₹299 is charged on 13 Nov.')).toBeTruthy()
      expect(screen.getByRole('region', { name: 'What you get' })).toBeTruthy()
      expect(screen.queryByRole('region', { name: 'If you do not pay' })).toBeNull()
      expect(screen.getByRole('region', { name: 'Stop the plan' })).toBeTruthy()
      expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual(['Stop the plan'])
    })

    it('shows Stopped with its days until P and no next-charge date, gap F', async () => {
      // 21 days before P; the stopped response still carries next_billing_at (13 Nov).
      vi.setSystemTime(new Date('2026-10-22T18:30:00Z'))
      stubReads(async () => ({ kind: 'subscription', subscription: liveStoppedSubscription() }))
      const { container } = show(accountFor(context('trial_active', 'vendor-1')))
      expect(await screen.findByText('21')).toBeTruthy()
      expect(screen.getByText('Plan stopped')).toBeTruthy()
      expect(screen.getByText('You stopped the plan. Shop stays open until 12 Nov. Pay ₹299 with Razorpay if you want to keep it after that.')).toBeTruthy()
      expect(screen.getByRole('region', { name: 'If you do not pay' })).toBeTruthy()
      expect(container.textContent).not.toMatch(/13 Nov|Next ₹299/)
      expect(screen.queryAllByRole('button')).toEqual([])
      expect(screen.queryByRole('region', { name: 'Stop the plan' })).toBeNull()
    })

    it('shows Payment failed with its hidden shop, "If you do not pay" and no action yet', async () => {
      vi.setSystemTime(new Date('2026-11-20T10:00:00Z'))
      stubReads(async () => ({ kind: 'subscription', subscription: liveHaltedSubscription() }))
      show(accountFor(context('trial_active', 'vendor-1')))
      expect(await screen.findByText('Payment failed')).toBeTruthy()
      expect(screen.getByText('Shop is hidden')).toBeTruthy()
      expect(screen.getByText('Customers cannot see your shop. Pay ₹299 with Razorpay to open it again. Old orders are still here.')).toBeTruthy()
      expect(screen.getByRole('region', { name: 'If you do not pay' })).toBeTruthy()
      expect(screen.queryAllByRole('button')).toEqual([])
    })

    it('shows Shop closed once free days end without AutoPay, even while the status is still TRIAL_ACTIVE, gap J', async () => {
      vi.setSystemTime(daysBeforeEnd(-0.5))
      stubReads(async () => trial())
      show(accountFor(context('trial_active', 'vendor-1')))
      expect(await screen.findByText('Shop closed')).toBeTruthy()
      expect(screen.getByText('Free days are over. Customers cannot see your shop. Pay ₹299 with Razorpay to open it again.')).toBeTruthy()
      expect(screen.getByRole('region', { name: 'If you do not pay' })).toBeTruthy()
      expect(screen.queryByText(/^Confirming payment/)).toBeNull()
      expect(screen.queryAllByRole('button')).toEqual([])
    })

    it('shows Confirming with no action but Check again, which rereads through the service, gap C', async () => {
      vi.setSystemTime(daysBeforeEnd(-0.5))
      const reads = stubReads(async () => ({ kind: 'subscription', subscription: liveTrialAutoPaySubscription() }))
      show(accountFor(context('trial_active', 'vendor-1')))
      expect(await screen.findByText('Shop closed')).toBeTruthy()
      expect(screen.getByText('Free days are over. Customers cannot see your shop. Pay ₹299 with Razorpay to open it again.')).toBeTruthy()
      expect(screen.getByText('Confirming payment… Card payments take about a minute; UPI can take a few hours. Your shop opens once Razorpay confirms the ₹299.')).toBeTruthy()
      expect(screen.getByRole('region', { name: 'If you do not pay' })).toBeTruthy()
      expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual(['Check again'])
      expect(screen.queryByRole('button', { name: /Pay/ })).toBeNull()

      vi.setSystemTime(new Date('2026-10-22T18:30:00Z'))
      reads.readSubscription.mockImplementation(async () => ({ kind: 'subscription', subscription: livePaidSubscription() }))
      fireEvent.click(screen.getByRole('button', { name: 'Check again' }))
      expect(await screen.findByText('Paid')).toBeTruthy()
      expect(screen.queryByText(/^Confirming payment/)).toBeNull()
      expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual(['Stop the plan'])
      expect(reads.readSubscription).toHaveBeenCalledTimes(2)
      expect(reads.listPaidPlans).toHaveBeenCalledTimes(2)
    })

    describe('Turn off AutoPay and Stop the plan', () => {
      const autoPayOn = (): LiveSubscriptionRead => ({ kind: 'subscription', subscription: liveTrialAutoPaySubscription() })
      const paid = (): LiveSubscriptionRead => ({ kind: 'subscription', subscription: livePaidSubscription() })
      const gapA = () => new ApiError('Internal server error', 500, null, '/v1/vendors/vendor-1/subscription/cancel', 'server')
      const gapAMessage = 'Couldn’t turn off AutoPay right now. Try again later or contact support.'

      /** Opens the confirm step of Stop the plan and confirms it. */
      function stopThePlan() {
        fireEvent.click(screen.getByRole('button', { name: 'Stop the plan' }))
        fireEvent.click(screen.getByRole('button', { name: 'Yes, stop the plan' }))
      }

      it('turns off AutoPay with one cancel call and shows the response as Free days, with no reread', async () => {
        const reads = stubReads(async () => autoPayOn())
        const cancel = vi.spyOn(liveBillingService, 'cancel').mockResolvedValue(liveTrialAutoPayCancelledSubscription())
        show(accountFor(context('trial_active', 'vendor-1')))
        fireEvent.click(await screen.findByRole('button', { name: 'Turn off AutoPay' }))
        expect(await screen.findByText('Your shop is live free until 12 Oct, 3:34 pm. After that, subscribe with Razorpay — ₹299 each month — to keep it open.')).toBeTruthy()
        expect(screen.getByText('13')).toBeTruthy()
        expect(screen.queryByText(/^AutoPay on/)).toBeNull()
        expect(screen.queryByRole('button', { name: 'Turn off AutoPay' })).toBeNull()
        expect(screen.queryByRole('alert')).toBeNull()
        expect(cancel).toHaveBeenCalledOnce()
        expect(cancel).toHaveBeenCalledWith('vendor-1')
        expect(reads.readSubscription).toHaveBeenCalledOnce()
        expect(reads.listPaidPlans).toHaveBeenCalledOnce()
      })

      it('stops the plan after its confirm step with one cancel call, showing Stopped with no reread', async () => {
        vi.setSystemTime(new Date('2026-10-22T18:30:00Z'))
        const reads = stubReads(async () => paid())
        const cancel = vi.spyOn(liveBillingService, 'cancel').mockResolvedValue(liveStoppedSubscription())
        show(accountFor(context('trial_active', 'vendor-1')))
        fireEvent.click(await screen.findByRole('button', { name: 'Stop the plan' }))
        expect(screen.getByText('Stop the plan? No more ₹299 is charged. Your shop stays open until 12 Nov, then customers cannot see it.')).toBeTruthy()
        expect(cancel).not.toHaveBeenCalled()
        fireEvent.click(screen.getByRole('button', { name: 'Yes, stop the plan' }))
        expect(await screen.findByText('Plan stopped')).toBeTruthy()
        expect(screen.getByText('You stopped the plan. Shop stays open until 12 Nov. Pay ₹299 with Razorpay if you want to keep it after that.')).toBeTruthy()
        expect(screen.queryByRole('region', { name: 'Stop the plan' })).toBeNull()
        expect(cancel).toHaveBeenCalledOnce()
        expect(reads.readSubscription).toHaveBeenCalledOnce()
      })

      it('makes no call when the vendor backs out of the confirm step', async () => {
        vi.setSystemTime(new Date('2026-10-22T18:30:00Z'))
        stubReads(async () => paid())
        const cancel = vi.spyOn(liveBillingService, 'cancel')
        show(accountFor(context('trial_active', 'vendor-1')))
        fireEvent.click(await screen.findByRole('button', { name: 'Stop the plan' }))
        fireEvent.click(screen.getByRole('button', { name: 'Keep the plan' }))
        expect(screen.queryByText(/^Stop the plan\?/)).toBeNull()
        expect(screen.getByRole('button', { name: 'Stop the plan' })).toBeTruthy()
        expect(screen.getByText('Paid')).toBeTruthy()
        expect(cancel).not.toHaveBeenCalled()
      })

      it('shows gap A’s message for a 500 from Turn off AutoPay, after one call, and keeps the view', async () => {
        vi.useFakeTimers()
        vi.setSystemTime(daysBeforeEnd(12.5))
        const reads = stubReads(async () => autoPayOn())
        const cancel = vi.spyOn(liveBillingService, 'cancel').mockRejectedValue(gapA())
        show(accountFor(context('trial_active', 'vendor-1')))
        await act(async () => { await vi.advanceTimersByTimeAsync(0) })
        fireEvent.click(screen.getByRole('button', { name: 'Turn off AutoPay' }))
        await act(async () => { await vi.advanceTimersByTimeAsync(0) })
        expect(screen.getByRole('alert').textContent).toBe(gapAMessage)
        expect(screen.getByText('AutoPay on — first ₹299 on 12 Oct')).toBeTruthy()
        expect(screen.getByRole('button', { name: 'Turn off AutoPay' })).toBeTruthy()
        await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
        expect(cancel).toHaveBeenCalledOnce()
        expect(reads.readSubscription).toHaveBeenCalledOnce()
      })

      it('shows gap A’s message for a 500 from Stop the plan, after one call, and keeps Paid', async () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-10-22T18:30:00Z'))
        const reads = stubReads(async () => paid())
        const cancel = vi.spyOn(liveBillingService, 'cancel').mockRejectedValue(gapA())
        show(accountFor(context('trial_active', 'vendor-1')))
        await act(async () => { await vi.advanceTimersByTimeAsync(0) })
        stopThePlan()
        await act(async () => { await vi.advanceTimersByTimeAsync(0) })
        expect(screen.getByRole('alert').textContent).toBe(gapAMessage)
        expect(screen.getByText('Paid')).toBeTruthy()
        expect(screen.queryByText('Plan stopped')).toBeNull()
        await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
        expect(cancel).toHaveBeenCalledOnce()
        expect(reads.readSubscription).toHaveBeenCalledOnce()
      })

      it('shows getErrorMessage for any other failure, after one call', async () => {
        stubReads(async () => autoPayOn())
        const cancel = vi.spyOn(liveBillingService, 'cancel').mockRejectedValue(
          new ApiError('Subscription is not active.', 409, null, '/v1/vendors/vendor-1/subscription/cancel', 'client'))
        show(accountFor(context('trial_active', 'vendor-1')))
        fireEvent.click(await screen.findByRole('button', { name: 'Turn off AutoPay' }))
        expect((await screen.findByRole('alert')).textContent).toBe('Subscription is not active.')
        expect(screen.getByText('AutoPay on — first ₹299 on 12 Oct')).toBeTruthy()
        expect(cancel).toHaveBeenCalledOnce()
      })

      it('makes one call for a double click', async () => {
        stubReads(async () => autoPayOn())
        const response = deferred<unknown>()
        const cancel = vi.spyOn(liveBillingService, 'cancel').mockReturnValue(response.promise)
        show(accountFor(context('trial_active', 'vendor-1')))
        const turnOff = await screen.findByRole('button', { name: 'Turn off AutoPay' })
        fireEvent.click(turnOff)
        fireEvent.click(turnOff)
        await act(async () => { response.resolve(liveTrialAutoPayCancelledSubscription()) })
        expect(await screen.findByText(/^Your shop is live free until/)).toBeTruthy()
        expect(cancel).toHaveBeenCalledOnce()
      })

      it('makes one call for a double click on Yes, stop the plan', async () => {
        vi.setSystemTime(new Date('2026-10-22T18:30:00Z'))
        stubReads(async () => paid())
        const response = deferred<unknown>()
        const cancel = vi.spyOn(liveBillingService, 'cancel').mockReturnValue(response.promise)
        show(accountFor(context('trial_active', 'vendor-1')))
        fireEvent.click(await screen.findByRole('button', { name: 'Stop the plan' }))
        const confirm = screen.getByRole('button', { name: 'Yes, stop the plan' })
        fireEvent.click(confirm)
        fireEvent.click(confirm)
        await act(async () => { response.resolve(liveStoppedSubscription()) })
        expect(await screen.findByText('Plan stopped')).toBeTruthy()
        expect(cancel).toHaveBeenCalledOnce()
      })

      it('still shows a cancel response that lands after Plan unmounts in the shared read, with no error', async () => {
        const reads = stubReads(async () => autoPayOn())
        const response = deferred<unknown>()
        vi.spyOn(liveBillingService, 'cancel').mockReturnValue(response.promise)
        const errors = vi.spyOn(console, 'error')
        const view = show(accountFor(context('trial_active', 'vendor-1')))
        fireEvent.click(await screen.findByRole('button', { name: 'Turn off AutoPay' }))
        view.unmount()
        await act(async () => { response.resolve(liveTrialAutoPayCancelledSubscription()) })
        expect(errors).not.toHaveBeenCalled()
        // The remount's reread never lands, so Plan shows whatever the shared read holds.
        reads.readSubscription.mockReturnValue(new Promise(() => {}))
        show(accountFor(context('trial_active', 'vendor-1')))
        expect(screen.getByText(/^Your shop is live free until/)).toBeTruthy()
        expect(screen.queryByText(/^AutoPay on/)).toBeNull()
        expect(screen.queryByRole('alert')).toBeNull()
      })

      it('ignores a cancel response that lands after a vendor switch', async () => {
        stubReads((vendorId) => Promise.resolve(vendorId === 'vendor-1' ? autoPayOn() : { kind: 'not-live' }))
        const success = deferred<unknown>()
        vi.spyOn(liveBillingService, 'cancel').mockReturnValue(success.promise)
        const view = render(page('vendor-1'))
        fireEvent.click(await screen.findByRole('button', { name: 'Turn off AutoPay' }))
        signIn('vendor-2')
        view.rerender(page('vendor-2'))
        expect(await screen.findByText('Free days start when your shop goes live.')).toBeTruthy()
        await act(async () => { success.resolve(liveTrialAutoPayCancelledSubscription()) })
        expect(screen.getByText('Free days start when your shop goes live.')).toBeTruthy()
        expect(screen.queryByText(/^Your shop is live free until/)).toBeNull()
        expect(screen.queryByRole('alert')).toBeNull()
      })

      it('ignores a cancel failure that lands after a vendor switch', async () => {
        stubReads((vendorId) => Promise.resolve(vendorId === 'vendor-1' ? autoPayOn() : { kind: 'not-live' }))
        let fail!: (error: unknown) => void
        vi.spyOn(liveBillingService, 'cancel').mockReturnValue(new Promise((_, reject) => { fail = reject }))
        const view = render(page('vendor-1'))
        fireEvent.click(await screen.findByRole('button', { name: 'Turn off AutoPay' }))
        signIn('vendor-2')
        view.rerender(page('vendor-2'))
        expect(await screen.findByText('Free days start when your shop goes live.')).toBeTruthy()
        await act(async () => { fail(gapA()) })
        expect(screen.queryByRole('alert')).toBeNull()
      })
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
