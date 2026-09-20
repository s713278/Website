// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { mapVendorContext, vendorOnboardingService, type VendorSkuRef } from '@/shared/api'
import { useAuthStore } from '@/shared/auth/store/auth-store'
import { SAMPLE_MEASUREMENT_CATALOG } from '../../data/onboarding-measurement-sample'
import { invalidateVendorOnboardingState } from '../../lib/onboarding-state-cache'
import { useOnboardingStore } from '../../store/onboarding-store'
import { OnboardingWizard } from './OnboardingWizard'

const savedSize: VendorSkuRef = {
  vendorProductId: 900, skuId: 4001, priceId: 8001,
  name: 'Test Juice-1 L', size: '1 L', displayName: 'Test Juice', description: '',
  isActive: true, quantity: 1, unit: 'L', listPrice: 100, salePrice: 90,
}

beforeEach(() => {
  vi.stubEnv('VITE_USE_API', 'true')
  vi.stubEnv('DEV', false)
  vi.stubGlobal('CSS', { escape: (value: string) => value })
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, value: vi.fn() })
  localStorage.clear()
  invalidateVendorOnboardingState()
  useOnboardingStore.getState().abandonDraft()
  useAuthStore.getState().applySession({
    token: 'test-token', refreshToken: null,
    user: {
      id: 'test-user', name: 'Test Vendor', email: 'vendor@example.test',
      role: 'vendor', roles: ['vendor'], vendorId: '91', vendors: [{ vendorId: '91' }],
    },
  })
  useAuthStore.getState().setHydrated(true)
  vi.spyOn(vendorOnboardingService, 'getVendorProfile').mockResolvedValue({
    businessName: 'Test Store', businessType: 'Beverages', ownerName: 'Test Vendor',
    contactPerson: 'Test Vendor', contactNumber: '',
  })
  vi.spyOn(vendorOnboardingService, 'getBusinessTypes').mockResolvedValue({
    items: [{ id: 7, name: 'Beverages', icon: null, displayOrder: 1 }],
    pageNumber: 0, pageSize: 100, totalPages: 1, totalElements: 1, lastPage: true,
  })
  vi.spyOn(vendorOnboardingService, 'getVendorCategories').mockResolvedValue([
    { vendorCategoryId: 500, platformCategoryId: 10, name: 'Juices', imageUrl: null },
  ])
  vi.spyOn(vendorOnboardingService, 'getVendorProducts').mockResolvedValue([
    { vendorProductId: 900, platformProductId: 31, platformCategoryId: 10, name: 'Test Juice', measurementId: 2 },
  ])
  vi.spyOn(vendorOnboardingService, 'getVendorSkus').mockResolvedValue([savedSize])
  vi.spyOn(vendorOnboardingService, 'getMeasurements').mockResolvedValue(SAMPLE_MEASUREMENT_CATALOG)
  vi.spyOn(vendorOnboardingService, 'getCheckoutOptions').mockResolvedValue(null)
  vi.spyOn(vendorOnboardingService, 'createSkus').mockResolvedValue(undefined)
  vi.spyOn(vendorOnboardingService, 'updateSku').mockResolvedValue(undefined)
  vi.spyOn(vendorOnboardingService, 'updateSkuPrice').mockResolvedValue(undefined)
  vi.spyOn(vendorOnboardingService, 'deleteSku').mockResolvedValue(undefined)
})

afterEach(() => {
  cleanup()
  invalidateVendorOnboardingState()
  useOnboardingStore.getState().abandonDraft()
  useAuthStore.getState().clearSession()
  localStorage.clear()
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

function renderAccount(approvalStatus: string, nextStep = 11, maxSkus = 2, skuUsage = 1) {
  vi.spyOn(vendorOnboardingService, 'getVendorContext').mockResolvedValue(mapVendorContext({
    data: {
      vendor_id: 91, vendor_status: 'ACTIVE', approval_status: approvalStatus,
      business_name: 'Test Store',
      onboarding: { status: nextStep === 11 ? 'COMPLETED' : 'IN_PROGRESS', next_step: nextStep },
      subscription: { limits: { max_categories: 3, max_products: 10, max_skus: maxSkus }, usage: { skus: skuUsage } },
    },
  }))
  render(<MemoryRouter><OnboardingWizard /></MemoryRouter>)
}

async function openSizes() {
  fireEvent.click(await screen.findByRole('button', { name: /^Step 6,/ }))
  return screen.findByRole('button', { name: 'Add another size' })
}

function fillNewSize() {
  fireEvent.change(screen.getAllByLabelText('Quantity').at(-1)!, { target: { value: '2' } })
  fireEvent.change(screen.getAllByLabelText('MRP (₹)').at(-1)!, { target: { value: '180' } })
  fireEvent.change(screen.getAllByLabelText('Price (₹)').at(-1)!, { target: { value: '160' } })
}

describe('onboarding account hydration and size permissions', () => {
  it('opens active approved but unfinished setup at the backend step with editable controls', async () => {
    renderAccount('APPROVED', 7)
    expect(await screen.findByRole('button', { name: /Step 7,.*You are here/ })).toBeTruthy()
    expect(useOnboardingStore.getState().storeSubmission).toBeNull()
    const add = await openSizes()
    expect(add.matches(':disabled')).toBe(false)
  })

  it('keeps a completed pending vendor unable to create sizes', async () => {
    renderAccount('PENDING')
    const add = await openSizes()
    expect(screen.getByText('Under review')).toBeTruthy()
    expect(screen.getByText('You can still add categories and products.')).toBeTruthy()
    expect(screen.getByText('Sizes and prices unlock after approval.')).toBeTruthy()
    expect(screen.queryByText('Your store is with us for review.')).toBeNull()
    expect(add.matches(':disabled')).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await screen.findByRole('button', { name: /Step 7,.*You are here/ })
    expect(vendorOnboardingService.createSkus).not.toHaveBeenCalled()
  })

  it('counts backend usage omitted from the size list against the plan limit', async () => {
    renderAccount('APPROVED', 11, 2, 2)
    const add = await openSizes()
    expect(screen.getByText('Approved')).toBeTruthy()
    expect(screen.getByText('You can add to your catalog; saved setup is locked.')).toBeTruthy()
    expect(add.matches(':disabled')).toBe(true)
  })

  it('saves an approved size addition, locks saved sizes and enforces the plan limit', async () => {
    renderAccount('APPROVED')
    const add = await openSizes()
    expect(add.matches(':disabled')).toBe(false)
    expect(screen.getByLabelText('Quantity').matches(':disabled')).toBe(true)
    fireEvent.click(add)
    fillNewSize()
    expect(add.matches(':disabled')).toBe(true)
    vi.mocked(vendorOnboardingService.createSkus).mockImplementation(async () => {
      vi.mocked(vendorOnboardingService.getVendorSkus).mockResolvedValue([
        savedSize,
        { ...savedSize, skuId: 4002, priceId: 8002, size: '2 L', quantity: 2, listPrice: 180, salePrice: 160 },
      ])
    })

    fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }))

    await screen.findByRole('button', { name: /Step 7,.*You are here/ })
    expect(vendorOnboardingService.createSkus).toHaveBeenCalledOnce()
    expect(vendorOnboardingService.createSkus).toHaveBeenCalledWith('91', expect.objectContaining({
      sizes: [{ quantity: 2, unit: 'L', measurementType: 'VOLUME', listPrice: 180, salePrice: 160 }],
    }), 900)
    expect(vendorOnboardingService.updateSku).not.toHaveBeenCalled()
    expect(vendorOnboardingService.updateSkuPrice).not.toHaveBeenCalled()
    expect(vendorOnboardingService.deleteSku).not.toHaveBeenCalled()
    expect(useOnboardingStore.getState().accountCatalog.skuIds).toEqual([4001, 4002])
  })

  it('keeps the vendor on Step 6 and displays a failed size save', async () => {
    renderAccount('APPROVED')
    fireEvent.click(await openSizes())
    fillNewSize()
    vi.mocked(vendorOnboardingService.createSkus).mockRejectedValue(new Error('Could not create size'))

    fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }))

    await waitFor(() => expect(screen.getAllByText('Could not create size').length).toBeGreaterThan(0))
    expect(useOnboardingStore.getState().draft.currentStep).toBe(6)
  })
})
