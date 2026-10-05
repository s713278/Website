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
  if (scrollIntoView) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', scrollIntoView)
  else delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView
  if (scrollTo) Object.defineProperty(HTMLElement.prototype, 'scrollTo', scrollTo)
  else delete (HTMLElement.prototype as Partial<HTMLElement>).scrollTo
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

const follows = (first: Node, second: Node) =>
  Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING)

// The wizard's polite live region that announces the first issue after a failed action.
function liveRegion() {
  const region = document.querySelector('[role="status"][aria-live="polite"]')
  if (!(region instanceof HTMLElement)) throw new Error('Expected the issue live region')
  return region
}

// On-screen copies of a message, leaving out the sr-only live region that also announces it.
function shownCopies(text: string) {
  return screen.getAllByText(text).filter((element) => !liveRegion().contains(element))
}

async function openSizes() {
  fireEvent.click(await screen.findByRole('button', { name: /^Step 6,/ }))
  return screen.findByRole('button', { name: 'Add another size to Test Juice' })
}

function fillNewSize() {
  fireEvent.change(screen.getAllByLabelText('Quantity').at(-1)!, { target: { value: '2' } })
  fireEvent.change(screen.getAllByLabelText('MRP (₹)').at(-1)!, { target: { value: '180' } })
  fireEvent.change(screen.getAllByLabelText('Discounted price (₹)').at(-1)!, { target: { value: '160' } })
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
    const card = screen.getByRole('group', { name: 'Test Juice, 1 L size' })
    expect(screen.queryByLabelText('Quantity')).toBeNull()
    expect(within(card).getByRole('switch', { name: '1 L status: active' }).matches(':disabled')).toBe(true)
    expect(within(card).getByRole('button', { name: 'Remove 1 L' }).matches(':disabled')).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await screen.findByRole('button', { name: /Step 7,.*You are here/ })
    expect(vendorOnboardingService.createSkus).not.toHaveBeenCalled()
  })

  it('renders approved saved sizes as read-only rows', async () => {
    renderAccount('APPROVED')
    await openSizes()

    const card = screen.getByRole('group', { name: 'Test Juice, 1 L size' })
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

    const card = screen.getByRole('group', { name: 'Test Juice, 2 L size' })
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
    expect(screen.queryByRole('group', { name: 'Test Juice, 2 L size' })).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.queryByText('Remove this size?')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Remove size' })).toBeNull()
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
    expect(within(screen.getByRole('group', { name: 'Test Juice, 1 L size' })).getByRole('switch', { name: '1 L status: active' }).matches(':disabled')).toBe(true)
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

    // The failure is shown inline on Step 6, once, and never in a wizard-level summary.
    await waitFor(() => expect(document.getElementById('skus-error')?.textContent).toBe('Could not create size'))
    await waitFor(() => expect(document.activeElement).toBe(document.getElementById('skus')))
    expect(document.getElementById('skus')?.getAttribute('tabindex')).toBe('-1')
    expect(liveRegion().textContent).toBe('Could not create size')
    expect(shownCopies('Could not create size')).toHaveLength(1)
    expect(screen.queryByText(/Please fix/)).toBeNull()
    expect(useOnboardingStore.getState().draft.currentStep).toBe(6)
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

    fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }))

    const price = lastField('Discounted price (₹)')
    await waitFor(() => expect(fieldError(price)?.textContent).toBe('Discounted price cannot exceed MRP.'))
    expect(price.getAttribute('aria-invalid')).toBe('true')
    // The first faulty field takes focus once the step has rendered, and its message is announced.
    await waitFor(() => expect(document.activeElement).toBe(price))
    expect(liveRegion().textContent).toBe('Discounted price cannot exceed MRP.')
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

    fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }))

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

    fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }))

    await waitFor(() => expect(fieldError(lastField('MRP (₹)'))?.textContent).toBe('MRP can have at most two decimal places.'))
    expect(fieldError(lastField('Discounted price (₹)'))?.textContent).toBe('Discounted price cannot exceed MRP.')
    expectNoSummary()
  })

  it('keeps a failed save message while the vendor edits fields', { timeout }, async () => {
    renderAccount('APPROVED')
    fireEvent.click(await openSizes())
    fillNewSize()
    vi.mocked(vendorOnboardingService.createSkus).mockRejectedValue(new Error('Could not create size'))

    fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }))

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
    fireEvent.click(screen.getByRole('button', { name: 'Add another size to Test Juice' }))
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
    expect(liveRegion().textContent).toBe('Could not save checkout')
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
    expect(liveRegion().textContent).toBe('Could not save payments')
    expectNoSummary()
    expect(useOnboardingStore.getState().draft.currentStep).toBe(8)
  })

  it('shows a failed go-live on Step 10 above the consequence sentence', async () => {
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

describe('Step 10 readiness issues', () => {
  it('focuses the readiness list when Submit finds issues owned by earlier steps', async () => {
    renderAccount('APPROVED', 10)
    await screen.findByRole('button', { name: /Step 10,.*You are here/ })
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

  it('drops the store details note once the store is submitted and Step 9 is read-only', async () => {
    renderAccount('APPROVED')
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
