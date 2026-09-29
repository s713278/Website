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
  liveActivatedSubscription, liveCancelledPaidSubscription, liveHaltedSubscription, livePaidSubscription, livePlans, liveStoppedSubscription,
  liveTrialAutoPayCancelledSubscription, liveSubscribeResponse, liveTrialAutoPaySubscription, liveTrialSubscription,
} from '@/shared/api/fixtures/live-billing-wire'
import { useAuthStore } from '@/shared/auth/store/auth-store'
import { resetDemoState } from '@/shared/api/fixtures/demo-state'
import * as checkout from '@/shared/payments/razorpay-checkout'
import { CheckoutBeforeOpenError, type SubscriptionCheckoutResult } from '@/shared/payments/razorpay-checkout'
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

    it('shows free days with the rounded-up count, the exact end and the sections, and Set up AutoPay as its only action', async () => {
      const reads = stubReads(async () => trial())
      show(accountFor(context('trial_active', 'vendor-1')))
      expect(await screen.findByText('13')).toBeTruthy()
      expect(screen.getByText('Free days')).toBeTruthy()
      expect(screen.getByText('Your shop is live free until 12 Oct, 3:34 pm. After that, subscribe with Razorpay — ₹299 each month — to keep it open.')).toBeTruthy()
      expect(screen.getByText('Mithra Social Starter · ₹299 / month')).toBeTruthy()
      expect(screen.getByRole('region', { name: 'What you get' })).toBeTruthy()
      expect(screen.getByRole('region', { name: 'If you do not pay' })).toBeTruthy()
      expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual(['Set up AutoPay · ₹299 on 12 Oct'])
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
      expect(screen.getByRole('button', { name: 'Set up AutoPay · ₹299 on 12 Oct' })).toBeTruthy()
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
      expect(container.textContent).not.toMatch(/Next ₹299/)
      expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual(['Keep shop open · ₹299'])
      expect(screen.queryByRole('region', { name: 'Stop the plan' })).toBeNull()
    })

    it('shows Payment failed with its hidden shop, "If you do not pay" and Pay ₹299', async () => {
      vi.setSystemTime(new Date('2026-11-20T10:00:00Z'))
      stubReads(async () => ({ kind: 'subscription', subscription: liveHaltedSubscription() }))
      show(accountFor(context('trial_active', 'vendor-1')))
      expect(await screen.findByText('Payment failed')).toBeTruthy()
      expect(screen.getByText('Shop is hidden')).toBeTruthy()
      expect(screen.getByText('Customers cannot see your shop. Pay ₹299 with Razorpay to open it again. Old orders are still here.')).toBeTruthy()
      expect(screen.getByRole('region', { name: 'If you do not pay' })).toBeTruthy()
      expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual(['Pay ₹299 with Razorpay'])
    })

    it('shows Shop closed once free days end without AutoPay, even while the status is still TRIAL_ACTIVE, gap J', async () => {
      vi.setSystemTime(daysBeforeEnd(-0.5))
      stubReads(async () => trial())
      show(accountFor(context('trial_active', 'vendor-1')))
      expect(await screen.findByText('Shop closed')).toBeTruthy()
      expect(screen.getByText('Free days are over. Customers cannot see your shop. Pay ₹299 with Razorpay to open it again.')).toBeTruthy()
      expect(screen.getByRole('region', { name: 'If you do not pay' })).toBeTruthy()
      expect(screen.queryByText(/^Confirming payment/)).toBeNull()
      expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual(['Pay ₹299 with Razorpay'])
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
        // The suite fakes only Date, and useFakeTimers() does not reinstall over it.
        vi.useRealTimers()
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
        // The suite fakes only Date, and useFakeTimers() does not reinstall over it.
        vi.useRealTimers()
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

    describe('Set up AutoPay', () => {
      const setUp = 'Set up AutoPay · ₹299 on 12 Oct'
      const waiting = 'Confirming AutoPay…'
      const autoPayOn = (): LiveSubscriptionRead => ({ kind: 'subscription', subscription: liveTrialAutoPaySubscription() })
      /** The handler's three values; every ID is a placeholder. */
      const callback = { razorpay_payment_id: 'pay_FakePayment0001', razorpay_subscription_id: 'sub_FakeAutoPay0001', razorpay_signature: 'fake_signature_0001' }
      const submitted = (): SubscriptionCheckoutResult => ({ status: 'submitted', callback: { ...callback } })
      const open = () => vi.spyOn(checkout, 'openSubscriptionCheckout')
      const subscribe = () => vi.spyOn(liveBillingService, 'subscribe').mockResolvedValue(liveSubscribeResponse())
      const confirm = () => vi.spyOn(liveBillingService, 'confirm')
      /** Lets pending promises and timers due within `ms` run. */
      const wait = (ms = 0) => act(async () => { await vi.advanceTimersByTimeAsync(ms) })
      const button = () => screen.getByRole<HTMLButtonElement>('button', { name: setUp })

      beforeEach(() => {
        // The suite fakes only Date, and useFakeTimers() does not reinstall over it.
        vi.useRealTimers()
        vi.useFakeTimers()
        vi.setSystemTime(daysBeforeEnd(12.5))
      })

      it('subscribes, opens Checkout, confirms, then polls every 5 s until a read shows AutoPay on', async () => {
        const reads = stubReads(async () => trial())
        const subscribed = subscribe()
        const opened = open().mockResolvedValue(submitted())
        const confirmed = confirm().mockResolvedValue(null)
        show(accountFor(context('trial_active', 'vendor-1')))
        await wait()
        expect(screen.getByText('Opens Razorpay Checkout. Approve AutoPay by card or UPI with a small refundable charge now; the first ₹299 is charged on 12 Oct, when free days end.')).toBeTruthy()
        fireEvent.click(button())
        await wait()
        expect(subscribed).toHaveBeenCalledExactlyOnceWith('vendor-1', 'MITHRA_SOCIAL_STARTER_MONTHLY')
        expect(opened).toHaveBeenCalledOnce()
        expect(opened.mock.calls[0][0]).toMatchObject({ keyId: 'rzp_test_FakeKey0001', subscriptionId: 'sub_FakeAutoPay0001' })
        expect(confirmed).toHaveBeenCalledExactlyOnceWith('vendor-1', callback)
        expect(subscribed.mock.invocationCallOrder[0]).toBeLessThan(opened.mock.invocationCallOrder[0])
        expect(opened.mock.invocationCallOrder[0]).toBeLessThan(confirmed.mock.invocationCallOrder[0])
        expect(screen.getByText(waiting)).toBeTruthy()
        expect(button().disabled).toBe(true)
        expect(reads.readSubscription).toHaveBeenCalledOnce()

        await wait(5_000)
        expect(reads.readSubscription).toHaveBeenCalledTimes(2)
        expect(screen.getByText(waiting)).toBeTruthy()
        expect(button().disabled).toBe(true)

        reads.readSubscription.mockResolvedValue(autoPayOn())
        await wait(5_000)
        expect(reads.readSubscription).toHaveBeenCalledTimes(3)
        expect(screen.getByText('AutoPay on — first ₹299 on 12 Oct')).toBeTruthy()
        expect(screen.queryByText(waiting)).toBeNull()
        expect(screen.queryByRole('button', { name: setUp })).toBeNull()
        await wait(90_000)
        expect(reads.readSubscription).toHaveBeenCalledTimes(3)
        expect(screen.queryByRole('alert')).toBeNull()
      })

      /** Shows Plan, presses Set up AutoPay and lets Checkout submit, leaving Plan polling. */
      async function setUpAutoPay() {
        show(accountFor(context('trial_active', 'vendor-1')))
        await wait()
        fireEvent.click(button())
        await wait()
      }

      it('stops polling after 90 s, keeps the waiting line with Check again, and gives the action back while the read still offers it', async () => {
        const reads = stubReads(async () => trial())
        subscribe()
        open().mockResolvedValue(submitted())
        confirm().mockResolvedValue(null)
        await setUpAutoPay()
        await wait(85_000)
        expect(button().disabled).toBe(true)
        expect(screen.queryByRole('button', { name: 'Check again' })).toBeNull()
        await wait(5_000)
        expect(reads.readSubscription).toHaveBeenCalledTimes(19)
        expect(screen.getByText(waiting)).toBeTruthy()
        expect(button().disabled).toBe(false)
        await wait(60_000)
        expect(reads.readSubscription).toHaveBeenCalledTimes(19)

        fireEvent.click(screen.getByRole('button', { name: 'Check again' }))
        await wait()
        expect(reads.readSubscription).toHaveBeenCalledTimes(20)
        expect(screen.getByText(waiting)).toBeTruthy()
        expect(button().disabled).toBe(false)

        reads.readSubscription.mockResolvedValue(autoPayOn())
        fireEvent.click(screen.getByRole('button', { name: 'Check again' }))
        await wait()
        expect(screen.getByText('AutoPay on — first ₹299 on 12 Oct')).toBeTruthy()
        expect(screen.queryByText(waiting)).toBeNull()
        expect(screen.queryByRole('button', { name: 'Check again' })).toBeNull()
      })

      const badGateway = () => new ApiError('Bad gateway', 502, null, '/v1/vendors/vendor-1/subscription/confirm', 'server')
      const unavailable = () => new ApiError('Service unavailable', 503, null, '/v1/vendors/vendor-1/subscription/confirm', 'server')
      const offline = () => new ApiError('You appear to be offline. Check your connection and try again.', 0, null, '/v1/vendors/vendor-1/subscription/confirm', 'network')

      it('retries confirm at 5, 15 and 30 s after 502, 503 and network failures, while the poll runs', async () => {
        const reads = stubReads(async () => trial())
        subscribe()
        open().mockResolvedValue(submitted())
        const confirmed = confirm().mockRejectedValueOnce(badGateway()).mockRejectedValueOnce(unavailable()).mockRejectedValueOnce(offline()).mockResolvedValue(null)
        await setUpAutoPay()
        expect(confirmed).toHaveBeenCalledTimes(1)
        await wait(4_999)
        expect(confirmed).toHaveBeenCalledTimes(1)
        await wait(1)
        expect(confirmed).toHaveBeenCalledTimes(2)
        await wait(14_999)
        expect(confirmed).toHaveBeenCalledTimes(2)
        await wait(1)
        expect(confirmed).toHaveBeenCalledTimes(3)
        expect(reads.readSubscription).toHaveBeenCalledTimes(5)
        await wait(30_000)
        expect(confirmed).toHaveBeenCalledTimes(4)
        for (const call of confirmed.mock.calls) expect(call).toEqual(['vendor-1', callback])
        expect(screen.queryByRole('alert')).toBeNull()
        expect(screen.getByText(waiting)).toBeTruthy()
      })

      it('retries confirm at most 3 times, then shows the failure while the poll still runs', async () => {
        const reads = stubReads(async () => trial())
        subscribe()
        open().mockResolvedValue(submitted())
        const confirmed = confirm().mockRejectedValue(badGateway())
        await setUpAutoPay()
        await wait(50_000)
        expect(confirmed).toHaveBeenCalledTimes(4)
        expect(screen.getByRole('alert').textContent).toBe('Bad gateway')
        await wait(30_000)
        expect(confirmed).toHaveBeenCalledTimes(4)
        expect(reads.readSubscription).toHaveBeenCalledTimes(17)
        expect(screen.getByText(waiting)).toBeTruthy()
      })

      it.each([
        ['401', new ApiError('Invalid signature', 401, null, '/v1/vendors/vendor-1/subscription/confirm', 'unauthorized')],
        ['400', new ApiError('Subscription mismatch', 400, null, '/v1/vendors/vendor-1/subscription/confirm', 'validation')],
      ])('shows the could-not-confirm message for a confirm %s, with no retry, and keeps polling', async (_, failure) => {
        const reads = stubReads(async () => trial())
        subscribe()
        open().mockResolvedValue(submitted())
        const confirmed = confirm().mockRejectedValue(failure)
        await setUpAutoPay()
        expect(screen.getByRole('alert').textContent).toBe('We couldn’t confirm this payment here. If money was taken, it will show once Razorpay confirms it.')
        expect(screen.getByText(waiting)).toBeTruthy()
        reads.readSubscription.mockResolvedValue(autoPayOn())
        await wait(5_000)
        expect(reads.readSubscription).toHaveBeenCalledTimes(2)
        expect(screen.getByText('AutoPay on — first ₹299 on 12 Oct')).toBeTruthy()
        await wait(60_000)
        expect(confirmed).toHaveBeenCalledOnce()
      })

      it('shows getErrorMessage for a failed subscribe after one call, and opens no Checkout', async () => {
        const reads = stubReads(async () => trial())
        const subscribed = vi.spyOn(liveBillingService, 'subscribe').mockRejectedValue(
          new ApiError('Unable to create the subscription.', 500, null, '/v1/vendors/vendor-1/subscription', 'server'))
        const opened = open()
        await setUpAutoPay()
        expect(screen.getByRole('alert').textContent).toBe('Unable to create the subscription.')
        expect(button().disabled).toBe(false)
        expect(screen.queryByText(waiting)).toBeNull()
        await wait(60_000)
        expect(subscribed).toHaveBeenCalledOnce()
        expect(opened).not.toHaveBeenCalled()
        expect(reads.readSubscription).toHaveBeenCalledOnce()
      })

      it('says the free days are the same when a payment failed and Checkout was then closed, with no confirm', async () => {
        stubReads(async () => trial())
        subscribe()
        open().mockImplementation(async (_config, options) => {
          options?.onPaymentFailure?.('Your payment was declined by the bank.')
          return { status: 'dismissed' }
        })
        const confirmed = confirm()
        await setUpAutoPay()
        expect(screen.getByRole('alert').textContent).toBe('The payment did not go through (Your payment was declined by the bank.), so AutoPay is not set up. Nothing changed; your free days are the same.')
        expect(screen.getByText('13')).toBeTruthy()
        expect(screen.queryByText(waiting)).toBeNull()
        expect(button().disabled).toBe(false)
        expect(confirmed).not.toHaveBeenCalled()
      })

      it('shows no notice, sends no confirm and does not poll when Checkout is dismissed', async () => {
        const reads = stubReads(async () => trial())
        subscribe()
        open().mockResolvedValue({ status: 'dismissed' })
        const confirmed = confirm()
        await setUpAutoPay()
        expect(screen.queryByRole('alert')).toBeNull()
        expect(screen.queryByText(waiting)).toBeNull()
        expect(button().disabled).toBe(false)
        await wait(30_000)
        expect(confirmed).not.toHaveBeenCalled()
        expect(reads.readSubscription).toHaveBeenCalledOnce()
      })

      it('shows a Checkout script failure and lets the vendor try again', async () => {
        stubReads(async () => trial())
        const subscribed = subscribe()
        const opened = open().mockRejectedValueOnce(new CheckoutBeforeOpenError('Could not load Razorpay. Check your connection and try again.'))
          .mockResolvedValueOnce({ status: 'dismissed' })
        await setUpAutoPay()
        expect(screen.getByRole('alert').textContent).toBe('Could not load Razorpay. Check your connection and try again.')
        expect(button().disabled).toBe(false)
        fireEvent.click(button())
        await wait()
        expect(subscribed).toHaveBeenCalledTimes(2)
        expect(opened).toHaveBeenCalledTimes(2)
        expect(screen.queryByRole('alert')).toBeNull()
      })

      it('subscribes once for a double click', async () => {
        stubReads(async () => trial())
        const response = deferred<unknown>()
        const subscribed = vi.spyOn(liveBillingService, 'subscribe').mockReturnValue(response.promise)
        const opened = open().mockResolvedValue({ status: 'dismissed' })
        show(accountFor(context('trial_active', 'vendor-1')))
        await wait()
        fireEvent.click(button())
        fireEvent.click(button())
        await act(async () => { response.resolve(liveSubscribeResponse()) })
        await wait()
        expect(subscribed).toHaveBeenCalledOnce()
        expect(opened).toHaveBeenCalledOnce()
      })

      it('stops the poll and confirm retries when Plan unmounts, with no errors from late answers', async () => {
        const reads = stubReads(async () => trial())
        subscribe()
        open().mockResolvedValue(submitted())
        const confirmed = confirm().mockRejectedValue(badGateway())
        const errors = vi.spyOn(console, 'error')
        await setUpAutoPay()
        cleanup()
        // The poll, its cap and the wait before confirm's first retry are all gone.
        expect(vi.getTimerCount()).toBe(0)
        await wait(120_000)
        expect(reads.readSubscription).toHaveBeenCalledOnce()
        expect(confirmed).toHaveBeenCalledOnce()
        expect(errors).not.toHaveBeenCalled()
      })

      it('stops polling after a vendor switch and ignores the first vendor’s late confirm failure', async () => {
        const reads = stubReads((vendorId) => Promise.resolve(vendorId === 'vendor-1' ? trial() : { kind: 'not-live' }))
        subscribe()
        open().mockResolvedValue(submitted())
        let fail!: (error: unknown) => void
        vi.spyOn(liveBillingService, 'confirm').mockReturnValue(new Promise((_, reject) => { fail = reject }))
        const view = render(page('vendor-1'))
        await wait()
        fireEvent.click(button())
        await wait()
        expect(screen.getByText(waiting)).toBeTruthy()
        signIn('vendor-2')
        view.rerender(page('vendor-2'))
        await wait()
        expect(screen.getByText('Free days start when your shop goes live.')).toBeTruthy()
        await act(async () => { fail(new ApiError('Invalid signature', 401, null, '/v1/vendors/vendor-1/subscription/confirm', 'unauthorized')) })
        await wait(90_000)
        expect(reads.readSubscription.mock.calls.filter(([vendorId]) => vendorId === 'vendor-1')).toHaveLength(1)
        expect(screen.queryByText(waiting)).toBeNull()
        expect(screen.queryByRole('alert')).toBeNull()
      })

      it('opens no Checkout for a subscribe answer that lands after a vendor switch', async () => {
        stubReads((vendorId) => Promise.resolve(vendorId === 'vendor-1' ? trial() : { kind: 'not-live' }))
        const response = deferred<unknown>()
        vi.spyOn(liveBillingService, 'subscribe').mockReturnValue(response.promise)
        const opened = open()
        const view = render(page('vendor-1'))
        await wait()
        fireEvent.click(button())
        signIn('vendor-2')
        view.rerender(page('vendor-2'))
        await wait()
        await act(async () => { response.resolve(liveSubscribeResponse()) })
        await wait()
        expect(opened).not.toHaveBeenCalled()
        expect(screen.queryByRole('alert')).toBeNull()
      })
    })

    describe('Keep shop open and Pay ₹299', () => {
      const keepOpen = 'Keep shop open · ₹299'
      const pay = 'Pay ₹299 with Razorpay'
      const autoPayWaiting = 'Confirming AutoPay…'
      const paymentWaiting = 'Confirming payment… Card payments take about a minute; UPI can take a few hours. Your shop opens once Razorpay confirms the ₹299.'
      const keepOpenHelp = 'Opens Razorpay Checkout. Approve AutoPay by card or UPI with a small refundable charge now; ₹299 is charged on 13 Nov, when paid days end.'
      const payHelp = 'Opens Razorpay Checkout. Pay by card or UPI.'
      /** 21 days before P: the last paid day is 12 Nov and P is IST midnight starting 13 Nov. */
      const inPaidDays = new Date('2026-10-22T18:30:00Z')
      /** A week after P and after the trial end. */
      const lapsed = new Date('2026-11-20T10:00:00Z')
      const callback = { razorpay_payment_id: 'pay_FakePayment0002', razorpay_subscription_id: 'sub_FakeRejoin0001', razorpay_signature: 'fake_signature_0002' }
      const read = (subscription: Record<string, unknown>): LiveSubscriptionRead => ({ kind: 'subscription', subscription })
      /** Paid again after paying to reopen: a new period from the payment. */
      const paidAgain = () => read(livePaidSubscription({
        razorpay_subscription_id: 'sub_FakeRejoin0001', current_period_start: '2026-11-20T10:05:02Z',
        current_period_end: '2026-12-19T18:30Z', next_billing_at: '2026-12-19T18:30Z', updated_at: '2026-11-20T10:05:05.10427Z',
      }))
      const subscribe = () => vi.spyOn(liveBillingService, 'subscribe').mockResolvedValue(liveSubscribeResponse({ razorpay_subscription_id: 'sub_FakeRejoin0001' }))
      const open = () => vi.spyOn(checkout, 'openSubscriptionCheckout')
      const confirm = () => vi.spyOn(liveBillingService, 'confirm')
      const wait = (ms = 0) => act(async () => { await vi.advanceTimersByTimeAsync(ms) })
      const button = (name: string) => screen.getByRole<HTMLButtonElement>('button', { name })

      beforeEach(() => {
        // The suite fakes only Date, and useFakeTimers() does not reinstall over it.
        vi.useRealTimers()
        vi.useFakeTimers()
      })

      /** Shows Plan at `now` on the stubbed read, then presses `action`. */
      async function press(now: Date, action: string) {
        vi.setSystemTime(now)
        show(accountFor(context('trial_active', 'vendor-1')))
        await wait()
        fireEvent.click(button(action))
        await wait()
      }

      it.each([
        ['4, Stopped', 'Plan stopped', () => read(liveStoppedSubscription())],
        ['5, AutoPay ended', 'AutoPay ended', () => read(liveCancelledPaidSubscription())],
      ])('keeps the shop open from row %s: subscribe, Checkout, confirm, then the poll until a read changes the view', async (_, eyebrow, stopped) => {
        const reads = stubReads(async () => stopped())
        const subscribed = subscribe()
        const opened = open().mockResolvedValue({ status: 'submitted', callback: { ...callback } })
        const confirmed = confirm().mockResolvedValue(null)
        vi.setSystemTime(inPaidDays)
        show(accountFor(context('trial_active', 'vendor-1')))
        await wait()
        expect(screen.getByText(eyebrow)).toBeTruthy()
        expect(screen.getByText(keepOpenHelp)).toBeTruthy()
        fireEvent.click(button(keepOpen))
        await wait()
        expect(subscribed).toHaveBeenCalledExactlyOnceWith('vendor-1', 'MITHRA_SOCIAL_STARTER_MONTHLY')
        expect(opened.mock.calls[0][0]).toMatchObject({ keyId: 'rzp_test_FakeKey0001', subscriptionId: 'sub_FakeRejoin0001' })
        expect(confirmed).toHaveBeenCalledExactlyOnceWith('vendor-1', callback)
        expect(subscribed.mock.invocationCallOrder[0]).toBeLessThan(opened.mock.invocationCallOrder[0])
        expect(opened.mock.invocationCallOrder[0]).toBeLessThan(confirmed.mock.invocationCallOrder[0])
        expect(screen.getByText(autoPayWaiting)).toBeTruthy()
        expect(button(keepOpen).disabled).toBe(true)

        await wait(5_000)
        expect(reads.readSubscription).toHaveBeenCalledTimes(2)
        expect(button(keepOpen).disabled).toBe(true)
        // Once gap E is fixed, the old paid period with AutoPay agreed reads as Paid.
        reads.readSubscription.mockResolvedValue(read(livePaidSubscription({ razorpay_status: 'authenticated' })))
        await wait(5_000)
        expect(screen.getByText('Paid')).toBeTruthy()
        expect(screen.queryByText(autoPayWaiting)).toBeNull()
        await wait(90_000)
        expect(reads.readSubscription).toHaveBeenCalledTimes(3)
        expect(screen.queryByRole('alert')).toBeNull()
      })

      it.each([
        ['1, Payment failed', 'Payment failed', () => read(liveHaltedSubscription())],
        ['6, Shop closed after paid days', 'Paid days are over.', () => read(livePaidSubscription())],
        ['10, Shop closed after free days', 'Free days are over.', () => read(liveTrialSubscription())],
        ['11, Shop closed while paying again', 'Paid days are over.', () => read(liveHaltedSubscription({
          status: 'PAYMENT_PENDING', razorpay_subscription_id: 'sub_FakePayAgain0002', razorpay_status: 'created',
        }))],
      ])('pays ₹299 from row %s: subscribe, Checkout, confirm, then the poll until a read changes the view', async (_, shown, closed) => {
        const reads = stubReads(async () => closed())
        const subscribed = subscribe()
        const opened = open().mockResolvedValue({ status: 'submitted', callback: { ...callback } })
        const confirmed = confirm().mockResolvedValue(null)
        vi.setSystemTime(lapsed)
        show(accountFor(context('trial_active', 'vendor-1')))
        await wait()
        expect(screen.getByText(new RegExp(shown))).toBeTruthy()
        expect(screen.getByText(payHelp)).toBeTruthy()
        fireEvent.click(button(pay))
        await wait()
        expect(subscribed).toHaveBeenCalledExactlyOnceWith('vendor-1', 'MITHRA_SOCIAL_STARTER_MONTHLY')
        expect(opened).toHaveBeenCalledOnce()
        expect(confirmed).toHaveBeenCalledExactlyOnceWith('vendor-1', callback)
        expect(subscribed.mock.invocationCallOrder[0]).toBeLessThan(opened.mock.invocationCallOrder[0])
        expect(opened.mock.invocationCallOrder[0]).toBeLessThan(confirmed.mock.invocationCallOrder[0])
        expect(screen.getByText(paymentWaiting)).toBeTruthy()
        expect(button(pay).disabled).toBe(true)

        await wait(5_000)
        expect(reads.readSubscription).toHaveBeenCalledTimes(2)
        expect(button(pay).disabled).toBe(true)
        reads.readSubscription.mockResolvedValue(paidAgain())
        await wait(5_000)
        expect(screen.getByText('You paid ₹299 via Razorpay. Shop stays open until 19 Dec. Next ₹299 is charged on 20 Dec.')).toBeTruthy()
        expect(screen.queryByText(paymentWaiting)).toBeNull()
        expect(screen.queryByRole('button', { name: pay })).toBeNull()
        await wait(90_000)
        expect(reads.readSubscription).toHaveBeenCalledTimes(3)
      })

      it('ends the Pay ₹299 poll on a Confirming read, which offers no Pay button', async () => {
        const reads = stubReads(async () => read(liveTrialSubscription()))
        subscribe()
        open().mockResolvedValue({ status: 'submitted', callback: { ...callback } })
        confirm().mockResolvedValue(null)
        await press(lapsed, pay)
        reads.readSubscription.mockResolvedValue(read(liveTrialAutoPaySubscription()))
        await wait(5_000)
        expect(screen.getByText(paymentWaiting)).toBeTruthy()
        expect(screen.queryByRole('button', { name: /Pay/ })).toBeNull()
        expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual(['Check again'])
        await wait(90_000)
        expect(reads.readSubscription).toHaveBeenCalledTimes(2)
      })

      it('names the last paid day when turning AutoPay back on is refused with a 409, gap E, after one subscribe', async () => {
        const reads = stubReads(async () => read(liveStoppedSubscription()))
        const subscribed = vi.spyOn(liveBillingService, 'subscribe').mockRejectedValue(
          new ApiError('An active subscription already exists.', 409, null, '/v1/vendors/vendor-1/subscription', 'client'))
        const opened = open()
        await press(inPaidDays, keepOpen)
        expect(screen.getByRole('alert').textContent).toBe('Couldn’t turn AutoPay back on right now. Your shop stays open until 12 Nov.')
        expect(screen.getByText('Plan stopped')).toBeTruthy()
        expect(button(keepOpen).disabled).toBe(false)
        await wait(60_000)
        expect(subscribed).toHaveBeenCalledOnce()
        expect(opened).not.toHaveBeenCalled()
        expect(reads.readSubscription).toHaveBeenCalledOnce()
      })

      it('shows the backend’s message when paying after the trial fails with a 500, gap I, after one subscribe', async () => {
        const reads = stubReads(async () => read(liveTrialSubscription()))
        const subscribed = vi.spyOn(liveBillingService, 'subscribe').mockRejectedValue(
          new ApiError('Unable to initiate subscription payment at this time.', 500, null, '/v1/vendors/vendor-1/subscription', 'server'))
        const opened = open()
        await press(lapsed, pay)
        expect(screen.getByRole('alert').textContent).toBe('Unable to initiate subscription payment at this time.')
        expect(screen.getByText('Shop closed')).toBeTruthy()
        expect(button(pay).disabled).toBe(false)
        await wait(60_000)
        expect(subscribed).toHaveBeenCalledOnce()
        expect(opened).not.toHaveBeenCalled()
        expect(reads.readSubscription).toHaveBeenCalledOnce()
      })

      it('shows a 409 while paying to reopen with getErrorMessage, not the gap E message', async () => {
        stubReads(async () => read(liveHaltedSubscription()))
        vi.spyOn(liveBillingService, 'subscribe').mockRejectedValue(
          new ApiError('An active subscription already exists.', 409, null, '/v1/vendors/vendor-1/subscription', 'client'))
        await press(lapsed, pay)
        expect(screen.getByRole('alert').textContent).toBe('An active subscription already exists.')
      })

      it.each([
        ['Keep shop open', inPaidDays, keepOpen, () => read(liveStoppedSubscription()), 'Plan stopped',
          'The payment did not go through (Your payment was declined by the bank.), so AutoPay is not set up again. Nothing changed; the plan is still stopped.'],
        ['Pay ₹299', lapsed, pay, () => read(liveHaltedSubscription()), 'Payment failed',
          'The payment did not go through (Your payment was declined by the bank.). Nothing changed; your shop is still hidden.'],
      ])('words %s’s failed payment after Checkout closes, with the state unchanged and no confirm', async (_, now, action, current, eyebrow, message) => {
        const reads = stubReads(async () => current())
        subscribe()
        open().mockImplementation(async (_config, options) => {
          options?.onPaymentFailure?.('Your payment was declined by the bank.')
          return { status: 'dismissed' }
        })
        const confirmed = confirm()
        await press(now, action)
        expect(screen.getByRole('alert').textContent).toBe(message)
        expect(screen.getByText(eyebrow)).toBeTruthy()
        expect(button(action).disabled).toBe(false)
        expect(screen.queryByText(/^Confirming/)).toBeNull()
        await wait(30_000)
        expect(confirmed).not.toHaveBeenCalled()
        expect(reads.readSubscription).toHaveBeenCalledOnce()
      })

      it.each([
        ['Keep shop open', inPaidDays, keepOpen, () => read(liveStoppedSubscription())],
        ['Pay ₹299', lapsed, pay, () => read(liveHaltedSubscription())],
      ])('subscribes once for a double click on %s', async (_, now, action, current) => {
        stubReads(async () => current())
        const response = deferred<unknown>()
        const subscribed = vi.spyOn(liveBillingService, 'subscribe').mockReturnValue(response.promise)
        const opened = open().mockResolvedValue({ status: 'dismissed' })
        vi.setSystemTime(now)
        show(accountFor(context('trial_active', 'vendor-1')))
        await wait()
        fireEvent.click(button(action))
        fireEvent.click(button(action))
        await act(async () => { response.resolve(liveSubscribeResponse()) })
        await wait()
        expect(subscribed).toHaveBeenCalledOnce()
        expect(opened).toHaveBeenCalledOnce()
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
