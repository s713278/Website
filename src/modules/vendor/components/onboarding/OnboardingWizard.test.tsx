// @vitest-environment jsdom

import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { apiErrorFromResponse, configureApiClient, getHttp, mapVendorContext, vendorImagesService, vendorOnboardingService, type MeasurementCatalog, type VendorSkuRef, type VendorStorefrontSettings } from '@/shared/api'
import { useAuthStore } from '@/shared/auth/store/auth-store'
import { SAMPLE_MEASUREMENT_CATALOG } from '../../data/onboarding-measurement-sample'
import { invalidateMeasurementCatalog } from '../../lib/measurement-catalog-cache'
import { resetFirstPageReadsForTests } from '../../hooks/use-onboarding-catalog'
import { writeReferenceCache } from '../../lib/onboarding-catalog-cache'
import {
  invalidateOnboardingResources,
  loadOnboardingResource,
  peekOnboardingResource,
} from '../../lib/onboarding-resource-cache'
import type { OnboardingResource } from '../../lib/onboarding-resume'
import { invalidateVendorContext, loadVendorContext, peekVendorContext } from '../../lib/vendor-context-cache'
import { useOnboardingStore } from '../../store/onboarding-store'
import { markTypeSaveInFlight, readSavedTypeRecord } from '../../lib/onboarding-saved-type-record'
import { createEmptyOnboardingDraft } from '../../data/onboarding-defaults'
import { ONBOARDING_CONFIG, ONBOARDING_DRAFT_VERSION, type OnboardingStep } from '../../types/onboarding'
type OnboardingStoreState = ReturnType<typeof useOnboardingStore.getState>
import { ONBOARDING_DRAFT_STORAGE_KEY, parsePersistedEnvelope, toPersistedDraft } from '../../lib/onboarding-persistence'
import { pendingSteps } from '../../lib/onboarding-progress'
import { ACCOUNT_WRITE_SIGNAL_KEY, AWAY_AFTER_MS } from '../../lib/page-away'
import { OnboardingWizard } from './OnboardingWizard'

const savedSize: VendorSkuRef = {
  vendorProductId: 900, skuId: 4001, priceId: 8001,
  name: 'Test Juice-1 L', size: '1 L', displayName: 'Test Juice', description: '',
  isActive: true, quantity: 1, unit: 'L', listPrice: 100, salePrice: 90,
}

function savedSettings(): VendorStorefrontSettings {
  const store = createEmptyOnboardingDraft().storefront
  return {
    storeName: 'Test Store', tagline: 'Existing tagline', businessLocation: 'Test City',
    instagram: 'teststore', orderWhatsapp: '+919876543210', supportWhatsapp: '+919000000001',
    welcomeMessage: 'Welcome back', announcementBar: 'Saved announcement',
    heroBadges: [], trustStrip: [],
    theme: { primaryColor: '#123456', accentColor: '#456789', backgroundColor: '#ffffff', textColor: '#222222',
      fontFamily: store.fontFamily, buttonShape: 'SQUARE', cardStyle: 'BORDER', themePreset: null },
  }
}

function invalidateAll() {
  invalidateOnboardingResources()
  resetFirstPageReadsForTests()
  invalidateVendorContext()
  invalidateMeasurementCatalog()
}

let scrollIntoView: PropertyDescriptor | undefined
let scrollTo: PropertyDescriptor | undefined

beforeEach(() => {
  vi.stubEnv('VITE_USE_API', 'true')
  vi.stubEnv('DEV', false)
  vi.stubGlobal('CSS', { escape: (value: string) => value })
  scrollTo = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollTo')
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, value: vi.fn() })
  // Showing issues focuses and scrolls to the first field after a timer, which jsdom does not
  // implement; that timer can fire in any test whose Continue fails.
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })))
  scrollIntoView = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView')
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  localStorage.clear()
  invalidateAll()
  useOnboardingStore.getState().abandonDraft()
  useAuthStore.getState().applySession({
    token: 'test-token', refreshToken: null,
    user: {
      id: 'test-user', name: 'Test Vendor', email: 'vendor@example.test',
      role: 'vendor', roles: ['vendor'], vendorId: '91', vendors: [{ vendorId: '91' }],
    },
  })
  useAuthStore.getState().setHydrated(true)
  vi.spyOn(vendorImagesService, 'getImage').mockResolvedValue(null)
  vi.spyOn(vendorOnboardingService, 'getStorefrontSettings').mockResolvedValue(savedSettings())
  vi.spyOn(vendorOnboardingService, 'saveStoreProfile').mockResolvedValue(undefined)
  vi.spyOn(vendorOnboardingService, 'getVendorProfile').mockResolvedValue({
    businessName: 'Test Store', businessType: 'Beverages', contactNumber: '',
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
  vi.spyOn(vendorOnboardingService, 'updateSkuStatus').mockResolvedValue(undefined)
  vi.spyOn(vendorOnboardingService, 'getVendorSku').mockResolvedValue(null)
  vi.spyOn(vendorOnboardingService, 'updateSkuPrice').mockResolvedValue(undefined)
  vi.spyOn(vendorOnboardingService, 'deleteSku').mockResolvedValue(undefined)
  // Every other network seam a step can reach, so nothing escapes to a real API.
  vi.spyOn(vendorOnboardingService, 'getCategories').mockResolvedValue(EMPTY_PAGE)
  vi.spyOn(vendorOnboardingService, 'getProductsByCategory').mockResolvedValue(EMPTY_PAGE)
  vi.spyOn(vendorOnboardingService, 'saveBusinessType').mockResolvedValue(undefined)
})

afterEach(() => {
  cleanup()
  invalidateAll()
  useOnboardingStore.getState().abandonDraft()
  useAuthStore.getState().clearSession()
  localStorage.clear()
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  if (scrollIntoView) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', scrollIntoView)
  else delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView
  if (scrollTo) Object.defineProperty(HTMLElement.prototype, 'scrollTo', scrollTo)
  else delete (HTMLElement.prototype as Partial<HTMLElement>).scrollTo
})

function renderAccount(approvalStatus: string, nextStep = 11, maxSkus = 2, skuUsage = 1, strict = false, catalogPreview?: unknown, vendorStatus = 'ACTIVE') {
  vi.spyOn(vendorOnboardingService, 'getVendorContext').mockResolvedValue(mapVendorContext({
    data: {
      vendor_id: 91, vendor_status: vendorStatus, approval_status: approvalStatus,
      store_identifier: 'test-store',
      business_name: 'Test Store',
      onboarding: { status: nextStep === 11 ? 'COMPLETED' : 'IN_PROGRESS', next_step: nextStep },
      subscription: { limits: { max_categories: 3, max_products: 10, max_skus: maxSkus }, usage: { skus: skuUsage } },
      catalog_preview: catalogPreview,
    },
  }))
  const wizard = <MemoryRouter><OnboardingWizard /></MemoryRouter>
  render(strict ? <StrictMode>{wizard}</StrictMode> : wizard)
}

/** The tab is hidden for `awayMs`, then shown again; by default long enough to count as away. */
function hideAndShowTab(awayMs = AWAY_AFTER_MS) {
  const start = Date.now()
  const clock = vi.spyOn(Date, 'now').mockReturnValue(start)
  const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
  document.dispatchEvent(new Event('visibilitychange'))
  clock.mockReturnValue(start + awayMs)
  visibility.mockReturnValue('visible')
  document.dispatchEvent(new Event('visibilitychange'))
  clock.mockRestore()
}

const follows = (first: Node, second: Node) =>
  Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING)

// The toast supplies the action announcement; persistent inline errors remain separate.
function liveRegion() {
  return document.querySelector('[data-slot="toast"]:not([data-ending-style]) [data-slot="toast-title"]') ?? document.createElement('div')
}

function shownCopies(text: string) {
  return screen.getAllByText(text).filter((element) => !element.closest('[data-slot="toast"]'))
}

async function openSizes() {
  fireEvent.click(await screen.findByRole('button', { name: /^Step 6,/ }))
  return screen.findByRole('button', { name: 'Add another size to Test Juice' })
}

// An approved store's Step 6 save confirms in place and keeps the vendor on the step.
async function expectSavedInPlace() {
  expect((await screen.findByText('Changes saved.')).closest('[data-slot="toast"]')).toBeTruthy()
  expect(useOnboardingStore.getState().draft.currentStep).toBe(6)
}

function fillNewSize() {
  fireEvent.change(screen.getAllByLabelText('Quantity').at(-1)!, { target: { value: '2' } })
  fireEvent.change(screen.getAllByLabelText('MRP (₹)').at(-1)!, { target: { value: '180' } })
  fireEvent.change(screen.getAllByLabelText('Discounted price (₹)').at(-1)!, { target: { value: '160' } })
}

const EMPTY_PAGE = { items: [], pageNumber: 0, pageSize: 12, totalPages: 0, totalElements: 0, lastPage: true }

// The reference lists Steps 4-5 show; they are not account reads.
function stubReferencePages() {
  vi.spyOn(vendorOnboardingService, 'getCategories').mockResolvedValue(EMPTY_PAGE)
  vi.spyOn(vendorOnboardingService, 'getProductsByCategory').mockResolvedValue(EMPTY_PAGE)
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((settle, fail) => { resolve = settle; reject = fail })
  return { promise, resolve, reject }
}

const ACCOUNT_READS = [
  'getVendorContext', 'getVendorProfile', 'getBusinessTypes', 'getVendorCategories',
  'getVendorProducts', 'getVendorSkus', 'getCheckoutOptions', 'getMeasurements',
] as const

/** How many times each account read (and the units) has been requested, omitting zeros. */
function accountReadCounts() {
  return Object.fromEntries(ACCOUNT_READS
    .map((name) => [name, vi.mocked(vendorOnboardingService[name]).mock.calls.length] as const)
    .filter(([, count]) => count > 0))
}

const READY_CHECKOUT = {
  fulfillmentType: 'HOME_DELIVERY' as const,
  schedulingStrategy: 'FIXED_WINDOW' as const,
  schedulingConfig: { min_delivery_days: 1, max_delivery_days: 3 },
  shippingConfig: { deliveryCharge: 30, freeDeliveryThreshold: 0 },
  slots: [],
  consentTitle: '',
  consentText: '',
  payments: [{ type: 'CASH_ON_DELIVERY' as const, isDefault: true, details: {} }],
}

/**
 * An account whose saved setup passes Step 10's readiness: payments and the order number from
 * the account, and a location in the store details saved earlier (unreadable before approval,
 * so this browser's copy holds it). Edits made on Step 10 itself would be unsaved changes.
 */
function seedReadyAccount(businessLocation: string) {
  vi.spyOn(vendorOnboardingService, 'getCheckoutOptions').mockResolvedValue(READY_CHECKOUT)
  vi.spyOn(vendorOnboardingService, 'getVendorProfile').mockResolvedValue({
    businessName: 'Test Store', businessType: 'Beverages', contactNumber: '+919876543210',
  })
  const draft = createEmptyOnboardingDraft()
  useOnboardingStore.setState({
    draft: { ...draft, mobileVerified: true, storefront: { ...draft.storefront, businessLocation } },
    draftOwnerId: '91',
  })
}

const stepSpinner = () => screen.queryByRole('status', { name: 'Loading this step' })
const continueDisabled = (name = 'Continue') => screen.getByRole('button', { name }).matches(':disabled')

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
    const card = screen.getByRole('group', { name: 'Test Juice, 1 L size' })
    expect(screen.queryByLabelText('Quantity')).toBeNull()
    expect(within(card).getByRole('switch', { name: '1 L status: active' }).matches(':disabled')).toBe(true)
    expect(within(card).getByRole('button', { name: 'Remove 1 L' }).matches(':disabled')).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await screen.findByRole('button', { name: /Step 7,.*You are here/ })
    expect(vendorOnboardingService.createSkus).not.toHaveBeenCalled()
  })

  it('renders approved saved sizes as editable rows with a working status switch', async () => {
    renderAccount('APPROVED')
    await openSizes()

    const card = screen.getByRole('group', { name: 'Test Juice, 1 L size' })
    expect((within(card).getByLabelText('Quantity') as HTMLInputElement).value).toBe('1')
    expect((within(card).getByLabelText('Unit') as HTMLSelectElement).value).toBe('L')
    expect((within(card).getByLabelText('MRP (₹)') as HTMLInputElement).value).toBe('100')
    expect((within(card).getByLabelText('Discounted price (₹)') as HTMLInputElement).value).toBe('90')

    const activeSwitch = within(card).getByRole('switch', { name: '1 L status: active' })
    expect(activeSwitch.matches(':disabled')).toBe(false)
    expect(within(card).getByRole('button', { name: 'Remove 1 L' }).matches(':disabled')).toBe(true)
  })

  it('saves an approved saved size quantity, unit and price edit in place', async () => {
    renderAccount('APPROVED')
    await openSizes()
    const card = screen.getByRole('group', { name: 'Test Juice, 1 L size' })
    fireEvent.change(within(card).getByLabelText('Quantity'), { target: { value: '500' } })
    fireEvent.change(within(card).getByLabelText('Unit'), { target: { value: 'ml' } })
    fireEvent.change(within(card).getByLabelText('MRP (₹)'), { target: { value: '60' } })
    fireEvent.change(within(card).getByLabelText('Discounted price (₹)'), { target: { value: '55' } })
    const productReads = vi.mocked(vendorOnboardingService.getVendorProducts).mock.calls.length

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await expectSavedInPlace()
    // Step 6 already read the products, so the save maps them without reading again.
    expect(vendorOnboardingService.getVendorProducts).toHaveBeenCalledTimes(productReads)
    expect(vendorOnboardingService.updateSku).toHaveBeenCalledWith('91', 4001, { quantity: 500, unit: 'ml', active: true })
    expect(vendorOnboardingService.updateSkuPrice).toHaveBeenCalledWith(4001, 8001, { listPrice: 60, salePrice: 55 })
    expect(vendorOnboardingService.createSkus).not.toHaveBeenCalled()
    expect(vendorOnboardingService.deleteSku).not.toHaveBeenCalled()
  })

  it('keeps an approved store on Step 6 after a save, with no next-step read', async () => {
    renderAccount('APPROVED')
    await openSizes()
    fireEvent.change(within(screen.getByRole('group', { name: 'Test Juice, 1 L size' })).getByLabelText('MRP (₹)'), { target: { value: '110' } })

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await expectSavedInPlace()
    expect(vendorOnboardingService.updateSkuPrice).toHaveBeenCalledWith(4001, 8001, { listPrice: 110, salePrice: 90 })
    expect(screen.getByRole('button', { name: /Step 6,.*You are here/ })).toBeTruthy()
    expect(vendorOnboardingService.getCheckoutOptions).not.toHaveBeenCalled()
    const state = useOnboardingStore.getState()
    expect(state.editedSteps).not.toContain(6)
    expect(state.draft.completedSteps).toContain(6)
  })

  it('stays on Step 6 and writes nothing when an approved store saves unchanged sizes', async () => {
    renderAccount('APPROVED')
    await openSizes()

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await expectSavedInPlace()
    for (const write of ['createSkus', 'updateSku', 'updateSkuStatus', 'updateSkuPrice', 'deleteSku'] as const) {
      expect(vendorOnboardingService[write]).not.toHaveBeenCalled()
    }
    expect(vendorOnboardingService.getCheckoutOptions).not.toHaveBeenCalled()
  })

  it('removes the saved confirmation once the vendor edits Step 6 again', async () => {
    renderAccount('APPROVED')
    await openSizes()
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await expectSavedInPlace()

    fireEvent.change(within(screen.getByRole('group', { name: 'Test Juice, 1 L size' })).getByLabelText('MRP (₹)'), { target: { value: '120' } })

    expect(document.querySelector('[data-slot="toast"]:not([data-ending-style])')?.textContent ?? '').not.toContain('Changes saved.')
  })

  it('keeps the vendor on Step 6 and displays a rejected saved size edit', async () => {
    renderAccount('APPROVED')
    await openSizes()
    fireEvent.change(within(screen.getByRole('group', { name: 'Test Juice, 1 L size' })).getByLabelText('Quantity'), { target: { value: '2' } })
    vi.mocked(vendorOnboardingService.updateSku).mockRejectedValue(new Error('Please check the input request and try again.'))

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(document.getElementById('skus-error')?.textContent).toBe('Please check the input request and try again.'))
    expect(vendorOnboardingService.createSkus).not.toHaveBeenCalled()
    expect(vendorOnboardingService.deleteSku).not.toHaveBeenCalled()
    expect(useOnboardingStore.getState().draft.currentStep).toBe(6)
  })

  it('saves an approved saved size switched off with a status-only update', async () => {
    vi.mocked(vendorOnboardingService.getVendorSkus).mockResolvedValue([savedSize, {
      ...savedSize, skuId: 4002, priceId: 8002, size: '2 L', quantity: 2,
    }])
    renderAccount('APPROVED')
    await openSizes()
    fireEvent.click(within(screen.getByRole('group', { name: 'Test Juice, 1 L size' })).getByRole('switch', { name: '1 L status: active' }))

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await expectSavedInPlace()
    expect(vendorOnboardingService.updateSkuStatus).toHaveBeenCalledWith('91', 4001, false)
    expect(vendorOnboardingService.updateSku).not.toHaveBeenCalled()
    expect(vendorOnboardingService.createSkus).not.toHaveBeenCalled()
    expect(vendorOnboardingService.deleteSku).not.toHaveBeenCalled()
  })

  it('deletes an approved saved size the vendor removed, and sends nothing else', async () => {
    const second = { ...savedSize, skuId: 4002, priceId: 8002, size: '2 L', quantity: 2 }
    vi.mocked(vendorOnboardingService.getVendorSkus).mockResolvedValue([savedSize, second])
    renderAccount('APPROVED')
    await openSizes()
    vi.mocked(vendorOnboardingService.deleteSku).mockImplementation(async () => {
      vi.mocked(vendorOnboardingService.getVendorSkus).mockResolvedValue([savedSize])
    })
    fireEvent.click(within(screen.getByRole('group', { name: 'Test Juice, 2 L size' })).getByRole('button', { name: 'Remove 2 L' }))

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await expectSavedInPlace()
    expect(vendorOnboardingService.deleteSku).toHaveBeenCalledOnce()
    expect(vendorOnboardingService.deleteSku).toHaveBeenCalledWith('91', 4002)
    expect(vendorOnboardingService.createSkus).not.toHaveBeenCalled()
    expect(vendorOnboardingService.updateSku).not.toHaveBeenCalled()
    expect(vendorOnboardingService.updateSkuStatus).not.toHaveBeenCalled()
    expect(vendorOnboardingService.updateSkuPrice).not.toHaveBeenCalled()
    expect(useOnboardingStore.getState().accountCatalog.skuIds).toEqual([4001])
  })

  it('keeps an approved product from switching off its only size', async () => {
    renderAccount('APPROVED')
    await openSizes()
    fireEvent.click(within(screen.getByRole('group', { name: 'Test Juice, 1 L size' })).getByRole('switch', { name: '1 L status: active' }))

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(document.body.textContent).toContain('Turn on at least one size for Test Juice.'))
    expect(vendorOnboardingService.updateSkuStatus).not.toHaveBeenCalled()
  })

  it('keeps inactive approved sizes visibly muted without enabling removal', async () => {
    vi.mocked(vendorOnboardingService.getVendorSkus).mockResolvedValue([{
      ...savedSize,
      isActive: false,
    }])
    renderAccount('APPROVED')
    await openSizes()

    const card = screen.getByRole('group', { name: 'Test Juice, 1 L size' })
    const activeSwitch = within(card).getByRole('switch', { name: '1 L status: inactive' })
    const removeButton = within(card).getByRole('button', { name: 'Remove 1 L' })
    expect(activeSwitch.getAttribute('aria-checked')).toBe('false')
    expect(activeSwitch.className).toContain('bg-slate-300')
    expect(removeButton.className).toContain('text-slate-400')
    expect(removeButton.matches(':disabled')).toBe(true)
  })

  it('uses the compact switch and remove action for newly added editable sizes', async () => {
    renderAccount('APPROVED')
    const add = await openSizes()
    fireEvent.click(add)
    fillNewSize()

    const card = screen.getByRole('group', { name: 'Test Juice, 2 L size, not saved' })
    const activeSwitch = within(card).getByRole('switch', { name: '2 L status: active' })
    const removeButton = within(card).getByRole('button', { name: 'Remove 2 L' })
    expect(activeSwitch.matches(':disabled')).toBe(false)
    expect(activeSwitch.className).toContain('h-7 w-12')
    expect(removeButton.matches(':disabled')).toBe(false)
    expect(removeButton.className).toContain('size-9')
    expect(removeButton.className).not.toContain('pointer-events-none')
    expect(removeButton.className).not.toMatch(/\bbg-/)

    fireEvent.click(activeSwitch)
    expect(activeSwitch.getAttribute('aria-checked')).toBe('false')
    fireEvent.click(removeButton)
    // Removal is immediate: no confirmation dialog stands between the click and the row going.
    expect(screen.queryByRole('group', { name: 'Test Juice, 2 L size, not saved' })).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.queryByText('Remove this size?')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Remove size' })).toBeNull()
  })

  it('counts backend usage omitted from the size list against the plan limit', async () => {
    renderAccount('APPROVED', 11, 2, 2)
    const add = await openSizes()
    expect(screen.getByText('Approved')).toBeTruthy()
    expect(screen.getByText('You can add to your catalog, edit sizes and update store details.')).toBeTruthy()
    expect(add.matches(':disabled')).toBe(true)
  })

  it('saves an approved size addition, leaves the saved size untouched and enforces the plan limit', async () => {
    renderAccount('APPROVED')
    const add = await openSizes()
    expect(add.matches(':disabled')).toBe(false)
    expect(within(screen.getByRole('group', { name: 'Test Juice, 1 L size' })).getByRole('button', { name: 'Remove 1 L' }).matches(':disabled')).toBe(true)
    fireEvent.click(add)
    fillNewSize()
    expect(add.matches(':disabled')).toBe(true)
    vi.mocked(vendorOnboardingService.createSkus).mockImplementation(async () => {
      vi.mocked(vendorOnboardingService.getVendorSkus).mockResolvedValue([
        savedSize,
        { ...savedSize, skuId: 4002, priceId: 8002, size: '2 L', quantity: 2, listPrice: 180, salePrice: 160 },
      ])
    })

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await expectSavedInPlace()
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

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    // The failure is shown inline on Step 6, once, and never in a wizard-level summary.
    await waitFor(() => expect(document.getElementById('skus-error')?.textContent).toBe('Could not create size'))
    await waitFor(() => expect(document.activeElement).toBe(document.getElementById('skus')))
    expect(document.getElementById('skus')?.getAttribute('tabindex')).toBe('-1')
    // Field-specific, so inline only: no toast repeats it.
    expect(liveRegion().textContent).toBe('')
    expect(shownCopies('Could not create size')).toHaveLength(1)
    expect(screen.queryByText(/Please fix/)).toBeNull()
    expect(useOnboardingStore.getState().draft.currentStep).toBe(6)
  })
})

describe('account copy per step around unsaved edits', () => {
  const localProduct = {
    id: 77, name: 'Local Juice', description: null, imageUrl: null,
    measurementId: null, measurementName: null, categoryId: 10,
  }

  function seedEdited(editedSteps: OnboardingStep[], fieldEdits: OnboardingStoreState['fieldEdits'] = {}) {
    useOnboardingStore.setState({
      draft: {
        ...createEmptyOnboardingDraft(),
        mobileVerified: true,
        currentStep: 5,
        completedSteps: [1, 2, 3, 4] as OnboardingStep[],
        products: [localProduct],
      },
      furthestVisitedStep: 5,
      draftOwnerId: '91',
      editedSteps,
      fieldEdits,
    })
  }

  it('takes the account copy for unedited steps, merges the edited one, and opens the account’s step', async () => {
    // The product was added when the account held none.
    seedEdited([5], { products: { at: 1, saved: [] } })
    renderAccount('PENDING', 6)

    // Saved progress is the account's: the unsaved Step 5 edit does not hold the vendor there.
    await waitFor(() => expect(useOnboardingStore.getState().loadedSteps).toEqual([3, 4, 5, 6]))
    const state = useOnboardingStore.getState()
    expect(state.draft.categories.map((category) => category.id)).toEqual([10])
    expect(state.draft.business.businessType?.id).toBe(7)
    // The unsaved addition stays, and so does the product the account has saved since.
    expect(state.draft.products.map((product) => product.id)).toEqual([localProduct.id, 31])
    expect(state.draft.products[0]).toEqual(localProduct)
    expect(state.draft.currentStep).toBe(6)
    expect(state.furthestVisitedStep).toBe(6)
    // Step 6 builds only from saved products, so the unsaved local product gets no size.
    expect(state.draft.skus.some((sku) => sku.productId === localProduct.id)).toBe(false)
    expect(state.editedSteps).toEqual([5])
    expect(state.recoveryMessage ?? '').not.toMatch(/Picked up/)
  })

  it('rebuilds the whole draft from the account when nothing is edited', async () => {
    seedEdited([])
    renderAccount('PENDING', 6)

    await waitFor(() => expect(useOnboardingStore.getState().draft.currentStep).toBe(6))
    const state = useOnboardingStore.getState()
    expect(state.draft.categories.map((category) => category.id)).toEqual([10])
    expect(state.draft.products.map((product) => product.id)).toEqual([31])
    expect(state.draft.skus.map((sku) => sku.id)).toEqual(['sku-4001'])
    expect(state.furthestVisitedStep).toBe(6)
    expect(state.recoveryMessage).toMatch(/Picked up/)
  })

  it('lets the account win every step once the store is submitted', async () => {
    stubReferencePages()
    seedEdited([5])
    renderAccount('PENDING')

    await waitFor(() => expect(useOnboardingStore.getState().draft.currentStep).toBe(10))
    expect(useOnboardingStore.getState().editedSteps).toEqual([])
    act(() => useOnboardingStore.getState().goToStep(5))
    await waitFor(() => expect(useOnboardingStore.getState().draft.products.map((product) => product.id)).toEqual([31]))
  })

  it('leaves a step whose read failed alone and unloaded', async () => {
    vi.spyOn(vendorOnboardingService, 'getVendorSkus').mockRejectedValue(new Error('down'))
    stubReferencePages()
    seedEdited([5])
    renderAccount('PENDING', 6)

    expect(await screen.findByText('Something went wrong')).toBeTruthy()
    expect(useOnboardingStore.getState().loadedSteps).toEqual([3, 4, 5])
    expect(useOnboardingStore.getState().draft.skus).toEqual([])
  })
})

describe('saved progress belongs to the account', () => {
  const SAVED_CHECKOUT = {
    fulfillmentType: 'HOME_DELIVERY' as const,
    schedulingStrategy: 'FIXED_WINDOW' as const,
    schedulingConfig: { min_delivery_days: 1, max_delivery_days: 3 },
    shippingConfig: { deliveryCharge: 30, freeDeliveryThreshold: 0 },
    slots: [],
    consentTitle: '',
    consentText: '',
    payments: [{ type: 'CASH_ON_DELIVERY' as const, isDefault: true, details: {} }],
  }
  const deliveryCharge = () => screen.getByLabelText('Delivery charge (₹)') as HTMLInputElement
  const currentStepIs = (step: number) => screen.findByRole('button', { name: new RegExp(`^Step ${step},.*You are here`) })

  beforeEach(() => {
    stubReferencePages()
    vi.spyOn(vendorOnboardingService, 'getCheckoutOptions').mockResolvedValue(SAVED_CHECKOUT)
  })

  it('opens the account’s step on reload even with an unsaved earlier edit, keeping the edit', async () => {
    // A saved business type is locked, so the unsaved earlier edit here is a store detail,
    // recorded with the saved value it started from (store details are unreadable before
    // approval, so that record is what keeps it pending).
    const storefront = { ...createEmptyOnboardingDraft().storefront, tagline: 'Unsaved tagline' }
    useOnboardingStore.setState({
      draft: {
        ...createEmptyOnboardingDraft(),
        mobileVerified: true,
        currentStep: 3,
        completedSteps: [1, 2] as OnboardingStep[],
        storefront,
      },
      furthestVisitedStep: 3,
      draftOwnerId: '91',
      editedSteps: [9],
      fieldEdits: { 'storefront.tagline': { at: 1, saved: '' } },
    })
    renderAccount('PENDING', 10)

    await currentStepIs(10)
    const state = useOnboardingStore.getState()
    expect(state.furthestVisitedStep).toBe(10)
    expect(state.draft.completedSteps).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect(state.draft.storefront.tagline).toBe('Unsaved tagline')
    expect(state.editedSteps).toEqual([9])
    // Submission waits on Step 9: its specific readiness items stand in for the generic line.
    expect(await screen.findByText('Enter a business location.')).toBeTruthy()
    expect(screen.queryByText('Save or undo your changes to store details.')).toBeNull()
  })

  it('leaves later steps reachable after an earlier edit is reverted, writing nothing', async () => {
    const save = vi.spyOn(vendorOnboardingService, 'saveCheckoutOptions').mockResolvedValue(undefined)
    renderAccount('PENDING', 9)
    await currentStepIs(9)

    fireEvent.click(screen.getByRole('button', { name: /^Step 7,/ }))
    await currentStepIs(7)
    fireEvent.change(deliveryCharge(), { target: { value: '45' } })
    expect(useOnboardingStore.getState().editedSteps).toEqual([7])
    fireEvent.change(deliveryCharge(), { target: { value: '30' } })
    expect(useOnboardingStore.getState().editedSteps).toEqual([])

    fireEvent.click(screen.getByRole('button', { name: /^Step 9,/ }))
    await currentStepIs(9)
    fireEvent.click(screen.getByRole('button', { name: /^Step 7,/ }))
    await currentStepIs(7)
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await currentStepIs(9)
    expect(save).not.toHaveBeenCalled()
  })

  it('saves an edit to an earlier step and returns to where the vendor came from', async () => {
    const save = vi.spyOn(vendorOnboardingService, 'saveCheckoutOptions').mockResolvedValue(undefined)
    renderAccount('PENDING', 9)
    await currentStepIs(9)

    fireEvent.click(screen.getByRole('button', { name: /^Step 7,/ }))
    await currentStepIs(7)
    fireEvent.change(deliveryCharge(), { target: { value: '45' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await currentStepIs(9)
    expect(save).toHaveBeenCalledTimes(1)
    expect(save.mock.calls[0]![1].shipping.charge).toBe(45)
    expect(useOnboardingStore.getState().editedSteps).toEqual([])
    expect(screen.getByRole('button', { name: 'Review readiness' })).toBeTruthy()
  })

  it('saves Step 7 with Step 8’s saved values, leaving Step 8’s edit unsaved and unsent', async () => {
    const save = vi.spyOn(vendorOnboardingService, 'saveCheckoutOptions').mockResolvedValue(undefined)
    renderAccount('PENDING', 9)
    await currentStepIs(9)

    fireEvent.click(screen.getByRole('button', { name: /^Step 8,/ }))
    await currentStepIs(8)
    fireEvent.click(screen.getByRole('checkbox', { name: /cash on delivery/i }))
    fireEvent.click(screen.getByRole('button', { name: /^Step 7,/ }))
    await currentStepIs(7)
    fireEvent.change(deliveryCharge(), { target: { value: '45' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await currentStepIs(9)
    expect(save).toHaveBeenCalledTimes(1)
    const [, delivery, payments] = save.mock.calls[0]!
    expect(delivery.shipping.charge).toBe(45)
    expect(payments.options.find((option) => option.type === 'CASH_ON_DELIVERY')).toMatchObject({ enabled: true, isDefault: true })
    // Still unsaved: it stays in the draft, and still counts as an edit.
    const state = useOnboardingStore.getState()
    expect(state.draft.payments.find((option) => option.type === 'CASH_ON_DELIVERY')?.enabled).toBe(false)
    expect(state.editedSteps).toEqual([8])
  })

  it('reads the saved checkout first when Step 8’s saved values are unknown', async () => {
    const save = vi.spyOn(vendorOnboardingService, 'saveCheckoutOptions').mockResolvedValue(undefined)
    renderAccount('PENDING', 9)
    await currentStepIs(9)
    fireEvent.click(screen.getByRole('button', { name: /^Step 7,/ }))
    await currentStepIs(7)
    const reads = vi.mocked(vendorOnboardingService.getCheckoutOptions).mock.calls.length
    act(() => useOnboardingStore.getState().recordSavedBaselines({ 8: undefined }))

    fireEvent.change(deliveryCharge(), { target: { value: '45' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await currentStepIs(9)
    expect(vendorOnboardingService.getCheckoutOptions).toHaveBeenCalledTimes(reads + 1)
    expect(save.mock.calls[0]![2].options.find((option) => option.type === 'CASH_ON_DELIVERY')).toMatchObject({ enabled: true })
  })

  it('follows the same rules in demo mode, with no account reads or writes', async () => {
    vi.stubEnv('VITE_USE_API', 'false')
    configureApiClient({ useApi: false })
    const save = vi.spyOn(vendorOnboardingService, 'saveCheckoutOptions').mockResolvedValue(undefined)
    const context = vi.spyOn(vendorOnboardingService, 'getVendorContext').mockRejectedValue(new Error('no reads in demo'))
    useOnboardingStore.setState({
      draft: {
        ...createEmptyOnboardingDraft(),
        mobileVerified: true,
        currentStep: 9,
        completedSteps: [1, 2, 3, 4, 5, 6, 7, 8] as OnboardingStep[],
      },
      furthestVisitedStep: 9,
      draftOwnerId: '91',
    })
    render(<MemoryRouter><OnboardingWizard /></MemoryRouter>)
    await currentStepIs(9)

    fireEvent.click(screen.getByRole('button', { name: /^Step 7,/ }))
    await currentStepIs(7)
    fireEvent.change(deliveryCharge(), { target: { value: '45' } })
    expect(useOnboardingStore.getState().furthestVisitedStep).toBe(9)
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await currentStepIs(9)
    expect(useOnboardingStore.getState().editedSteps).toEqual([])
    expect(save).not.toHaveBeenCalled()
    expect(context).not.toHaveBeenCalled()
  })
})

describe('catalog dependencies guide a revisit save', () => {
  // Sample catalog in demo mode: references come from local sample data, so no read or
  // write reaches an account and Step 4-6 choices are real cards.
  const freshProduce = { id: -201, businessTypeId: -101, name: 'Fresh produce', description: 'Everyday fruit and vegetables', imageUrl: null, displayOrder: 1 }
  const pantry = { id: -202, businessTypeId: -101, name: 'Pantry', description: 'Staples, grains, and cooking essentials', imageUrl: null, displayOrder: 2 }
  const tomatoes = { id: -301, name: 'Tomatoes', description: 'Fresh local tomatoes', imageUrl: null, measurementId: null, measurementName: 'WEIGHT', categoryId: -201 }
  const bananas = { id: -302, name: 'Bananas', description: 'Naturally ripened bananas', imageUrl: null, measurementId: null, measurementName: 'COUNT', categoryId: -201 }
  const sizeOf = (productId: number, measurementType: 'WEIGHT' | 'COUNT', unit: string) => ({
    id: `draft-sku-${Math.abs(productId)}-1`, productId, name: '', description: '', skuType: 'ITEM' as const,
    measurementType, unit, quantity: 1, listPrice: 100, salePrice: 90, active: true, homeDelivery: true, storePickup: false,
  })
  const currentStepIs = (step: number) => screen.findByRole('button', { name: new RegExp(`^Step ${step},.*You are here`) })
  const stepLabel = (step: number) => screen.getByRole('button', { name: new RegExp(`^Step ${step},`) }).getAttribute('aria-label')
  const saveChanges = () => fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
  const fillSize = (productId: number) => {
    const card = within(document.getElementById(`product-${productId}`)!)
    fireEvent.change(card.getByLabelText('Quantity'), { target: { value: '1' } })
    fireEvent.change(card.getByLabelText('MRP (₹)'), { target: { value: '100' } })
    fireEvent.change(card.getByLabelText('Discounted price (₹)'), { target: { value: '90' } })
  }

  function renderReadyDemo(patch: Partial<ReturnType<typeof createEmptyOnboardingDraft>> = {}, currentStep: OnboardingStep = 9, unsaved: Partial<OnboardingStoreState> = {}) {
    vi.stubEnv('VITE_USE_API', 'false')
    configureApiClient({ useApi: false })
    const empty = createEmptyOnboardingDraft()
    useOnboardingStore.setState({
      draft: {
        ...empty,
        catalogSource: 'sample',
        mobileVerified: true,
        currentStep,
        completedSteps: ([1, 2, 3, 4, 5, 6, 7, 8, 9] as OnboardingStep[]).filter((step) => step < currentStep),
        business: { businessType: { id: -101, name: 'Grocery & essentials', icon: null, displayOrder: 1 }, businessName: 'Test Store' },
        categories: [freshProduce],
        products: [tomatoes],
        skus: [sizeOf(tomatoes.id, 'WEIGHT', 'kg')],
        delivery: { ...empty.delivery, shipping: { ...empty.delivery.shipping, charge: 45 } },
        payments: empty.payments.map((option) => option.type === 'CASH_ON_DELIVERY' ? { ...option, enabled: true, isDefault: true } : option),
        storefront: { ...empty.storefront, storeName: 'Test Store', businessLocation: 'Test City', tagline: 'Unchanged tagline' },
        ...patch,
      },
      runtime: { ...useOnboardingStore.getState().runtime, orderWhatsapp: '9876543210' },
      furthestVisitedStep: currentStep,
      draftOwnerId: '91',
      ...unsaved,
    })
    render(<MemoryRouter><OnboardingWizard /></MemoryRouter>)
  }

  it('9 → 4 adds a category: Save goes to 5, then 6, then back to 9, leaving Steps 7-9 untouched', async () => {
    renderReadyDemo()
    await currentStepIs(9)
    const before = useOnboardingStore.getState().draft
    expect(stepLabel(5)).not.toMatch(/needs attention/i)

    fireEvent.click(screen.getByRole('button', { name: /^Step 4,/ }))
    await currentStepIs(4)
    fireEvent.click(await screen.findByRole('button', { name: /^Pantry/ }))
    // An unsaved pick lights no other step, and nothing is locked.
    expect(stepLabel(5)).not.toMatch(/needs attention/i)
    expect(screen.getByRole('button', { name: /^Step 9,/ }).matches(':disabled')).toBe(false)
    saveChanges()

    await currentStepIs(5)
    // Saved without a product, the category needs attention: marked in place and opened.
    expect(stepLabel(5)).toMatch(/needs attention/i)
    const panel = document.getElementById(`category-products-${pantry.id}`) as HTMLDetailsElement
    expect(panel.open).toBe(true)
    expect(panel.getAttribute('data-attention')).toBe('true')
    expect(within(panel).getByText('Needs a product')).toBeTruthy()
    fireEvent.click(within(panel).getByRole('button', { name: /^Toor dal/ }))
    // The pick is unsaved: Step 5 stays marked until it is saved, and Step 6 is not lit.
    expect(stepLabel(5)).toMatch(/needs attention/i)
    expect(stepLabel(6)).not.toMatch(/needs attention/i)
    saveChanges()

    await currentStepIs(6)
    expect(stepLabel(5)).not.toMatch(/needs attention/i)
    expect(stepLabel(6)).toMatch(/needs attention/i)
    const product = document.getElementById('product--312')!
    expect(product.getAttribute('data-attention')).toBe('true')
    expect(within(product).getByText('Needs a size')).toBeTruthy()
    fillSize(-312)
    expect(stepLabel(6)).toMatch(/needs attention/i)
    saveChanges()

    await currentStepIs(9)
    expect(stepLabel(6)).not.toMatch(/needs attention/i)
    const after = useOnboardingStore.getState().draft
    expect(after.completedSteps).toEqual(before.completedSteps)
    expect(after.delivery).toEqual(before.delivery)
    expect(after.payments).toEqual(before.payments)
    expect(after.storefront).toEqual(before.storefront)
    expect(useOnboardingStore.getState().editedSteps).toEqual([])
  })

  it('a new product without a size goes to 6, then back to 9', async () => {
    renderReadyDemo()
    await currentStepIs(9)

    fireEvent.click(screen.getByRole('button', { name: /^Step 5,/ }))
    await currentStepIs(5)
    fireEvent.click(await screen.findByRole('button', { name: /^Bananas/ }))
    saveChanges()

    await currentStepIs(6)
    fillSize(bananas.id)
    saveChanges()
    await currentStepIs(9)
  })

  it('a catalog edit that leaves everything valid returns straight to 9', async () => {
    renderReadyDemo({ products: [tomatoes, bananas], skus: [sizeOf(tomatoes.id, 'WEIGHT', 'kg'), sizeOf(bananas.id, 'COUNT', 'pc')] })
    await currentStepIs(9)

    fireEvent.click(screen.getByRole('button', { name: /^Step 5,/ }))
    await currentStepIs(5)
    fireEvent.click(await screen.findByRole('button', { name: /^Bananas/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Remove product' }))
    saveChanges()

    await currentStepIs(9)
  })

  it('keeps Step 10 submission blocked while a category has no product', async () => {
    renderReadyDemo({ categories: [freshProduce, pantry] }, 10)
    await currentStepIs(10)
    expect(stepLabel(5)).toMatch(/needs attention/i)

    fireEvent.click(screen.getByRole('button', { name: 'Save private preview' }))

    const readiness = await waitFor(() => document.getElementById('readiness-issues')!)
    expect(within(readiness).getByText('Choose at least one product in Pantry.')).toBeTruthy()
    expect(useOnboardingStore.getState().draft.publication.state).not.toBe('prototype-complete')
    // Let the readiness list's focus and scroll timers finish inside the test.
    await waitFor(() => expect(document.activeElement?.id).toBe('readiness-issues'))
    await new Promise((resolve) => setTimeout(resolve, 50))
  })

  describe('saved and unsaved catalog', () => {
    const toorDal = { id: -312, name: 'Toor dal', description: 'Cleaned pigeon peas', imageUrl: null, measurementId: null, measurementName: 'WEIGHT', categoryId: -202 }
    const readiness = () => within(document.getElementById('readiness-issues')!).getAllByRole('button')
      .map((item) => item.firstElementChild?.textContent)
    const summaryValue = (label: string) => within(screen.getByLabelText('Store summary')).getByText(label).nextElementSibling?.textContent
    const goTo = async (step: number) => {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(`^Step ${step},`) }))
      await currentStepIs(step)
    }

    it('keeps an unsaved product pick off Step 6 and counts it on Step 10 as one unsaved step', async () => {
      renderReadyDemo({}, 10)
      await currentStepIs(10)

      await goTo(5)
      fireEvent.click(await screen.findByRole('button', { name: /^Bananas/ }))
      expect(stepLabel(6)).not.toMatch(/needs attention/i)

      await goTo(6)
      expect(document.getElementById(`product-${bananas.id}`)).toBeNull()
      expect(useOnboardingStore.getState().draft.skus.map((sku) => sku.productId)).toEqual([tomatoes.id])

      await goTo(10)
      expect(readiness()).toEqual(['Save or undo your changes to products.'])
      expect(summaryValue('Products')).toBe('1')
    })

    it('counts a blank unsaved size row on Step 10 as one unsaved step, not as sizes or fields', async () => {
      renderReadyDemo({}, 10)
      await currentStepIs(10)

      await goTo(6)
      fireEvent.click(screen.getByRole('button', { name: 'Add another size to Tomatoes' }))

      await goTo(10)
      expect(readiness()).toEqual(['Save or undo your changes to sizes and prices.'])
      expect(summaryValue('Sizes')).toBe('1 active · 0 inactive')
    })

    it('asks for a size for a saved product without one, judged on what is saved', async () => {
      renderReadyDemo({ products: [tomatoes, bananas] }, 10)
      await currentStepIs(10)
      expect(readiness()).toEqual(['Add a size for Bananas.'])
      expect(stepLabel(6)).toMatch(/needs attention/i)

      await goTo(6)
      // Saved without a size, the product gets a starter row; filling it saves nothing yet.
      fillSize(bananas.id)

      await goTo(10)
      // The size item says what Step 6 needs, so no generic line repeats it.
      expect(readiness()).toEqual(['Add a size for Bananas.'])
    })

    it('keeps products under an unsaved category hidden and unsent until the category is saved', async () => {
      renderReadyDemo({ categories: [freshProduce, pantry], products: [tomatoes, toorDal] }, 10, {
        editedSteps: [4, 5],
        fieldEdits: { categories: { at: 1, saved: [freshProduce] }, products: { at: 1, saved: [tomatoes] } },
      })
      await currentStepIs(10)
      expect(readiness()).toEqual(['Save or undo your changes to categories.', 'Save or undo your changes to products.'])
      expect(summaryValue('Products')).toBe('1')

      await goTo(5)
      expect(document.getElementById(`category-products-${pantry.id}`)).toBeNull()
      saveChanges()
      await currentStepIs(10)
      expect(useOnboardingStore.getState().savedBaselines[5]?.products).toEqual([tomatoes])
      expect(useOnboardingStore.getState().draft.products).toEqual([tomatoes, toorDal])

      // Saving the category brings its product back, still to be saved, then its size.
      await goTo(4)
      saveChanges()
      await currentStepIs(5)
      const panel = document.getElementById(`category-products-${pantry.id}`) as HTMLDetailsElement
      expect(within(panel).getByRole('button', { name: /^Toor dal/ }).getAttribute('aria-pressed')).toBe('true')
      saveChanges()
      await currentStepIs(6)
      expect(document.getElementById(`product-${toorDal.id}`)).toBeTruthy()
    })
  })
})

describe('stale validation errors', () => {
  const lastField = (label: string) => screen.getAllByLabelText(label).at(-1) as HTMLInputElement
  const fieldError = (input: HTMLInputElement) => document.getElementById(`${input.id}-error`)
  // Issues are shown only inline on their own step; the wizard-level summary is gone.
  const expectNoSummary = () => {
    expect(screen.queryByText(/Please fix/)).toBeNull()
    expect(document.getElementById('error-summary-heading')).toBeNull()
    expect(screen.queryAllByRole('alert').filter((alert) => /Please fix/.test(alert.textContent ?? ''))).toHaveLength(0)
  }

  // The full suite runs these well past the 5 s default under load.
  const timeout = 15_000

  it('clears a shown field error once the vendor fixes the field, before Continue', { timeout }, async () => {
    renderAccount('APPROVED')
    fireEvent.click(await openSizes())
    fillNewSize()
    fireEvent.change(lastField('Discounted price (₹)'), { target: { value: '200' } })

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    const price = lastField('Discounted price (₹)')
    await waitFor(() => expect(fieldError(price)?.textContent).toBe('Discounted price cannot exceed MRP.'))
    expect(price.getAttribute('aria-invalid')).toBe('true')
    // The first faulty field takes focus once the step has rendered, and its message is announced.
    await waitFor(() => expect(document.activeElement).toBe(price))
    // Field-specific, so inline only: no toast repeats it.
    expect(liveRegion().textContent).toBe('')
    expectNoSummary()

    fireEvent.change(price, { target: { value: '160' } })

    expect(fieldError(lastField('Discounted price (₹)'))).toBeNull()
    expect(lastField('Discounted price (₹)').getAttribute('aria-invalid')).toBeNull()
    expect(screen.queryByText('Discounted price cannot exceed MRP.')).toBeNull()
    expect(liveRegion().textContent).toBe('')
    expectNoSummary()
    expect(vendorOnboardingService.createSkus).not.toHaveBeenCalled()
    expect(useOnboardingStore.getState().draft.currentStep).toBe(6)
  })

  it('clears only the fixed error and never adds a new one before Continue', { timeout }, async () => {
    renderAccount('APPROVED')
    fireEvent.click(await openSizes())
    fillNewSize()
    fireEvent.change(lastField('Quantity'), { target: { value: '' } })
    fireEvent.change(lastField('Discounted price (₹)'), { target: { value: '200' } })

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(fieldError(lastField('Quantity'))?.textContent).toBe('Required field.'))
    // Each field error renders directly below its own input.
    expect(lastField('Quantity').nextElementSibling).toBe(fieldError(lastField('Quantity')))
    expect(lastField('Discounted price (₹)').nextElementSibling).toBe(fieldError(lastField('Discounted price (₹)')))
    expectNoSummary()
    expect(fieldError(lastField('Discounted price (₹)'))?.textContent).toBe('Discounted price cannot exceed MRP.')

    fireEvent.change(lastField('Quantity'), { target: { value: '2' } })

    expect(fieldError(lastField('Quantity'))).toBeNull()
    expect(lastField('Quantity').getAttribute('aria-invalid')).toBeNull()
    expect(fieldError(lastField('Discounted price (₹)'))?.textContent).toBe('Discounted price cannot exceed MRP.')
    expect(lastField('Discounted price (₹)').getAttribute('aria-invalid')).toBe('true')

    // A new problem typed in (MRP with three decimals) waits for the next Continue.
    fireEvent.change(lastField('MRP (₹)'), { target: { value: '180.555' } })

    expect(fieldError(lastField('MRP (₹)'))).toBeNull()
    expect(screen.queryByText('MRP can have at most two decimal places.')).toBeNull()
    expect(fieldError(lastField('Discounted price (₹)'))?.textContent).toBe('Discounted price cannot exceed MRP.')

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(fieldError(lastField('MRP (₹)'))?.textContent).toBe('MRP can have at most two decimal places.'))
    expect(fieldError(lastField('Discounted price (₹)'))?.textContent).toBe('Discounted price cannot exceed MRP.')
    expectNoSummary()
  })

  it('keeps a failed save message while the vendor edits fields', { timeout }, async () => {
    renderAccount('APPROVED')
    fireEvent.click(await openSizes())
    fillNewSize()
    vi.mocked(vendorOnboardingService.createSkus).mockRejectedValue(new Error('Could not create size'))

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(document.getElementById('skus-error')?.textContent).toBe('Could not create size'))
    expectNoSummary()

    fireEvent.change(lastField('Discounted price (₹)'), { target: { value: '150' } })
    fireEvent.change(lastField('MRP (₹)'), { target: { value: '170' } })

    expect(document.getElementById('skus-error')?.textContent).toBe('Could not create size')
    expect(shownCopies('Could not create size')).toHaveLength(1)
    expectNoSummary()
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
    expect(await screen.findByRole('status', { name: 'Loading this step' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Continue' }).matches(':disabled')).toBe(true)
    // Step 5 stays unmounted until the catalog lands, so its own list is not started early,
    // torn down and sent again.
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
    expect(productList).not.toHaveBeenCalled()

    await act(async () => answer(SAMPLE_MEASUREMENT_CATALOG))
    await waitFor(() => expect(screen.queryByRole('status', { name: 'Loading this step' })).toBeNull())
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

    // Revisiting a saved step: saving returns to Step 7, where the vendor came from.
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await screen.findByRole('button', { name: /Step 7,.*You are here/ })

    expect(products.mock.calls.length).toBe(productReads)
    expect(skus.mock.calls.length).toBe(skuReads)
    expect(vendorOnboardingService.createSkus).not.toHaveBeenCalled()
    expect(vendorOnboardingService.updateSku).not.toHaveBeenCalled()

    await openSizes()
    fireEvent.click(screen.getByRole('button', { name: 'Add another size to Test Juice' }))
    fillNewSize()
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
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
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await screen.findByRole('button', { name: /Step 8,.*You are here/ })
    expect(save).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('checkbox', { name: /cash on delivery/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await screen.findByRole('button', { name: /Step 9,.*You are here/ })
    expect(save).toHaveBeenCalledTimes(2)
  })
})

describe('save failures shown inline on their own step', () => {
  const expectNoSummary = () => {
    expect(screen.queryByText(/Please fix/)).toBeNull()
    expect(document.getElementById('error-summary-heading')).toBeNull()
  }

  it('shows a failed Step 7 save under the fulfilment choices', async () => {
    vi.spyOn(vendorOnboardingService, 'saveCheckoutOptions').mockRejectedValue(new Error('Could not save checkout'))
    renderAccount('APPROVED', 7)
    await screen.findByRole('button', { name: /Step 7,.*You are here/ })

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    await waitFor(() => expect(document.getElementById('fulfillment-error')?.textContent).toBe('Could not save checkout'))
    // Directly below the fulfilment choices it belongs to.
    expect(follows(document.getElementById('fulfillment')!, document.getElementById('fulfillment-error')!)).toBe(true)
    expect(shownCopies('Could not save checkout')).toHaveLength(1)
    await waitFor(() => expect(document.activeElement).toBe(document.getElementById('fulfillment')))
    // Field-specific, so inline only: no toast repeats it.
    expect(liveRegion().textContent).toBe('')
    expectNoSummary()
    expect(useOnboardingStore.getState().draft.currentStep).toBe(7)
  })

  it('shows a failed Step 8 save in the payments area', async () => {
    const save = vi.spyOn(vendorOnboardingService, 'saveCheckoutOptions').mockResolvedValue(undefined)
    renderAccount('APPROVED', 7)
    await screen.findByRole('button', { name: /Step 7,.*You are here/ })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await screen.findByRole('button', { name: /Step 8,.*You are here/ })
    expect(document.getElementById('payments-error')).toBeNull()

    save.mockRejectedValue(new Error('Could not save payments'))
    fireEvent.click(screen.getByRole('checkbox', { name: /cash on delivery/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    await waitFor(() => expect(document.getElementById('payments-error')?.textContent).toBe('Could not save payments'))
    expect(document.getElementById('payments')?.contains(document.getElementById('payments-error'))).toBe(true)
    expect(shownCopies('Could not save payments')).toHaveLength(1)
    await waitFor(() => expect(document.activeElement).toBe(document.getElementById('payments')))
    expect(document.getElementById('payments')?.getAttribute('tabindex')).toBe('-1')
    // Field-specific, so inline only: no toast repeats it.
    expect(liveRegion().textContent).toBe('')
    expectNoSummary()
    expect(useOnboardingStore.getState().draft.currentStep).toBe(8)
  })

  it('shows a failed go-live on Step 10 above the consequence sentence', async () => {
    seedReadyAccount('Test Road')
    renderAccount('APPROVED', 10)
    await screen.findByRole('button', { name: /Step 10,.*You are here/ })
    await waitFor(() => expect(continueDisabled('Submit for review')).toBe(false))
    vi.spyOn(vendorOnboardingService, 'goLive').mockRejectedValue(new Error('Could not submit the store'))

    fireEvent.click(screen.getByRole('button', { name: 'Submit for review' }))
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Submit for review' }))

    await waitFor(() => expect(document.getElementById('store-name-error')?.textContent).toBe('Could not submit the store'))
    const error = document.getElementById('store-name-error')!
    expect(document.getElementById('store-name')?.contains(error)).toBe(true)
    expect(follows(error, screen.getByText(/^Submitting sends your store for review/))).toBe(true)
    expect(shownCopies('Could not submit the store')).toHaveLength(1)
    expectNoSummary()
    expect(useOnboardingStore.getState().storeSubmission).toBeNull()
  })
})

describe('Products action feedback', () => {
  const toProducts = async () => {
    vi.spyOn(vendorOnboardingService, 'getProductsByCategory').mockResolvedValue(EMPTY_PAGE)
    renderAccount('PENDING', 5)
    await screen.findByRole('button', { name: /Step 5,.*You are here/ })
    await waitFor(() => expect(screen.getByRole('button', { name: /^Continue/ }).hasAttribute('disabled')).toBe(false))
  }

  it('shows only a red toast, with no inline message or scrolling, when no product is selected', async () => {
    await toProducts()
    const scroll = vi.mocked(HTMLElement.prototype.scrollIntoView)
    scroll.mockClear()
    act(() => useOnboardingStore.getState().updateDraft((draft) => ({ ...draft, products: [], skus: [] }), 5))
    fireEvent.click(screen.getByRole('button', { name: /^Continue/ }))
    const message = 'Choose at least one product to continue.'
    expect(liveRegion().textContent).toBe(message)
    expect(liveRegion().closest('[data-slot="toast"]')?.className).toContain('text-red-900')
    expect(document.getElementById('products-error')).toBeNull()
    expect(shownCopies(message)).toHaveLength(0)
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(scroll).not.toHaveBeenCalled()
    expect(useOnboardingStore.getState().draft.currentStep).toBe(5)
    fireEvent.click(screen.getByRole('button', { name: /^Step 4,/ }))
    await waitFor(() => expect(liveRegion().textContent).toBe(''))
  })

  it('toasts a category with no product and still opens and scrolls to its panel, without an inline message', async () => {
    await toProducts()
    const scroll = vi.mocked(HTMLElement.prototype.scrollIntoView)
    scroll.mockClear()
    // A saved category: Step 5 offers products only under those.
    const second = { id: 11, name: 'Smoothies', businessTypeId: 7, description: null, imageUrl: null, displayOrder: 2 }
    act(() => {
      useOnboardingStore.getState().setAccountCatalog({ categoryIds: [10, second.id] })
      useOnboardingStore.getState().updateDraft((draft) => ({
        ...draft,
        categories: [...draft.categories, second],
        products: draft.products.filter((product) => product.categoryId !== second.id),
        skus: [],
      }), 5)
    })
    fireEvent.click(screen.getByRole('button', { name: /^Continue/ }))
    const message = `Choose at least one product in ${second.name}.`
    expect(liveRegion().textContent).toBe(message)
    expect(document.getElementById(`category-products-${second.id}-error`)).toBeNull()
    expect(shownCopies(message)).toHaveLength(0)
    await waitFor(() => expect((document.getElementById(`category-products-${second.id}`) as HTMLDetailsElement).open).toBe(true))
    await waitFor(() => expect(scroll).toHaveBeenCalled())
  })
})

describe('Missing choices on Steps 3 and 4', () => {
  it.each([
    [3, 'Choose a business type.', 'business-type'],
    [4, 'Choose at least one category.', 'categories'],
  ])('Step %i shows only a toast, with no inline message or scrolling', async (step, message, field) => {
    vi.spyOn(vendorOnboardingService, 'getCategories').mockResolvedValue(EMPTY_PAGE)
    renderAccount('PENDING', step)
    await screen.findByRole('button', { name: new RegExp(`Step ${step},.*You are here`) })
    await waitFor(() => expect(stepSpinner()).toBeNull())
    act(() => useOnboardingStore.getState().updateDraft((draft) => step === 3
      ? { ...draft, business: { ...draft.business, businessType: null }, categories: [], products: [], skus: [] }
      : { ...draft, categories: [], products: [], skus: [] }, step as 3 | 4))
    const scroll = vi.mocked(HTMLElement.prototype.scrollIntoView)
    scroll.mockClear()

    fireEvent.click(screen.getByRole('button', { name: /^Continue/ }))

    expect(liveRegion().textContent).toBe(message)
    expect(document.getElementById(`${field}-error`)).toBeNull()
    expect(shownCopies(message)).toHaveLength(0)
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(scroll).not.toHaveBeenCalled()
    expect(useOnboardingStore.getState().draft.currentStep).toBe(step)
  })
})

describe('Plan-limit messages on Step 4', () => {
  it('stay inline as well as in the toast', async () => {
    vi.spyOn(vendorOnboardingService, 'getCategories').mockResolvedValue(EMPTY_PAGE)
    renderAccount('PENDING', 4)
    await screen.findByRole('button', { name: /Step 4,.*You are here/ })
    await waitFor(() => expect(stepSpinner()).toBeNull())
    const extra = [11, 12, 13, 14].map((id) => ({ id, name: `Extra ${id}`, businessTypeId: 7, description: null, imageUrl: null, displayOrder: id }))
    act(() => useOnboardingStore.getState().updateDraft((draft) => ({ ...draft, categories: [...draft.categories, ...extra] }), 4))

    fireEvent.click(screen.getByRole('button', { name: /^Continue/ }))

    const message = 'Your plan allows 3 categories in total, including those already saved to your store.'
    expect(liveRegion().textContent).toBe(message)
    expect(document.getElementById('categories-error')?.textContent).toBe(message)
  })
})

describe('Step 10 readiness issues', () => {
  it('focuses the readiness list when Submit finds issues owned by earlier steps', async () => {
    renderAccount('APPROVED', 10)
    await screen.findByRole('button', { name: /Step 10,.*You are here/ })
    // An unsubmitted Step 10 reads every account resource.
    await waitFor(() => expect(cachedResources()).toEqual(ALL_RESOURCES))
    const goLive = vi.spyOn(vendorOnboardingService, 'goLive').mockResolvedValue(undefined)

    fireEvent.click(screen.getByRole('button', { name: 'Submit for review' }))

    const list = document.getElementById('readiness-issues')
    expect(list).not.toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(list))
    const first = within(list!).getAllByRole('button')[0]
    expect(liveRegion().textContent).not.toBe('')
    expect(first.textContent).toContain(liveRegion().textContent!)
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(goLive).not.toHaveBeenCalled()
  })
})

describe('Step 10 store summary', () => {
  it('groups checkout settings under Checkout Options and shows WhatsApp numbers in full', async () => {
    renderAccount('APPROVED', 10)
    await screen.findByRole('button', { name: /Step 10,.*You are here/ })
    expect(screen.getByRole('heading', { level: 1, name: 'Review your store' })).toBeTruthy()
    expect(screen.getByText('Check your store before submitting.')).toBeTruthy()
    act(() => {
      useOnboardingStore.getState().updateRuntime({ orderWhatsapp: '9876543210', supportWhatsapp: '9000000001' })
    })

    const summary = screen.getByLabelText('Store summary')
    expect(within(summary).getByRole('heading', { name: 'Checkout Options' })).toBeTruthy()
    expect(within(summary).queryByRole('heading', { name: 'Orders' })).toBeNull()
    const value = (label: string) => within(summary).getByText(label).nextElementSibling?.textContent
    expect(value('Order WhatsApp')).toBe('9876543210')
    expect(value('Support WhatsApp')).toBe('9000000001')
    expect(summary.textContent).not.toContain('•')
  })

  it('reads Not added for a missing order number and drops an empty support row', async () => {
    renderAccount('APPROVED', 10)
    await screen.findByRole('button', { name: /Step 10,.*You are here/ })
    act(() => {
      useOnboardingStore.getState().updateRuntime({ orderWhatsapp: '', supportWhatsapp: '' })
    })

    const summary = screen.getByLabelText('Store summary')
    expect(within(summary).getByText('Order WhatsApp').nextElementSibling?.textContent).toBe('Not added')
    expect(within(summary).queryByText('Support WhatsApp')).toBeNull()
  })
})

const ALL_RESOURCES: readonly OnboardingResource[] = [
  'profile', 'businessTypes', 'categories', 'products', 'skus', 'checkout',
]

/** Fill the shared account cache for vendor 91, as an earlier visit would have. */
async function cacheEveryResource() {
  // The vendor record names the saved type, so Steps 3-4 know it without further reads.
  const cached: Partial<Record<OnboardingResource, unknown>> = {
    profile: { businessName: 'Test Store', businessType: 'Beverages', contactNumber: '' },
    businessTypes: [{ id: 7, name: 'Beverages', icon: null, displayOrder: 1 }],
    checkout: null,
  }
  await Promise.all(ALL_RESOURCES.map((resource) => loadOnboardingResource('91', resource, async () => (
    (resource in cached ? cached[resource] : []) as never
  ))))
}

/** The resources still resolved in the shared cache for vendor 91. */
const cachedResources = () => ALL_RESOURCES.filter((resource) => peekOnboardingResource('91', resource))

describe('the business type locks at its first confirmed save', () => {
  const beverages = { id: 7, name: 'Beverages', icon: null, displayOrder: 1 }
  const bakery = { id: 8, name: 'Bakery', icon: null, displayOrder: 2 }
  const others = { id: 30, name: 'Others', icon: null, displayOrder: 30 }
  const LOCKED = 'Business type cannot be changed now. Contact support to change it.'
  const UNRESOLVED = 'We couldn’t confirm your saved business type. Try again.'
  const currentStepIs = (step: number) => screen.findByRole('button', { name: new RegExp(`^Step ${step},.*You are here`) })
  const card = (name: string) => screen.findByRole('button', { name: new RegExp(`${name}$`) })
  const toast = () => document.querySelector('[data-slot="toast"]:not([data-ending-style]) [data-slot="toast-title"]')?.textContent ?? ''
  const profileNames = (businessType: string) => vi.mocked(vendorOnboardingService.getVendorProfile)
    .mockResolvedValue({ businessName: 'Test Store', businessType, contactNumber: '' })
  const contextAt = (nextStep: number) => vi.mocked(vendorOnboardingService.getVendorContext).mockResolvedValue(mapVendorContext({
    data: {
      vendor_id: 91, vendor_status: 'ACTIVE', approval_status: 'PENDING', store_identifier: 'test-store', business_name: 'Test Store',
      onboarding: { status: 'IN_PROGRESS', next_step: nextStep },
      subscription: { limits: { max_categories: 3, max_products: 10, max_skus: 2 }, usage: { skus: 0 } },
    },
  }))
  /** Each business type's category list, as `GET /v1/categories/?business_type_id=` pages it. */
  function listCategories(lists: Record<number, number[]>) {
    vi.mocked(vendorOnboardingService.getCategories).mockImplementation(async (params = {}) => {
      const typeId = params.business_type_id ?? 0
      const ids = lists[typeId] ?? []
      return {
        items: ids.map((id) => ({ id, name: `Category ${id}`, icon: null, businessTypeId: typeId, description: null, imageUrl: null, displayOrder: id })),
        pageNumber: params.pageNumber ?? 0, pageSize: params.pageSize ?? 12, totalPages: 1, totalElements: ids.length, lastPage: true,
      }
    })
  }
  const typeListReads = () => vi.mocked(vendorOnboardingService.getCategories).mock.calls
    .filter(([params]) => params?.pageSize === 100).map(([params]) => params?.business_type_id)
  /** Every read of one type's category list, whatever its page size. */
  const typeCategoryReads = (typeId: number) => vi.mocked(vendorOnboardingService.getCategories).mock.calls
    .filter(([params]) => params?.business_type_id === typeId).length
  /** A new account: no catalog saved yet. */
  function emptyAccount() {
    vi.mocked(vendorOnboardingService.getVendorCategories).mockResolvedValue([])
    vi.mocked(vendorOnboardingService.getVendorProducts).mockResolvedValue([])
    vi.mocked(vendorOnboardingService.getVendorSkus).mockResolvedValue([])
  }
  /** This browser's draft from a visit whose first type save was still pending. */
  function seedPendingChoice(type: typeof bakery) {
    useOnboardingStore.setState({
      draft: {
        ...createEmptyOnboardingDraft(),
        mobileVerified: true,
        currentStep: 3,
        completedSteps: [1, 2] as OnboardingStep[],
        business: { businessType: type, businessName: 'Test Store' },
      },
      furthestVisitedStep: 3,
      draftOwnerId: '91',
      editedSteps: [3],
    })
    markTypeSaveInFlight('91', type)
  }

  beforeEach(() => {
    // The reference cache is module-level; 48 other keys push an earlier test's list out.
    for (let index = 0; index < 48; index++) writeReferenceCache(`test-filler:${index}`, EMPTY_PAGE, false)
    vi.mocked(vendorOnboardingService.getBusinessTypes).mockResolvedValue({
      items: [beverages, bakery, others], pageNumber: 0, pageSize: 100, totalPages: 1, totalElements: 3, lastPage: true,
    })
  })

  it('refuses another type once saved: it warns, keeps the selection and writes nothing', async () => {
    const save = vi.mocked(vendorOnboardingService.saveBusinessType)
    renderAccount('PENDING', 5)
    await currentStepIs(5)
    fireEvent.click(screen.getByRole('button', { name: /^Step 3,/ }))
    await currentStepIs(3)

    // Locked cards stay focusable and pressable, so the press can say why nothing changes.
    const other = await card('Bakery')
    expect(other.matches(':disabled')).toBe(false)
    other.focus()
    expect(document.activeElement).toBe(other)
    fireEvent.click(other)
    await waitFor(() => expect(toast()).toBe(LOCKED))
    expect(screen.getAllByText(LOCKED)).toHaveLength(1)
    expect((await card('Beverages')).getAttribute('aria-pressed')).toBe('true')
    expect(other.getAttribute('aria-pressed')).toBe('false')
    const state = useOnboardingStore.getState()
    expect(state.draft.business.businessType).toEqual(beverages)
    expect(state.editedSteps).not.toContain(3)
    expect(state.draft.completedSteps).toContain(4)

    // Saving the unchanged type returns to where the vendor was, without a write.
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await currentStepIs(5)
    expect(save).not.toHaveBeenCalled()
  })

  it('lets the vendor change the type freely before the first confirmed save', async () => {
    profileNames('Others')
    emptyAccount()
    renderAccount('PENDING', 3)
    await currentStepIs(3)

    fireEvent.click(await card('Beverages'))
    fireEvent.click(await card('Bakery'))
    expect(useOnboardingStore.getState().draft.business.businessType).toEqual(bakery)
    expect(toast()).not.toBe(LOCKED)
    expect(readSavedTypeRecord('91')).toEqual({ confirmed: null, inFlight: null })
  })

  it('takes a type saved on another device while the page was away, never sending this tab’s choice', async () => {
    profileNames('Others')
    emptyAccount()
    listCategories({ 7: [10], 8: [20], 30: [301] })
    renderAccount('PENDING', 3)
    await currentStepIs(3)
    fireEvent.click(await card('Bakery'))
    // Another device saves Beverages and moves on.
    contextAt(4)
    profileNames('Beverages')

    act(() => hideAndShowTab())
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    await waitFor(() => expect(useOnboardingStore.getState().savedType).toEqual({ status: 'saved', type: beverages }))
    expect(useOnboardingStore.getState().draft.business.businessType).toEqual(beverages)
    expect(vendorOnboardingService.saveBusinessType).not.toHaveBeenCalledWith('91', { businessType: 'Bakery' })
    expect(toast()).not.toBe(LOCKED)
  })

  it('locks the type a save confirms, and a stale vendor record read afterwards does not unlock it', async () => {
    profileNames('Others')
    emptyAccount()
    listCategories({ 7: [10], 8: [20], 30: [301] })
    renderAccount('PENDING', 3)
    await currentStepIs(3)
    fireEvent.click(await card('Bakery'))
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    await currentStepIs(4)
    expect(vendorOnboardingService.saveBusinessType).toHaveBeenCalledWith('91', { businessType: 'Bakery' })
    expect(useOnboardingStore.getState().savedType).toEqual({ status: 'saved', type: bakery })
    expect(readSavedTypeRecord('91')).toEqual({ confirmed: bakery, inFlight: null })
    expect(await screen.findByRole('button', { name: /Category 20/ })).toBeTruthy()

    // Reload: the context has moved on, but the vendor record still reports "Others".
    cleanup()
    invalidateAll()
    renderAccount('PENDING', 4)
    await currentStepIs(4)
    expect(await screen.findByRole('button', { name: /Category 20/ })).toBeTruthy()
    expect(useOnboardingStore.getState().savedType).toEqual({ status: 'saved', type: bakery })
    expect(screen.queryByText(UNRESOLVED)).toBeNull()
    // The browser's record settles it: no category evidence is read.
    expect(typeListReads()).toEqual([])
  })

  it('resumes a vendor who chose Others past Step 3, locked to Others by the assigned categories', async () => {
    profileNames('Others')
    vi.mocked(vendorOnboardingService.getVendorCategories).mockResolvedValue([
      { vendorCategoryId: 500, platformCategoryId: 301, name: 'Misc', imageUrl: null },
    ])
    vi.mocked(vendorOnboardingService.getVendorProducts).mockResolvedValue([
      { vendorProductId: 900, platformProductId: 31, platformCategoryId: 301, name: 'Test Juice', measurementId: 2 },
    ])
    listCategories({ 7: [10, 11], 8: [20], 30: [301] })
    renderAccount('PENDING', 4)

    await currentStepIs(4)
    // Step 4 lists Others' categories, with the saved one chosen.
    expect((await screen.findByRole('button', { name: /Misc/ })).getAttribute('aria-pressed')).toBe('true')
    expect(useOnboardingStore.getState().savedType).toEqual({ status: 'saved', type: others })
    expect(useOnboardingStore.getState().draft.business.businessType).toEqual(others)
    // The vendor record says "Others", so its list is checked alone first, and it holds them all.
    expect(typeListReads()).toEqual([30])
    // Step 4 shows Others' first page from that read rather than reading the list again.
    expect(typeCategoryReads(30)).toBe(1)
    expect(useOnboardingStore.getState().catalogMixed).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: /^Step 3,/ }))
    await currentStepIs(3)
    expect((await card('Others')).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(await card('Beverages'))
    await waitFor(() => expect(toast()).toBe(LOCKED))
    expect(useOnboardingStore.getState().draft.business.businessType).toEqual(others)

    // The answer is recorded, so a later entry tells it without reading every list again.
    expect(readSavedTypeRecord('91')).toEqual({ confirmed: others, inFlight: null })
    cleanup()
    invalidateAll()
    vi.mocked(vendorOnboardingService.getCategories).mockClear()
    vi.mocked(vendorOnboardingService.getBusinessTypes).mockClear()
    renderAccount('PENDING', 4)
    await currentStepIs(4)
    expect((await screen.findByRole('button', { name: /Misc/ })).getAttribute('aria-pressed')).toBe('true')
    expect(useOnboardingStore.getState().savedType).toEqual({ status: 'saved', type: others })
    expect(typeListReads()).toEqual([])
    expect(vendorOnboardingService.getBusinessTypes).not.toHaveBeenCalled()
  })

  it('reads every type’s list when a vendor record saying "Others" is stale, without calling the catalog mixed', async () => {
    profileNames('Others')
    vi.mocked(vendorOnboardingService.getVendorCategories).mockResolvedValue([
      { vendorCategoryId: 500, platformCategoryId: 20, name: 'Breads', imageUrl: null },
    ])
    vi.mocked(vendorOnboardingService.getVendorProducts).mockResolvedValue([])
    vi.mocked(vendorOnboardingService.getVendorSkus).mockResolvedValue([])
    listCategories({ 7: [10, 11], 8: [20, 21], 30: [301] })
    renderAccount('PENDING', 4)

    await currentStepIs(4)
    expect((await screen.findByRole('button', { name: /Breads/ })).getAttribute('aria-pressed')).toBe('true')
    expect(useOnboardingStore.getState().savedType).toEqual({ status: 'saved', type: bakery })
    expect(readSavedTypeRecord('91')).toEqual({ confirmed: bakery, inFlight: null })
    // Others first, then the rest; Others' list is not read twice.
    expect(typeListReads()[0]).toBe(30)
    expect(typeListReads().sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual([7, 8, 30])
    // Step 4 shows Bakery's first page from the fallback's read.
    expect(await screen.findByRole('button', { name: /Category 21/ })).toBeTruthy()
    expect(typeCategoryReads(8)).toBe(1)
    expect(useOnboardingStore.getState().catalogMixed).toBe(false)
    expect(screen.queryByText(/more than one business type/)).toBeNull()
  })

  it('records no type when the record names one, and none the categories cannot settle', async () => {
    renderAccount('PENDING', 4)
    await currentStepIs(4)
    await waitFor(() => expect(useOnboardingStore.getState().savedType).toEqual({ status: 'saved', type: beverages }))
    expect(readSavedTypeRecord('91')).toEqual({ confirmed: null, inFlight: null })

    cleanup()
    invalidateAll()
    profileNames('Others')
    // Category 10 is listed by two types, so nothing is told and nothing recorded.
    listCategories({ 7: [10], 8: [10], 30: [301] })
    renderAccount('PENDING', 4)
    expect(await screen.findByText(UNRESOLVED)).toBeTruthy()
    expect(readSavedTypeRecord('91')).toEqual({ confirmed: null, inFlight: null })
  })

  it('verifies a save still pending at reload instead of reopening the choice, then points to support', async () => {
    seedPendingChoice(bakery)
    profileNames('Others')
    emptyAccount()
    // The save landed: the account counts Step 3 as saved, but nothing says which type.
    renderAccount('PENDING', 4)

    await currentStepIs(4)
    expect(await screen.findByText(UNRESOLVED)).toBeTruthy()
    expect(continueDisabled()).toBe(true)
    expect(useOnboardingStore.getState().draft.business.businessType).toEqual(bakery)
    expect(readSavedTypeRecord('91').inFlight).toEqual(bakery)

    fireEvent.click(screen.getByRole('button', { name: /^Step 3,/ }))
    await currentStepIs(3)
    expect(await screen.findByText(UNRESOLVED)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Beverages$/ })).toBeNull()

    const profileReads = vi.mocked(vendorOnboardingService.getVendorProfile).mock.calls.length
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText(/contact support to continue/)).toBeTruthy()
    // The check read the vendor record again rather than reusing the earlier copy.
    expect(vi.mocked(vendorOnboardingService.getVendorProfile).mock.calls.length).toBe(profileReads + 1)
    expect(useOnboardingStore.getState().draft.business.businessType).toEqual(bakery)
    expect(vendorOnboardingService.saveBusinessType).not.toHaveBeenCalled()
  })

  it('reopens the choice with the vendor’s input when the pending save did not land', async () => {
    seedPendingChoice(bakery)
    profileNames('Others')
    emptyAccount()
    renderAccount('PENDING', 3)

    await currentStepIs(3)
    expect((await card('Bakery')).getAttribute('aria-pressed')).toBe('true')
    expect(readSavedTypeRecord('91')).toEqual({ confirmed: null, inFlight: null })
    fireEvent.click(await card('Beverages'))
    expect(useOnboardingStore.getState().draft.business.businessType).toEqual(beverages)
  })

  it('checks a save whose response was lost against fresh reads before allowing another choice', async () => {
    profileNames('Others')
    emptyAccount()
    listCategories({ 8: [20] })
    vi.mocked(vendorOnboardingService.saveBusinessType).mockRejectedValue(new Error('Network Error'))
    renderAccount('PENDING', 3)
    await currentStepIs(3)
    fireEvent.click(await card('Bakery'))
    // The save reached the account after all; the fresh reads say so.
    contextAt(4)
    profileNames('Bakery')
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    await waitFor(() => expect(useOnboardingStore.getState().savedType).toEqual({ status: 'saved', type: bakery }))
    expect(readSavedTypeRecord('91')).toEqual({ confirmed: bakery, inFlight: null })
    fireEvent.click(await card('Beverages'))
    await waitFor(() => expect(toast()).toBe(LOCKED))
    expect(useOnboardingStore.getState().draft.business.businessType).toEqual(bakery)
  })

  it('reopens the choice at once when the server refuses the first save', async () => {
    profileNames('Others')
    emptyAccount()
    vi.mocked(vendorOnboardingService.saveBusinessType).mockRejectedValue(apiErrorFromResponse(400, { success: false, status: 400, message: 'Invalid business type' }))
    renderAccount('PENDING', 3)
    await currentStepIs(3)
    fireEvent.click(await card('Bakery'))
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    await waitFor(() => expect(vendorOnboardingService.saveBusinessType).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Continue' }).hasAttribute('aria-busy')).toBe(false))
    expect(readSavedTypeRecord('91')).toEqual({ confirmed: null, inFlight: null })
    expect(useOnboardingStore.getState().savedType).toEqual({ status: 'open' })
    fireEvent.click(await card('Beverages'))
    expect(useOnboardingStore.getState().draft.business.businessType).toEqual(beverages)
  })

  describe('drafts left by the old type change', () => {
    const MIXED = 'Your catalog has categories from more than one business type. Contact support to continue.'
    const PENDING_CATEGORY = -1_000_001
    const PENDING_PRODUCT = -1_000_002
    const category = (id: number, businessTypeId: number, pending?: true) => ({
      id, businessTypeId, name: `Category ${id}`, description: null, imageUrl: null, displayOrder: null, ...(pending ? { pending } : {}),
    })
    const product = (id: number, categoryId: number, pending?: true) => ({
      id, categoryId, name: `Product ${id}`, description: null, imageUrl: null, measurementId: null, measurementName: null, ...(pending ? { pending } : {}),
    })
    const size = (id: string, productId: number) => ({
      id, productId, name: '', description: '', skuType: 'ITEM' as const, measurementType: 'COUNT' as const, unit: 'pc',
      quantity: 1, listPrice: 100, salePrice: 90, active: true, homeDelivery: true, storePickup: false,
    })

    /**
     * What a vendor's browser held after the old behaviour: Beverages saved with its catalog,
     * then Bakery chosen and never saved, with Bakery categories (one listed, one authored),
     * products and sizes picked on top; progress collapsed to Step 4; and an unrelated unsaved
     * tagline. `edited` is the envelope's edited-steps field; absent is the legacy shape.
     */
    function plantOldDraft(edited: { editedSteps?: OnboardingStep[]; hasLocalEdits?: boolean }) {
      const empty = createEmptyOnboardingDraft()
      const draft = {
        ...empty,
        mobileVerified: true,
        currentStep: 4 as OnboardingStep,
        completedSteps: [1, 2, 3] as OnboardingStep[],
        business: { businessType: bakery, businessName: 'Test Store' },
        categories: [category(10, 7), category(20, 8), category(PENDING_CATEGORY, 8, true)],
        products: [product(31, 10), product(41, 20), product(PENDING_PRODUCT, PENDING_CATEGORY, true)],
        skus: [size('sku-4001', 31), size('draft-sku-41', 41), size('draft-sku-pending', PENDING_PRODUCT)],
        storefront: { ...empty.storefront, tagline: 'Unsaved tagline' },
      }
      // Written before drafts recorded saved values (version 4).
      localStorage.setItem(ONBOARDING_DRAFT_STORAGE_KEY, JSON.stringify({
        version: 4, revision: 3, updatedAt: '2026-11-01T10:00:00.000Z', ownerId: '91',
        furthestVisitedStep: 4, ...edited, draft: { ...toPersistedDraft(draft), version: 4 }, previewSnapshot: null,
      }))
      // Read the browser's draft as a fresh page load does.
      useOnboardingStore.setState({ persistenceInitialized: false })
    }
    const storedDraft = () => parsePersistedEnvelope(JSON.parse(localStorage.getItem(ONBOARDING_DRAFT_STORAGE_KEY) ?? 'null'))

    it.each([
      ['edited steps', { editedSteps: [3, 4, 5, 6, 9] as OnboardingStep[] }],
      ['the legacy flag absent', {}],
      ['the legacy flag set', { hasLocalEdits: true }],
    ])('restores the saved type and drops the other type’s unsaved catalog, silently (%s)', async (_, edited) => {
      seedReadyAccount('Test City')
      plantOldDraft(edited)
      renderAccount('PENDING', 10)

      await currentStepIs(10)
      await waitFor(() => expect(useOnboardingStore.getState().loadedSteps).toContain(6))
      const state = useOnboardingStore.getState()
      expect(state.savedType).toEqual({ status: 'saved', type: beverages })
      expect(state.draft.business.businessType).toEqual(beverages)
      expect(state.draft.completedSteps).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
      // The saved catalog stays; Bakery's unsaved selections and everything under them go.
      expect(state.draft.categories.map(({ id }) => id)).toEqual([10])
      expect(state.draft.products.map(({ id }) => id)).toEqual([31])
      expect(state.draft.skus.map(({ id }) => id)).toEqual(['sku-4001'])
      // Unrelated unsaved input is kept.
      expect(state.draft.storefront.tagline).toBe('Unsaved tagline')
      // No notice of any kind, and nothing written to the account.
      expect(toast()).toBe('')
      expect(screen.queryByText(LOCKED)).toBeNull()
      expect(screen.queryByText(MIXED)).toBeNull()
      expect(vendorOnboardingService.saveBusinessType).not.toHaveBeenCalled()
      // The repaired draft is one the next page load can open.
      act(() => useOnboardingStore.getState().flushPersistence())
      expect(storedDraft()?.draft.business.businessType).toEqual(beverages)
      expect(storedDraft()?.draft.categories.map(({ id }) => id)).toEqual([10])
    })

    it('keeps the draft’s catalog while the saved type is unresolved, guessing nothing', async () => {
      seedReadyAccount('Test City')
      profileNames('Others')
      // Category 10 sits in two types' lists, so the categories cannot tell the type.
      listCategories({ 7: [10], 8: [10, 20], 30: [] })
      plantOldDraft({ editedSteps: [3, 4, 5, 6] })
      renderAccount('PENDING', 10)

      await currentStepIs(10)
      await waitFor(() => expect(useOnboardingStore.getState().savedType.status).toBe('unresolved'))
      const state = useOnboardingStore.getState()
      expect(state.draft.business.businessType).toEqual(bakery)
      expect(state.draft.categories.map(({ id }) => id)).toEqual([10, 20, PENDING_CATEGORY])
      expect(readSavedTypeRecord('91')).toEqual({ confirmed: null, inFlight: null })
    })

    it('sends a vendor whose saved catalog is mixed to support, blocking catalog changes and submission', async () => {
      // Category 20 is saved on the account but is not on Beverages' complete list.
      vi.mocked(vendorOnboardingService.getVendorCategories).mockResolvedValue([
        { vendorCategoryId: 500, platformCategoryId: 10, name: 'Juices', imageUrl: null },
        { vendorCategoryId: 501, platformCategoryId: 20, name: 'Bread', imageUrl: null },
      ])
      listCategories({ 7: [10, 11], 8: [20] })
      renderAccount('PENDING', 6)
      await currentStepIs(6)
      // Nothing in hand says so yet: no list is read for this check alone.
      expect(screen.queryByText(MIXED)).toBeNull()
      expect(typeListReads()).toEqual([])

      // Step 4 reads Beverages' list anyway; it is complete, and category 20 is not on it.
      fireEvent.click(screen.getByRole('button', { name: /^Step 4,/ }))
      await currentStepIs(4)
      expect(await screen.findByText(MIXED)).toBeTruthy()
      expect(screen.queryByRole('button', { name: /Category 11/ })).toBeNull()
      expect(continueDisabled('Save changes')).toBe(true)
      // Nothing saved on the account is dropped or reassigned.
      expect(useOnboardingStore.getState().draft.categories.map(({ id }) => id)).toEqual([10, 20])

      fireEvent.click(screen.getByRole('button', { name: /^Step 5,/ }))
      await currentStepIs(5)
      expect(await screen.findByText(MIXED)).toBeTruthy()
      expect(continueDisabled('Save changes')).toBe(true)

      fireEvent.click(screen.getByRole('button', { name: /^Step 6,/ }))
      await currentStepIs(6)
      expect(await screen.findByText(MIXED)).toBeTruthy()

      fireEvent.click(screen.getByRole('button', { name: /^Step 3,/ }))
      await currentStepIs(3)
      expect(screen.queryByText(MIXED)).toBeNull()
    })

    it('blocks submission on Step 10 once the mixed catalog is known', async () => {
      seedReadyAccount('Test City')
      vi.mocked(vendorOnboardingService.getVendorCategories).mockResolvedValue([
        { vendorCategoryId: 500, platformCategoryId: 10, name: 'Juices', imageUrl: null },
        { vendorCategoryId: 501, platformCategoryId: 20, name: 'Bread', imageUrl: null },
      ])
      listCategories({ 7: [10, 11], 8: [20] })
      renderAccount('PENDING', 10)
      await currentStepIs(10)
      fireEvent.click(screen.getByRole('button', { name: /^Step 4,/ }))
      await currentStepIs(4)
      expect(await screen.findByText(MIXED)).toBeTruthy()

      fireEvent.click(screen.getByRole('button', { name: /^Step 10,/ }))
      await currentStepIs(10)
      await waitFor(() => expect(cachedResources()).toEqual(ALL_RESOURCES))
      const goLive = vi.spyOn(vendorOnboardingService, 'goLive').mockResolvedValue(undefined)
      fireEvent.click(await screen.findByRole('button', { name: 'Submit for review' }))
      const list = await waitFor(() => {
        const found = document.getElementById('readiness-issues')
        expect(found).not.toBeNull()
        return found!
      })
      expect(within(list).getByText(MIXED)).toBeTruthy()
      expect(screen.queryByRole('alertdialog')).toBeNull()
      expect(goLive).not.toHaveBeenCalled()
    })

    it('never calls a category the vendor authors and saves this visit mixed', async () => {
      // Beverages' list fits one page; the authored category is not on it.
      listCategories({ 7: [10, 11], 8: [20] })
      vi.spyOn(vendorOnboardingService, 'createCategory').mockResolvedValue(900)
      const save = vi.spyOn(vendorOnboardingService, 'saveCategories').mockResolvedValue(undefined)
      renderAccount('PENDING', 4)
      await currentStepIs(4)
      expect(await screen.findByRole('button', { name: /Category 11/ })).toBeTruthy()

      act(() => { useOnboardingStore.getState().addPendingCategory({ name: 'Zed Two Cat', businessTypeId: 7 }) })
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
      await currentStepIs(5)
      expect(save).toHaveBeenCalled()
      expect(useOnboardingStore.getState().accountCatalog.categoryIds).toContain(900)
      expect(screen.queryByText(MIXED)).toBeNull()

      fireEvent.click(screen.getByRole('button', { name: /^Step 4,/ }))
      await currentStepIs(4)
      expect(await screen.findByRole('button', { name: /Category 11/ })).toBeTruthy()
      expect(screen.queryByText(MIXED)).toBeNull()
      expect(useOnboardingStore.getState().catalogMixed).toBe(false)
    })

    it('does not call the catalog mixed while the saved type’s list is only partly read', async () => {
      vi.mocked(vendorOnboardingService.getVendorCategories).mockResolvedValue([
        { vendorCategoryId: 500, platformCategoryId: 10, name: 'Juices', imageUrl: null },
        { vendorCategoryId: 501, platformCategoryId: 20, name: 'Bread', imageUrl: null },
      ])
      vi.mocked(vendorOnboardingService.getCategories).mockResolvedValue({
        items: [{ id: 10, name: 'Juices', icon: null, businessTypeId: 7, description: null, imageUrl: null, displayOrder: 1 }],
        pageNumber: 0, pageSize: 6, totalPages: 2, totalElements: 7, lastPage: false,
      })
      renderAccount('PENDING', 4)

      await currentStepIs(4)
      expect(await screen.findByRole('button', { name: /Juices/ })).toBeTruthy()
      expect(screen.queryByText(MIXED)).toBeNull()
    })
  })
})

describe('what a save clears from the shared account cache', () => {
  it('drops only the categories and the context after a Step 4 save', async () => {
    stubReferencePages()
    const save = vi.spyOn(vendorOnboardingService, 'saveCategories').mockResolvedValue(undefined)
    await cacheEveryResource()
    renderAccount('APPROVED', 7)
    fireEvent.click(await screen.findByRole('button', { name: /^Step 4,/ }))
    await screen.findByRole('button', { name: /Step 4,.*You are here/ })
    await waitFor(() => expect(continueDisabled('Save changes')).toBe(false))
    act(() => useOnboardingStore.getState().updateDraft((draft) => ({
      ...draft,
      categories: [...draft.categories, { id: 11, name: 'Smoothies', businessTypeId: 7, description: null, imageUrl: null, displayOrder: 2 }],
    }), 4))
    expect(peekVendorContext('91')).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(useOnboardingStore.getState().draft.currentStep).not.toBe(4))

    expect(save).toHaveBeenCalledWith('91', [11])
    expect(cachedResources()).toEqual(['profile', 'businessTypes', 'products', 'skus', 'checkout'])
    expect(peekVendorContext('91')).toBeNull()
  })

  it('drops only the checkout settings and the context after a Step 7 save', async () => {
    vi.spyOn(vendorOnboardingService, 'saveCheckoutOptions').mockResolvedValue(undefined)
    await cacheEveryResource()
    renderAccount('APPROVED', 7)
    await screen.findByRole('button', { name: /Step 7,.*You are here/ })
    await waitFor(() => expect(peekVendorContext('91')).not.toBeNull())

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await screen.findByRole('button', { name: /Step 8,.*You are here/ })

    expect(cachedResources()).toEqual(['profile', 'businessTypes', 'categories', 'products', 'skus'])
    expect(peekVendorContext('91')).toBeNull()
  })
})

describe('submitting the store for review', () => {
  it('reads the submitted context back once and shares it with the dashboard', async () => {
    seedReadyAccount('Test Road')
    renderAccount('APPROVED', 10)
    await screen.findByRole('button', { name: /Step 10,.*You are here/ })
    // An unsubmitted Step 10 reads every account resource.
    await waitFor(() => expect(cachedResources()).toEqual(ALL_RESOURCES))
    const goLive = vi.spyOn(vendorOnboardingService, 'goLive').mockResolvedValue(undefined)
    const context = vi.mocked(vendorOnboardingService.getVendorContext)
    const readsBefore = context.mock.calls.length

    fireEvent.click(screen.getByRole('button', { name: 'Submit for review' }))
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Submit for review' }))
    await waitFor(() => expect(goLive).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(context.mock.calls.length).toBe(readsBefore + 1))
    // Go-live changes everything the account holds for the vendor but the platform business types.
    expect(cachedResources()).toEqual(['businessTypes'])

    // The dashboard's provider reads through the same cache, so opening it costs nothing.
    const shared = await loadVendorContext('91', vendorOnboardingService.getVendorContext)
    expect(shared.approvalStatus).toBe('APPROVED')
    expect(context.mock.calls.length).toBe(readsBefore + 1)
  })
})

describe('step messages', () => {
  const saveNote = (text: string) => {
    const note = screen.getByText(text)
    // In the footer beside Continue, not in the scrolling step a vendor may never scroll through.
    expect(document.getElementById('onboarding-form-scroll')!.contains(note)).toBe(false)
    return note
  }

  it('shows what saving a catalog step cannot undo beside Continue, only while it reaches the account', async () => {
    renderAccount('APPROVED', 7)
    fireEvent.click(await screen.findByRole('button', { name: /^Step 4,/ }))
    await screen.findByRole('button', { name: /Step 4,.*You are here/ })
    saveNote('Saved categories can’t be removed here.')

    fireEvent.click(screen.getByRole('button', { name: /^Step 5,/ }))
    await screen.findByRole('button', { name: /Step 5,.*You are here/ })
    saveNote('Saved products can only be made inactive.')

    act(() => useOnboardingStore.getState().updateDraft((draft) => ({ ...draft, catalogSource: 'sample' })))
    expect(screen.queryByText('Saved products can only be made inactive.')).toBeNull()
  })

  it('notes that store details are saved but not shown until approval', async () => {
    renderAccount('APPROVED', 9)
    await screen.findByRole('button', { name: /Step 9,.*You are here/ })
    saveNote('Saved now, but shown here only after approval.')
  })

  it('drops the store details note once the store is under review and Step 9 is read-only', async () => {
    renderAccount('PENDING')
    fireEvent.click(await screen.findByRole('button', { name: /^Step 9,/ }))
    await screen.findByRole('button', { name: /Step 9,.*You are here/ })
    expect(screen.queryByText('Saved now, but shown here only after approval.')).toBeNull()
  })

  it('carries the size limit on the usage line rather than a separate notice', async () => {
    renderAccount('APPROVED', 11, 1, 1)
    await openSizes()
    const usage = screen.getByText(/1 of 1 sizes used/)
    expect(usage.textContent).toContain('You’ve reached your plan’s limit, counting sizes already saved to your store.')
    expect(screen.queryByText(/You've reached your plan's limit of 1 sizes/)).toBeNull()
  })

  it('keeps step guidance in the description instead of a notice', async () => {
    renderAccount('APPROVED', 8)
    await screen.findByRole('button', { name: /Step 8,.*You are here/ })
    expect(screen.getByText('Choose how customers pay, and pick one default.')).toBeTruthy()
    expect(screen.queryByText('Choose accepted methods and one default.')).toBeNull()
  })
})

describe('per-step account reads', () => {
  it('lands on Step 7 reading only the context, the profile and checkout, and reads Step 4 on opening it', async () => {
    stubReferencePages()
    const checkout = deferred<null>()
    vi.spyOn(vendorOnboardingService, 'getCheckoutOptions').mockReturnValue(checkout.promise)
    renderAccount('APPROVED', 7)

    await screen.findByRole('button', { name: /Step 7,.*You are here/ })
    expect(stepSpinner()).toBeTruthy()
    expect(continueDisabled()).toBe(true)

    await act(async () => checkout.resolve(null))
    await waitFor(() => expect(stepSpinner()).toBeNull())
    expect(continueDisabled()).toBe(false)
    expect(accountReadCounts()).toEqual({ getVendorContext: 1, getVendorProfile: 1, getCheckoutOptions: 1 })

    act(() => useOnboardingStore.getState().goToStep(4))
    await waitFor(() => expect(stepSpinner()).toBeNull())
    expect(accountReadCounts()).toEqual({
      getVendorContext: 1, getVendorProfile: 1, getCheckoutOptions: 1, getBusinessTypes: 1, getVendorCategories: 1,
    })
  })

  describe('Step 4’s first category list', () => {
    const category = (id: number, name: string) => ({ id, businessTypeId: 7, name, description: null, icon: null, imageUrl: null, displayOrder: id })
    const listed = { ...EMPTY_PAGE, pageSize: ONBOARDING_CONFIG.categoryPageSize, totalPages: 1, totalElements: 1, items: [category(11, 'Smoothies')] }

    beforeEach(() => {
      // The reference cache is module-level; 48 other keys push an earlier test's categories out.
      for (let index = 0; index < 48; index++) writeReferenceCache(`test-filler:${index}`, EMPTY_PAGE, false)
    })

    it('reads the saved categories and the first list page at once, showing one spinner until both land', async () => {
      const saved = deferred<Awaited<ReturnType<typeof vendorOnboardingService.getVendorCategories>>>()
      const getVendorCategories = vi.spyOn(vendorOnboardingService, 'getVendorCategories').mockReturnValue(saved.promise)
      const list = deferred<Awaited<ReturnType<typeof vendorOnboardingService.getCategories>>>()
      const getCategories = vi.spyOn(vendorOnboardingService, 'getCategories').mockReturnValue(list.promise)
      renderAccount('PENDING', 4)

      await screen.findByRole('button', { name: /Step 4,.*You are here/ })
      expect(stepSpinner()).toBeTruthy()
      // The list's read starts while the saved categories are still being read.
      await waitFor(() => expect(getCategories).toHaveBeenCalledTimes(1))
      expect(getVendorCategories).toHaveBeenCalledTimes(1)
      expect(getCategories.mock.calls[0][0]).toMatchObject({ business_type_id: 7, pageNumber: 0, pageSize: ONBOARDING_CONFIG.categoryPageSize })

      await act(async () => saved.resolve([{ vendorCategoryId: 500, platformCategoryId: 10, name: 'Juices', imageUrl: null }]))
      expect(stepSpinner()).toBeTruthy()
      expect(screen.queryByLabelText('Search category')).toBeNull()
      expect(document.querySelector('[data-slot="skeleton"]')).toBeNull()

      await act(async () => list.resolve(listed))
      expect(await screen.findByRole('button', { name: /Juices/ })).toBeTruthy()
      expect(screen.getByRole('button', { name: /Smoothies/ })).toBeTruthy()
      expect(stepSpinner()).toBeNull()
      expect(screen.queryByRole('status', { name: 'Loading categories' })).toBeNull()
      expect(screen.getByLabelText('Search category')).toBeTruthy()
      await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)) })
      expect(getCategories).toHaveBeenCalledTimes(1)
    })

    it('opens the step when the list’s read fails, the step reading it once more and showing only the error until Try again', async () => {
      const getCategories = vi.spyOn(vendorOnboardingService, 'getCategories')
        .mockRejectedValueOnce(new Error('Categories are down'))
        .mockRejectedValueOnce(new Error('Categories are down'))
        .mockResolvedValueOnce(listed)
      renderAccount('PENDING', 4)

      expect(await screen.findByText('Something went wrong')).toBeTruthy()
      expect(screen.queryByText('Categories are down')).toBeNull()
      expect(stepSpinner()).toBeNull()
      expect(continueDisabled()).toBe(false)
      expect(screen.queryByRole('button', { name: /Smoothies/ })).toBeNull()
      // The step's read failed and cached nothing, so the step read the page itself.
      expect(getCategories).toHaveBeenCalledTimes(2)

      fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
      expect(await screen.findByRole('button', { name: /Smoothies/ })).toBeTruthy()
      expect(screen.getByRole('button', { name: /Juices/ })).toBeTruthy()
      expect(screen.queryByText('Something went wrong')).toBeNull()
      expect(getCategories).toHaveBeenCalledTimes(3)
    })
  })

  describe('Step 3’s business types', () => {
    const type = (id: number) => ({ id, name: `Type ${id}`, icon: null, displayOrder: id })

    beforeEach(() => {
      // The reference cache is module-level; 48 other keys push an earlier test's types out.
      for (let index = 0; index < 48; index++) writeReferenceCache(`test-filler:${index}`, EMPTY_PAGE, false)
    })

    it('reads the full list alongside the profile with no saved type, and the step makes no first-page request', async () => {
      const profile = deferred<Awaited<ReturnType<typeof vendorOnboardingService.getVendorProfile>>>()
      vi.spyOn(vendorOnboardingService, 'getVendorProfile').mockReturnValue(profile.promise)
      const getBusinessTypes = vi.spyOn(vendorOnboardingService, 'getBusinessTypes')
        .mockResolvedValueOnce({
          items: Array.from({ length: 12 }, (_, index) => type(index + 1)),
          pageNumber: 0, pageSize: 100, totalPages: 1, totalElements: 12, lastPage: true,
        })
        .mockResolvedValueOnce({ items: [type(10), type(11), type(12)], pageNumber: 1, pageSize: 9, totalPages: 2, totalElements: 12, lastPage: true })
        .mockResolvedValueOnce({ items: [type(5)], pageNumber: 0, pageSize: 9, totalPages: 1, totalElements: 1, lastPage: true })
      renderAccount('PENDING', 3)

      await screen.findByRole('button', { name: /Step 3,.*You are here/ })
      // Both start before the profile answers.
      await waitFor(() => expect(getBusinessTypes).toHaveBeenCalledTimes(1))
      expect(vendorOnboardingService.getVendorProfile).toHaveBeenCalledTimes(1)
      expect(getBusinessTypes.mock.calls[0][0]).toEqual({ pageNumber: 0, pageSize: 100, sortBy: 'id', sortOrder: 'ASC' })
      expect(stepSpinner()).toBeTruthy()

      await act(async () => profile.resolve({
        businessName: 'Test Store', businessType: 'Others', contactNumber: '',
      }))
      expect(await screen.findByRole('button', { name: /Type 9$/ })).toBeTruthy()
      expect(screen.queryByRole('button', { name: /Type 10$/ })).toBeNull()
      expect(stepSpinner()).toBeNull()
      await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)) })
      expect(getBusinessTypes).toHaveBeenCalledTimes(1)

      // Show more reads the step's own page 1 of nine.
      fireEvent.click(screen.getByRole('button', { name: 'Show more business types' }))
      expect(await screen.findByRole('button', { name: /Type 12$/ })).toBeTruthy()
      expect(getBusinessTypes.mock.calls[1][0]).toMatchObject({ pageNumber: 1, pageSize: 9 })

      fireEvent.change(screen.getByLabelText('Search business type'), { target: { value: 'type 5' } })
      fireEvent.submit(screen.getByRole('search'))
      await waitFor(() => expect(getBusinessTypes).toHaveBeenCalledTimes(3))
      expect(getBusinessTypes.mock.calls[2][0]).toMatchObject({ keyword: 'type 5', pageNumber: 0, pageSize: 9 })
      expect(await screen.findByRole('button', { name: /Type 5$/ })).toBeTruthy()
      expect(screen.queryByRole('button', { name: /Type 12$/ })).toBeNull()
    })
  })

  describe('Step 5’s default panel', () => {
    const reference = (id: number, name: string) => ({
      id, name, description: null, icon: null, imageUrl: null, measurementId: null, measurementName: 'COUNT',
    })
    const listed = { ...EMPTY_PAGE, totalPages: 1, totalElements: 1, items: [reference(32, 'Apple Juice')] }
    const panel = () => within(document.getElementById('category-products-10')!)

    beforeEach(() => {
      // The reference cache is module-level; 48 other keys push an earlier test's products out.
      for (let index = 0; index < 48; index++) writeReferenceCache(`test-filler:${index}`, EMPTY_PAGE, false)
    })

    it('reads the saved products and the panel’s first page at once, then paints both together', async () => {
      const saved = deferred<Awaited<ReturnType<typeof vendorOnboardingService.getVendorProducts>>>()
      const getVendorProducts = vi.spyOn(vendorOnboardingService, 'getVendorProducts').mockReturnValue(saved.promise)
      const list = deferred<Awaited<ReturnType<typeof vendorOnboardingService.getProductsByCategory>>>()
      const getProducts = vi.spyOn(vendorOnboardingService, 'getProductsByCategory').mockReturnValue(list.promise)
      renderAccount('PENDING', 5)

      await screen.findByRole('button', { name: /Step 5,.*You are here/ })
      expect(stepSpinner()).toBeTruthy()
      // The panel's read starts while the saved products are still being read.
      await waitFor(() => expect(getProducts).toHaveBeenCalledTimes(1))
      expect(getVendorProducts).toHaveBeenCalledTimes(1)
      expect(getProducts.mock.calls[0][0]).toBe(10)

      await act(async () => saved.resolve([
        { vendorProductId: 900, platformProductId: 31, platformCategoryId: 10, name: 'Test Juice', measurementId: 2 },
      ]))
      expect(stepSpinner()).toBeTruthy()
      expect(screen.queryByRole('button', { name: /Test Juice/ })).toBeNull()

      await act(async () => list.resolve(listed))
      expect(await screen.findByRole('button', { name: /Test Juice/ })).toBeTruthy()
      expect(screen.getByRole('button', { name: /Apple Juice/ })).toBeTruthy()
      expect(stepSpinner()).toBeNull()
      expect(panel().queryByRole('status', { name: 'Loading products' })).toBeNull()
      await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)) })
      expect(getProducts).toHaveBeenCalledTimes(1)
    })

    it('reads no products for a category picked on Step 4 and not saved, and shows no panel for it', async () => {
      const juices = { id: 10, name: 'Juices', imageUrl: null, businessTypeId: 7, description: null, displayOrder: null }
      const smoothies = { ...juices, id: 12, name: 'Smoothies' }
      const empty = createEmptyOnboardingDraft()
      useOnboardingStore.setState({
        draft: { ...empty, mobileVerified: true, categories: [smoothies, juices] },
        editedSteps: [4],
        fieldEdits: { categories: { at: Date.now(), saved: [juices] } },
        draftOwnerId: '91',
      })
      const getProducts = vi.spyOn(vendorOnboardingService, 'getProductsByCategory').mockResolvedValue(listed)
      renderAccount('PENDING', 5)

      expect(await screen.findByRole('button', { name: /Apple Juice/ })).toBeTruthy()
      await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)) })
      expect(useOnboardingStore.getState().draft.categories.map((category) => category.id)).toEqual([12, 10])
      expect(document.getElementById('category-products-12')).toBeNull()
      expect(getProducts.mock.calls.map((call) => call[0])).toEqual([10])
    })

    it('opens the step when the panel’s read fails, the panel showing only its error until a retry lists every product', async () => {
      const getProducts = vi.spyOn(vendorOnboardingService, 'getProductsByCategory')
        .mockRejectedValueOnce(new Error('Products are down'))
        .mockRejectedValueOnce(new Error('Products are down'))
        .mockResolvedValueOnce(listed)
      renderAccount('PENDING', 5)

      await screen.findByText('Something went wrong')
      expect(panel().getByText('Something went wrong')).toBeTruthy()
      expect(screen.queryByText('Products are down')).toBeNull()
      expect(stepSpinner()).toBeNull()
      expect(continueDisabled()).toBe(false)
      expect(screen.queryByRole('button', { name: /Test Juice/ })).toBeNull()
      expect(screen.queryByLabelText('Search in Juices')).toBeNull()
      // The step's read failed and cached nothing, so the panel read the page itself.
      expect(getProducts).toHaveBeenCalledTimes(2)

      fireEvent.click(panel().getByRole('button', { name: 'Try again' }))
      expect(await screen.findByRole('button', { name: /Apple Juice/ })).toBeTruthy()
      expect(screen.getByRole('button', { name: /Test Juice/ })).toBeTruthy()
      expect(getProducts).toHaveBeenCalledTimes(3)
    })
  })

  it('opens an approved store on Step 10 with the context and profile alone, and the phone preview', async () => {
    renderAccount('APPROVED')

    expect(await screen.findByRole('heading', { name: 'Put this on your counter' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 1, name: 'Your store' })).toBeTruthy()
    expect(screen.getByText('Share your store link.')).toBeTruthy()
    expect(accountReadCounts()).toEqual({ getVendorContext: 1, getVendorProfile: 1 })
    expect(document.querySelector('.onboarding-preview-stage')).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Your shop' })).toBeTruthy()
  })

  it('opens a pending store on Step 10 with the context and profile alone, and the phone preview', async () => {
    renderAccount('PENDING')

    expect(await screen.findByRole('heading', { name: 'Under review' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 1, name: 'Your store' })).toBeTruthy()
    expect(screen.getByText('Submitted for review. You can still add categories and products.')).toBeTruthy()
    expect(accountReadCounts()).toEqual({ getVendorContext: 1, getVendorProfile: 1 })
    expect(document.querySelector('.onboarding-preview-stage')).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Your shop' })).toBeTruthy()
  })

  it('fills a submitted Step 10 phone preview from the context catalog summary, without reading the catalog', async () => {
    renderAccount('APPROVED', 11, 2, 1, false, {
      categories: [{ id: 10, name: 'Fresh Juices' }],
      products: [{ id: 31, name: 'Mango Juice', category_id: 10, image_url: null, price: 60 }],
      active_sku_count: 4,
    })

    expect(await screen.findByRole('heading', { name: 'Put this on your counter' })).toBeTruthy()
    const stage = document.querySelector<HTMLElement>('.onboarding-preview-stage:not([role])')!
    const count = (label: string) => within(stage).getByText(label).previousElementSibling?.textContent
    expect(count('Categories')).toBe('1')
    expect(count('Products')).toBe('1')
    expect(count('Sizes')).toBe('4')
    expect(within(stage).getByText('Fresh Juices')).toBeTruthy()
    expect(within(stage).getByText('Mango Juice')).toBeTruthy()
    expect(within(stage).getByText('₹60')).toBeTruthy()
    expect(accountReadCounts()).toEqual({ getVendorContext: 1, getVendorProfile: 1 })
    expect(useOnboardingStore.getState().draft.categories).toEqual([])
  })

  it('still shows a submitted store its status when the profile read fails', async () => {
    vi.spyOn(vendorOnboardingService, 'getVendorProfile').mockRejectedValue(new Error('down'))
    renderAccount('APPROVED')

    expect(await screen.findByRole('heading', { name: 'Put this on your counter' })).toBeTruthy()
    expect(screen.queryByText('Something went wrong')).toBeNull()
    // Nothing named the store, so the status names it by its fallback, 'your shop'. That name
    // is only rendered in the QR image's alt text, and jsdom has no canvas to draw the QR.
    const { draft } = useOnboardingStore.getState()
    expect(draft.storefront.storeName).toBe('')
    expect(draft.business.businessName).toBe('')
  })

  it('blocks a step whose read failed until Try again reads that resource alone', async () => {
    vi.spyOn(vendorOnboardingService, 'getCheckoutOptions').mockRejectedValueOnce(new Error('down'))
    renderAccount('APPROVED', 7)

    expect(await screen.findByText('Something went wrong')).toBeTruthy()
    expect(continueDisabled()).toBe(true)
    expect(screen.getByRole('button', { name: 'Back' }).matches(':disabled')).toBe(false)
    expect(screen.getByRole('button', { name: /^Step 6,/ }).matches(':disabled')).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(screen.queryByText('Something went wrong')).toBeNull())
    await waitFor(() => expect(continueDisabled()).toBe(false))
    expect(accountReadCounts()).toEqual({ getVendorContext: 1, getVendorProfile: 1, getCheckoutOptions: 2 })
  })

  it('reads neither the profile again nor business types while the profile read has failed', async () => {
    vi.spyOn(vendorOnboardingService, 'getVendorProfile').mockRejectedValueOnce(new Error('down'))
    renderAccount('APPROVED', 3)

    expect(await screen.findByText('Something went wrong')).toBeTruthy()
    await act(async () => {})
    expect(accountReadCounts()).toEqual({ getVendorContext: 1, getVendorProfile: 1 })

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(continueDisabled()).toBe(false))
    expect(accountReadCounts()).toEqual({ getVendorContext: 1, getVendorProfile: 2, getBusinessTypes: 1 })
  })

  it('keeps an edit made while its step’s read was in flight', async () => {
    const products = deferred<Awaited<ReturnType<typeof vendorOnboardingService.getVendorProducts>>>()
    vi.spyOn(vendorOnboardingService, 'getVendorProducts').mockReturnValue(products.promise)
    stubReferencePages()
    renderAccount('APPROVED', 5)
    await screen.findByRole('button', { name: /Step 5,.*You are here/ })
    const local = {
      id: 77, name: 'Local Juice', description: null, imageUrl: null,
      measurementId: null, measurementName: null, categoryId: 10,
    }
    act(() => useOnboardingStore.getState().updateDraft((draft) => ({ ...draft, products: [local] }), 5))

    await act(async () => products.resolve([
      { vendorProductId: 900, platformProductId: 31, platformCategoryId: 10, name: 'Test Juice', measurementId: 2 },
    ]))

    await waitFor(() => expect(useOnboardingStore.getState().accountCatalog.productIds).toEqual([31]))
    // The edit stays, and the account's saved product joins it: assigned products are never dropped.
    expect(useOnboardingStore.getState().draft.products.map((product) => product.id)).toEqual([77, 31])
    expect(useOnboardingStore.getState().draft.products[0]).toEqual(local)
    expect(useOnboardingStore.getState().editedSteps).toContain(5)
  })

  it('applies a read that lands after the vendor moved on, without disturbing the new step', async () => {
    const products = deferred<Awaited<ReturnType<typeof vendorOnboardingService.getVendorProducts>>>()
    vi.spyOn(vendorOnboardingService, 'getVendorProducts').mockReturnValue(products.promise)
    stubReferencePages()
    renderAccount('APPROVED', 5)
    await screen.findByRole('button', { name: /Step 5,.*You are here/ })
    act(() => useOnboardingStore.getState().goToStep(4))
    await waitFor(() => expect(stepSpinner()).toBeNull())

    await act(async () => products.resolve([
      { vendorProductId: 900, platformProductId: 31, platformCategoryId: 10, name: 'Test Juice', measurementId: 2 },
    ]))

    expect(useOnboardingStore.getState().draft.products.map((product) => product.id)).toEqual([31])
    expect(useOnboardingStore.getState().draft.currentStep).toBe(4)
    expect(stepSpinner()).toBeNull()
    expect(continueDisabled('Save changes')).toBe(false)
  })

  it('drops a read that lands after the wizard has gone', async () => {
    const products = deferred<Awaited<ReturnType<typeof vendorOnboardingService.getVendorProducts>>>()
    vi.spyOn(vendorOnboardingService, 'getVendorProducts').mockReturnValue(products.promise)
    stubReferencePages()
    renderAccount('APPROVED', 5)
    await screen.findByRole('button', { name: /Step 5,.*You are here/ })
    cleanup()

    await act(async () => products.resolve([
      { vendorProductId: 900, platformProductId: 31, platformCategoryId: 10, name: 'Test Juice', measurementId: 2 },
    ]))

    expect(useOnboardingStore.getState().draft.products).toEqual([])
    expect(useOnboardingStore.getState().accountCatalog.productIds).toEqual([])
  })

  it('opens Step 6 on sample units when the units read fails', async () => {
    vi.spyOn(vendorOnboardingService, 'getMeasurements').mockRejectedValue(new Error('down'))
    renderAccount('APPROVED', 6)

    expect(await screen.findByRole('button', { name: 'Add another size to Test Juice' })).toBeTruthy()
    expect(screen.queryByText('Something went wrong')).toBeNull()
    const state = useOnboardingStore.getState()
    expect(state.measurementCatalog).toBe(SAMPLE_MEASUREMENT_CATALOG)
    expect(state.productMeasurementCatalog).toEqual([])
    expect(state.draft.skus.map((sku) => sku.id)).toEqual(['sku-4001'])
  })

  it('applies the account sizes to Step 6 after an upstream edit, so its Continue deletes none', async () => {
    stubReferencePages()
    renderAccount('APPROVED', 5)
    await screen.findByRole('button', { name: /Step 5,.*You are here/ })
    await waitFor(() => expect(useOnboardingStore.getState().loadedSteps).toEqual([3, 4, 5]))

    // Back on Step 4, a category change rewrites the never-loaded sizes section.
    act(() => {
      useOnboardingStore.getState().goToStep(4)
      useOnboardingStore.getState().updateDraft((draft) => ({ ...draft, skus: [] }), 4)
      useOnboardingStore.setState({ furthestVisitedStep: 6 })
      useOnboardingStore.getState().goToStep(6)
    })

    await waitFor(() => expect(useOnboardingStore.getState().draft.skus.map((sku) => sku.id)).toEqual(['sku-4001']))
    expect(useOnboardingStore.getState().editedSteps).not.toContain(6)
    await waitFor(() => expect(continueDisabled()).toBe(false))
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await screen.findByRole('button', { name: /Step 7,.*You are here/ })
    expect(vendorOnboardingService.deleteSku).not.toHaveBeenCalled()
  })

  it('blocks every step while the context is unread, and Try again reads it and the step', async () => {
    vi.spyOn(vendorOnboardingService, 'getVendorContext').mockRejectedValueOnce(new Error('Context is down'))
    renderAccount('APPROVED', 7)

    expect(await screen.findByText('Context is down')).toBeTruthy()
    expect(screen.getByText('Something went wrong')).toBeTruthy()
    expect(continueDisabled()).toBe(true)
    expect(vendorOnboardingService.getCheckoutOptions).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await screen.findByRole('button', { name: /Step 7,.*You are here/ })
    await waitFor(() => expect(continueDisabled()).toBe(false))
    expect(screen.queryByText('Context is down')).toBeNull()
    expect(accountReadCounts()).toEqual({ getVendorContext: 2, getVendorProfile: 1, getCheckoutOptions: 1 })
  })

  it('without a resume pointer, holds Step 10 on a failed read and derives the step once it succeeds', async () => {
    vi.spyOn(vendorOnboardingService, 'getVendorSkus').mockRejectedValueOnce(new Error('down'))
    vi.spyOn(vendorOnboardingService, 'getVendorContext').mockResolvedValue(mapVendorContext({
      data: {
        vendor_id: 91, vendor_status: 'SETTING_UP', approval_status: 'PENDING',
        onboarding: { status: 'IN_PROGRESS', next_step: null },
      },
    }))
    render(<MemoryRouter><OnboardingWizard /></MemoryRouter>)

    expect(await screen.findByText('Something went wrong')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Step 10,.*You are here/ })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    // Saved sizes but no checkout yet: delivery is the first unfinished step.
    expect(await screen.findByRole('button', { name: /Step 7,.*You are here/ })).toBeTruthy()
  })
})

describe('Continue prefetches the next step’s account reads', () => {
  async function openAt(step: OnboardingStep, approvalStatus = 'PENDING', action = 'Continue') {
    stubReferencePages()
    renderAccount(approvalStatus, step)
    await screen.findByRole('button', { name: new RegExp(`Step ${step},.*You are here`) })
    await waitFor(() => expect(stepSpinner()).toBeNull())
    await waitFor(() => expect(continueDisabled(action)).toBe(false))
  }

  it('reads Step 4’s categories while the Step 3 save is in flight, and Step 4 reuses them', async () => {
    const save = deferred<undefined>()
    vi.spyOn(vendorOnboardingService, 'saveBusinessType').mockReturnValue(save.promise)
    await openAt(3)
    const categories = vi.mocked(vendorOnboardingService.getVendorCategories)
    expect(categories).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await waitFor(() => expect(categories).toHaveBeenCalledTimes(1))
    expect(vendorOnboardingService.saveBusinessType).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Continue' }).getAttribute('aria-busy')).toBe('true')

    await act(async () => save.resolve(undefined))
    await screen.findByRole('button', { name: /Step 4,.*You are here/ })
    await waitFor(() => expect(stepSpinner()).toBeNull())
    expect(categories).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Continue' }).hasAttribute('aria-busy')).toBe(false)
  })

  it('reads Step 5’s products but not the units on Continue; Step 5 reads the units when it opens', async () => {
    const save = deferred<undefined>()
    vi.spyOn(vendorOnboardingService, 'saveCategories').mockReturnValue(save.promise)
    await openAt(4)
    act(() => useOnboardingStore.getState().updateDraft((draft) => ({
      ...draft,
      categories: [...draft.categories, { id: 11, name: 'Smoothies', businessTypeId: 7, description: null, imageUrl: null, displayOrder: 2 }],
    }), 4))
    const products = vi.mocked(vendorOnboardingService.getVendorProducts)
    const measurements = vi.mocked(vendorOnboardingService.getMeasurements)
    expect(products).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await waitFor(() => expect(vendorOnboardingService.saveCategories).toHaveBeenCalledTimes(1))
    expect(products).toHaveBeenCalledTimes(1)
    expect(measurements).not.toHaveBeenCalled()

    await act(async () => save.resolve(undefined))
    await screen.findByRole('button', { name: /Step 5,.*You are here/ })
    await waitFor(() => expect(stepSpinner()).toBeNull())
    expect(products).toHaveBeenCalledTimes(1)
    expect(measurements).toHaveBeenCalledTimes(1)
  })

  it('reads only what Step 10 still lacks on Continue from Step 9, and no units until it opens', async () => {
    const save = deferred<undefined>()
    vi.spyOn(vendorOnboardingService, 'saveStorefront').mockReturnValue(save.promise)
    vi.spyOn(vendorOnboardingService, 'saveBusinessType').mockResolvedValue(undefined)
    await openAt(9, 'PENDING', 'Review readiness')
    expect(accountReadCounts()).toEqual({ getVendorContext: 1, getVendorProfile: 1, getBusinessTypes: 1 })
    act(() => {
      useOnboardingStore.getState().updateDraft((draft) => ({
        ...draft, storefront: { ...draft.storefront, businessLocation: 'Test Market' },
      }), 9)
      useOnboardingStore.getState().updateRuntime({ orderWhatsapp: '9876543210' })
    })

    fireEvent.click(screen.getByRole('button', { name: 'Review readiness' }))
    await waitFor(() => expect(vendorOnboardingService.saveStorefront).toHaveBeenCalledTimes(1))
    expect(accountReadCounts()).toEqual({
      getVendorContext: 1, getVendorProfile: 1, getBusinessTypes: 1,
      getVendorCategories: 1, getVendorProducts: 1, getVendorSkus: 1, getCheckoutOptions: 1,
    })

    await act(async () => save.resolve(undefined))
    await screen.findByRole('button', { name: /Step 10,.*You are here/ })
    await waitFor(() => expect(vendorOnboardingService.getMeasurements).toHaveBeenCalledTimes(1))
    expect(accountReadCounts()).toMatchObject({
      getVendorProfile: 1, getBusinessTypes: 1,
      getVendorCategories: 1, getVendorProducts: 1, getVendorSkus: 1, getCheckoutOptions: 1,
    })
  })

  it('reads Step 7’s checkout settings while a setup store’s Step 6 save is in flight, then moves on', async () => {
    const save = deferred<undefined>()
    vi.mocked(vendorOnboardingService.updateSkuPrice).mockReturnValue(save.promise)
    await openAt(6)
    fireEvent.change(within(screen.getByRole('group', { name: 'Test Juice, 1 L size' })).getByLabelText('MRP (₹)'), { target: { value: '110' } })
    const checkout = vi.mocked(vendorOnboardingService.getCheckoutOptions)
    expect(checkout).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await waitFor(() => expect(vendorOnboardingService.updateSkuPrice).toHaveBeenCalledTimes(1))
    expect(checkout).toHaveBeenCalledTimes(1)

    await act(async () => save.resolve(undefined))
    await screen.findByRole('button', { name: /Step 7,.*You are here/ })
    expect(document.querySelector('[data-slot="toast"]:not([data-ending-style])')?.textContent ?? '').not.toContain('Changes saved.')
  })

  it('reads nothing on Continue from Step 7, whose checkout settings Step 8 already has', async () => {
    vi.spyOn(vendorOnboardingService, 'saveCheckoutOptions').mockResolvedValue(undefined)
    await openAt(7, 'APPROVED')
    const before = accountReadCounts()

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await screen.findByRole('button', { name: /Step 8,.*You are here/ })
    await waitFor(() => expect(stepSpinner()).toBeNull())
    expect(accountReadCounts()).toEqual(before)
  })

  it('keeps a failed prefetch off the current step; the next step reads again and shows its own failure', async () => {
    const save = deferred<undefined>()
    vi.spyOn(vendorOnboardingService, 'saveBusinessType').mockReturnValue(save.promise)
    const categories = vi.spyOn(vendorOnboardingService, 'getVendorCategories').mockRejectedValue(new Error('down'))
    await openAt(3)

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await waitFor(() => expect(categories).toHaveBeenCalledTimes(1))
    await act(async () => { await Promise.resolve() })
    expect(screen.queryByText('Something went wrong')).toBeNull()

    await act(async () => save.resolve(undefined))
    await screen.findByRole('button', { name: /Step 4,.*You are here/ })
    expect(await screen.findByText('Something went wrong')).toBeTruthy()
    expect(categories).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
  })
})

describe('catalog saves reuse this visit’s account reads', () => {
  const smoothies = { id: 11, name: 'Smoothies', businessTypeId: 7, description: null, imageUrl: null, displayOrder: 2 }
  const lemonade = { id: 32, name: 'Lemonade', description: null, imageUrl: null, measurementId: 2, measurementName: null, categoryId: 10 }

  async function openAt(step: OnboardingStep) {
    stubReferencePages()
    renderAccount('PENDING', step)
    await screen.findByRole('button', { name: new RegExp(`Step ${step},.*You are here`) })
    await waitFor(() => expect(stepSpinner()).toBeNull())
    await waitFor(() => expect(continueDisabled()).toBe(false))
  }
  const addCategory = () => act(() => useOnboardingStore.getState().updateDraft((draft) => ({
    ...draft, categories: [...draft.categories, smoothies],
  }), 4))
  const addProduct = () => act(() => useOnboardingStore.getState().updateDraft((draft) => ({
    ...draft, products: [...draft.products, lemonade],
  }), 5))

  it('assigns a new category against the categories Step 4 already read', async () => {
    const save = vi.spyOn(vendorOnboardingService, 'saveCategories').mockResolvedValue(undefined)
    await openAt(4)
    addCategory()

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await screen.findByRole('button', { name: /Step 5,.*You are here/ })

    expect(save).toHaveBeenCalledWith('91', [11])
    expect(vendorOnboardingService.getVendorCategories).toHaveBeenCalledTimes(1)
  })

  it('assigns a new product against the products Step 5 already read', async () => {
    const assign = vi.spyOn(vendorOnboardingService, 'assignProducts').mockResolvedValue(undefined)
    await openAt(5)
    addProduct()

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await screen.findByRole('button', { name: /Step 6,.*You are here/ })

    expect(assign).toHaveBeenCalledWith('91', 10, [32])
    expect(vendorOnboardingService.getVendorProducts).toHaveBeenCalledTimes(1)
  })

  it('assigns against the re-check’s read after an away, reading nothing more itself', async () => {
    const save = vi.spyOn(vendorOnboardingService, 'saveCategories').mockResolvedValue(undefined)
    await openAt(4)
    addCategory()
    // Another device assigned category 11 meanwhile: nothing is left to send.
    vi.mocked(vendorOnboardingService.getVendorCategories).mockResolvedValue([
      { vendorCategoryId: 500, platformCategoryId: 10, name: 'Juices', imageUrl: null },
      { vendorCategoryId: 501, platformCategoryId: 11, name: 'Smoothies', imageUrl: null },
    ])

    act(() => hideAndShowTab())
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await screen.findByRole('button', { name: /Step 5,.*You are here/ })

    expect(save).not.toHaveBeenCalled()
    expect(vendorOnboardingService.getVendorCategories).toHaveBeenCalledTimes(2)
  })

  it('reads the account again when retrying a failed category save, which may have landed', async () => {
    const save = vi.spyOn(vendorOnboardingService, 'saveCategories').mockRejectedValueOnce(new Error('Network Error'))
    await openAt(4)
    addCategory()
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(await screen.findAllByText('Network Error')).not.toHaveLength(0)
    expect(vendorOnboardingService.getVendorCategories).toHaveBeenCalledTimes(1)

    // It had landed after all.
    vi.mocked(vendorOnboardingService.getVendorCategories).mockResolvedValue([
      { vendorCategoryId: 500, platformCategoryId: 10, name: 'Juices', imageUrl: null },
      { vendorCategoryId: 501, platformCategoryId: 11, name: 'Smoothies', imageUrl: null },
    ])
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await screen.findByRole('button', { name: /Step 5,.*You are here/ })

    expect(save).toHaveBeenCalledTimes(1)
    expect(vendorOnboardingService.getVendorCategories).toHaveBeenCalledTimes(2)
  })
})

describe('wizard logo and banner', () => {
  async function openBranding(nextStep = 9) {
    renderAccount('PENDING', nextStep)
    if (nextStep !== 9) fireEvent.click(await screen.findByRole('button', { name: /^Step 9,/ }))
    await screen.findByRole('button', { name: /Step 9,.*You are here/ })
    await waitFor(() => expect(stepSpinner()).toBeNull())
  }

  function prepareStore() {
    act(() => {
      useOnboardingStore.getState().updateDraft((draft) => ({
        ...draft, storefront: { ...draft.storefront, businessLocation: 'Test Market' },
      }), 9)
      useOnboardingStore.getState().updateRuntime({ orderWhatsapp: '9876543210' })
    })
  }

  it('retries only the failed image while keeping the other preview and Continue available', async () => {
    vi.mocked(vendorImagesService.getImage).mockRejectedValueOnce(new Error('Images unavailable'))
      .mockResolvedValueOnce('https://images.example.test/banner.png')
      .mockResolvedValueOnce('https://images.example.test/logo.png')
    await openBranding(10)
    await screen.findByRole('button', { name: 'Retry logo' })
    // Opened from Step 10, so saving returns there.
    expect(continueDisabled('Save changes')).toBe(false)
    expect(screen.getByRole('button', { name: 'Choose logo image' }).matches(':disabled')).toBe(false)
    expect(screen.getByAltText('Banner upload preview').getAttribute('src')).toBe('https://images.example.test/banner.png')
    fireEvent.click(screen.getByRole('button', { name: 'Retry logo' }))
    await screen.findByAltText('Logo upload preview')
    expect(useOnboardingStore.getState().runtime.savedLogoUrl).toBe('https://images.example.test/logo.png')
    expect(continueDisabled('Save changes')).toBe(false)
    expect(vi.mocked(vendorImagesService.getImage).mock.calls.map(([, kind]) => kind)).toEqual(['logo', 'banner', 'logo'])
  })

  it.each(['logo', 'banner'] as const)('opens the file picker from the %s box and its upload/replace button, without opening it on remove', async (kind) => {
    vi.stubGlobal('URL', class extends URL { static createObjectURL = vi.fn(() => 'blob:replacement'); static revokeObjectURL = vi.fn() })
    await openBranding()
    const input = document.getElementById(`store-${kind}-file`)!
    const pick = vi.spyOn(input, 'click')
    fireEvent.click(screen.getByRole('button', { name: `Choose ${kind} image` }))
    expect(pick).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: `Upload ${kind}` }))
    expect(pick).toHaveBeenCalledTimes(2)
    fireEvent.change(input, { target: { files: [new File(['gif'], `${kind}.gif`, { type: 'image/gif' })] } })
    fireEvent.click(screen.getByAltText(kind === 'logo' ? 'Logo upload preview' : 'Banner upload preview'))
    expect(pick).toHaveBeenCalledTimes(3)
    fireEvent.click(screen.getByRole('button', { name: `Replace ${kind}` }))
    expect(pick).toHaveBeenCalledTimes(4)
    fireEvent.click(screen.getByRole('button', { name: `Remove ${kind} selection` }))
    expect(pick).toHaveBeenCalledTimes(4)
    expect(useOnboardingStore.getState().runtime[`${kind}File`]).toBeNull()
    expect(screen.getByRole('button', { name: `Upload ${kind}` })).toBeTruthy()
    await waitFor(() => expect(document.activeElement).toBe(document.getElementById(`store-${kind}-file-button`)))
  })

  it.each(['logo', 'banner'] as const)('retains a valid %s preview on invalid selection and removes its pending replacement back to the saved image', async (kind) => {
    vi.stubGlobal('URL', class extends URL { static createObjectURL = vi.fn(() => 'blob:replacement'); static revokeObjectURL = vi.fn() })
    vi.mocked(vendorImagesService.getImage).mockResolvedValue('https://images.example.test/saved.png')
    const upload = vi.spyOn(vendorImagesService, 'uploadImage').mockRejectedValue(new Error('Do not upload on selection'))
    await openBranding(10)
    const input = document.getElementById(`store-${kind}-file`)!
    const previewLabel = kind === 'logo' ? 'Logo upload preview' : 'Banner upload preview'
    const valid = new File(['gif'], `${kind}.gif`, { type: 'image/gif' })
    fireEvent.change(input, { target: { files: [valid] } })
    expect(useOnboardingStore.getState().runtime[`${kind}File`]).toBe(valid)
    fireEvent.change(input, { target: { files: [new File(['webp'], 'logo.webp', { type: 'image/webp' })] } })
    expect(document.getElementById(`store-${kind}-file-error`)?.textContent).toContain('PNG, JPEG, or GIF')
    expect(useOnboardingStore.getState().runtime[`${kind}File`]).toBe(valid)
    expect(screen.getByAltText(previewLabel).getAttribute('src')).toBe('blob:replacement')
    expect(screen.queryByRole('button', { name: `Discard ${kind} selection` })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: `Remove ${kind} selection` }))
    expect(document.getElementById(`store-${kind}-file-error`)).toBeNull()
    expect(screen.getByAltText(previewLabel).getAttribute('src')).toBe('https://images.example.test/saved.png')
    await waitFor(() => expect(document.activeElement).toBe(document.getElementById(`store-${kind}-file-button`)))
    expect(upload).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: `Remove ${kind} selection` })).toBeNull()
  })

  it('stays on Step 9 after a partial upload failure, then retries only the failed image on Continue', async () => {
    vi.stubGlobal('URL', class extends URL { static createObjectURL = vi.fn((file: File) => `blob:${file.name}`); static revokeObjectURL = vi.fn() })
    const upload = vi.spyOn(vendorImagesService, 'uploadImage')
      .mockResolvedValueOnce('https://images.example.test/logo.png')
      .mockRejectedValueOnce(new Error('Banner upload failed'))
      .mockResolvedValueOnce('https://images.example.test/banner.gif')
    const storefrontSave = vi.spyOn(vendorOnboardingService, 'saveStorefront').mockResolvedValue(undefined)
    vi.spyOn(vendorOnboardingService, 'saveBusinessType').mockResolvedValue(undefined)
    await openBranding()
    prepareStore()
    fireEvent.change(document.getElementById('store-logo-file')!, { target: { files: [new File(['png'], 'logo.png', { type: 'image/png' })] } })
    fireEvent.change(document.getElementById('store-banner-file')!, { target: { files: [new File(['gif'], 'banner.gif', { type: 'image/gif' })] } })
    expect(upload).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Review readiness' }))
    await waitFor(() => expect(document.getElementById('store-banner-file-error')?.textContent).toContain('Banner upload failed'))
    expect(useOnboardingStore.getState().draft.currentStep).toBe(9)
    expect(useOnboardingStore.getState().runtime.logoFile).toBeNull()
    expect(storefrontSave).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Review readiness' }))
    await waitFor(() => expect(useOnboardingStore.getState().draft.currentStep).toBe(10))
    expect(upload.mock.calls.map(([, kind]) => kind)).toEqual(['logo', 'banner', 'banner'])
    expect(storefrontSave).toHaveBeenCalledWith('91', expect.objectContaining({
      uploadedLogoUrl: 'https://images.example.test/logo.png', uploadedBannerUrl: 'https://images.example.test/banner.gif',
    }))
  })

  it('ignores a saved-image response after sign-out', async () => {
    const images = deferred<string | null>()
    vi.mocked(vendorImagesService.getImage).mockReturnValue(images.promise)
    renderAccount('PENDING', 10)
    await waitFor(() => expect(vendorImagesService.getImage).toHaveBeenCalled())
    act(() => useAuthStore.getState().clearSession())
    await act(async () => images.resolve('https://images.example.test/previous-vendor.png'))
    expect(useOnboardingStore.getState().runtime.logoUrl).toBeNull()
    expect(screen.queryByAltText('Logo upload preview')).toBeNull()
  })
})

describe('approved Step 9 editing', () => {
  async function openApprovedBranding() {
    renderAccount('APPROVED')
    fireEvent.click(await screen.findByRole('button', { name: /^Step 9,/ }))
    return screen.findByLabelText('Store name')
  }

  it('unlocks store details and image replacement for an active completed approved store', async () => {
    vi.mocked(vendorImagesService.getImage).mockImplementation(async (_vendorId, kind) => `https://images.example.test/saved-${kind}.png`)
    const name = await openApprovedBranding()
    expect(name.matches(':disabled')).toBe(false)
    expect(screen.getByRole('button', { name: 'Replace logo image' }).matches(':disabled')).toBe(false)
    expect(screen.getByAltText('Logo upload preview').getAttribute('src')).toBe('https://images.example.test/saved-logo.png')
    expect(screen.getByAltText('Banner upload preview').getAttribute('src')).toBe('https://images.example.test/saved-banner.png')
    expect(vendorImagesService.getImage).toHaveBeenCalledWith('91', 'logo')
    expect(vendorImagesService.getImage).toHaveBeenCalledWith('91', 'banner')
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeTruthy()
  })

  it('restores saved branding and both WhatsApp numbers before enabling a full save', async () => {
    await openApprovedBranding()
    const state = useOnboardingStore.getState()
    expect(state.draft.storefront).toMatchObject({
      storeName: 'Test Store', tagline: 'Existing tagline', businessLocation: 'Test City',
      instagram: 'teststore', welcomeMessage: 'Welcome back', announcementBar: 'Saved announcement',
      primaryColor: '#123456', cardStyle: 'BORDER', buttonShape: 'SQUARE', heroBadges: [], trustStrip: [],
    })
    expect(state.runtime).toMatchObject({ orderWhatsapp: '9876543210', supportWhatsapp: '9000000001' })
    expect(screen.getByLabelText('Order WhatsApp').getAttribute('value')).toBe('9876543210')
  })

  it('saves the store name and an original image in place without changing approval or resubmitting', async () => {
    vi.stubGlobal('URL', class extends URL { static createObjectURL = vi.fn(() => 'blob:replacement'); static revokeObjectURL = vi.fn() })
    const save = vi.spyOn(vendorOnboardingService, 'saveStorefront').mockResolvedValue(undefined)
    const initialDetails = vi.spyOn(vendorOnboardingService, 'saveBusinessType').mockRejectedValue(new Error('Must not reset onboarding'))
    const submit = vi.spyOn(vendorOnboardingService, 'goLive').mockRejectedValue(new Error('Must not resubmit'))
    const upload = vi.spyOn(vendorImagesService, 'uploadImage').mockResolvedValue('https://images.example.test/replacement.png')
    await openApprovedBranding()
    const submission = useOnboardingStore.getState().storeSubmission
    fireEvent.change(screen.getByLabelText('Store name'), { target: { value: 'Updated Store' } })
    const file = new File(['original'], 'replacement.png', { type: 'image/png' })
    fireEvent.change(document.getElementById('store-logo-file')!, { target: { files: [file] } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await screen.findByText('Changes saved.')
    expect(useOnboardingStore.getState().draft.currentStep).toBe(9)
    expect(useOnboardingStore.getState().storeSubmission).toEqual(submission)
    expect(save).toHaveBeenCalledWith('91', expect.objectContaining({
      tagline: 'Existing tagline', welcomeMessage: 'Welcome back', heroBadges: [], trustStrip: [],
      supportWhatsapp: '9000000001', uploadedLogoUrl: 'https://images.example.test/replacement.png',
      theme: expect.objectContaining({ primaryColor: '#123456', cardStyle: 'BORDER' }),
    }))
    expect(vendorOnboardingService.saveStoreProfile).toHaveBeenCalledWith('91', { businessName: 'Updated Store' })
    expect(upload).toHaveBeenCalledWith('91', 'logo', file, expect.anything())
    expect(initialDetails).not.toHaveBeenCalled()
    expect(submit).not.toHaveBeenCalled()
    expect(vendorOnboardingService.getVendorContext).toHaveBeenCalledTimes(1)
    expect(peekOnboardingResource('91', 'storefront')).toBeNull()
    expect(useOnboardingStore.getState().runtime.logoFile).toBeNull()
  })

  it('does not write unchanged settings and validates edited Step 9 fields', async () => {
    const save = vi.spyOn(vendorOnboardingService, 'saveStorefront').mockResolvedValue(undefined)
    await openApprovedBranding()
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await screen.findByText('Changes saved.')
    expect(save).not.toHaveBeenCalled()
    expect(vendorOnboardingService.saveStoreProfile).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Store name'), { target: { value: 'X' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await screen.findAllByText(/characters for the store name\./)
    expect(save).not.toHaveBeenCalled()
    expect(useOnboardingStore.getState().draft.currentStep).toBe(9)
  })

  it('keeps defaults out of an active store when the saved settings read fails, then retries', async () => {
    vi.mocked(vendorOnboardingService.getStorefrontSettings).mockRejectedValueOnce(new Error('unavailable'))
    renderAccount('APPROVED')
    fireEvent.click(await screen.findByRole('button', { name: /^Step 9,/ }))
    await screen.findByText('Could not load your saved store settings. Retry before making changes.')
    expect(screen.queryByLabelText('Store name')).toBeNull()
    expect(continueDisabled('Save changes')).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect((await screen.findByLabelText('Store name')).getAttribute('value')).toBe('Test Store')
    expect(vendorOnboardingService.getStorefrontSettings).toHaveBeenCalledTimes(2)
  })

  it('applies saved branding after a slower profile read, so profile defaults cannot overwrite it', async () => {
    const profile = deferred<Awaited<ReturnType<typeof vendorOnboardingService.getVendorProfile>>>()
    vi.mocked(vendorOnboardingService.getVendorProfile).mockReturnValue(profile.promise)
    renderAccount('APPROVED')
    fireEvent.click(await screen.findByRole('button', { name: /^Step 9,/ }))
    await waitFor(() => expect(vendorOnboardingService.getStorefrontSettings).toHaveBeenCalledTimes(1))
    expect(screen.queryByLabelText('Store name')).toBeNull()
    await act(async () => profile.resolve({
      businessName: 'Profile name', businessType: 'Beverages', contactNumber: '9000000002',
    }))
    expect((await screen.findByLabelText('Store name')).getAttribute('value')).toBe('Test Store')
    expect(useOnboardingStore.getState().runtime.orderWhatsapp).toBe('9876543210')
    expect(useOnboardingStore.getState().draft.storefront.tagline).toBe('Existing tagline')
  })

  it('restores the saved edit after re-entering the wizard instead of using the pre-save cache', async () => {
    let settings = savedSettings()
    vi.mocked(vendorOnboardingService.getStorefrontSettings).mockImplementation(async () => settings)
    vi.spyOn(vendorOnboardingService, 'saveStorefront').mockImplementation(async (_id, input) => { settings = input })
    await openApprovedBranding()
    fireEvent.change(screen.getByLabelText(/^Tagline/), { target: { value: 'Updated tagline' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await screen.findByText('Changes saved.')
    cleanup()
    renderAccount('APPROVED')
    fireEvent.click(await screen.findByRole('button', { name: /^Step 9,/ }))
    expect((await screen.findByLabelText(/^Tagline/)).getAttribute('value')).toBe('Updated tagline')
    expect(vendorOnboardingService.getStorefrontSettings).toHaveBeenCalledTimes(2)
    expect(useOnboardingStore.getState().runtime.supportWhatsapp).toBe('9000000001')
  })

  it('retains uploaded images when a later profile save fails and retries without reuploading', async () => {
    vi.stubGlobal('URL', class extends URL { static createObjectURL = vi.fn(() => 'blob:replacement'); static revokeObjectURL = vi.fn() })
    vi.spyOn(vendorOnboardingService, 'saveStorefront').mockResolvedValue(undefined)
    vi.mocked(vendorOnboardingService.saveStoreProfile).mockRejectedValueOnce(new Error('Profile update failed'))
    const upload = vi.spyOn(vendorImagesService, 'uploadImage').mockResolvedValue('https://images.example.test/replacement.png')
    await openApprovedBranding()
    fireEvent.change(document.getElementById('store-logo-file')!, {
      target: { files: [new File(['original'], 'replacement.png', { type: 'image/png' })] },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await screen.findAllByText('Profile update failed')
    expect(useOnboardingStore.getState().draft.currentStep).toBe(9)
    expect(useOnboardingStore.getState().runtime.logoFile).toBeNull()
    expect(peekOnboardingResource('91', 'storefront')).toBeNull()
    expect(screen.queryByText('Changes saved.')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await screen.findByText('Changes saved.')
    expect(upload).toHaveBeenCalledTimes(1)
    expect(vendorOnboardingService.saveStoreProfile).toHaveBeenCalledTimes(2)
  })

  it('supports legacy active approved contexts that omit onboarding, as the current completion rule does', async () => {
    vi.spyOn(vendorOnboardingService, 'getVendorContext').mockResolvedValue(mapVendorContext({ data: {
      vendor_id: 91, vendor_status: 'ACTIVE', approval_status: 'APPROVED', business_name: 'Test Store',
    } }))
    render(<MemoryRouter><OnboardingWizard /></MemoryRouter>)
    fireEvent.click(await screen.findByRole('button', { name: /^Step 9,/ }))
    expect((await screen.findByLabelText('Store name')).matches(':disabled')).toBe(false)
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeTruthy()
  })

  it('keeps pending-review branding locked and never reads its unavailable public settings', async () => {
    renderAccount('PENDING')
    fireEvent.click(await screen.findByRole('button', { name: /^Step 9,/ }))
    expect((await screen.findByLabelText('Store name')).matches(':disabled')).toBe(true)
    expect(screen.getByRole('button', { name: 'Choose logo image' }).matches(':disabled')).toBe(true)
    expect(vendorOnboardingService.getStorefrontSettings).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await screen.findByRole('button', { name: /Step 10,.*You are here/ })
    expect(vendorOnboardingService.saveStoreProfile).not.toHaveBeenCalled()
  })
})

describe('submitted wizard image reads', () => {
  it('can retry an image read while image editing remains locked', async () => {
    vi.mocked(vendorImagesService.getImage).mockRejectedValueOnce(new Error('Images unavailable'))
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce('https://images.example.test/saved.png')
    renderAccount('PENDING')
    fireEvent.click(await screen.findByRole('button', { name: /^Step 9,/ }))
    await screen.findByRole('button', { name: 'Retry logo' })
    const retry = screen.getByRole('button', { name: 'Retry logo' })
    expect(retry.matches(':disabled')).toBe(false)
    fireEvent.click(retry)
    await screen.findByAltText('Logo upload preview')
    expect(screen.getByRole('button', { name: 'Replace logo image' }).matches(':disabled')).toBe(true)
    expect(vendorImagesService.getImage).toHaveBeenCalledTimes(3)
  })
})


describe('first-time Step 9 images', () => {
  it.each(['none', 'logo', 'banner', 'both'] as const)('saves with %s selected without fetching saved images', async (selection) => {
    vi.stubGlobal('URL', class extends URL { static createObjectURL = vi.fn((file: File) => `blob:${file.name}`); static revokeObjectURL = vi.fn() })
    vi.mocked(vendorImagesService.getImage).mockRejectedValue(new Error('Vendor not found'))
    const upload = vi.spyOn(vendorImagesService, 'uploadImage').mockImplementation(async (_vendorId, kind) => `https://images.example.test/${kind}.png`)
    const save = vi.spyOn(vendorOnboardingService, 'saveStorefront').mockResolvedValue(undefined)
    vi.spyOn(vendorOnboardingService, 'saveBusinessType').mockResolvedValue(undefined)
    renderAccount('PENDING', 9, 2, 1, false, undefined, 'INACTIVE')

    expect((await screen.findByRole('button', { name: 'Choose logo image' })).matches(':disabled')).toBe(false)
    expect(screen.getByRole('button', { name: 'Choose banner image' }).matches(':disabled')).toBe(false)
    expect(vendorImagesService.getImage).not.toHaveBeenCalled()
    expect(continueDisabled('Review readiness')).toBe(false)
    act(() => {
      useOnboardingStore.getState().updateDraft((draft) => ({
        ...draft, storefront: { ...draft.storefront, businessLocation: 'Test Market' },
      }), 9)
      useOnboardingStore.getState().updateRuntime({ orderWhatsapp: '9876543210' })
    })
    const selectedKinds = (['logo', 'banner'] as const).filter((kind) => selection === 'both' || selection === kind)
    for (const kind of selectedKinds) {
      fireEvent.change(document.getElementById(`store-${kind}-file`)!, {
        target: { files: [new File(['png'], `${kind}.png`, { type: 'image/png' })] },
      })
    }
    expect(upload).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Review readiness' }))
    await screen.findByRole('button', { name: /Step 10,.*You are here/ })
    await waitFor(() => expect(stepSpinner()).toBeNull())
    expect(save).toHaveBeenCalledWith('91', expect.objectContaining({
      uploadedLogoUrl: selectedKinds.includes('logo') ? 'https://images.example.test/logo.png' : null,
      uploadedBannerUrl: selectedKinds.includes('banner') ? 'https://images.example.test/banner.png' : null,
    }))
    expect(upload).toHaveBeenCalledTimes(selectedKinds.length)
    expect(vendorImagesService.getImage).not.toHaveBeenCalled()
    expect(screen.queryByText('Something went wrong')).toBeNull()
  })

  it('skips image reads when arriving from payments with an earlier context pointer', async () => {
    vi.mocked(vendorImagesService.getImage).mockRejectedValue(new Error('Vendor not found'))
    vi.spyOn(vendorOnboardingService, 'saveCheckoutOptions').mockResolvedValue(undefined)
    renderAccount('PENDING', 8, 2, 1, false, undefined, 'INACTIVE')
    await screen.findByRole('button', { name: /Step 8,.*You are here/ })
    await waitFor(() => expect(continueDisabled()).toBe(false))
    act(() => useOnboardingStore.getState().updateDraft((draft) => ({
      ...draft, payments: [{ type: 'CASH_ON_DELIVERY', enabled: true, isDefault: true }],
    }), 8))
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect((await screen.findByRole('button', { name: 'Choose logo image' })).matches(':disabled')).toBe(false)
    expect(vendorImagesService.getImage).not.toHaveBeenCalled()
    expect(continueDisabled('Review readiness')).toBe(false)
  })
})

describe('independent optional image reads', () => {
  it('allows review submission with an unavailable optional image', async () => {
    vi.mocked(vendorImagesService.getImage).mockRejectedValue(new Error('Saved image unavailable'))
    const submit = vi.spyOn(vendorOnboardingService, 'goLive').mockResolvedValue(undefined)
    seedReadyAccount('Test Market')
    renderAccount('PENDING', 10)
    await screen.findByRole('button', { name: 'Retry logo' })
    await waitFor(() => expect(continueDisabled('Submit for review')).toBe(false))
    fireEvent.click(screen.getByRole('button', { name: 'Submit for review' }))
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Submit for review' }))
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1))
  })

  it.each(['old URL', 'empty', 'error'] as const)('keeps a confirmed upload when an older read returns %s, including re-entry', async (lateResult) => {
    vi.stubGlobal('URL', class extends URL { static createObjectURL = vi.fn(() => 'blob:new-logo'); static revokeObjectURL = vi.fn() })
    const oldRead = deferred<string | null>()
    vi.mocked(vendorImagesService.getImage).mockImplementation((_vendorId, kind) => kind === 'logo' ? oldRead.promise : Promise.resolve(null))
    vi.spyOn(vendorImagesService, 'uploadImage').mockResolvedValue('https://images.example.test/new-logo.png')
    vi.spyOn(vendorOnboardingService, 'saveStorefront').mockResolvedValue(undefined)
    renderAccount('APPROVED')
    fireEvent.click(await screen.findByRole('button', { name: /^Step 9,/ }))
    await screen.findByLabelText('Store name')
    fireEvent.change(document.getElementById('store-logo-file')!, { target: { files: [new File(['png'], 'new-logo.png', { type: 'image/png' })] } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await screen.findByText('Changes saved.')
    await act(async () => {
      if (lateResult === 'error') oldRead.reject(new Error('Stale image error'))
      else oldRead.resolve(lateResult === 'empty' ? null : 'https://images.example.test/old-logo.png')
    })
    expect(screen.getByAltText('Logo upload preview').getAttribute('src')).toBe('https://images.example.test/new-logo.png')
    expect(screen.queryByRole('button', { name: 'Retry logo' })).toBeNull()
    expect(peekOnboardingResource('91', 'logo')?.value).toBe('https://images.example.test/new-logo.png')
    cleanup()
    renderAccount('APPROVED')
    fireEvent.click(await screen.findByRole('button', { name: /^Step 9,/ }))
    await screen.findByAltText('Logo upload preview')
    expect(useOnboardingStore.getState().runtime.savedLogoUrl).toBe('https://images.example.test/new-logo.png')
    expect(vi.mocked(vendorImagesService.getImage).mock.calls.filter(([, kind]) => kind === 'logo')).toHaveLength(1)
  })

  it('shows a loaded logo before a slower banner read settles', async () => {
    const banner = deferred<string | null>()
    vi.mocked(vendorImagesService.getImage).mockImplementation((_vendorId, kind) => kind === 'logo'
      ? Promise.resolve('https://images.example.test/logo.png') : banner.promise)
    renderAccount('PENDING', 10)
    await waitFor(() => expect(useOnboardingStore.getState().runtime.savedLogoUrl).toBe('https://images.example.test/logo.png'))
    await waitFor(() => expect(continueDisabled('Submit for review')).toBe(false))
    fireEvent.click(screen.getByRole('button', { name: /^Step 9,/ }))
    await screen.findByAltText('Logo upload preview')
    expect(screen.getByRole('button', { name: 'Choose banner image' }).matches(':disabled')).toBe(false)
    await act(async () => banner.resolve(null))
  })

  it('omits an unreadable untouched logo from the storefront write while preserving the saved banner', async () => {
    vi.mocked(vendorImagesService.getImage).mockImplementation(async (_vendorId, kind) => {
      if (kind === 'logo') throw new Error('Saved logo unavailable')
      return 'https://images.example.test/banner.png'
    })
    const write = vi.spyOn(getHttp(), 'put').mockResolvedValue({ data: { success: true } })
    renderAccount('APPROVED')
    fireEvent.click(await screen.findByRole('button', { name: /^Step 9,/ }))
    await screen.findByRole('button', { name: 'Retry logo' })
    fireEvent.change(screen.getByLabelText(/^Tagline/), { target: { value: 'Changed tagline' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await screen.findByText('Changes saved.')
    const wire = JSON.parse(JSON.stringify(write.mock.calls[0][1]))
    expect(wire.theme).not.toHaveProperty('logo_image')
    expect(wire.theme.banner_image).toBe('https://images.example.test/banner.png')
  })

  it.each(['logo', 'banner'] as const)('keeps review and the other image usable when %s fails to load', async (failedKind) => {
    vi.mocked(vendorImagesService.getImage).mockRestore()
    const savedKind = failedKind === 'logo' ? 'banner' : 'logo'
    vi.spyOn(getHttp(), 'get').mockImplementation(async (_path, config) => {
      const params = config?.params
      if (params && typeof params === 'object' && 'image_type' in params && params.image_type === (failedKind === 'logo' ? 'THUMBNAIL' : 'HOMEBANNER')) {
        throw apiErrorFromResponse(500, { success: false, status: '500', failure_reason: 'Image lookup failed' })
      }
      return { data: { success: true, data: { image_url: `https://images.example.test/${savedKind}.png` } } }
    })
    renderAccount('PENDING', 10, 2, 1, false, undefined, 'INACTIVE')
    await screen.findByRole('button', { name: `Retry ${failedKind}` })
    await waitFor(() => expect(continueDisabled('Submit for review')).toBe(false))
    await waitFor(() => expect(useOnboardingStore.getState().runtime[`${savedKind}Url`]).toBe(`https://images.example.test/${savedKind}.png`))
    expect(screen.getByRole('button', { name: `Retry ${failedKind}` })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /^Step 9,/ }))
    expect((await screen.findByRole('button', { name: `Choose ${failedKind} image` })).matches(':disabled')).toBe(false)
    expect(screen.getByAltText(`${savedKind === 'logo' ? 'Logo' : 'Banner'} upload preview`).getAttribute('src')).toBe(`https://images.example.test/${savedKind}.png`)
    expect(continueDisabled('Save changes')).toBe(false)
  })
})

describe('resumed vendor image-read failure', () => {
  it('keeps review and selection available while image reads are still loading', async () => {
    const image = deferred<string | null>()
    vi.mocked(vendorImagesService.getImage).mockReturnValue(image.promise)
    renderAccount('PENDING', 10, 2, 1, false, undefined, 'INACTIVE')
    await waitFor(() => expect(continueDisabled('Submit for review')).toBe(false))
    fireEvent.click(screen.getByRole('button', { name: /^Step 9,/ }))
    expect((await screen.findByRole('button', { name: 'Choose logo image' })).matches(':disabled')).toBe(false)
    expect(continueDisabled('Save changes')).toBe(false)
    expect(screen.getByRole('status', { name: 'Loading saved logo' })).toBeTruthy()
    await act(async () => image.resolve(null))
    await waitFor(() => expect(screen.queryByRole('status', { name: 'Loading saved logo' })).toBeNull())
  })

  it('keeps store details and selection available when both saved-image reads fail', async () => {
    vi.mocked(vendorImagesService.getImage).mockRestore()
    const read = vi.spyOn(getHttp(), 'get').mockRejectedValue(apiErrorFromResponse(500, {
      success: false, status: '500', failure_reason: 'Image lookup failed',
      user_message: 'Something failed', api_details: [], reason_code: '500',
    }))
    renderAccount('PENDING', 10, 2, 1, false, undefined, 'INACTIVE')
    fireEvent.click(await screen.findByRole('button', { name: /^Step 9,/ }))
    await screen.findByRole('button', { name: 'Retry logo' })
    expect(read.mock.calls.map(([path, config]) => [path, config?.params])).toEqual([
      ['/v1/vendors/91/images', { image_type: 'THUMBNAIL' }],
      ['/v1/vendors/91/images', { image_type: 'HOMEBANNER' }],
    ])
    expect(screen.getByLabelText('Store name')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Retry banner' })).toBeTruthy()
    expect(continueDisabled('Save changes')).toBe(false)
    expect(screen.getByRole('button', { name: 'Choose logo image' })).toBeTruthy()
    expect(screen.queryByText('Something went wrong')).toBeNull()
  })

  // TEMP(vendor-image-404): QA returns 404 for an image never uploaded. Delete this test when the
  // backend returns 200 with a null `image_url` (docs/API_GAPS.md#temporary-image-404-as-no-image).
  it('reads a 404 for both images as no saved image, without Retry', async () => {
    vi.mocked(vendorImagesService.getImage).mockRestore()
    vi.spyOn(getHttp(), 'get').mockRejectedValue(apiErrorFromResponse(404, {
      success: false, status: '404', failure_reason: 'Vendor #91 not found',
      user_message: 'No data found!!', api_details: [], reason_code: '404',
    }))
    renderAccount('PENDING', 10, 2, 1, false, undefined, 'INACTIVE')
    fireEvent.click(await screen.findByRole('button', { name: /^Step 9,/ }))
    expect((await screen.findByRole('button', { name: 'Choose logo image' })).matches(':disabled')).toBe(false)
    await waitFor(() => expect(screen.queryByRole('status', { name: 'Loading saved logo' })).toBeNull())
    await waitFor(() => expect(screen.queryByRole('status', { name: 'Loading saved banner' })).toBeNull())
    expect(screen.queryByRole('button', { name: 'Retry logo' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Retry banner' })).toBeNull()
    expect(continueDisabled('Save changes')).toBe(false)
  })
})

describe('silent draft sync', () => {
  const beverages = { id: 7, name: 'Beverages', icon: null, displayOrder: 1 }
  const currentStepIs = (step: number) => screen.findByRole('button', { name: new RegExp(`^Step ${step},.*You are here`) })
  const shipping = (charge: number) => ({ charge, freeDeliveryThreshold: 0 })
  const storedEnvelope = () => parsePersistedEnvelope(JSON.parse(localStorage.getItem(ONBOARDING_DRAFT_STORAGE_KEY) ?? 'null'))

  /**
   * This browser's draft as a fresh page load finds it: an unsaved delivery charge of 45 and
   * a store detail, written in `version`'s format with the given edit record.
   */
  function plantDraft(version: number, record: Record<string, unknown>, patch: Partial<ReturnType<typeof createEmptyOnboardingDraft>> = {}) {
    const empty = createEmptyOnboardingDraft()
    const draft = {
      ...empty,
      mobileVerified: true,
      currentStep: 7 as OnboardingStep,
      completedSteps: [1, 2, 3, 4, 5, 6] as OnboardingStep[],
      business: { businessType: beverages, businessName: 'Test Store' },
      delivery: { ...empty.delivery, fulfillmentType: 'BOTH' as const, shipping: shipping(45) },
      storefront: { ...empty.storefront, storeName: 'Test Store', businessLocation: 'Test City', tagline: 'Old tagline' },
      ...patch,
    }
    localStorage.setItem(ONBOARDING_DRAFT_STORAGE_KEY, JSON.stringify({
      version, revision: 3, updatedAt: '2026-11-01T10:00:00.000Z', ownerId: '91', furthestVisitedStep: 7,
      ...record, draft: { ...toPersistedDraft(draft), version }, previewSnapshot: null,
    }))
    useOnboardingStore.setState({ persistenceInitialized: false })
  }

  beforeEach(() => {
    stubReferencePages()
    // Delivery charge 30, home delivery only.
    vi.mocked(vendorOnboardingService.getCheckoutOptions).mockResolvedValue(READY_CHECKOUT)
    vi.mocked(vendorOnboardingService.getVendorProfile).mockResolvedValue({
      businessName: 'Test Store', businessType: 'Beverages', contactNumber: '+919876543210',
    })
  })

  it('keeps input of a step not saved yet while the account holds what it started from, and takes a value saved elsewhere', async () => {
    // Step 7 is not among the draft's saved steps, so its input is first-time input, which a
    // page load keeps (a saved step's edits give way to its saved values, below).
    plantDraft(ONBOARDING_DRAFT_VERSION, {
      editedSteps: [7],
      edits: {
        // Started from the charge the account still holds: the vendor's input stands.
        'delivery.shipping': { at: 1, saved: shipping(30) },
        // Started from store pickup, but the account has since saved home delivery.
        'delivery.fulfillmentType': { at: 1, saved: 'STORE_PICKUP' },
      },
    })
    renderAccount('PENDING', 7)

    await currentStepIs(7)
    await waitFor(() => expect(useOnboardingStore.getState().loadedSteps).toContain(7))
    const state = useOnboardingStore.getState()
    expect(state.draft.delivery.shipping).toEqual(shipping(45))
    expect(state.draft.delivery.fulfillmentType).toBe('HOME_DELIVERY')
    expect(state.editedSteps).toEqual([7])
    expect(pendingSteps(state)).toEqual([7])
    expect(screen.queryByRole('alertdialog')).toBeNull()
    // What the next load needs to judge the kept input again: the saved value it started from.
    act(() => useOnboardingStore.getState().flushPersistence())
    expect(storedEnvelope()?.edits).toEqual({ 'delivery.shipping': { at: 1, saved: shipping(30) } })
  })

  describe('after a reload, saved values come from the account', () => {
    const juices = { id: 10, name: 'Juices', imageUrl: null, businessTypeId: 7, description: null, displayOrder: null }
    const smoothies = { ...juices, id: 12, name: 'Smoothies' }
    const pick = (id: number, name: string) => ({ id, name, categoryId: 10, description: null, imageUrl: null, measurementId: 2, measurementName: null })
    const juiceSize = (id: string, quantity: number, listPrice: number, salePrice: number) => ({
      id, productId: 31, name: 'Test Juice', description: '', skuType: 'ITEM' as const, measurementType: 'VOLUME' as const,
      unit: 'L', quantity, listPrice, salePrice, active: true, homeDelivery: true, storePickup: true,
    })

    it('shows a saved Step 7 value in place of an unsaved edit, with nothing left to save', async () => {
      seedReadyAccount('Test City')
      plantDraft(ONBOARDING_DRAFT_VERSION, {
        editedSteps: [7],
        // Both edits started from what the account still holds.
        edits: {
          'delivery.shipping': { at: 1, saved: shipping(30) },
          'delivery.fulfillmentType': { at: 1, saved: 'HOME_DELIVERY' },
        },
      }, { completedSteps: [1, 2, 3, 4, 5, 6, 7, 8, 9] as OnboardingStep[] })
      renderAccount('PENDING', 10)

      await currentStepIs(10)
      await waitFor(() => expect(useOnboardingStore.getState().loadedSteps).toEqual([3, 4, 5, 6, 7, 8, 9]))
      const state = useOnboardingStore.getState()
      expect(state.draft.delivery.shipping).toEqual(shipping(30))
      expect(state.draft.delivery.fulfillmentType).toBe('HOME_DELIVERY')
      expect(state.editedSteps).toEqual([])
      expect(pendingSteps(state)).toEqual([])
      expect(screen.queryByText('Save or undo your changes to delivery.')).toBeNull()
    })

    it('never undoes another open tab’s unsaved edit by what this page load shows', async () => {
      // Tab A, still open, wrote an unsaved charge of 45 for saved Step 7; this tab loads now.
      seedReadyAccount('Test City')
      const edit = { at: 1, saved: shipping(30) }
      plantDraft(ONBOARDING_DRAFT_VERSION, { editedSteps: [7], edits: { 'delivery.shipping': edit } },
        { completedSteps: [1, 2, 3, 4, 5, 6, 7, 8, 9] as OnboardingStep[] })
      renderAccount('PENDING', 10)

      await currentStepIs(10)
      await waitFor(() => expect(useOnboardingStore.getState().loadedSteps).toEqual([3, 4, 5, 6, 7, 8, 9]))
      expect(useOnboardingStore.getState().draft.delivery.shipping).toEqual(shipping(30))
      // What this tab writes, even after an edit of its own elsewhere, still holds tab A's edit,
      // so tab A does not take it for a save or an undo.
      act(() => {
        useOnboardingStore.getState().updateDraft((draft) => ({ ...draft, storefront: { ...draft.storefront, welcomeMessage: 'Here' } }), 9)
        useOnboardingStore.getState().flushPersistence()
      })
      expect(storedEnvelope()?.edits?.['delivery.shipping']).toEqual(edit)
      expect(storedEnvelope()?.draft.delivery.shipping).toEqual(shipping(45))
      expect(storedEnvelope()?.draft.storefront.welcomeMessage).toBe('Here')

      // Once this tab edits that field itself, its own value is what it writes.
      act(() => {
        useOnboardingStore.getState().updateDraft((draft) => ({ ...draft, delivery: { ...draft.delivery, shipping: shipping(35) } }), 7)
        useOnboardingStore.getState().flushPersistence()
      })
      expect(storedEnvelope()?.draft.delivery.shipping).toEqual(shipping(35))
      expect(storedEnvelope()?.edits?.['delivery.shipping']?.at).toBeGreaterThan(1)
    })

    it('shows saved store details this browser recorded, which no read can tell before approval', async () => {
      seedReadyAccount('Test City')
      plantDraft(ONBOARDING_DRAFT_VERSION, {
        editedSteps: [9],
        edits: { 'storefront.tagline': { at: 1, saved: 'Saved tagline' } },
      }, { completedSteps: [1, 2, 3, 4, 5, 6, 7, 8, 9] as OnboardingStep[] })
      renderAccount('PENDING', 10)

      await currentStepIs(10)
      await waitFor(() => expect(useOnboardingStore.getState().loadedSteps).toEqual([3, 4, 5, 6, 7, 8, 9]))
      const state = useOnboardingStore.getState()
      expect(state.draft.storefront.tagline).toBe('Saved tagline')
      expect(pendingSteps(state)).toEqual([])
      expect(screen.queryByText('Save or undo your changes to store details.')).toBeNull()
    })

    it('keeps Step 7 input that was never saved', async () => {
      vi.mocked(vendorOnboardingService.getCheckoutOptions).mockResolvedValue(null)
      const defaults = createEmptyOnboardingDraft().delivery
      plantDraft(ONBOARDING_DRAFT_VERSION, {
        editedSteps: [7],
        edits: {
          'delivery.shipping': { at: 1, saved: defaults.shipping },
          'delivery.fulfillmentType': { at: 1, saved: defaults.fulfillmentType },
        },
      })
      renderAccount('PENDING', 7)

      await currentStepIs(7)
      await waitFor(() => expect(useOnboardingStore.getState().loadedSteps).toContain(7))
      const state = useOnboardingStore.getState()
      expect(state.draft.delivery.shipping).toEqual(shipping(45))
      expect(state.draft.delivery.fulfillmentType).toBe('BOTH')
      expect(state.editedSteps).toEqual([7])
    })

    it('shows a saved Step 6 price in place of an unsaved edit, keeping unsaved picks and sizes marked', async () => {
      vi.spyOn(vendorOnboardingService, 'getCategories').mockResolvedValue({ ...EMPTY_PAGE, totalPages: 1, totalElements: 2, items: [juices, smoothies] })
      vi.spyOn(vendorOnboardingService, 'getProductsByCategory').mockResolvedValue({
        ...EMPTY_PAGE, totalPages: 1, totalElements: 2,
        items: [pick(31, 'Test Juice'), pick(32, 'Apple Juice')].map(({ categoryId: _, ...product }) => ({ ...product, icon: null })),
      })
      plantDraft(ONBOARDING_DRAFT_VERSION, {
        editedSteps: [4, 5, 6],
        edits: {
          categories: { at: 1, saved: [juices] },
          products: { at: 1, saved: [pick(31, 'Test Juice')] },
          skus: { at: 1, saved: [juiceSize('sku-4001', 1, 100, 90)] },
        },
      }, {
        currentStep: 6 as OnboardingStep,
        categories: [juices, smoothies],
        products: [pick(31, 'Test Juice'), pick(32, 'Apple Juice')],
        // The saved size's price edited to 70, and a new 2 L size added.
        skus: [juiceSize('sku-4001', 1, 100, 70), juiceSize('draft-sku-31-1', 2, 180, 160)],
      })
      renderAccount('PENDING', 7)

      await currentStepIs(7)
      const sizes = await openSizes()
      expect(sizes).toBeTruthy()
      const state = useOnboardingStore.getState()
      expect(state.draft.skus.map(({ id, salePrice }) => [id, salePrice])).toEqual([['sku-4001', 90], ['draft-sku-31-1', 160]])
      expect(screen.getByRole('group', { name: 'Test Juice, 1 L size' })).toBeTruthy()
      expect(screen.getByRole('group', { name: 'Test Juice, 2 L size, not saved' })).toBeTruthy()
      expect(state.draft.categories.map(({ id }) => id)).toEqual([10, 12])
      expect(state.draft.products.map(({ id }) => id)).toEqual([31, 32])

      fireEvent.click(screen.getByRole('button', { name: /^Step 5,/ }))
      expect(await screen.findByRole('button', { name: /Apple Juice, not saved/ })).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: /^Step 4,/ }))
      expect(await screen.findByRole('button', { name: /Smoothies, not saved/ })).toBeTruthy()
    })
  })

  it('lets the account’s newer value win over an edit that started from an older one', async () => {
    plantDraft(ONBOARDING_DRAFT_VERSION, {
      editedSteps: [7],
      edits: { 'delivery.shipping': { at: 1, saved: shipping(20) } },
    })
    renderAccount('PENDING', 7)

    await currentStepIs(7)
    await waitFor(() => expect(useOnboardingStore.getState().loadedSteps).toContain(7))
    const state = useOnboardingStore.getState()
    expect(state.draft.delivery.shipping).toEqual(shipping(30))
    expect(state.editedSteps).toEqual([])
    expect(pendingSteps(state)).toEqual([])
  })

  it('keeps an old-format draft’s explicitly edited store details pending, across reloads', async () => {
    seedReadyAccount('Test City')
    plantDraft(4, { editedSteps: [7, 9] })
    renderAccount('PENDING', 10)

    await currentStepIs(10)
    await waitFor(() => expect(useOnboardingStore.getState().loadedSteps).toEqual([3, 4, 5, 6, 7, 8, 9]))
    let state = useOnboardingStore.getState()
    // The account holds a delivery setup, so it wins over the unsaved copy.
    expect(state.draft.delivery.shipping).toEqual(shipping(30))
    expect(state.draft.delivery.fulfillmentType).toBe('HOME_DELIVERY')
    // Store details are unreadable before approval: this browser's copy stays, still unsaved.
    expect(state.draft.storefront.tagline).toBe('Old tagline')
    expect(pendingSteps(state)).toEqual([9])
    // Step 9's specific readiness items stand in for the generic line.
    const step9Listed = () => waitFor(() => expect(within(document.getElementById('readiness-issues')!).getAllByText('Step 9')).not.toHaveLength(0))
    await step9Listed()
    expect(screen.queryByText('Save or undo your changes to store details.')).toBeNull()
    expect(screen.queryByRole('alertdialog')).toBeNull()

    // Written back in the current format, it stays pending on the next load.
    act(() => useOnboardingStore.getState().flushPersistence())
    expect(storedEnvelope()?.version).toBe(ONBOARDING_DRAFT_VERSION)
    expect(storedEnvelope()?.editedSteps).toEqual([9])
    cleanup()
    invalidateAll()
    useOnboardingStore.setState({ persistenceInitialized: false })
    renderAccount('PENDING', 10)
    await currentStepIs(10)
    await waitFor(() => expect(useOnboardingStore.getState().loadedSteps).toEqual([3, 4, 5, 6, 7, 8, 9]))
    state = useOnboardingStore.getState()
    expect(state.draft.storefront.tagline).toBe('Old tagline')
    expect(pendingSteps(state)).toEqual([9])
    await step9Listed()
  })

  it.each([
    ['the legacy flag absent', {}],
    ['the legacy flag set', { hasLocalEdits: true }],
  ])('treats the oldest draft’s store details as saved, as it marks every step edited (%s)', async (_, record) => {
    seedReadyAccount('Test City')
    plantDraft(4, record)
    renderAccount('PENDING', 10)

    await currentStepIs(10)
    await waitFor(() => expect(useOnboardingStore.getState().loadedSteps).toEqual([3, 4, 5, 6, 7, 8, 9]))
    const state = useOnboardingStore.getState()
    expect(state.draft.delivery.shipping).toEqual(shipping(30))
    expect(state.draft.storefront.tagline).toBe('Old tagline')
    expect(pendingSteps(state)).toEqual([])
    expect(screen.queryByText('Save or undo your changes to store details.')).toBeNull()
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('lets an old-format draft fill what the account has not saved yet', async () => {
    vi.mocked(vendorOnboardingService.getCheckoutOptions).mockResolvedValue(null)
    plantDraft(4, { editedSteps: [7] })
    renderAccount('PENDING', 7)

    await currentStepIs(7)
    await waitFor(() => expect(useOnboardingStore.getState().loadedSteps).toContain(7))
    const state = useOnboardingStore.getState()
    expect(state.draft.delivery.shipping).toEqual(shipping(45))
    expect(state.draft.delivery.fulfillmentType).toBe('BOTH')
    expect(state.editedSteps).toEqual([7])
  })

  it('discards an unreadable draft without a word and opens the account’s setup', async () => {
    localStorage.setItem(ONBOARDING_DRAFT_STORAGE_KEY, '{"version": 2, "draft": "damaged"')
    useOnboardingStore.setState({ persistenceInitialized: false })
    renderAccount('PENDING', 9)

    await currentStepIs(9)
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.queryByText(/cannot be opened/i)).toBeNull()
    await waitFor(() => expect(useOnboardingStore.getState().draft.business.businessName).toBe('Test Store'))
    expect(useOnboardingStore.getState().persistenceStatus).not.toBe('corrupt')
    // Nothing of the damaged copy survives the next write.
    act(() => useOnboardingStore.getState().flushPersistence())
    const stored = localStorage.getItem(ONBOARDING_DRAFT_STORAGE_KEY)
    expect(stored === null || storedEnvelope() !== null).toBe(true)
  })

  describe('across tabs', () => {
    /** What another tab writes: this tab's last stored draft with `change` applied on top. */
    function otherTabWrites(change: (draft: ReturnType<typeof createEmptyOnboardingDraft>) => ReturnType<typeof createEmptyOnboardingDraft>, edits: Record<string, unknown>) {
      const state = useOnboardingStore.getState()
      const envelope = {
        version: ONBOARDING_DRAFT_VERSION,
        revision: state.persistenceRevision + 1,
        updatedAt: new Date(Date.now() + 1000).toISOString(),
        ownerId: '91',
        furthestVisitedStep: state.furthestVisitedStep,
        editedSteps: [9],
        edits,
        draft: toPersistedDraft(change(state.draft)),
        previewSnapshot: null,
      }
      act(() => {
        window.dispatchEvent(new StorageEvent('storage', { key: ONBOARDING_DRAFT_STORAGE_KEY, newValue: JSON.stringify(envelope) }))
      })
    }
    const withStorefront = (patch: Partial<ReturnType<typeof createEmptyOnboardingDraft>['storefront']>) =>
      (draft: ReturnType<typeof createEmptyOnboardingDraft>) => ({ ...draft, storefront: { ...draft.storefront, ...patch } })

    async function openStep9() {
      useOnboardingStore.setState({ persistenceInitialized: false })
      renderAccount('PENDING', 9)
      await currentStepIs(9)
      await waitFor(() => expect(useOnboardingStore.getState().loadedSteps).toContain(9))
      act(() => useOnboardingStore.getState().flushPersistence())
    }

    it('adopts the other tab’s newer draft silently', async () => {
      await openStep9()

      otherTabWrites(withStorefront({ tagline: 'From the other tab' }), {
        'storefront.tagline': { at: Date.now(), saved: '' },
      })

      expect(screen.queryByRole('alertdialog')).toBeNull()
      expect(screen.queryByText(/newer draft/i)).toBeNull()
      const state = useOnboardingStore.getState()
      expect(state.draft.storefront.tagline).toBe('From the other tab')
      expect(state.editedSteps).toEqual([9])
      expect(state.persistenceStatus).not.toBe('conflict')
      // This tab still writes: its next edit reaches storage.
      act(() => {
        state.updateDraft((draft) => ({ ...draft, storefront: { ...draft.storefront, welcomeMessage: 'Later' } }), 9)
        useOnboardingStore.getState().flushPersistence()
      })
      expect(storedEnvelope()?.draft.storefront).toMatchObject({ tagline: 'From the other tab', welcomeMessage: 'Later' })
    })

    it('keeps both tabs’ unsaved edits to different fields, and the more recent edit of the same field', async () => {
      await openStep9()
      act(() => useOnboardingStore.getState().updateDraft((draft) => ({
        ...draft, storefront: { ...draft.storefront, welcomeMessage: 'This tab', announcementBar: 'This tab, earlier' },
      }), 9))

      otherTabWrites(withStorefront({ tagline: 'Other tab', announcementBar: 'Other tab, later' }), {
        'storefront.tagline': { at: Date.now() + 500, saved: '' },
        'storefront.announcementBar': { at: Date.now() + 500, saved: '' },
      })

      const { storefront } = useOnboardingStore.getState().draft
      expect(storefront.welcomeMessage).toBe('This tab')
      expect(storefront.tagline).toBe('Other tab')
      expect(storefront.announcementBar).toBe('Other tab, later')
      expect(screen.queryByRole('alertdialog')).toBeNull()
      // This tab's own unsaved edit is written back, so the other tab can have it too.
      expect(storedEnvelope()?.draft.storefront).toMatchObject({ welcomeMessage: 'This tab', tagline: 'Other tab' })
    })
  })
})

describe('account freshness after the page was away', () => {
  const SAVED_CHECKOUT = {
    fulfillmentType: 'HOME_DELIVERY' as const,
    schedulingStrategy: 'FIXED_WINDOW' as const,
    schedulingConfig: { min_delivery_days: 1, max_delivery_days: 3 },
    shippingConfig: { deliveryCharge: 30, freeDeliveryThreshold: 0 },
    slots: [],
    consentTitle: '',
    consentText: '',
    payments: [{ type: 'CASH_ON_DELIVERY' as const, isDefault: true, details: {} }],
  }
  const deliveryCharge = () => screen.getByLabelText('Delivery charge (₹)') as HTMLInputElement
  const currentStepIs = (step: number) => screen.findByRole('button', { name: new RegExp(`^Step ${step},.*You are here`) })
  const contextData = (overrides: Record<string, unknown> = {}) => ({
    vendor_id: 91, vendor_status: 'ACTIVE', approval_status: 'PENDING', store_identifier: 'test-store', business_name: 'Test Store',
    onboarding: { status: 'IN_PROGRESS', next_step: 9 },
    subscription: { limits: { max_categories: 3, max_products: 10, max_skus: 2 }, usage: { skus: 1 } },
    ...overrides,
  })
  /** The vendor switches to another tab and back. */
  const leaveTab = () => act(() => hideAndShowTab())
  /** The vendor glances at another tab and comes straight back. */
  const switchTabBriefly = () => act(() => hideAndShowTab(AWAY_AFTER_MS - 1))
  /** Another tab of this browser saved a step for `vendorId`. */
  const saveInAnotherTab = (vendorId = '91') => act(() => {
    window.dispatchEvent(new StorageEvent('storage', {
      key: ACCOUNT_WRITE_SIGNAL_KEY,
      newValue: JSON.stringify({ vendorId, at: Date.now() }),
    }))
  })
  /** The window loses and regains focus without the tab being hidden: DevTools, a file picker. */
  const blurWindow = () => act(() => {
    window.dispatchEvent(new Event('blur'))
    window.dispatchEvent(new Event('focus'))
  })

  beforeEach(() => {
    stubReferencePages()
    vi.spyOn(vendorOnboardingService, 'getCheckoutOptions').mockResolvedValue(SAVED_CHECKOUT)
  })

  async function openStep7() {
    renderAccount('PENDING', 9)
    await currentStepIs(9)
    fireEvent.click(screen.getByRole('button', { name: /^Step 7,/ }))
    await currentStepIs(7)
    await waitFor(() => expect(useOnboardingStore.getState().loadedSteps).toContain(7))
  }

  it('sends what another device saved while the tab was away along with this tab’s edit', async () => {
    const save = vi.spyOn(vendorOnboardingService, 'saveCheckoutOptions').mockResolvedValue(undefined)
    await openStep7()
    fireEvent.change(deliveryCharge(), { target: { value: '45' } })
    vi.mocked(vendorOnboardingService.getCheckoutOptions)
      .mockResolvedValue({ ...SAVED_CHECKOUT, schedulingConfig: { min_delivery_days: 1, max_delivery_days: 5 } })

    leaveTab()
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await currentStepIs(9)
    expect(save).toHaveBeenCalledTimes(1)
    const [, delivery] = save.mock.calls[0]!
    expect(delivery.shipping.charge).toBe(45)
    expect(delivery.fixedWindow.maxDeliveryDays).toBe(5)
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('lets a value saved elsewhere win over an unsaved edit of the same field, writing nothing', async () => {
    const save = vi.spyOn(vendorOnboardingService, 'saveCheckoutOptions').mockResolvedValue(undefined)
    await openStep7()
    fireEvent.change(deliveryCharge(), { target: { value: '45' } })
    vi.mocked(vendorOnboardingService.getCheckoutOptions)
      .mockResolvedValue({ ...SAVED_CHECKOUT, shippingConfig: { deliveryCharge: 60, freeDeliveryThreshold: 0 } })

    leaveTab()
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await currentStepIs(9)
    expect(save).not.toHaveBeenCalled()
    const state = useOnboardingStore.getState()
    expect(state.draft.delivery.shipping.charge).toBe(60)
    expect(state.editedSteps).toEqual([])
  })

  it('keeps an edit made after this tab’s own save, which the account stores without the hidden free-delivery threshold', async () => {
    // Step 7 saved for the first time here: a flat charge goes out with a zero threshold, so the
    // account never holds the draft's default one. That is no change made elsewhere.
    vi.mocked(vendorOnboardingService.getCheckoutOptions).mockResolvedValue(null)
    const save = vi.spyOn(vendorOnboardingService, 'saveCheckoutOptions').mockResolvedValue(undefined)
    renderAccount('PENDING', 7)
    await currentStepIs(7)
    await waitFor(() => expect(useOnboardingStore.getState().loadedSteps).toContain(7))
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await currentStepIs(8)
    vi.mocked(vendorOnboardingService.getCheckoutOptions).mockResolvedValue(SAVED_CHECKOUT)

    fireEvent.click(screen.getByRole('button', { name: /^Step 7,/ }))
    await currentStepIs(7)
    fireEvent.change(deliveryCharge(), { target: { value: '25' } })
    leaveTab()
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await currentStepIs(8)
    expect(save).toHaveBeenCalledTimes(2)
    expect(save.mock.calls[1]![1].shipping.charge).toBe(25)
  })

  it('keeps the input and blocks the save while the check fails, then saves on the next press', async () => {
    const save = vi.spyOn(vendorOnboardingService, 'saveCheckoutOptions').mockResolvedValue(undefined)
    await openStep7()
    fireEvent.change(deliveryCharge(), { target: { value: '45' } })
    vi.mocked(vendorOnboardingService.getVendorContext).mockRejectedValueOnce(new Error('Could not reach the server'))

    leaveTab()
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findAllByText('Could not reach the server')).not.toHaveLength(0)
    expect(useOnboardingStore.getState().draft.currentStep).toBe(7)
    expect(deliveryCharge().value).toBe('45')
    expect(save).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await currentStepIs(9)
    expect(save).toHaveBeenCalledTimes(1)
    expect(save.mock.calls[0]![1].shipping.charge).toBe(45)
  })

  it('joins a context read another part of the app started since the away, instead of reading again', async () => {
    vi.spyOn(vendorOnboardingService, 'saveCheckoutOptions').mockResolvedValue(undefined)
    await openStep7()
    const before = accountReadCounts()
    fireEvent.change(deliveryCharge(), { target: { value: '45' } })
    // An earlier save dropped the shared context, so the header reads it afresh on its own
    // after the vendor came back.
    invalidateVendorContext('91')
    leaveTab()
    void loadVendorContext('91', (id) => vendorOnboardingService.getVendorContext(id))
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await currentStepIs(9)
    expect(accountReadCounts()).toEqual({
      ...before,
      getVendorContext: before.getVendorContext! + 1,
      getCheckoutOptions: before.getCheckoutOptions! + 1,
    })
  })

  it('reads again on retry only what failed, not what the failed check already read', async () => {
    const save = vi.spyOn(vendorOnboardingService, 'saveCheckoutOptions').mockResolvedValue(undefined)
    await openStep7()
    const before = accountReadCounts()
    fireEvent.change(deliveryCharge(), { target: { value: '45' } })
    vi.mocked(vendorOnboardingService.getVendorContext).mockRejectedValueOnce(new Error('Could not reach the server'))
    leaveTab()
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findAllByText('Could not reach the server')).not.toHaveLength(0)

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await currentStepIs(9)
    expect(save).toHaveBeenCalledTimes(1)
    expect(accountReadCounts()).toEqual({
      ...before,
      getVendorContext: before.getVendorContext! + 2,
      getCheckoutOptions: before.getCheckoutOptions! + 1,
    })
  })

  it('reads nothing more before a save while the tab never left', async () => {
    const save = vi.spyOn(vendorOnboardingService, 'saveCheckoutOptions').mockResolvedValue(undefined)
    await openStep7()
    const before = accountReadCounts()
    fireEvent.change(deliveryCharge(), { target: { value: '45' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await currentStepIs(9)
    expect(save).toHaveBeenCalledTimes(1)
    expect(accountReadCounts()).toEqual(before)
  })

  it('reads nothing more before a save after only a short tab switch', async () => {
    const save = vi.spyOn(vendorOnboardingService, 'saveCheckoutOptions').mockResolvedValue(undefined)
    await openStep7()
    const before = accountReadCounts()
    fireEvent.change(deliveryCharge(), { target: { value: '45' } })
    switchTabBriefly()
    switchTabBriefly()
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await currentStepIs(9)
    expect(save).toHaveBeenCalledTimes(1)
    expect(accountReadCounts()).toEqual(before)
  })

  it('reads again before the next save once another tab saved for this vendor, merging what it saved', async () => {
    const save = vi.spyOn(vendorOnboardingService, 'saveCheckoutOptions').mockResolvedValue(undefined)
    await openStep7()
    const before = accountReadCounts()
    fireEvent.change(deliveryCharge(), { target: { value: '45' } })
    vi.mocked(vendorOnboardingService.getCheckoutOptions)
      .mockResolvedValue({ ...SAVED_CHECKOUT, schedulingConfig: { min_delivery_days: 1, max_delivery_days: 5 } })

    saveInAnotherTab()
    // Nothing is read until this tab writes.
    expect(accountReadCounts()).toEqual(before)
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await currentStepIs(9)
    expect(accountReadCounts()).toEqual({
      ...before,
      getVendorContext: before.getVendorContext! + 1,
      getCheckoutOptions: before.getCheckoutOptions! + 1,
    })
    const [, delivery] = save.mock.calls[0]!
    expect(delivery.shipping.charge).toBe(45)
    expect(delivery.fixedWindow.maxDeliveryDays).toBe(5)
  })

  it('reads nothing more before a save when another tab saved for another vendor', async () => {
    const save = vi.spyOn(vendorOnboardingService, 'saveCheckoutOptions').mockResolvedValue(undefined)
    await openStep7()
    const before = accountReadCounts()
    fireEvent.change(deliveryCharge(), { target: { value: '45' } })
    saveInAnotherTab('92')
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await currentStepIs(9)
    expect(save).toHaveBeenCalledTimes(1)
    expect(accountReadCounts()).toEqual(before)
  })

  it('tells this browser’s other tabs which vendor a save was for, and nothing else', async () => {
    vi.spyOn(vendorOnboardingService, 'saveCheckoutOptions').mockResolvedValue(undefined)
    await openStep7()
    expect(localStorage.getItem(ACCOUNT_WRITE_SIGNAL_KEY)).toBeNull()
    fireEvent.change(deliveryCharge(), { target: { value: '45' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await currentStepIs(9)
    const note = JSON.parse(localStorage.getItem(ACCOUNT_WRITE_SIGNAL_KEY)!)
    expect(Object.keys(note).sort()).toEqual(['at', 'vendorId'])
    expect(note.vendorId).toBe('91')
  })

  it('reads nothing more before a save when the window only lost and regained focus', async () => {
    const save = vi.spyOn(vendorOnboardingService, 'saveCheckoutOptions').mockResolvedValue(undefined)
    await openStep7()
    const before = accountReadCounts()
    fireEvent.change(deliveryCharge(), { target: { value: '45' } })
    blurWindow()
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await currentStepIs(9)
    expect(save).toHaveBeenCalledTimes(1)
    expect(accountReadCounts()).toEqual(before)
  })

  it('sends this tab’s edit when the re-check after an away finds the account unchanged', async () => {
    const save = vi.spyOn(vendorOnboardingService, 'saveCheckoutOptions').mockResolvedValue(undefined)
    await openStep7()
    const before = accountReadCounts()
    fireEvent.change(deliveryCharge(), { target: { value: '45' } })

    leaveTab()
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await currentStepIs(9)
    expect(accountReadCounts()).toEqual({
      ...before,
      getVendorContext: before.getVendorContext! + 1,
      getCheckoutOptions: before.getCheckoutOptions! + 1,
    })
    expect(save).toHaveBeenCalledTimes(1)
    expect(save.mock.calls[0]![1].shipping.charge).toBe(45)
  })

  it('re-reads only the context and the step’s own resource after an away, sharing each read', async () => {
    vi.spyOn(vendorOnboardingService, 'saveCheckoutOptions').mockResolvedValue(undefined)
    await openStep7()
    const before = accountReadCounts()
    fireEvent.change(deliveryCharge(), { target: { value: '45' } })
    leaveTab()
    leaveTab()
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await currentStepIs(9)
    expect(accountReadCounts()).toEqual({
      ...before,
      getVendorContext: before.getVendorContext! + 1,
      getCheckoutOptions: before.getCheckoutOptions! + 1,
    })
  })

  it('writes nothing when another device submitted the store meanwhile, and shows it submitted', async () => {
    const save = vi.spyOn(vendorOnboardingService, 'saveCheckoutOptions').mockResolvedValue(undefined)
    await openStep7()
    fireEvent.change(deliveryCharge(), { target: { value: '45' } })
    vi.mocked(vendorOnboardingService.getVendorContext).mockResolvedValue(mapVendorContext({
      data: contextData({ onboarding: { status: 'COMPLETED', next_step: 11 } }),
    }))

    leaveTab()
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await currentStepIs(10)
    expect(save).not.toHaveBeenCalled()
    expect(useOnboardingStore.getState().storeSubmission).not.toBeNull()
  })

  it('clears a step another tab saved from pending when Submit checks the account again', async () => {
    seedReadyAccount('Test Road')
    renderAccount('APPROVED', 10)
    await screen.findByRole('button', { name: /Step 10,.*You are here/ })
    await waitFor(() => expect(continueDisabled('Submit for review')).toBe(false))
    // Another tab saved Step 7 and this tab adopted its draft; only this tab's saved values are old.
    act(() => useOnboardingStore.setState((state) => ({
      draft: { ...state.draft, delivery: { ...state.draft.delivery, shipping: { charge: 45, freeDeliveryThreshold: 0 } } },
    })))
    expect(pendingSteps(useOnboardingStore.getState())).toEqual([7])
    vi.mocked(vendorOnboardingService.getCheckoutOptions)
      .mockResolvedValue({ ...READY_CHECKOUT, shippingConfig: { deliveryCharge: 45, freeDeliveryThreshold: 0 } })

    leaveTab()
    fireEvent.click(screen.getByRole('button', { name: 'Submit for review' }))

    expect(await screen.findByRole('alertdialog')).toBeTruthy()
    expect(pendingSteps(useOnboardingStore.getState())).toEqual([])
  })

  it('reads the context and profile afresh on entry when the cached copies predate an away', async () => {
    const context = mapVendorContext({ data: contextData() })
    await loadVendorContext('91', async () => context)
    await loadOnboardingResource('91', 'profile', async () => ({ businessName: 'Test Store', businessType: 'Beverages', contactNumber: '' }))
    leaveTab()

    renderAccount('PENDING', 9)
    await currentStepIs(9)
    expect(vendorOnboardingService.getVendorContext).toHaveBeenCalledTimes(1)
    expect(vendorOnboardingService.getVendorProfile).toHaveBeenCalledTimes(1)
  })

  it('still reuses copies read since the page last left, such as sign-in’s', async () => {
    const context = mapVendorContext({ data: contextData() })
    await loadVendorContext('91', async () => context)
    await loadOnboardingResource('91', 'profile', async () => ({ businessName: 'Test Store', businessType: 'Beverages', contactNumber: '' }))

    renderAccount('PENDING', 9)
    await currentStepIs(9)
    expect(vendorOnboardingService.getVendorContext).not.toHaveBeenCalled()
    expect(vendorOnboardingService.getVendorProfile).not.toHaveBeenCalled()
  })

  it('reads nothing in demo mode, however often the page leaves', async () => {
    vi.stubEnv('VITE_USE_API', 'false')
    configureApiClient({ useApi: false })
    const save = vi.spyOn(vendorOnboardingService, 'saveCheckoutOptions').mockResolvedValue(undefined)
    const context = vi.spyOn(vendorOnboardingService, 'getVendorContext').mockRejectedValue(new Error('no reads in demo'))
    useOnboardingStore.setState({
      draft: { ...createEmptyOnboardingDraft(), mobileVerified: true, currentStep: 7, completedSteps: [1, 2, 3, 4, 5, 6] as OnboardingStep[] },
      furthestVisitedStep: 7,
      draftOwnerId: '91',
    })
    render(<MemoryRouter><OnboardingWizard /></MemoryRouter>)
    await currentStepIs(7)
    leaveTab()
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await currentStepIs(8)
    expect(context).not.toHaveBeenCalled()
    expect(save).not.toHaveBeenCalled()
  })
})
