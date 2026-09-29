// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { resetBillingPrototypeState } from '@/modules/vendor/hooks/use-billing-prototype'
import { invalidateVendorContext } from '@/modules/vendor/lib/vendor-context-cache'
import { resetLiveBilling } from '@/modules/vendor/store/live-billing'
import {
  ApiError, configureApiClient, liveBillingService, mapVendorContext, prototypeSeed, vendorOnboardingService, vendorService,
  type LiveSubscriptionRead, type PrototypeState,
} from '@/shared/api'
import {
  liveActivatedSubscription, liveCancelledPaidSubscription, liveHaltedSubscription, livePaidSubscription, livePlans, liveStoppedSubscription,
  liveTrialAutoPayCancelledSubscription, liveTrialAutoPaySubscription, liveTrialSubscription,
} from '@/shared/api/fixtures/live-billing-wire'
import { useAuthStore } from '@/shared/auth/store/auth-store'
import { VendorSettingsPage } from '../pages/VendorSettingsPage'
import { LiveVendorPlan } from './LiveVendorPlan'
import { VendorBillingPrototype } from './VendorBillingPrototype'
import { VendorShell } from './VendorShell'

const serverTime = '2026-09-24T10:00:00.000Z'

/** The local helper's status, scenario and reset routes, holding one prototype record. */
function fakeHelper(initial: PrototypeState | 'down') {
  let generation = 1
  const recordFor = (scenario: PrototypeState) => ({ vendorId: 'r1-prototype', scenario, generation, serverTime,
    ...prototypeSeed(scenario, new Date(serverTime)), attempts: [], associations: [], availableActions: [], authorisationStatus: 'not_configured', nextChargeAt: null, cancellation: null,
    paymentStatus: 'none', providerVerified: { authorisation: false, payment: false, coverage: false }, providerCheck: 'not_checked' })
  let record: ReturnType<typeof recordFor> | null = initial === 'down' ? null : recordFor(initial)
  const paths: string[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, options?: RequestInit) => {
    paths.push(url)
    if (initial === 'down') throw new TypeError('Failed to fetch')
    const body = options?.body ? JSON.parse(String(options.body)) as { scenario?: PrototypeState } : {}
    if (url.endsWith('/resets')) record = null
    if (url.endsWith('/scenario')) { generation += 1; record = recordFor(body.scenario!) }
    return { ok: true, json: async () => ({ record, history: [] }) }
  }))
  return paths
}

function renderShell(path: string, plan: ReactNode = <VendorBillingPrototype />) {
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
  resetBillingPrototypeState()
  resetLiveBilling()
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('VendorShell in demo development', () => {
  beforeEach(() => { vi.stubEnv('VITE_USE_API', 'false'); configureApiClient({ useApi: false }) })

  it.each(['/vendor', '/vendor/orders', '/vendor/products', '/vendor/plan'])('shows the prototype banner and header button on %s, both linking to Plan', async (path) => {
    fakeHelper('three_days_left')
    renderShell(path)
    await waitFor(() => expect(banner()?.textContent).toMatch(/^3 free days left — set up AutoPay now/))
    expect(within(banner()!).getByRole('link', { name: 'Pay ₹299' }).getAttribute('href')).toBe('/vendor/plan')
    expect(header().getByRole('link', { name: 'Pay ₹299' }).getAttribute('href')).toBe('/vendor/plan')
    expect(header().getByRole('link', { name: 'Setup' }).getAttribute('href')).toBe('/onboarding')
    expect(screen.getAllByRole('status', { name: 'Shop plan status' })).toHaveLength(1)
    expect(screen.queryByText('Demo: store state')).toBeNull()
  })

  it.each([
    ['stopped', 'Keep open · ₹299', /^Shop stays open until 2 Oct/],
    ['shop_closed', 'Pay ₹299', /^Shop is hidden from customers — pay ₹299/],
    ['payment_failed', 'Pay ₹299', /^Shop is hidden from customers — last Razorpay payment/],
  ] as const)('labels the header for %s', async (state, action, copy) => {
    fakeHelper(state)
    renderShell('/vendor/orders')
    await waitFor(() => expect(banner()?.textContent).toMatch(copy))
    expect(header().getByRole('link', { name: action })).toBeTruthy()
  })

  it('shows no banner in Paid and labels the header Shop plan', async () => {
    const paths = fakeHelper('paid')
    renderShell('/vendor/products')
    await waitFor(() => expect(paths.length).toBeGreaterThan(0))
    await waitFor(() => expect(header().getByRole('link', { name: 'Shop plan' }).getAttribute('href')).toBe('/vendor/plan'))
    expect(banner()).toBeNull()
  })

  it('follows a state change made on Plan, reading the helper once for both', async () => {
    const paths = fakeHelper('free_days')
    renderShell('/vendor/plan')
    await waitFor(() => expect(banner()?.textContent).toMatch(/^12 free days left/))
    expect(paths.filter((path) => path.endsWith('/status'))).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Stopped' }))
    await waitFor(() => expect(header().getByRole('link', { name: 'Keep open · ₹299' })).toBeTruthy())
    expect(banner()?.textContent).toMatch(/^Shop stays open until 2 Oct/)
  })

  it('names the plan in the rail and on Settings from the demo context', async () => {
    vi.spyOn(vendorOnboardingService, 'getVendorContext').mockResolvedValue(mapVendorContext({
      data: { vendor_id: 'r1', business_name: 'Green Bowl Grocers', vendor_status: 'ACTIVE', approval_status: 'APPROVED',
        onboarding: { status: 'COMPLETED', next_step: 11 }, subscription: { tier: 'FREE', plan_name: 'Free' } },
    }))
    storeProfile()
    fakeHelper('paid')
    const reads = vi.spyOn(liveBillingService, 'readSubscription')
    renderShell('/vendor/settings')
    await waitFor(() => expect(settingsPlan()).toBe('Free'))
    expect(planChip()?.textContent).toBe('Free plan')
    expect(reads).not.toHaveBeenCalled()
  })

  it('shows the display-only Free days seed while the helper is down', async () => {
    fakeHelper('down')
    renderShell('/vendor')
    await waitFor(() => expect(banner()?.textContent).toMatch(/^12 free days left/))
    expect(header().getByRole('link', { name: 'Pay ₹299' })).toBeTruthy()
  })
})

describe('VendorShell under the live API', () => {
  /** 3:34 pm IST on 12 Oct. */
  const trialEnd = '2026-10-12T10:04:16.169Z'
  const daysBeforeEnd = (days: number) => new Date(Date.parse(trialEnd) - days * 24 * 60 * 60 * 1000)
  const trial = (): LiveSubscriptionRead => ({ kind: 'subscription', subscription: liveTrialSubscription() })

  /** Stubs both halves of the shared billing read; nothing reaches the dev backend. */
  function stubReads(subscription: () => Promise<LiveSubscriptionRead>) {
    vi.spyOn(liveBillingService, 'listPaidPlans').mockResolvedValue(livePlans)
    return vi.spyOn(liveBillingService, 'readSubscription').mockImplementation(subscription)
  }

  /** An open store on the free tier: the one vendor `PlanBanner` speaks to. */
  function freeTierStore() {
    vi.spyOn(vendorOnboardingService, 'getVendorContext').mockResolvedValue(mapVendorContext({
      data: { vendor_id: 'r1', business_name: 'Green Bowl Grocers', vendor_status: 'ACTIVE', approval_status: 'APPROVED',
        onboarding: { status: 'COMPLETED', next_step: 11 }, subscription: { tier: 'FREE', plan_name: 'Free' } },
    }))
  }

  const planBanner = () => screen.queryByText('Free plan active')

  beforeEach(() => {
    vi.stubEnv('VITE_USE_API', 'true'); configureApiClient({ useApi: true })
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(daysBeforeEnd(12.5))
  })
  afterEach(() => { vi.useRealTimers() })

  it.each(['/vendor', '/vendor/orders', '/vendor/products'])('shows free days in the neutral banner and Pay ₹299 on %s, both linking to Plan', async (path) => {
    freeTierStore()
    const paths = fakeHelper('three_days_left')
    stubReads(async () => trial())
    renderShell(path, <LiveVendorPlan />)
    await waitFor(() => expect(banner()?.textContent).toBe('13 free days left — after that, subscribe with Razorpay (₹299 / month) to keep the shop open.Pay ₹299'))
    expect(banner()!.className).toContain('--vc-banner')
    expect(within(banner()!).getByRole('link', { name: 'Pay ₹299' }).getAttribute('href')).toBe('/vendor/plan')
    expect(header().getByRole('link', { name: 'Pay ₹299' }).getAttribute('href')).toBe('/vendor/plan')
    expect(header().queryByRole('link', { name: 'Your plan' })).toBeNull()
    expect(planBanner()).toBeNull()
    expect(paths).toEqual([])
  })

  it('warns with the danger banner at 3 days left, on Plan too', async () => {
    vi.setSystemTime(daysBeforeEnd(2.5))
    freeTierStore()
    stubReads(async () => trial())
    renderShell('/vendor/plan', <LiveVendorPlan />)
    await waitFor(() => expect(banner()?.textContent).toMatch(/^3 free days left — set up AutoPay now so customers can still open your shop when free days end\./))
    expect(banner()!.className).toContain('destructive')
    expect(header().getByRole('link', { name: 'Pay ₹299' }).getAttribute('href')).toBe('/vendor/plan')
    expect(screen.getAllByRole('status', { name: 'Shop plan status' })).toHaveLength(1)
    expect(planBanner()).toBeNull()
  })

  it('shows the neutral AutoPay-on banner and the Shop plan header while free days last', async () => {
    freeTierStore()
    stubReads(async () => ({ kind: 'subscription', subscription: liveTrialAutoPaySubscription() }))
    renderShell('/vendor', <LiveVendorPlan />)
    await waitFor(() => expect(banner()?.textContent).toBe('13 free days left — AutoPay is on, so the first ₹299 is charged on 12 Oct.Shop plan'))
    expect(banner()!.className).toContain('--vc-banner')
    expect(within(banner()!).getByRole('link', { name: 'Shop plan' }).getAttribute('href')).toBe('/vendor/plan')
    expect(header().getByRole('link', { name: 'Shop plan' }).getAttribute('href')).toBe('/vendor/plan')
    expect(planBanner()).toBeNull()
  })

  it('shows no billing banner while Razorpay collects, so PlanBanner can show', async () => {
    vi.setSystemTime(daysBeforeEnd(-1))
    freeTierStore()
    stubReads(async () => ({ kind: 'subscription', subscription: liveActivatedSubscription() }))
    renderShell('/vendor', <LiveVendorPlan />)
    await waitFor(() => expect(planBanner()).toBeTruthy())
    expect(banner()).toBeNull()
    expect(header().getByRole('link', { name: 'Shop plan' }).getAttribute('href')).toBe('/vendor/plan')
  })

  it('shows no billing banner while paid, so PlanBanner can show', async () => {
    vi.setSystemTime(new Date('2026-10-22T18:30:00Z'))
    freeTierStore()
    stubReads(async () => ({ kind: 'subscription', subscription: livePaidSubscription() }))
    renderShell('/vendor/plan', <LiveVendorPlan />)
    expect(await screen.findByText(/^You paid ₹299 via Razorpay\./)).toBeTruthy()
    expect(banner()).toBeNull()
    expect(planBanner()).toBeTruthy()
    expect(header().getByRole('link', { name: 'Shop plan' }).getAttribute('href')).toBe('/vendor/plan')
  })

  it.each([
    ['stopped', liveStoppedSubscription],
    ['AutoPay ended', liveCancelledPaidSubscription],
  ])('shows the warning banner and Keep open · ₹299 when %s', async (_, subscription) => {
    vi.setSystemTime(new Date('2026-10-22T18:30:00Z'))
    freeTierStore()
    stubReads(async () => ({ kind: 'subscription', subscription: subscription() }))
    renderShell('/vendor', <LiveVendorPlan />)
    await waitFor(() => expect(banner()?.textContent).toBe('Shop stays open until 12 Nov — then customers cannot see it. You can pay again any time with Razorpay.Keep open · ₹299'))
    expect(banner()!.className).toContain('amber')
    expect(within(banner()!).getByRole('link', { name: 'Keep open · ₹299' }).getAttribute('href')).toBe('/vendor/plan')
    expect(header().getByRole('link', { name: 'Keep open · ₹299' }).getAttribute('href')).toBe('/vendor/plan')
    expect(planBanner()).toBeNull()
  })

  it.each([
    ['Payment failed', '2026-11-20T10:00:00Z', liveHaltedSubscription, 'last Razorpay payment did not go through. Pay ₹299 to open the shop again.'],
    ['Shop closed, paid days', '2026-11-20T10:00:00Z', livePaidSubscription, 'pay ₹299 with Razorpay to open it again.'],
    ['Shop closed, free days', '2026-10-12T22:00:00Z', liveTrialSubscription, 'pay ₹299 with Razorpay to open it again.'],
  ])('shows the danger banner and Pay ₹299 in %s', async (_, now, subscription, text) => {
    vi.setSystemTime(new Date(now))
    freeTierStore()
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
    freeTierStore()
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

  it('shows Free days on Plan, the banner and the header at once after Turn off AutoPay, with no reread', async () => {
    freeTierStore()
    const reads = stubReads(async () => ({ kind: 'subscription', subscription: liveTrialAutoPaySubscription() }))
    vi.spyOn(liveBillingService, 'cancel').mockResolvedValue(liveTrialAutoPayCancelledSubscription())
    renderShell('/vendor/plan', <LiveVendorPlan />)
    fireEvent.click(await screen.findByRole('button', { name: 'Turn off AutoPay' }))
    await waitFor(() => expect(banner()?.textContent).toBe('13 free days left — after that, subscribe with Razorpay (₹299 / month) to keep the shop open.Pay ₹299'))
    expect(screen.getByText(/^Your shop is live free until/)).toBeTruthy()
    expect(header().getByRole('link', { name: 'Pay ₹299' }).getAttribute('href')).toBe('/vendor/plan')
    expect(reads).toHaveBeenCalledOnce()
  })

  it('updates the banner and header when a Stop the plan response lands after leaving Plan', async () => {
    vi.setSystemTime(new Date('2026-10-22T18:30:00Z'))
    freeTierStore()
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

  it('shows the confirming banner and the Shop plan header while a payment is confirmed', async () => {
    vi.setSystemTime(daysBeforeEnd(-0.5))
    freeTierStore()
    stubReads(async () => ({ kind: 'subscription', subscription: liveTrialAutoPaySubscription() }))
    renderShell('/vendor', <LiveVendorPlan />)
    await waitFor(() => expect(banner()?.textContent).toBe('Shop is hidden from customers — your ₹299 payment is being confirmed.Shop plan'))
    expect(banner()!.className).toContain('destructive')
    expect(header().getByRole('link', { name: 'Shop plan' }).getAttribute('href')).toBe('/vendor/plan')
    expect(planBanner()).toBeNull()
  })

  it('shows PlanBanner and Shop plan for a shop that is not live', async () => {
    freeTierStore()
    stubReads(async () => ({ kind: 'not-live' }))
    renderShell('/vendor', <LiveVendorPlan />)
    await waitFor(() => expect(planBanner()).toBeTruthy())
    expect(banner()).toBeNull()
    expect(header().getByRole('link', { name: 'Shop plan' }).getAttribute('href')).toBe('/vendor/plan')
  })

  it('keeps PlanBanner to its own conditions when the shop is not live', async () => {
    stubReads(async () => ({ kind: 'not-live' }))
    renderShell('/vendor', <LiveVendorPlan />)
    await waitFor(() => expect(header().getByRole('link', { name: 'Shop plan' })).toBeTruthy())
    await act(async () => {})
    expect(planBanner()).toBeNull()
    expect(banner()).toBeNull()
  })

  it('says Shop plan with no banner of either kind while the first read loads', async () => {
    freeTierStore()
    stubReads(() => new Promise(() => {}))
    renderShell('/vendor', <LiveVendorPlan />)
    expect(await screen.findByText('Overview page')).toBeTruthy()
    expect(header().getByRole('link', { name: 'Shop plan' }).getAttribute('href')).toBe('/vendor/plan')
    expect(banner()).toBeNull()
    expect(planBanner()).toBeNull()
  })

  it('says Shop plan with no banner of either kind after the read fails', async () => {
    freeTierStore()
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

  it('names the plan in the rail and on Settings from the subscription read, not the context', async () => {
    freeTierStore()
    storeProfile()
    stubReads(async () => ({ kind: 'subscription', subscription: liveTrialAutoPaySubscription() }))
    renderShell('/vendor/settings', <LiveVendorPlan />)
    await waitFor(() => expect(settingsPlan()).toBe('Mithra Social Starter'))
    expect(planChip()?.textContent).toBe('Mithra Social Starter plan')
  })

  it('names no plan while the first read loads, then none for a shop that is not live', async () => {
    freeTierStore()
    storeProfile()
    let resolve!: (read: LiveSubscriptionRead) => void
    stubReads(() => new Promise((res) => { resolve = res }))
    renderShell('/vendor/settings', <LiveVendorPlan />)
    await waitFor(() => expect(settingsPlan()).toBe('Loading…'))
    expect(planChip()).toBeNull()
    await act(async () => { resolve({ kind: 'not-live' }) })
    expect(settingsPlan()).toBe('Not set')
    expect(planChip()).toBeNull()
  })

  it('names no plan after the read fails', async () => {
    freeTierStore()
    storeProfile()
    const reads = stubReads(async () => { throw new ApiError('Billing is down for a moment.', 500, null, '/v1/vendors/r1/subscription', 'server') })
    renderShell('/vendor/settings', <LiveVendorPlan />)
    await waitFor(() => expect(reads).toHaveBeenCalled())
    await waitFor(() => expect(settingsPlan()).toBe('Not set'))
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
})
