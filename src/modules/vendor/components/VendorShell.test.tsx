// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { resetBillingPrototypeState } from '@/modules/vendor/hooks/use-billing-prototype'
import { invalidateVendorContext } from '@/modules/vendor/lib/vendor-context-cache'
import { configureApiClient, mapVendorContext, prototypeSeed, vendorOnboardingService, type PrototypeState } from '@/shared/api'
import { useAuthStore } from '@/shared/auth/store/auth-store'
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

function renderShell(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/vendor" element={<VendorShell />}>
          <Route index element={<p>Overview page</p>} />
          <Route path="orders" element={<p>Orders page</p>} />
          <Route path="products" element={<p>Products page</p>} />
          <Route path="plan" element={<VendorBillingPrototype />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

const banner = () => screen.queryByRole('status', { name: 'Shop plan status' })
const header = () => within(screen.getByRole('banner'))

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

  it('shows the display-only Free days seed while the helper is down', async () => {
    fakeHelper('down')
    renderShell('/vendor')
    await waitFor(() => expect(banner()?.textContent).toMatch(/^12 free days left/))
    expect(header().getByRole('link', { name: 'Pay ₹299' })).toBeTruthy()
  })
})

describe('VendorShell under the live API', () => {
  beforeEach(() => { vi.stubEnv('VITE_USE_API', 'true'); configureApiClient({ useApi: true }) })

  it('keeps the plan pill and never reads the prototype helper', async () => {
    const paths = fakeHelper('three_days_left')
    renderShell('/vendor')
    expect(await screen.findByText('Overview page')).toBeTruthy()
    expect(header().getByRole('link', { name: 'Your plan' }).getAttribute('href')).toBe('/vendor/plan')
    expect(banner()).toBeNull()
    expect(screen.queryByText('Demo: store state')).toBeNull()
    expect(paths).toEqual([])
  })
})
