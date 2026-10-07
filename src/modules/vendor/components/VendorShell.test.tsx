// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { invalidateVendorContext } from '@/modules/vendor/lib/vendor-context-cache'
import { holdLiveBilling, resetLiveBilling, resetLiveBillingPlansForTests } from '@/modules/vendor/store/live-billing'
import {
  ApiError, configureApiClient, liveBillingService, mapVendorContext, vendorOnboardingService, vendorService,
  type LiveSubscriptionRead,
} from '@/shared/api'
import {
  liveActivatedSubscription, liveCancelledPaidSubscription, liveEarlyFeePaidSubscription, liveEarlyFeeSubscription, liveHaltedSubscription, livePaidSubscription, livePlans, liveStoppedSubscription,
  liveSubscribeResponse, liveTrialAutoPaySubscription, liveTrialSubscription,
} from '@/shared/api/fixtures/live-billing-wire'
import { useAuthStore } from '@/shared/auth/store/auth-store'
import * as checkout from '@/shared/payments/razorpay-checkout'
import { VendorSettingsPage } from '../pages/VendorSettingsPage'
import { LiveVendorPlan } from './LiveVendorPlan'
import { VendorShell } from './VendorShell'

/**
 * The local Razorpay Test helper's backend routes, as Vite proxies them in demo development: each
 * answers in the backend's envelope. Returns the paths requested.
 */
function fakeLocalBackend(subscription: () => unknown) {
  const paths: string[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    paths.push(url)
    const data = url.endsWith('/subscription-plans') ? livePlans : url.endsWith('/history') ? [] : subscription()
    return { ok: true, status: 200, json: async () => ({ timestamp: new Date().toISOString(), success: true, status: 200, data }) }
  }))
  return paths
}

function renderShell(path: string, plan: ReactNode = <LiveVendorPlan />) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/vendor" element={<VendorShell />}>
          <Route index element={<p>Overview page</p>} />
          <Route path="orders" element={<p>Orders page</p>} />
          <Route path="products" element={<p>Products page</p>} />
          <Route path="plan" element={plan} />
          <Route path="settings" element={<VendorSettingsPage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

const banner = () => screen.queryByRole('status', { name: 'Shop plan status' })
const header = () => within(screen.getByRole('banner'))
const rail = () => within(screen.getByRole('complementary', { name: 'Vendor navigation' }))
/** The rail's plan chip, such as "Free plan"; the rail's "Plan" link does not match. */
const planChip = () => rail().queryByText(/ plan$/)
/** The live API's rail badge, such as "13 days left"; it marks its tone in `data-tone`. */
const railBadge = () => screen.getByRole('complementary', { name: 'Vendor navigation' }).querySelector<HTMLElement>('[data-tone]')
/** The value of the Plan row on Settings. */
const settingsPlan = () => screen.getByText('Plan', { selector: 'dt' }).nextElementSibling?.textContent

/** Settings' store details, with nothing but a name set. */
function storeProfile() {
  vi.spyOn(vendorService, 'getStoreProfile').mockResolvedValue({
    vendorId: 'r1', businessName: 'Green Bowl Grocers', description: null, businessType: null, ownerName: null, contactPerson: null,
    contactNumber: null, email: null, address: null, bannerImage: null, storeIdentifier: null,
  })
}

beforeEach(() => {
  invalidateVendorContext()
  vi.spyOn(vendorOnboardingService, 'getVendorContext').mockResolvedValue(mapVendorContext({
    data: { vendor_id: 'r1', business_name: 'Green Bowl Grocers', vendor_status: 'ACTIVE', approval_status: 'APPROVED',
      onboarding: { status: 'COMPLETED', next_step: 11 } },
  }))
  useAuthStore.getState().applySession({ token: 'test-token', refreshToken: null, user: {
    id: 'test-user', name: 'Test Vendor', email: 'vendor@example.test', role: 'vendor', roles: ['vendor'],
    vendors: [{ vendorId: 'r1' }], vendorId: 'r1',
  } })
})

afterEach(() => {
  cleanup()
  invalidateVendorContext()
  useAuthStore.getState().clearSession()
  resetLiveBilling()
  resetLiveBillingPlansForTests()
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('VendorShell in demo development', () => {
  /** 3:34 pm IST on 12 Oct. */
  const trialEnd = '2026-10-12T10:04:16.169Z'

  beforeEach(() => {
    vi.stubEnv('VITE_USE_API', 'false'); configureApiClient({ useApi: false })
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(Date.parse(trialEnd) - 2.5 * 24 * 60 * 60 * 1000))
  })
  afterEach(() => { vi.useRealTimers() })

  it.each(['/vendor', '/vendor/orders', '/vendor/plan'])('shows the Live billing banner and header from the local Razorpay Test helper on %s', async (path) => {
    const paths = fakeLocalBackend(() => liveTrialSubscription())
    renderShell(path)
    await waitFor(() => expect(banner()?.textContent).toMatch(/^3 free days left — pay ₹299 with Razorpay now/))
    expect(header().getByRole('link', { name: 'Pay ₹299' }).getAttribute('href')).toBe('/vendor/plan')
    expect(paths).toContain('/__local_vendor_billing_test/api/v1/vendors/r1/subscription')
    expect(screen.getAllByRole('status', { name: 'Shop plan status' })).toHaveLength(1)
  })

  it('shows the billing badge in the rail and names the plan on Settings from the helper’s subscription read', async () => {
    storeProfile()
    fakeLocalBackend(() => liveTrialAutoPaySubscription())
    renderShell('/vendor/settings')
    await waitFor(() => expect(settingsPlan()).toBe('Mithra Social Starter'))
    expect(railBadge()?.textContent).toBe('3 days left')
    expect(railBadge()?.dataset.tone).toBe('danger')
    expect(planChip()).toBeNull()
  })

  it('names the plan from the demo context in a production demo build, with no billing read', async () => {
    vi.stubEnv('DEV', false)
    vi.spyOn(vendorOnboardingService, 'getVendorContext').mockResolvedValue(mapVendorContext({
      data: { vendor_id: 'r1', business_name: 'Green Bowl Grocers', vendor_status: 'ACTIVE', approval_status: 'APPROVED',
        onboarding: { status: 'COMPLETED', next_step: 11 }, subscription: { tier: 'FREE', plan_name: 'Free' } },
    }))
    storeProfile()
    const paths = fakeLocalBackend(() => liveTrialSubscription())
    const reads = vi.spyOn(liveBillingService, 'readSubscription')
    renderShell('/vendor/settings', <p>Plan page</p>)
    await waitFor(() => expect(settingsPlan()).toBe('Free'))
    expect(planChip()?.textContent).toBe('Free plan')
    expect(planChip()?.className).toContain('bg-[var(--vc-tint)]')
    expect(railBadge()).toBeNull()
    expect(header().getByRole('link', { name: 'Your plan' }).getAttribute('href')).toBe('/vendor/plan')
    expect(reads).not.toHaveBeenCalled()
    expect(paths).toEqual([])
  })

  it('leads the share-link banner with the FREE plan’s name for an open store in a production demo build', async () => {
    vi.stubEnv('DEV', false)
    vi.spyOn(vendorOnboardingService, 'getVendorContext').mockResolvedValue(mapVendorContext({
      data: { vendor_id: 'r1', business_name: 'Green Bowl Grocers', vendor_status: 'ACTIVE', approval_status: 'APPROVED',
        onboarding: { status: 'COMPLETED', next_step: 11 }, subscription: { tier: 'FREE', plan_name: 'Free' } },
    }))
    const paths = fakeLocalBackend(() => liveTrialSubscription())
    renderShell('/vendor', <p>Plan page</p>)
    const lead = await screen.findByText('Free plan active')
    expect(lead.closest('[role="status"]')?.textContent).toBe('Free plan active — share your shop link to get your first WhatsApp orders.Share store link')
    expect(paths).toEqual([])
  })
})

describe('VendorShell under the live API', () => {
  /** 3:34 pm IST on 12 Oct. */
  const trialEnd = '2026-10-12T10:04:16.169Z'
  const daysBeforeEnd = (days: number) => new Date(Date.parse(trialEnd) - days * 24 * 60 * 60 * 1000)
  const trial = (): LiveSubscriptionRead => ({ kind: 'subscription', subscription: liveTrialSubscription() })

  /** Stubs both halves of the shared billing read, and Plan's history read; nothing reaches the dev backend. */
  function stubReads(subscription: () => Promise<LiveSubscriptionRead>) {
    vi.spyOn(liveBillingService, 'listPaidPlans').mockResolvedValue(livePlans)
    vi.spyOn(liveBillingService, 'readHistory').mockResolvedValue([])
    return vi.spyOn(liveBillingService, 'readSubscription').mockImplementation(subscription)
  }

  /** The share-link banner an open store sees until its free days end (T), below any billing banner. */
  const planBanner = () => screen.queryByText('Share your shop link to get your first WhatsApp orders.')?.closest<HTMLElement>('[role="status"]') ?? null
  const belowBillingBanner = () => !!(banner()!.compareDocumentPosition(planBanner()!) & Node.DOCUMENT_POSITION_FOLLOWING)

  beforeEach(() => {
    vi.stubEnv('VITE_USE_API', 'true'); configureApiClient({ useApi: true })
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(daysBeforeEnd(12.5))
  })
  afterEach(() => { vi.useRealTimers() })

  it.each(['/vendor', '/vendor/orders', '/vendor/products'])('shows free days in the neutral banner and Pay ₹299 on %s, both linking to Plan, with the Free plan banner below', async (path) => {
    const paths = fakeLocalBackend(() => liveTrialSubscription())
    stubReads(async () => trial())
    renderShell(path, <LiveVendorPlan />)
    await waitFor(() => expect(banner()?.textContent).toBe('13 free days left — after that, subscribe with Razorpay (₹299 / month) to keep the shop open.Pay ₹299'))
    expect(banner()!.className).toContain('--vc-banner')
    expect(within(banner()!).getByRole('link', { name: 'Pay ₹299' }).getAttribute('href')).toBe('/vendor/plan')
    expect(header().getByRole('link', { name: 'Pay ₹299' }).getAttribute('href')).toBe('/vendor/plan')
    expect(header().queryByRole('link', { name: 'Your plan' })).toBeNull()
    expect(planBanner()?.textContent).toBe('Share your shop link to get your first WhatsApp orders.Share store link')
    expect(screen.queryByText(/plan active/)).toBeNull()
    expect(within(planBanner()!).getByRole('link', { name: 'Share store link' }).getAttribute('href')).toBe('/vendor/storefront')
    expect(belowBillingBanner()).toBe(true)
    expect(paths).toEqual([])
  })

  it('warns with the danger banner at 3 days left, on Plan too, with the Free plan banner below', async () => {
    vi.setSystemTime(daysBeforeEnd(2.5))
    stubReads(async () => trial())
    renderShell('/vendor/plan', <LiveVendorPlan />)
    await waitFor(() => expect(banner()?.textContent).toMatch(/^3 free days left — pay ₹299 with Razorpay now so customers can still open your shop\./))
    expect(banner()!.className).toContain('destructive')
    expect(header().getByRole('link', { name: 'Pay ₹299' }).getAttribute('href')).toBe('/vendor/plan')
    expect(screen.getAllByRole('status', { name: 'Shop plan status' })).toHaveLength(1)
    expect(belowBillingBanner()).toBe(true)
  })

  it.each([13, 1])('shows no billing banner and no Free plan banner, and the Shop plan header, while a payment is confirmed in free days (row 7), %i days left', async (days) => {
    vi.setSystemTime(daysBeforeEnd(days - 0.5))
    stubReads(async () => ({ kind: 'subscription', subscription: liveTrialAutoPaySubscription() }))
    renderShell('/vendor', <LiveVendorPlan />)
    await waitFor(() => expect(header().getByRole('link', { name: 'Shop plan' }).getAttribute('href')).toBe('/vendor/plan'))
    await act(async () => {})
    expect(banner()).toBeNull()
    expect(planBanner()).toBeNull()
    expect(header().getByRole('link', { name: 'Shop plan' }).getAttribute('href')).toBe('/vendor/plan')
    expect(header().queryByRole('link', { name: 'Pay ₹299' })).toBeNull()
  })

  it.each([
    ['Free days', 12.5],
    ['3 days left', 2.5],
  ])('shows the Free plan banner to an open store in %s, before any payment', async (_, days) => {
    vi.setSystemTime(daysBeforeEnd(days))
    stubReads(async () => trial())
    renderShell('/vendor', <LiveVendorPlan />)
    await waitFor(() => expect(banner()).toBeTruthy())
    expect(planBanner()).toBeTruthy()
  })

  it('shows no Free plan banner while a Checkout payment is on hold, before any read reports it', async () => {
    vi.useRealTimers()
    vi.useFakeTimers()
    vi.setSystemTime(daysBeforeEnd(12.5))
    const wait = (ms = 0) => act(async () => { await vi.advanceTimersByTimeAsync(ms) })
    stubReads(async () => trial())
    vi.spyOn(liveBillingService, 'subscribe').mockResolvedValue(liveSubscribeResponse())
    vi.spyOn(checkout, 'openSubscriptionCheckout').mockResolvedValue({ status: 'submitted', callback: {
      razorpay_payment_id: 'pay_FakePayment0001', razorpay_subscription_id: 'sub_FakeAutoPay0001', razorpay_signature: 'fake_signature_0001',
    } })
    vi.spyOn(liveBillingService, 'confirm').mockResolvedValue(null)
    renderShell('/vendor/plan', <LiveVendorPlan />)
    await wait()
    expect(planBanner()).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Pay ₹299 with Razorpay' }))
    await wait()
    expect(screen.getByText('Confirming your payment…')).toBeTruthy()
    expect(planBanner()).toBeNull()
  })

  it('shows no Free plan banner once paid early, though it is still before T', async () => {
    stubReads(async () => ({ kind: 'subscription', subscription: liveEarlyFeePaidSubscription() }))
    renderShell('/vendor', <LiveVendorPlan />)
    await waitFor(() => expect(header().getByRole('link', { name: 'Shop plan' }).getAttribute('href')).toBe('/vendor/plan'))
    await act(async () => {})
    expect(Date.now()).toBeLessThan(Date.parse(trialEnd))
    expect(planBanner()).toBeNull()
  })

  it('shows no billing banner while Razorpay collects, and no Free plan banner after free days', async () => {
    vi.setSystemTime(daysBeforeEnd(-1))
    stubReads(async () => ({ kind: 'subscription', subscription: liveActivatedSubscription() }))
    renderShell('/vendor', <LiveVendorPlan />)
    await waitFor(() => expect(header().getByRole('link', { name: 'Shop plan' }).getAttribute('href')).toBe('/vendor/plan'))
    await act(async () => {})
    expect(banner()).toBeNull()
    expect(planBanner()).toBeNull()
  })

  it('shows no billing banner while paid, and no Free plan banner after free days', async () => {
    vi.setSystemTime(new Date('2026-10-22T18:30:00Z'))
    stubReads(async () => ({ kind: 'subscription', subscription: livePaidSubscription() }))
    renderShell('/vendor/plan', <LiveVendorPlan />)
    expect(await screen.findByText(/^You paid ₹299 via Razorpay\. Shop stays open until /)).toBeTruthy()
    expect(banner()).toBeNull()
    expect(planBanner()).toBeNull()
    expect(header().getByRole('link', { name: 'Shop plan' }).getAttribute('href')).toBe('/vendor/plan')
  })

  it('shows no billing banner and no Free plan banner, and the Shop plan header, once paid early with the free days kept', async () => {
    stubReads(async () => ({ kind: 'subscription', subscription: liveEarlyFeePaidSubscription() }))
    renderShell('/vendor/plan', <LiveVendorPlan />)
    expect(await screen.findByText(/^You paid ₹299 via Razorpay\. Shop stays open until 12 Nov\. Next month is another ₹299\./)).toBeTruthy()
    expect(banner()).toBeNull()
    expect(planBanner()).toBeNull()
    expect(header().getByRole('link', { name: 'Shop plan' }).getAttribute('href')).toBe('/vendor/plan')
  })

  it('pays ₹299 with Razorpay from Free days, then polls through "Confirming payment…" and stops at Paid with the free days kept', async () => {
    // The suite fakes only Date, and useFakeTimers() does not reinstall over it.
    vi.useRealTimers()
    vi.useFakeTimers()
    vi.setSystemTime(daysBeforeEnd(12.5))
    const wait = (ms = 0) => act(async () => { await vi.advanceTimersByTimeAsync(ms) })
    const waiting = 'Confirming your payment…'
    // Gap K's requested reads: subscribed, then ₹299 paid but not recorded (row 7), then captured.
    const reads = stubReads(async () => ({ kind: 'subscription', subscription: liveEarlyFeeSubscription() }))
    const subscribe = vi.spyOn(liveBillingService, 'subscribe').mockResolvedValue(liveSubscribeResponse({ status: 'TRIAL_ACTIVE', razorpay_subscription_id: 'sub_FakeEarlyFee0001' }))
    const opened = vi.spyOn(checkout, 'openSubscriptionCheckout').mockResolvedValue({ status: 'submitted', callback: {
      razorpay_payment_id: 'pay_FakeEarlyFee0001', razorpay_subscription_id: 'sub_FakeEarlyFee0001', razorpay_signature: 'fake_signature_0001',
    } })
    const confirm = vi.spyOn(liveBillingService, 'confirm').mockResolvedValue(null)
    renderShell('/vendor/plan', <LiveVendorPlan />)
    await wait()
    expect(header().getByRole('link', { name: 'Pay ₹299' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Pay ₹299 with Razorpay' }))
    await wait()
    expect(subscribe).toHaveBeenCalledOnce()
    expect(opened).toHaveBeenCalledOnce()
    expect(confirm).toHaveBeenCalledOnce()
    expect(screen.getByText(waiting)).toBeTruthy()

    reads.mockResolvedValue({ kind: 'subscription', subscription: liveEarlyFeeSubscription({ razorpay_status: 'authenticated' }) })
    await wait(5_000)
    expect(screen.getByText('Your shop is live free until 12 Oct, 3:34 pm. Your free days are kept.')).toBeTruthy()
    expect(screen.getAllByText(waiting)).toHaveLength(1)
    expect(header().getByRole('link', { name: 'Shop plan' })).toBeTruthy()

    reads.mockResolvedValue({ kind: 'subscription', subscription: liveEarlyFeePaidSubscription() })
    await wait(5_000)
    expect(screen.getByText('You paid ₹299 via Razorpay. Shop stays open until 12 Nov. Next month is another ₹299.')).toBeTruthy()
    expect(screen.queryByText(waiting)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Check again' })).toBeNull()
    expect(banner()).toBeNull()
    expect(header().getByRole('link', { name: 'Shop plan' }).getAttribute('href')).toBe('/vendor/plan')
    // A settled read ends the poll.
    const polled = reads.mock.calls.length
    await wait(90_000)
    expect(reads).toHaveBeenCalledTimes(polled)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it.each([
    ['Plan stopped', liveStoppedSubscription],
    ['AutoPay off', liveCancelledPaidSubscription],
  ])('shows %s on Plan, the warning banner and Keep open · ₹299', async (eyebrow, subscription) => {
    vi.setSystemTime(new Date('2026-10-22T18:30:00Z'))
    stubReads(async () => ({ kind: 'subscription', subscription: subscription() }))
    renderShell('/vendor/plan', <LiveVendorPlan />)
    await waitFor(() => expect(banner()?.textContent).toBe('Shop stays open until 12 Nov — then customers cannot see it. You can pay again any time with Razorpay.Keep open · ₹299'))
    expect(screen.getByText(eyebrow)).toBeTruthy()
    expect(banner()!.className).toContain('amber')
    expect(within(banner()!).getByRole('link', { name: 'Keep open · ₹299' }).getAttribute('href')).toBe('/vendor/plan')
    expect(header().getByRole('link', { name: 'Keep open · ₹299' }).getAttribute('href')).toBe('/vendor/plan')
    expect(planBanner()).toBeNull()
  })

  it.each([
    ['Payment failed', '2026-11-20T10:00:00Z', liveHaltedSubscription, 'last Razorpay payment did not go through. Pay ₹299 to open the shop again.'],
    ['Shop closed, a stopped plan’s paid days', '2026-11-20T10:00:00Z', liveStoppedSubscription, 'pay ₹299 with Razorpay to open it again.'],
    ['Shop closed, paid days with AutoPay off', '2026-11-20T10:00:00Z', liveCancelledPaidSubscription, 'pay ₹299 with Razorpay to open it again.'],
    ['Shop closed, free days', '2026-10-12T22:00:00Z', liveTrialSubscription, 'pay ₹299 with Razorpay to open it again.'],
  ])('shows the danger banner and Pay ₹299 in %s', async (_, now, subscription, text) => {
    vi.setSystemTime(new Date(now))
    stubReads(async () => ({ kind: 'subscription', subscription: subscription() }))
    renderShell('/vendor', <LiveVendorPlan />)
    await waitFor(() => expect(banner()?.textContent).toBe(`Shop is hidden from customers — ${text}Pay ₹299`))
    expect(banner()!.className).toContain('destructive')
    expect(within(banner()!).getByRole('link', { name: 'Pay ₹299' }).getAttribute('href')).toBe('/vendor/plan')
    expect(header().getByRole('link', { name: 'Pay ₹299' }).getAttribute('href')).toBe('/vendor/plan')
    expect(planBanner()).toBeNull()
  })

  it('shows Stopped on Plan, the warning banner and Keep open · ₹299 at once after Stop the plan, with no reread', async () => {
    vi.setSystemTime(new Date('2026-10-22T18:30:00Z'))
    const reads = stubReads(async () => ({ kind: 'subscription', subscription: livePaidSubscription() }))
    const cancel = vi.spyOn(liveBillingService, 'cancel').mockResolvedValue(liveStoppedSubscription())
    renderShell('/vendor/plan', <LiveVendorPlan />)
    fireEvent.click(await screen.findByRole('button', { name: 'Stop the plan' }))
    fireEvent.click(screen.getByRole('button', { name: 'Yes, stop the plan' }))
    expect(await screen.findByText('Plan stopped')).toBeTruthy()
    expect(banner()?.textContent).toBe('Shop stays open until 12 Nov — then customers cannot see it. You can pay again any time with Razorpay.Keep open · ₹299')
    expect(banner()!.className).toContain('amber')
    expect(header().getByRole('link', { name: 'Keep open · ₹299' }).getAttribute('href')).toBe('/vendor/plan')
    expect(planBanner()).toBeNull()
    expect(cancel).toHaveBeenCalledOnce()
    expect(reads).toHaveBeenCalledOnce()
  })

  it('updates the banner and header when a Stop the plan response lands after leaving Plan', async () => {
    vi.setSystemTime(new Date('2026-10-22T18:30:00Z'))
    stubReads(async () => ({ kind: 'subscription', subscription: livePaidSubscription() }))
    let respond!: (subscription: unknown) => void
    vi.spyOn(liveBillingService, 'cancel').mockReturnValue(new Promise((resolve) => { respond = resolve }))
    renderShell('/vendor/plan', <LiveVendorPlan />)
    fireEvent.click(await screen.findByRole('button', { name: 'Stop the plan' }))
    fireEvent.click(screen.getByRole('button', { name: 'Yes, stop the plan' }))
    fireEvent.click(screen.getAllByRole('link', { name: /Overview/ })[0])
    expect(await screen.findByText('Overview page')).toBeTruthy()
    await act(async () => { respond(liveStoppedSubscription()) })
    expect(banner()?.textContent).toBe('Shop stays open until 12 Nov — then customers cannot see it. You can pay again any time with Razorpay.Keep open · ₹299')
    expect(header().getByRole('link', { name: 'Keep open · ₹299' })).toBeTruthy()
  })

  it('follows the confirmation hold: row 7’s Shop plan header and no billing banner after leaving Plan, and Plan still holds on return', async () => {
    const payEarly = 'Pay ₹299 with Razorpay'
    const waiting = 'Confirming your payment…'
    stubReads(async () => trial())
    vi.spyOn(liveBillingService, 'subscribe').mockResolvedValue(liveSubscribeResponse())
    vi.spyOn(checkout, 'openSubscriptionCheckout').mockResolvedValue({ status: 'submitted', callback: {
      razorpay_payment_id: 'pay_FakePayment0001', razorpay_subscription_id: 'sub_FakeAutoPay0001', razorpay_signature: 'fake_signature_0001',
    } })
    vi.spyOn(liveBillingService, 'confirm').mockResolvedValue(null)
    renderShell('/vendor/plan', <LiveVendorPlan />)
    fireEvent.click(await screen.findByRole('button', { name: payEarly }))
    expect(await screen.findByText(waiting)).toBeTruthy()
    expect(header().getByRole('link', { name: 'Shop plan' }).getAttribute('href')).toBe('/vendor/plan')
    expect(banner()).toBeNull()
    fireEvent.click(rail().getByRole('link', { name: 'Overview' }))
    expect(await screen.findByText('Overview page')).toBeTruthy()
    expect(banner()).toBeNull()
    expect(planBanner()).toBeNull()
    expect(header().queryByRole('link', { name: 'Pay ₹299' })).toBeNull()
    fireEvent.click(header().getByRole('link', { name: 'Shop plan' }))
    expect(await screen.findByText(waiting)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Check again' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: payEarly })).toBeNull()
  })

  it.each([
    ['Free days over', daysBeforeEnd(-0.5), liveTrialSubscription, 'Pay ₹299 with Razorpay', 'Shop is hidden from customers — your ₹299 payment is being confirmed.Shop plan', 'destructive'],
    ['Plan stopped', new Date('2026-10-22T18:30:00Z'), liveStoppedSubscription, 'Keep shop open · ₹299', 'Shop stays open until 12 Nov — your ₹299 payment is being confirmed.Shop plan', 'amber'],
    ['AutoPay off', new Date('2026-10-22T18:30:00Z'), liveCancelledPaidSubscription, 'Keep shop open · ₹299', 'Shop stays open until 12 Nov — your ₹299 payment is being confirmed.Shop plan', 'amber'],
  ])('shows the confirming banner and the Shop plan header, with no Pay anywhere, once Checkout submits from %s', async (_, now, subscription, action, text, tone) => {
    vi.setSystemTime(now)
    stubReads(async () => ({ kind: 'subscription', subscription: subscription() }))
    vi.spyOn(liveBillingService, 'subscribe').mockResolvedValue(liveSubscribeResponse())
    vi.spyOn(checkout, 'openSubscriptionCheckout').mockResolvedValue({ status: 'submitted', callback: {
      razorpay_payment_id: 'pay_FakePayment0001', razorpay_subscription_id: 'sub_FakeAutoPay0001', razorpay_signature: 'fake_signature_0001',
    } })
    vi.spyOn(liveBillingService, 'confirm').mockResolvedValue(null)
    renderShell('/vendor/plan', <LiveVendorPlan />)
    fireEvent.click(await screen.findByRole('button', { name: action }))
    expect(await screen.findByText('Confirming your payment…')).toBeTruthy()
    expect(banner()?.textContent).toBe(text)
    expect(banner()!.className).toContain(tone)
    expect(within(banner()!).getByRole('link', { name: 'Shop plan' }).getAttribute('href')).toBe('/vendor/plan')
    expect(header().getByRole('link', { name: 'Shop plan' }).getAttribute('href')).toBe('/vendor/plan')
    expect(screen.queryAllByRole('link', { name: /Pay ₹299|Keep open/ })).toEqual([])
    expect(screen.queryAllByRole('button', { name: /Pay ₹299|Keep shop open/ })).toEqual([])
  })

  it.each([
    ['Free days (row 7)', daysBeforeEnd(12.5), liveTrialSubscription, null],
    ['Free days over (row 8)', daysBeforeEnd(-0.5), liveTrialSubscription, 'Shop is hidden from customers — your ₹299 payment is being confirmed.Shop plan'],
    ['Payment failed (row 8b)', new Date('2026-11-20T10:00:00Z'), liveHaltedSubscription, 'Shop is hidden from customers — your ₹299 payment is being confirmed.Shop plan'],
    ['Plan stopped', new Date('2026-10-22T18:30:00Z'), liveStoppedSubscription, 'Shop stays open until 12 Nov — your ₹299 payment is being confirmed.Shop plan'],
  ])('shows %s while confirming when a read with no hold reports the latest payment authorized, such as after a reload', async (_, now, subscription, text) => {
    vi.setSystemTime(now)
    stubReads(async () => ({ kind: 'subscription', subscription: subscription({ latest_payment_id: 'pay_FakePayment0001', latest_payment_status: 'authorized' }) }))
    renderShell('/vendor', <LiveVendorPlan />)
    await waitFor(() => expect(header().getByRole('link', { name: 'Shop plan' })).toBeTruthy())
    await waitFor(() => expect(banner()?.textContent ?? null).toBe(text))
    expect(screen.queryAllByRole('link', { name: /Pay ₹299|Keep open/ })).toEqual([])
  })

  it('shows the confirming danger banner and the Shop plan header once free days end before the payment is confirmed (row 8)', async () => {
    vi.setSystemTime(daysBeforeEnd(-0.5))
    stubReads(async () => ({ kind: 'subscription', subscription: liveTrialAutoPaySubscription() }))
    renderShell('/vendor', <LiveVendorPlan />)
    await waitFor(() => expect(banner()?.textContent).toBe('Shop is hidden from customers — your ₹299 payment is being confirmed.Shop plan'))
    expect(banner()!.className).toContain('destructive')
    expect(header().getByRole('link', { name: 'Shop plan' }).getAttribute('href')).toBe('/vendor/plan')
    expect(planBanner()).toBeNull()
  })

  it('shows no Free plan banner in free days to a store that is not open', async () => {
    vi.spyOn(vendorOnboardingService, 'getVendorContext').mockResolvedValue(mapVendorContext({
      data: { vendor_id: 'r1', business_name: 'Green Bowl Grocers', vendor_status: 'SUSPENDED', approval_status: 'APPROVED',
        onboarding: { status: 'COMPLETED', next_step: 11 } },
    }))
    stubReads(async () => trial())
    renderShell('/vendor', <LiveVendorPlan />)
    await waitFor(() => expect(banner()?.textContent).toMatch(/^13 free days left/))
    expect(planBanner()).toBeNull()
  })

  it('shows Shop plan and no banner of either kind for a shop that is not live', async () => {
    stubReads(async () => ({ kind: 'not-live' }))
    renderShell('/vendor', <LiveVendorPlan />)
    await waitFor(() => expect(header().getByRole('link', { name: 'Shop plan' }).getAttribute('href')).toBe('/vendor/plan'))
    await act(async () => {})
    expect(banner()).toBeNull()
    expect(planBanner()).toBeNull()
  })

  it('says Shop plan with no banner of either kind while the first read loads', async () => {
    stubReads(() => new Promise(() => {}))
    renderShell('/vendor', <LiveVendorPlan />)
    expect(await screen.findByText('Overview page')).toBeTruthy()
    expect(header().getByRole('link', { name: 'Shop plan' }).getAttribute('href')).toBe('/vendor/plan')
    expect(banner()).toBeNull()
    expect(planBanner()).toBeNull()
  })

  it('says Shop plan with no banner of either kind after the read fails', async () => {
    const reads = stubReads(async () => { throw new ApiError('Billing is down for a moment.', 500, null, '/v1/vendors/r1/subscription', 'server') })
    renderShell('/vendor', <LiveVendorPlan />)
    await waitFor(() => expect(reads).toHaveBeenCalled())
    await act(async () => {})
    expect(header().getByRole('link', { name: 'Shop plan' })).toBeTruthy()
    expect(banner()).toBeNull()
    expect(planBanner()).toBeNull()
  })

  it('shares one read with Plan when Plan mounts while the chrome’s read is in flight, and both agree', async () => {
    let resolve!: (read: LiveSubscriptionRead) => void
    const reads = stubReads(() => new Promise((res) => { resolve = res }))
    renderShell('/vendor', <LiveVendorPlan />)
    await waitFor(() => expect(reads).toHaveBeenCalledTimes(1))
    fireEvent.click(within(screen.getByRole('complementary', { name: 'Vendor navigation' })).getByRole('link', { name: 'Plan' }))
    expect(await screen.findByText('Reading shop plan…')).toBeTruthy()
    await act(async () => { resolve(trial()) })
    expect(await screen.findByText('13')).toBeTruthy()
    expect(banner()?.textContent).toMatch(/^13 free days left/)
    expect(header().getByRole('link', { name: 'Pay ₹299' })).toBeTruthy()
    expect(reads).toHaveBeenCalledTimes(1)
  })

  it('names the plan on Settings from the subscription read, not the context, and the rail shows the billing badge instead', async () => {
    storeProfile()
    stubReads(async () => ({ kind: 'subscription', subscription: liveTrialAutoPaySubscription() }))
    renderShell('/vendor/settings', <LiveVendorPlan />)
    await waitFor(() => expect(settingsPlan()).toBe('Mithra Social Starter'))
    expect(railBadge()?.textContent).toBe('13 days left')
    expect(planChip()).toBeNull()
  })

  const authorized = { latest_payment_id: 'pay_FakePayment0001', latest_payment_status: 'authorized' }
  it.each([
    ['Free days', daysBeforeEnd(12.5), () => liveTrialSubscription(), '13 days left', 'neutral'],
    ['3 days left', daysBeforeEnd(2.5), () => liveTrialSubscription(), '3 days left', 'danger'],
    ['3 days left, on the last day', daysBeforeEnd(0.5), () => liveTrialSubscription(), '1 day left', 'danger'],
    ['Free days while a payment is confirmed', daysBeforeEnd(12.5), () => liveTrialAutoPaySubscription(), '13 days left', 'neutral'],
    ['3 days left while a payment is confirmed', daysBeforeEnd(2.5), () => liveTrialAutoPaySubscription(), '3 days left', 'danger'],
    ['Collecting', daysBeforeEnd(-1), () => liveActivatedSubscription(), 'Social Starter', 'neutral'],
    ['Paid', new Date('2026-10-22T18:30:00Z'), () => livePaidSubscription(), 'Social Starter', 'neutral'],
    ['Plan stopped', new Date('2026-10-22T18:30:00Z'), () => liveStoppedSubscription(), 'Open until 12 Nov', 'warning'],
    ['AutoPay off', new Date('2026-10-22T18:30:00Z'), () => liveCancelledPaidSubscription(), 'Open until 12 Nov', 'warning'],
    ['Plan stopped while a payment is confirmed', new Date('2026-10-22T18:30:00Z'), () => liveStoppedSubscription(authorized), 'Open until 12 Nov', 'warning'],
    ['AutoPay off while a payment is confirmed', new Date('2026-10-22T18:30:00Z'), () => liveCancelledPaidSubscription(authorized), 'Open until 12 Nov', 'warning'],
    ['Shop closed', new Date('2026-11-20T10:00:00Z'), () => liveStoppedSubscription(), 'Shop closed', 'danger'],
    ['Payment failed', new Date('2026-11-20T10:00:00Z'), () => liveHaltedSubscription(), 'Shop closed', 'danger'],
    ['Shop closed while a payment is confirmed', daysBeforeEnd(-0.5), () => liveTrialSubscription(authorized), 'Shop closed', 'danger'],
  ])('shows the rail badge in %s', async (_, now, subscription, text, tone) => {
    vi.setSystemTime(now)
    stubReads(async () => ({ kind: 'subscription', subscription: subscription() }))
    renderShell('/vendor', <LiveVendorPlan />)
    await waitFor(() => expect(railBadge()?.textContent).toBe(text))
    expect(railBadge()?.dataset.tone).toBe(tone)
    expect(railBadge()?.className).toContain({ neutral: 'bg-[var(--vc-tint)]', danger: 'bg-destructive/[0.04]', warning: 'bg-amber-50/70' }[tone])
    expect(planChip()).toBeNull()
  })

  it('names no plan and shows no badge while the first read loads, then none for a shop that is not live', async () => {
    storeProfile()
    let resolve!: (read: LiveSubscriptionRead) => void
    stubReads(() => new Promise((res) => { resolve = res }))
    renderShell('/vendor/settings', <LiveVendorPlan />)
    await waitFor(() => expect(settingsPlan()).toBe('Loading…'))
    expect(railBadge()).toBeNull()
    await act(async () => { resolve({ kind: 'not-live' }) })
    expect(settingsPlan()).toBe('Not set')
    expect(railBadge()).toBeNull()
    expect(planChip()).toBeNull()
  })

  it('names no plan and shows no badge after the read fails', async () => {
    storeProfile()
    const reads = stubReads(async () => { throw new ApiError('Billing is down for a moment.', 500, null, '/v1/vendors/r1/subscription', 'server') })
    renderShell('/vendor/settings', <LiveVendorPlan />)
    await waitFor(() => expect(reads).toHaveBeenCalled())
    await waitFor(() => expect(settingsPlan()).toBe('Not set'))
    expect(railBadge()).toBeNull()
    expect(planChip()).toBeNull()
  })

  it('opens no Checkout from the chrome: its links only lead to Plan', async () => {
    const subscribe = vi.spyOn(liveBillingService, 'subscribe')
    stubReads(async () => trial())
    renderShell('/vendor', <LiveVendorPlan />)
    await waitFor(() => expect(banner()).toBeTruthy())
    fireEvent.click(header().getByRole('link', { name: 'Pay ₹299' }))
    expect(await screen.findByText('13')).toBeTruthy()
    fireEvent.click(within(banner()!).getByRole('link', { name: 'Pay ₹299' }))
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Plan')
    expect(subscribe).not.toHaveBeenCalled()
  })

  describe('staying current', () => {
    /** Lets pending promises and timers due within `ms` run. */
    const wait = (ms = 0) => act(async () => { await vi.advanceTimersByTimeAsync(ms) })
    const focus = () => act(async () => { window.dispatchEvent(new Event('focus')) })
    /** How long a good read stays fresh: focus before then sends nothing. */
    const freshFor = 15 * 60 * 1000
    const plans = () => vi.mocked(liveBillingService.listPaidPlans)

    /** Another tab's billing channel: what it posts reaches this tab's open channels of the same name. */
    class FakeChannel {
      static open = new Set<FakeChannel>()
      onmessage: ((event: MessageEvent) => void) | null = null
      readonly name: string
      constructor(name: string) { this.name = name; FakeChannel.open.add(this) }
      postMessage(data: unknown) {
        FakeChannel.open.forEach((channel) => { if (channel !== this && channel.name === this.name) channel.onmessage?.(new MessageEvent('message', { data })) })
      }
      close() { FakeChannel.open.delete(this) }
    }
    const otherTab = (vendorId: string) => act(async () => {
      const channel = new FakeChannel('md-vendor-billing')
      channel.postMessage({ vendorId })
      channel.close()
    })
    /** What this tab posts on the billing channel, as another tab would receive it. */
    const listen = () => {
      const posted: unknown[] = []
      new FakeChannel('md-vendor-billing').onmessage = (event) => { posted.push(event.data) }
      return posted
    }

    beforeEach(() => {
      // The suite fakes only Date, and useFakeTimers() does not reinstall over it.
      vi.useRealTimers()
      vi.useFakeTimers()
      vi.setSystemTime(daysBeforeEnd(12.5))
      FakeChannel.open.clear()
      vi.stubGlobal('BroadcastChannel', FakeChannel)
    })

    it('rereads once on window focus on a page other than Plan once the read is 15 minutes old, and the chrome follows', async () => {
      const reads = stubReads(async () => trial())
      renderShell('/vendor/orders', <LiveVendorPlan />)
      await wait()
      expect(header().getByRole('link', { name: 'Pay ₹299' })).toBeTruthy()
      reads.mockImplementation(async () => ({ kind: 'subscription', subscription: liveTrialAutoPaySubscription() }))
      await focus()
      await wait()
      expect(reads).toHaveBeenCalledOnce()
      await wait(freshFor - 1)
      await focus()
      await wait()
      expect(reads).toHaveBeenCalledOnce()
      expect(header().getByRole('link', { name: 'Pay ₹299' })).toBeTruthy()
      await wait(1)
      await focus()
      await wait()
      expect(banner()).toBeNull()
      expect(header().getByRole('link', { name: 'Shop plan' })).toBeTruthy()
      expect(reads).toHaveBeenCalledTimes(2)
      expect(plans()).toHaveBeenCalledOnce()
    })

    it('rereads on focus at once after a failed read', async () => {
      const reads = stubReads(async () => { throw new ApiError('Billing is down for a moment.', 500, null, '/v1/vendors/r1/subscription', 'server') })
      renderShell('/vendor/orders', <LiveVendorPlan />)
      await wait()
      expect(reads).toHaveBeenCalledOnce()
      reads.mockImplementation(async () => trial())
      await focus()
      await wait()
      expect(reads).toHaveBeenCalledTimes(2)
      expect(header().getByRole('link', { name: 'Pay ₹299' })).toBeTruthy()
    })

    it('rereads on focus at once while the view is confirming a payment', async () => {
      const reads = stubReads(async () => ({ kind: 'subscription', subscription: liveTrialAutoPaySubscription() }))
      renderShell('/vendor/orders', <LiveVendorPlan />)
      await wait()
      expect(reads).toHaveBeenCalledOnce()
      await focus()
      await wait()
      expect(reads).toHaveBeenCalledTimes(2)
      expect(plans()).toHaveBeenCalledOnce()
    })

    it('rereads on focus at once while the read reports the latest payment authorized, with no hold', async () => {
      const reads = stubReads(async () => ({ kind: 'subscription', subscription: liveTrialSubscription({ latest_payment_id: 'pay_FakePayment0001', latest_payment_status: 'authorized' }) }))
      renderShell('/vendor/orders', <LiveVendorPlan />)
      await wait()
      expect(reads).toHaveBeenCalledOnce()
      await focus()
      await wait()
      expect(reads).toHaveBeenCalledTimes(2)
    })

    it('rereads on focus at once while the confirmation hold lasts', async () => {
      const reads = stubReads(async () => trial())
      renderShell('/vendor/orders', <LiveVendorPlan />)
      await wait()
      act(() => { holdLiveBilling('r1', 'Waiting for Razorpay…', 'pay_FakePayment0001') })
      await focus()
      await wait()
      expect(reads).toHaveBeenCalledTimes(2)
      expect(plans()).toHaveBeenCalledOnce()
    })

    it('reads the plans list once across focus and T rereads', async () => {
      vi.setSystemTime(daysBeforeEnd(2.5))
      const reads = stubReads(async () => trial())
      renderShell('/vendor/orders', <LiveVendorPlan />)
      await wait()
      await wait(freshFor)
      await focus()
      await wait()
      expect(reads).toHaveBeenCalledTimes(2)
      await wait(Date.parse(trialEnd) - Date.now())
      expect(reads).toHaveBeenCalledTimes(3)
      expect(plans()).toHaveBeenCalledOnce()
    })

    it('reads the plans list again after it fails, and then not again', async () => {
      const reads = stubReads(async () => trial())
      plans().mockRejectedValueOnce(new ApiError('Plans are unavailable.', 500, null, '/v1/subscription-plans', 'server'))
      renderShell('/vendor/orders', <LiveVendorPlan />)
      await wait()
      expect(header().getByRole('link', { name: 'Shop plan' })).toBeTruthy()
      await focus()
      await wait()
      expect(header().getByRole('link', { name: 'Pay ₹299' })).toBeTruthy()
      expect(plans()).toHaveBeenCalledTimes(2)
      await wait(freshFor)
      await focus()
      await wait()
      expect(reads).toHaveBeenCalledTimes(3)
      expect(plans()).toHaveBeenCalledTimes(2)
    })

    it('rereads on the next focus after another tab signals a change for this vendor, but not for another vendor', async () => {
      const reads = stubReads(async () => trial())
      renderShell('/vendor/orders', <LiveVendorPlan />)
      await wait()
      await otherTab('r2')
      await focus()
      await wait()
      expect(reads).toHaveBeenCalledOnce()
      await otherTab('r1')
      await wait()
      // The signal alone sends nothing; the next focus rereads.
      expect(reads).toHaveBeenCalledOnce()
      await focus()
      await wait()
      expect(reads).toHaveBeenCalledTimes(2)
      await focus()
      await wait()
      expect(reads).toHaveBeenCalledTimes(2)
      expect(plans()).toHaveBeenCalledOnce()
    })

    it('tells other tabs when the confirmation hold starts and when a settled read ends it', async () => {
      const reads = stubReads(async () => ({ kind: 'subscription', subscription: liveEarlyFeeSubscription() }))
      renderShell('/vendor/orders', <LiveVendorPlan />)
      await wait()
      const posted = listen()
      act(() => { holdLiveBilling('r1', 'Waiting for Razorpay…', 'pay_FakePayment0001') })
      expect(posted).toEqual([{ vendorId: 'r1' }])
      reads.mockResolvedValue({ kind: 'subscription', subscription: liveEarlyFeePaidSubscription() })
      await focus()
      await wait()
      expect(reads).toHaveBeenCalledTimes(2)
      expect(posted).toEqual([{ vendorId: 'r1' }, { vendorId: 'r1' }])
    })

    it('ends the hold at a focus reread reporting its payment failed, away from Plan, telling no other tab', async () => {
      const reads = stubReads(async () => trial())
      renderShell('/vendor/orders', <LiveVendorPlan />)
      await wait()
      const posted = listen()
      act(() => { holdLiveBilling('r1', 'Waiting for Razorpay…', 'pay_FakePayment0001') })
      reads.mockResolvedValue({ kind: 'subscription', subscription: liveTrialSubscription({ latest_payment_id: 'pay_FakePayment0001', latest_payment_status: 'failed' }) })
      await focus()
      await wait()
      expect(reads).toHaveBeenCalledTimes(2)
      // The hold is over, so the next focus inside 15 minutes does not reread.
      await focus()
      await wait()
      expect(reads).toHaveBeenCalledTimes(2)
      expect(posted).toEqual([{ vendorId: 'r1' }])
    })

    it('tells other tabs after Stop the plan succeeds, and its response counts as a fresh read on focus', async () => {
      vi.setSystemTime(new Date('2026-10-22T18:30:00Z'))
      const reads = stubReads(async () => ({ kind: 'subscription', subscription: livePaidSubscription() }))
      vi.spyOn(liveBillingService, 'cancel').mockResolvedValue(liveStoppedSubscription())
      renderShell('/vendor/plan', <LiveVendorPlan />)
      await wait()
      // The read is no longer fresh, so only the cancel response can make it so.
      await wait(freshFor)
      const posted = listen()
      fireEvent.click(screen.getByRole('button', { name: 'Stop the plan' }))
      fireEvent.click(screen.getByRole('button', { name: 'Yes, stop the plan' }))
      await wait()
      expect(screen.getByText('Plan stopped')).toBeTruthy()
      expect(posted).toEqual([{ vendorId: 'r1' }])
      await focus()
      await wait()
      expect(reads).toHaveBeenCalledOnce()
    })

    it('rereads on the next focus when another tab signals while a read is in flight', async () => {
      let resolve!: (read: LiveSubscriptionRead) => void
      const reads = stubReads(() => new Promise((res) => { resolve = res }))
      renderShell('/vendor/orders', <LiveVendorPlan />)
      await wait()
      expect(reads).toHaveBeenCalledOnce()
      await otherTab('r1')
      await act(async () => { resolve(trial()) })
      await wait()
      expect(header().getByRole('link', { name: 'Pay ₹299' })).toBeTruthy()
      reads.mockImplementation(async () => trial())
      await focus()
      await wait()
      expect(reads).toHaveBeenCalledTimes(2)
    })

    it('rereads on no focus after sign-out, however old the read', async () => {
      const reads = stubReads(async () => trial())
      renderShell('/vendor/orders', <LiveVendorPlan />)
      await wait()
      act(() => { useAuthStore.getState().clearSession() })
      await wait()
      const signedOut = reads.mock.calls.length
      await wait(freshFor)
      await focus()
      await wait()
      expect(reads).toHaveBeenCalledTimes(signedOut)
    })

    it('rereads once at T on a page other than Plan, so the chrome shows the shop hidden at that moment', async () => {
      vi.setSystemTime(daysBeforeEnd(2.5))
      const reads = stubReads(async () => trial())
      renderShell('/vendor/orders', <LiveVendorPlan />)
      await wait()
      expect(banner()?.textContent).toMatch(/^3 free days left/)
      expect(planBanner()).toBeTruthy()
      await wait(Date.parse(trialEnd) - Date.now() - 1)
      expect(reads).toHaveBeenCalledOnce()
      await wait(1)
      expect(banner()?.textContent).toBe('Shop is hidden from customers — pay ₹299 with Razorpay to open it again.Pay ₹299')
      expect(planBanner()).toBeNull()
      expect(header().getByRole('link', { name: 'Pay ₹299' })).toBeTruthy()
      expect(reads).toHaveBeenCalledTimes(2)
    })

    it('rereads once at P on Plan, so a paid shop reads Collecting there, in the banner and in the header', async () => {
      const paidThrough = Date.parse('2026-11-12T18:30Z')
      vi.setSystemTime(new Date('2026-10-22T18:30:00Z'))
        const reads = stubReads(async () => ({ kind: 'subscription', subscription: livePaidSubscription() }))
      renderShell('/vendor/plan', <LiveVendorPlan />)
      await wait()
      expect(screen.getByText('Paid')).toBeTruthy()
      await wait(paidThrough - Date.now() - 1)
      expect(reads).toHaveBeenCalledOnce()
      await wait(1)
      expect(reads).toHaveBeenCalledTimes(2)
      expect(screen.getByText('AutoPay on.')).toBeTruthy()
      expect(screen.queryByText('Shop closed')).toBeNull()
      expect(screen.queryByRole('button', { name: /Pay/ })).toBeNull()
      expect(banner()).toBeNull()
      expect(planBanner()).toBeNull()
      expect(header().getByRole('link', { name: 'Shop plan' }).getAttribute('href')).toBe('/vendor/plan')
    })

    it('keeps the last view in Plan, the banner and the header when a background reread fails, with the error line on Plan', async () => {
      vi.setSystemTime(daysBeforeEnd(2.5))
        const reads = stubReads(async () => trial())
      renderShell('/vendor/plan', <LiveVendorPlan />)
      await wait()
      const warning = banner()?.textContent
      expect(warning).toMatch(/^3 free days left — pay ₹299 with Razorpay now/)
      reads.mockImplementation(async () => { throw new ApiError('Something went wrong on our side. Please try again later.', 503, null, '/v1/vendors/r1/subscription', 'server') })
      await wait(freshFor)
      await focus()
      await wait(50_000)
      expect(reads).toHaveBeenCalledTimes(5)
      expect(screen.getByRole('alert').textContent).toBe('MithraDirect isn’t responding. Try again in a minute.')
      expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
      expect(screen.getByText('Free days')).toBeTruthy()
      expect(banner()?.textContent).toBe(warning)
      expect(banner()!.className).toContain('destructive')
      expect(header().getByRole('link', { name: 'Pay ₹299' })).toBeTruthy()
      expect(belowBillingBanner()).toBe(true)
    })

    it('rereads on neither focus nor T once the console unmounts', async () => {
      vi.setSystemTime(daysBeforeEnd(2.5))
      const reads = stubReads(async () => trial())
      const { unmount } = renderShell('/vendor/plan', <LiveVendorPlan />)
      await wait()
      unmount()
      await focus()
      await wait(3 * 24 * 60 * 60 * 1000)
      expect(reads).toHaveBeenCalledOnce()
    })
  })
})
