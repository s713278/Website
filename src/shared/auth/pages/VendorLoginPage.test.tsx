// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { invalidateVendorOnboardingState } from '@/modules/vendor/lib/onboarding-state-cache'
import { resetLiveBillingPlansForTests } from '@/modules/vendor/store/live-billing'
import {
  authService,
  configureApiClient,
  liveBillingService,
  mapVendorContext,
  vendorOnboardingService,
  type OtpAuthSession,
  type VendorContext,
} from '@/shared/api'
import { useAuthStore } from '@/shared/auth/store/auth-store'
import type { User } from '@/shared/types'
import { VendorLoginPage } from './VendorLoginPage'

vi.mock('@/app/router/vendor-dashboard-chunks', () => ({ preloadVendorDashboard: vi.fn() }))

const VENDOR_ID = 'test-vendor'

const vendor: User = {
  id: 'test-user', name: 'Test Vendor', email: 'vendor@example.test',
  role: 'vendor', roles: ['vendor'],
  vendors: [{ vendorId: VENDOR_ID }], vendorId: VENDOR_ID,
}

const SUBMITTED: VendorContext = mapVendorContext({
  data: {
    vendor_id: VENDOR_ID,
    vendor_status: 'ACTIVE',
    approval_status: 'APPROVED',
    onboarding: { status: 'COMPLETED', next_step: 11 },
  },
})

const session: OtpAuthSession = {
  token: 'test-access-token',
  refreshToken: null,
  user: vendor,
  signInVendors: [{
    vendorId: VENDOR_ID,
    status: 'ACTIVE',
    onboarding: { status: 'COMPLETED', description: null, nextStep: 11 },
  }],
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => { resolve = res })
  return { promise, resolve }
}

const neverSettles = () => new Promise<never>(() => {})

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/vendor/login" element={<VendorLoginPage />} />
        <Route path="/vendor" element={<p>Dashboard</p>} />
        <Route path="/onboarding" element={<p>Setup</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.stubEnv('VITE_USE_API', 'true')
  configureApiClient({ useApi: true })
  invalidateVendorOnboardingState()
  resetLiveBillingPlansForTests()
  vi.spyOn(liveBillingService, 'readSubscription').mockReturnValue(neverSettles())
  vi.spyOn(liveBillingService, 'listPaidPlans').mockReturnValue(neverSettles())
})

afterEach(() => {
  cleanup()
  useAuthStore.getState().clearSession()
  invalidateVendorOnboardingState()
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe('VendorLoginPage', () => {
  it('lands an in-page sign-in from the verify-otp snapshot while the context is still in flight', async () => {
    const context = deferred<VendorContext>()
    const getContext = vi.spyOn(vendorOnboardingService, 'getVendorContext').mockReturnValue(context.promise)
    vi.spyOn(authService, 'requestOtp').mockResolvedValue({ success: true, status: 200, data: {} } as never)
    vi.spyOn(authService, 'verifyOtp').mockResolvedValue(session)

    renderAt('/vendor/login')
    fireEvent.change(screen.getByLabelText(/WhatsApp number/), { target: { value: '9000000000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send OTP' }))
    fireEvent.change(await screen.findByLabelText('OTP'), { target: { value: '1234' } })
    fireEvent.click(screen.getByRole('button', { name: 'Verify & continue' }))

    // Navigated before the context answered; that read starts in the background and is not awaited.
    expect(await screen.findByText('Dashboard')).toBeTruthy()
    await vi.waitFor(() => expect(getContext).toHaveBeenCalledTimes(1))
    await act(async () => context.resolve(SUBMITTED))
    expect(getContext).toHaveBeenCalledTimes(1)
  })

  it('still redirects a vendor already signed in on arrival from the context', async () => {
    const context = deferred<VendorContext>()
    vi.spyOn(vendorOnboardingService, 'getVendorContext').mockReturnValue(context.promise)
    act(() => useAuthStore.getState().applySession({ token: 'test-access-token', refreshToken: null, user: vendor }))

    renderAt('/vendor/login')
    expect(screen.getByText('Signing you in…')).toBeTruthy()
    expect(screen.queryByText('Dashboard')).toBeNull()

    await act(async () => context.resolve(SUBMITTED))
    expect(await screen.findByText('Dashboard')).toBeTruthy()
  })
})
