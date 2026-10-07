// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useVendorAccount } from '@/modules/vendor/hooks/use-vendor-account'
import { invalidateVendorContext } from '@/modules/vendor/lib/vendor-context-cache'
import { invalidateVendorOnboardingState } from '@/modules/vendor/lib/onboarding-state-cache'
import { VendorOverviewPage } from '@/modules/vendor/pages/VendorOverviewPage'
import {
  configureApiClient,
  mapVendorContext,
  vendorOnboardingService,
  vendorOrdersService,
  vendorService,
} from '@/shared/api'
import { useAuthStore } from '@/shared/auth/store/auth-store'
import { VendorAccountProvider } from './VendorAccountProvider'
import fixtures from '../../../../docs/examples/vendor-billing/mock-responses.json'
import type { VendorContext } from '@/shared/api'

beforeEach(() => {
  invalidateVendorContext()
  vi.stubEnv('DEV', false)
  vi.spyOn(vendorOrdersService, 'list').mockResolvedValue({
    orders: [], page: 0, totalPages: 0, totalElements: 0, lastPage: true,
  })
  vi.spyOn(vendorService, 'getInsights').mockResolvedValue({
    totalCustomers: null, ordersByStatus: {},
  })
  useAuthStore.getState().applySession({
    token: 'test-token',
    refreshToken: null,
    user: {
      id: 'test-user', name: 'Test Vendor', email: 'vendor@example.test',
      role: 'vendor', roles: ['vendor'],
      vendors: [{ vendorId: 'test-vendor' }], vendorId: 'test-vendor',
    },
  })
})

afterEach(() => {
  cleanup()
  invalidateVendorContext()
  useAuthStore.getState().clearSession()
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

function AccountReading() {
  const { context } = useVendorAccount()
  return <output aria-label="Account approval">{context.approvalStatus}</output>
}

function BillingAccountReading() {
  const { vendorId, context, plan, contextStale, refreshContext } = useVendorAccount()
  return <>
    <output aria-label="Selected vendor">{vendorId}</output>
    <output aria-label="Current plan">{plan.name}</output>
    <output aria-label="Current features">{context.eligibleFeatures.join(',')}</output>
    <output aria-label="Current usage">{plan.usage.products}</output>
    <output aria-label="Context stale">{contextStale ? 'yes' : 'no'}</output>
    <button onClick={() => { void refreshContext?.().catch(() => {}) }}>Refresh account</button>
  </>
}

function billingContext(vendorId: string, revision: number, name: string, products: number): VendorContext {
  const base = mapVendorContext(fixtures.contexts.trial_active)
  return { ...base, vendorId, billing: { revision },
    subscription: { ...base.subscription, planName: name, usage: { ...base.subscription.usage, products } },
    eligibleFeatures: [name],
  }
}

function renderContext(vendorStatus: string, approvalStatus: string, nextStep: number) {
  // Exercise the real mapper too: coercion must never erase the backend's approval value.
  vi.spyOn(vendorOnboardingService, 'getVendorContext').mockResolvedValue(mapVendorContext({
    data: {
      vendor_id: 'test-vendor', vendor_status: vendorStatus, approval_status: approvalStatus,
      onboarding: { status: nextStep === 11 ? 'COMPLETED' : 'IN_PROGRESS', next_step: nextStep },
    },
  }))
  return render(
    <MemoryRouter>
      <VendorAccountProvider>
        <AccountReading />
        <VendorOverviewPage />
      </VendorAccountProvider>
    </MemoryRouter>,
  )
}

describe('VendorAccountProvider store state', () => {
  it('reads the submitted store when returning from setup after an account write', async () => {
    const firstVisit = renderContext('INACTIVE', 'PENDING', 4)
    expect(await screen.findByRole('heading', { name: 'Setup incomplete' })).toBeTruthy()
    firstVisit.unmount()

    // This is the invalidation used by the wizard after persistStep and goLive.
    invalidateVendorOnboardingState('test-vendor')
    renderContext('ACTIVE', 'PENDING', 11)

    expect(await screen.findByRole('heading', { name: 'What needs doing' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Setup incomplete' })).toBeNull()
  })

  it('opens the work queue for a submitted live PENDING store with completed onboarding', async () => {
    renderContext('ACTIVE', 'PENDING', 11)

    expect(await screen.findByRole('heading', { name: 'What needs doing' })).toBeTruthy()
    expect(screen.getByLabelText('Account approval').textContent).toBe('PENDING')
    expect(screen.queryByRole('link', { name: 'Continue setup' })).toBeNull()
  })

  it('opens the seeded demo store as approved and active, with no store-state switch', async () => {
    vi.stubEnv('VITE_USE_API', 'false')
    configureApiClient({ useApi: false })
    // Overview's DEV plan card reads the local helper; keep it off the network, as if the helper were down.
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    render(
      <MemoryRouter>
        <VendorAccountProvider>
          <AccountReading />
          <VendorOverviewPage />
        </VendorAccountProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'What needs doing' })).toBeTruthy()
    expect(screen.getByLabelText('Account approval').textContent).toBe('APPROVED')
  })

  it.each([1, 5, 7, 10])('offers setup for an active approved store still at step %i', async (nextStep) => {
    renderContext('ACTIVE', 'APPROVED', nextStep)

    expect(await screen.findByRole('heading', { name: 'Setup incomplete' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Continue setup' }).getAttribute('href')).toBe('/onboarding')
    expect(vendorOrdersService.list).not.toHaveBeenCalled()
    expect(vendorService.getInsights).not.toHaveBeenCalled()
  })

  it('still labels the resume step for an unsubmitted store', async () => {
    renderContext('INACTIVE', 'APPROVED', 4)

    expect(await screen.findByRole('heading', { name: 'Setup incomplete' })).toBeTruthy()
    expect(screen.getByText('Step 4 of 10')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Continue setup' }).getAttribute('href')).toBe('/onboarding')
    expect(vendorOrdersService.list).not.toHaveBeenCalled()
    expect(vendorService.getInsights).not.toHaveBeenCalled()
  })
})

describe('VendorAccountProvider billing refresh', () => {
  it('bypasses a retained read and updates plan, usage and features from one accepted context', async () => {
    const first = billingContext('test-vendor', 1, 'First', 2)
    const second = billingContext('test-vendor', 2, 'Second', 7)
    let resolveSecond!: (context: VendorContext) => void
    const read = vi.spyOn(vendorOnboardingService, 'getVendorContext')
      .mockResolvedValueOnce(first)
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve }))
    render(<MemoryRouter><VendorAccountProvider><BillingAccountReading /></VendorAccountProvider></MemoryRouter>)
    await waitFor(() => expect(screen.getByLabelText('Current plan').textContent).toBe('First'))
    fireEvent.click(screen.getByRole('button', { name: 'Refresh account' }))
    await waitFor(() => expect(read).toHaveBeenCalledTimes(2))
    expect(screen.getByLabelText('Current plan').textContent).toBe('First')
    resolveSecond(second)
    await waitFor(() => expect(screen.getByLabelText('Current plan').textContent).toBe('Second'))
    expect(screen.getByLabelText('Current usage').textContent).toBe('7')
    expect(screen.getByLabelText('Current features').textContent).toBe('Second')
    expect(screen.getByLabelText('Context stale').textContent).toBe('no')
  })

  it('rejects a lower revision without replacing its plan and features', async () => {
    vi.spyOn(vendorOnboardingService, 'getVendorContext')
      .mockResolvedValueOnce(billingContext('test-vendor', 3, 'Newer', 7))
      .mockResolvedValueOnce(billingContext('test-vendor', 2, 'Older', 1))
    render(<MemoryRouter><VendorAccountProvider><BillingAccountReading /></VendorAccountProvider></MemoryRouter>)
    await waitFor(() => expect(screen.getByLabelText('Current plan').textContent).toBe('Newer'))
    fireEvent.click(screen.getByRole('button', { name: 'Refresh account' }))
    await waitFor(() => expect(screen.getByLabelText('Context stale').textContent).toBe('yes'))
    expect(screen.getByLabelText('Current plan').textContent).toBe('Newer')
    expect(screen.getByLabelText('Current usage').textContent).toBe('7')
    expect(screen.getByLabelText('Current features').textContent).toBe('Newer')
  })

  it('ignores the first vendor’s late context after selecting a second vendor', async () => {
    useAuthStore.getState().applySession({ token: 'test-token', refreshToken: null,
      user: { id: 'test-user', name: 'Test Vendor', email: 'vendor@example.test', role: 'vendor', roles: ['vendor'],
        vendors: [{ vendorId: 'test-vendor' }, { vendorId: 'second_vendor' }], vendorId: 'test-vendor' } })
    let resolveFirst!: (context: VendorContext) => void
    vi.spyOn(vendorOnboardingService, 'getVendorContext').mockImplementation((id) =>
      id === 'test-vendor' ? new Promise((resolve) => { resolveFirst = resolve })
        : Promise.resolve(billingContext('second_vendor', 1, 'Second vendor', 4)))
    render(<MemoryRouter><VendorAccountProvider><BillingAccountReading /></VendorAccountProvider></MemoryRouter>)
    await waitFor(() => expect(resolveFirst).toBeTypeOf('function'))
    useAuthStore.getState().selectVendor('second_vendor')
    await waitFor(() => expect(screen.getByLabelText('Current plan').textContent).toBe('Second vendor'))
    resolveFirst(billingContext('test-vendor', 9, 'Wrong vendor', 99))
    await waitFor(() => expect(screen.getByLabelText('Selected vendor').textContent).toBe('second_vendor'))
    expect(screen.queryByText('Wrong vendor')).toBeNull()
  })
})
