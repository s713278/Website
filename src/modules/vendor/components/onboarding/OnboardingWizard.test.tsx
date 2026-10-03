// @vitest-environment jsdom

import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { mapVendorContext, vendorOnboardingService, type MeasurementCatalog, type VendorSkuRef } from '@/shared/api'
import { useAuthStore } from '@/shared/auth/store/auth-store'
import { SAMPLE_MEASUREMENT_CATALOG } from '../../data/onboarding-measurement-sample'
import { invalidateVendorOnboardingState } from '../../lib/onboarding-state-cache'
import { loadVendorContext } from '../../lib/vendor-context-cache'
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

function renderAccount(approvalStatus: string, nextStep = 11, maxSkus = 2, skuUsage = 1, strict = false) {
  vi.spyOn(vendorOnboardingService, 'getVendorContext').mockResolvedValue(mapVendorContext({
    data: {
      vendor_id: 91, vendor_status: 'ACTIVE', approval_status: approvalStatus,
      store_identifier: 'test-store',
      business_name: 'Test Store',
      onboarding: { status: nextStep === 11 ? 'COMPLETED' : 'IN_PROGRESS', next_step: nextStep },
      subscription: { limits: { max_categories: 3, max_products: 10, max_skus: maxSkus }, usage: { skus: skuUsage } },
    },
  }))
  const wizard = <MemoryRouter><OnboardingWizard /></MemoryRouter>
  render(strict ? <StrictMode>{wizard}</StrictMode> : wizard)
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
  it.each(['APPROVED', 'ACTIVE'])('shows the Store & Share panels and dashboard link for %s approval', async (approvalStatus) => {
    renderAccount(approvalStatus)

    expect(await screen.findByRole('heading', { name: 'Put this on your counter' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Your shop link' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Save QR image' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Go to dashboard' }).getAttribute('href')).toBe('/vendor')
  })

  it('keeps the QR panels and dashboard link out of the under-review step', async () => {
    renderAccount('PENDING')

    expect(await screen.findByRole('heading', { name: 'Under review' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Put this on your counter' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Go to dashboard' })).toBeNull()
  })

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
    const card = screen.getByRole('group', { name: '1 L size' })
    expect(screen.queryByLabelText('Quantity')).toBeNull()
    expect(within(card).getByRole('switch', { name: '1 L status: active' }).matches(':disabled')).toBe(true)
    expect(within(card).getByRole('button', { name: 'Remove 1 L' }).matches(':disabled')).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await screen.findByRole('button', { name: /Step 7,.*You are here/ })
    expect(vendorOnboardingService.createSkus).not.toHaveBeenCalled()
  })

  it('renders approved saved sizes as compact read-only cards', async () => {
    renderAccount('APPROVED')
    await openSizes()

    const card = screen.getByRole('group', { name: '1 L size' })
    expect(within(card).getByText('1 L')).toBeTruthy()
    expect(within(card).getByText('₹100')).toBeTruthy()
    expect(within(card).getByText('₹90')).toBeTruthy()
    expect(screen.queryByLabelText('Quantity')).toBeNull()

    const activeSwitch = within(card).getByRole('switch', { name: '1 L status: active' })
    expect(activeSwitch.matches(':disabled')).toBe(true)
    expect(within(card).getByRole('button', { name: 'Remove 1 L' }).matches(':disabled')).toBe(true)
  })

  it('keeps inactive approved sizes visibly muted without enabling actions', async () => {
    vi.mocked(vendorOnboardingService.getVendorSkus).mockResolvedValue([{
      ...savedSize,
      isActive: false,
    }])
    renderAccount('APPROVED')
    await openSizes()

    const card = screen.getByRole('group', { name: '1 L size' })
    const activeSwitch = within(card).getByRole('switch', { name: '1 L status: inactive' })
    const removeButton = within(card).getByRole('button', { name: 'Remove 1 L' })
    expect(activeSwitch.getAttribute('aria-checked')).toBe('false')
    expect(activeSwitch.className).toContain('bg-slate-300')
    expect(removeButton.className).toContain('bg-slate-100')
    expect(removeButton.matches(':disabled')).toBe(true)
  })

  it('uses the compact switch and remove action for newly added editable sizes', async () => {
    renderAccount('APPROVED')
    const add = await openSizes()
    fireEvent.click(add)
    fillNewSize()

    const card = screen.getByRole('group', { name: '2 L size' })
    const activeSwitch = within(card).getByRole('switch', { name: '2 L status: active' })
    const removeButton = within(card).getByRole('button', { name: 'Remove 2 L' })
    expect(activeSwitch.matches(':disabled')).toBe(false)
    expect(activeSwitch.className).toContain('h-7 w-12')
    expect(removeButton.matches(':disabled')).toBe(false)
    expect(removeButton.className).toContain('size-9')

    fireEvent.click(activeSwitch)
    expect(activeSwitch.getAttribute('aria-checked')).toBe('false')
    fireEvent.click(removeButton)
    fireEvent.click(screen.getByRole('button', { name: 'Remove size' }))
    await waitFor(() => expect(screen.queryByRole('group', { name: '2 L size' })).toBeNull())
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
    expect(within(screen.getByRole('group', { name: '1 L size' })).getByRole('switch', { name: '1 L status: active' }).matches(':disabled')).toBe(true)
    expect(screen.queryByLabelText('Quantity')).toBeNull()
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

describe('measurement catalog reads', () => {
  const emptyPage = { items: [], pageNumber: 0, pageSize: 12, totalPages: 0, totalElements: 0, lastPage: true }

  // StrictMode as well: development double-runs the loading effect, which must still share one read.
  it.each([false, true])('makes none on Steps 3-4 and one on reaching Step 5, kept for the session (StrictMode: %s)', async (strict) => {
    vi.spyOn(vendorOnboardingService, 'getCategories').mockResolvedValue(emptyPage)
    const productList = vi.spyOn(vendorOnboardingService, 'getProductsByCategory').mockResolvedValue(emptyPage)
    let answer!: (catalog: MeasurementCatalog) => void
    const getMeasurements = vi.spyOn(vendorOnboardingService, 'getMeasurements')
      .mockReturnValue(new Promise((resolve) => { answer = resolve }))
    renderAccount('PENDING', 4, 2, 1, strict)

    await screen.findByRole('button', { name: /Step 4,.*You are here/ })
    expect(getMeasurements).not.toHaveBeenCalled()

    // The vendor has finished Step 4 and moves on.
    act(() => {
      useOnboardingStore.setState({ furthestVisitedStep: 5 })
      useOnboardingStore.getState().goToStep(5)
    })
    expect(await screen.findByText('Loading measurements…')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Continue' }).matches(':disabled')).toBe(true)
    // Step 5 stays unmounted until the catalog lands, so its own list is not started early,
    // torn down and sent again.
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
    expect(productList).not.toHaveBeenCalled()

    await act(async () => answer(SAMPLE_MEASUREMENT_CATALOG))
    await waitFor(() => expect(screen.queryByText('Loading measurements…')).toBeNull())
    expect(screen.getByRole('button', { name: 'Continue' }).matches(':disabled')).toBe(false)
    expect(useOnboardingStore.getState().productMeasurementCatalog).toBe(SAMPLE_MEASUREMENT_CATALOG)
    // At most once: the list cache is module-level, so a test that ran earlier may have filled it.
    await waitFor(() => expect(screen.getByRole('button', { name: /Step 5,.*You are here/ })).toBeTruthy())
    expect(productList.mock.calls.length).toBeLessThanOrEqual(1)

    act(() => useOnboardingStore.getState().goToStep(4))
    act(() => useOnboardingStore.getState().goToStep(5))
    await screen.findByRole('button', { name: /Step 5,.*You are here/ })
    expect(getMeasurements).toHaveBeenCalledTimes(1)
  })
})

describe('Continue on an unchanged catalog step', () => {
  it('advances without re-reading or writing the account, and saves again once something changes', async () => {
    renderAccount('APPROVED', 7)
    await openSizes()
    const products = vi.mocked(vendorOnboardingService.getVendorProducts)
    const skus = vi.mocked(vendorOnboardingService.getVendorSkus)
    const productReads = products.mock.calls.length
    const skuReads = skus.mock.calls.length

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await screen.findByRole('button', { name: /Step 7,.*You are here/ })

    expect(products.mock.calls.length).toBe(productReads)
    expect(skus.mock.calls.length).toBe(skuReads)
    expect(vendorOnboardingService.createSkus).not.toHaveBeenCalled()
    expect(vendorOnboardingService.updateSku).not.toHaveBeenCalled()

    await openSizes()
    fireEvent.click(screen.getByRole('button', { name: 'Add another size' }))
    fillNewSize()
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await waitFor(() => expect(vendorOnboardingService.createSkus).toHaveBeenCalledTimes(1))
  })
})

describe('Continue on unchanged checkout settings', () => {
  it('sends the shared Step 7-8 payload once, and again only after it changes', async () => {
    const save = vi.spyOn(vendorOnboardingService, 'saveCheckoutOptions').mockResolvedValue(undefined)
    renderAccount('APPROVED', 7)
    await screen.findByRole('button', { name: /Step 7,.*You are here/ })

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await screen.findByRole('button', { name: /Step 8,.*You are here/ })
    expect(save).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: /^Step 7,/ }))
    await screen.findByRole('button', { name: /Step 7,.*You are here/ })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await screen.findByRole('button', { name: /Step 8,.*You are here/ })
    expect(save).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('checkbox', { name: /cash on delivery/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await screen.findByRole('button', { name: /Step 9,.*You are here/ })
    expect(save).toHaveBeenCalledTimes(2)
  })
})

describe('submitting the store for review', () => {
  it('reads the submitted context back once and shares it with the dashboard', async () => {
    renderAccount('APPROVED', 10)
    await screen.findByRole('button', { name: /Step 10,.*You are here/ })
    act(() => {
      const store = useOnboardingStore.getState()
      store.updateDraft((draft) => ({
        ...draft,
        payments: [{ type: 'CASH_ON_DELIVERY', enabled: true, isDefault: true }],
        storefront: { ...draft.storefront, businessLocation: 'Test Road' },
      }))
      store.updateRuntime({ orderWhatsapp: '9876543210' })
    })
    const goLive = vi.spyOn(vendorOnboardingService, 'goLive').mockResolvedValue(undefined)
    const context = vi.mocked(vendorOnboardingService.getVendorContext)
    const readsBefore = context.mock.calls.length

    fireEvent.click(screen.getByRole('button', { name: 'Submit for review' }))
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Submit for review' }))
    await waitFor(() => expect(goLive).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(context.mock.calls.length).toBe(readsBefore + 1))

    // The dashboard's provider reads through the same cache, so opening it costs nothing.
    const shared = await loadVendorContext('91', vendorOnboardingService.getVendorContext)
    expect(shared.approvalStatus).toBe('APPROVED')
    expect(context.mock.calls.length).toBe(readsBefore + 1)
  })
})
