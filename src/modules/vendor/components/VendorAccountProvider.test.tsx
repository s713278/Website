// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useVendorAccount } from '@/modules/vendor/hooks/use-vendor-account'
import { invalidateVendorContext } from '@/modules/vendor/lib/vendor-context-cache'
import { invalidateVendorOnboardingState } from '@/modules/vendor/lib/onboarding-state-cache'
import { VendorOverviewPage } from '@/modules/vendor/pages/VendorOverviewPage'
import {
  demoService,
  mapVendorContext,
  vendorOnboardingService,
  vendorOrdersService,
  vendorService,
} from '@/shared/api'
import { useAuthStore } from '@/shared/auth/store/auth-store'
import { VendorAccountProvider } from './VendorAccountProvider'

beforeEach(() => {
  invalidateVendorContext()
  vi.spyOn(demoService, 'isDemo').mockReturnValue(false)
  vi.spyOn(demoService, 'storeStateKey').mockReturnValue('OPEN')
  vi.spyOn(demoService, 'select').mockImplementation(() => {})
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
})

function AccountReading() {
  const { context, demo } = useVendorAccount()
  return (
    <>
      <output aria-label="Account approval">{context.approvalStatus}</output>
      {demo ? <button onClick={() => demo.select('UNDER_REVIEW')}>Show under review</button> : null}
    </>
  )
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

  it('keeps the demo under-review screen reachable when the selection changes', async () => {
    vi.spyOn(demoService, 'isDemo').mockReturnValue(true)
    renderContext('ACTIVE', 'PENDING', 10)
    expect(await screen.findByRole('heading', { name: 'What needs doing' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Show under review' }))

    expect(screen.getByRole('heading', { name: 'Awaiting approval' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'What needs doing' })).toBeNull()
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
