// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { VendorAccountContext, type VendorAccount } from '@/modules/vendor/hooks/use-vendor-account'
import { resetLiveBilling, resetLiveBillingPlansForTests } from '@/modules/vendor/store/live-billing'
import type { VendorStoreProfile } from '@/modules/vendor/types/dashboard'
import { liveBillingService, vendorService } from '@/shared/api'
import { useAuthStore } from '@/shared/auth/store/auth-store'
import { VendorSettingsPage } from './VendorSettingsPage'

beforeEach(() => {
  useAuthStore.getState().applySession({
    token: 'test-token',
    refreshToken: null,
    user: {
      id: 'user-1',
      name: 'Test Vendor',
      email: 'vendor@example.test',
      role: 'vendor',
      roles: ['vendor'],
      vendors: [{ vendorId: 'vendor-1' }],
      vendorId: 'vendor-1',
    },
  })
  // The plan name comes from the shared billing read; it never answers here.
  vi.spyOn(liveBillingService, 'readSubscription').mockReturnValue(new Promise(() => {}))
  vi.spyOn(liveBillingService, 'listPaidPlans').mockReturnValue(new Promise(() => {}))
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  useAuthStore.getState().clearSession()
  resetLiveBilling()
  resetLiveBillingPlansForTests()
})

const account = {
  vendorId: 'vendor-1',
  plan: { code: 'FREE', name: 'Free' },
  context: { businessName: null },
} as unknown as VendorAccount

const profile: VendorStoreProfile = {
  vendorId: 'vendor-1',
  businessName: 'Test Store',
  description: null,
  businessType: 'Groceries',
  ownerName: 'Test Vendor',
  contactPerson: null,
  contactNumber: '9000000001',
  email: null,
  address: null,
  bannerImage: null,
  storeIdentifier: null,
}

function renderPage(value: VendorAccount = account) {
  return render(
    <MemoryRouter>
      <VendorAccountContext.Provider value={value}>
        <VendorSettingsPage />
      </VendorAccountContext.Provider>
    </MemoryRouter>,
  )
}

async function settle() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe('VendorSettingsPage', () => {
  it('shows a loading status for the details and keeps sign-out available', async () => {
    vi.spyOn(vendorService, 'getStoreProfile').mockReturnValue(new Promise(() => {}))

    renderPage()
    await settle()

    expect(screen.getByRole('status', { name: 'Loading your details' })).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeTruthy()
  })

  it('shows a failed read with Try again, which reads the details again', async () => {
    const getStoreProfile = vi.spyOn(vendorService, 'getStoreProfile')
      .mockRejectedValueOnce(new Error('Store read failed'))
      .mockResolvedValue(profile)

    renderPage()
    await settle()

    expect(screen.getByRole('alert').textContent).toContain('Something went wrong')
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await settle()

    expect(getStoreProfile).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByText('Test Store')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeTruthy()
  })

  it('shows an inline status, not text, while the plan name is read', async () => {
    vi.spyOn(vendorService, 'getStoreProfile').mockResolvedValue(profile)

    renderPage()
    await settle()

    expect(screen.getByText('Test Store')).toBeTruthy()
    expect(screen.getByRole('status', { name: 'Loading plan name' })).toBeTruthy()
    expect(screen.queryByText('Loading…')).toBeNull()
  })

  // Setup saves the name through the storefront PUT, which leaves the vendor record's stale.
  it('shows the store name from the vendor context before the vendor record', async () => {
    vi.spyOn(vendorService, 'getStoreProfile').mockResolvedValue({ ...profile, businessName: 'My Store' })

    renderPage({ ...account, context: { businessName: 'Saved Store' } } as unknown as VendorAccount)
    await settle()

    expect(screen.getByText('Saved Store')).toBeTruthy()
    expect(screen.queryByText('My Store')).toBeNull()
  })
})
