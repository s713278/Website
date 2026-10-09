// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import categoryFallbackImage from '@/assets/onboarding/category-fallback.svg'
import productFallbackImage from '@/assets/onboarding/product-fallback.svg'
import { mapVendorContext, vendorOnboardingService } from '@/shared/api'
import { useOnboardingStore } from '../../store/onboarding-store'
import { writeReferenceCache } from '../../lib/onboarding-catalog-cache'
import { loadServerOnboardingState } from '../../lib/onboarding-resume'
import { BusinessStep, CategoryStep, ProductStep } from './CatalogSteps'

afterEach(() => {
  cleanup()
  useOnboardingStore.getState().abandonDraft()
  useOnboardingStore.getState().setProductLimit(null)
  useOnboardingStore.getState().setAccountCatalog({ categoryIds: [], productIds: [] })
  vi.restoreAllMocks()
  vi.useRealTimers()
})

function setCatalogDraft(
  businessTypeId: number,
  categories: Array<{
    id: number
    name: string
    businessTypeId: number
    description: string | null
    imageUrl: string | null
    displayOrder: number | null
  }>,
) {
  useOnboardingStore.getState().updateDraft((current) => ({
    ...current,
    catalogSource: 'account',
    business: {
      ...current.business,
      businessType: {
        id: businessTypeId,
        name: 'Test business',
        icon: null,
        displayOrder: null,
      },
    },
    categories,
    products: [],
  }), 3)
}

function imageFor(selector: string) {
  const image = document.querySelector(selector)
  if (!(image instanceof HTMLImageElement)) {
    throw new Error(`Expected an image matching ${selector}`)
  }
  return image
}

describe('catalog step reference images', () => {
  it('tries a category icon, then image_path, then the category fallback', async () => {
    const icon = 'https://cdn.example.test/categories/icon.svg'
    const imagePath = 'https://cdn.example.test/categories/image.jpg'
    vi.spyOn(vendorOnboardingService, 'getCategories').mockResolvedValue({
      items: [{
        id: 4101,
        businessTypeId: 41,
        name: 'Produce',
        description: 'Fresh produce',
        icon,
        imageUrl: imagePath,
        displayOrder: 1,
      }],
      pageNumber: 0,
      pageSize: 12,
      totalElements: 1,
      totalPages: 1,
      lastPage: true,
    })
    setCatalogDraft(41, [])

    render(<CategoryStep issues={[]} confirm={() => undefined} />)
    const image = await waitFor(() => imageFor('#categories img'))

    expect(image.getAttribute('src')).toBe(icon)
    fireEvent.error(image)
    await waitFor(() => expect(image.getAttribute('src')).toBe(imagePath))
    fireEvent.error(image)
    await waitFor(() => expect(image.getAttribute('src')).toBe(categoryFallbackImage))
  })

  it('tries a product icon, then image_path, then the product fallback', async () => {
    const icon = 'https://cdn.example.test/products/icon.svg'
    const imagePath = 'https://cdn.example.test/products/image.jpg'
    vi.spyOn(vendorOnboardingService, 'getProductsByCategory').mockResolvedValue({
      items: [{
        id: 4201,
        name: 'Tomatoes',
        description: 'Fresh tomatoes',
        icon,
        imageUrl: imagePath,
        measurementId: null,
        measurementName: 'COUNT',
      }],
      pageNumber: 0,
      pageSize: 12,
      totalElements: 1,
      totalPages: 1,
      lastPage: true,
    })
    setCatalogDraft(42, [{
      id: 420,
      businessTypeId: 42,
      name: 'Produce',
      description: null,
      imageUrl: null,
      displayOrder: 1,
    }])

    render(<ProductStep issues={[]} confirm={() => undefined} />)
    const image = await waitFor(() => imageFor('#products img'))

    expect(image.getAttribute('src')).toBe(icon)
    fireEvent.error(image)
    await waitFor(() => expect(image.getAttribute('src')).toBe(imagePath))
    fireEvent.error(image)
    await waitFor(() => expect(image.getAttribute('src')).toBe(productFallbackImage))
  })
})

describe('product step messages', () => {
  const product = (id: number, name: string) => ({
    id, name, description: null, icon: null, imageUrl: null, measurementId: null, measurementName: 'COUNT',
  })

  function renderProducts() {
    vi.spyOn(vendorOnboardingService, 'getProductsByCategory').mockResolvedValue({
      items: [product(4301, 'Skim Milk'), product(4302, 'Cow Milk')],
      pageNumber: 0, pageSize: 12, totalElements: 2, totalPages: 1, lastPage: true,
    })
    setCatalogDraft(43, [{ id: 430, businessTypeId: 43, name: 'Dairy', description: null, imageUrl: null, displayOrder: 1 }])
    render(<ProductStep issues={[]} confirm={() => undefined} />)
  }

  it('states the plan limit once, even after the vendor tries another product', async () => {
    useOnboardingStore.getState().setProductLimit(1)
    renderProducts()
    fireEvent.click(await screen.findByRole('button', { name: /Skim Milk/ }))
    fireEvent.click(screen.getByRole('button', { name: /Cow Milk/ }))

    expect(screen.getAllByText(/reached your plan.s limit of 1 products/)).toHaveLength(1)
    expect(screen.getByRole('button', { name: /Cow Milk/ }).getAttribute('aria-pressed')).toBe('false')
  })

  it('answers a tap on a saved product in one short sentence', async () => {
    renderProducts()
    fireEvent.click(await screen.findByRole('button', { name: /Skim Milk/ }))
    act(() => useOnboardingStore.getState().setAccountCatalog({ categoryIds: [430], productIds: [4301] }))
    fireEvent.click(screen.getByRole('button', { name: /Skim Milk/ }))

    expect(screen.getByText('Skim Milk is saved, so it can’t be removed here. You can set it inactive in the next step.')).toBeTruthy()
  })

  it('clears the saved-product note after a few seconds, counted from the latest tap', async () => {
    renderProducts()
    fireEvent.click(await screen.findByRole('button', { name: /Skim Milk/ }))
    act(() => useOnboardingStore.getState().setAccountCatalog({ categoryIds: [430], productIds: [4301] }))
    vi.useFakeTimers()
    const note = /Skim Milk is saved/
    fireEvent.click(screen.getByRole('button', { name: /Skim Milk/ }))
    act(() => vi.advanceTimersByTime(3000))
    fireEvent.click(screen.getByRole('button', { name: /Skim Milk/ }))
    act(() => vi.advanceTimersByTime(3000))
    expect(screen.queryByText(note)).toBeTruthy()
    act(() => vi.advanceTimersByTime(1000))
    expect(screen.queryByText(note)).toBeNull()
  })
})

describe('category step messages', () => {
  it('clears the saved-category note after a few seconds', async () => {
    vi.spyOn(vendorOnboardingService, 'getCategories').mockResolvedValue({
      items: [{ id: 4401, businessTypeId: 44, name: 'Pickles', description: null, icon: null, imageUrl: null, displayOrder: 1 }],
      pageNumber: 0, pageSize: 12, totalElements: 1, totalPages: 1, lastPage: true,
    })
    setCatalogDraft(44, [{ id: 4401, businessTypeId: 44, name: 'Pickles', description: null, imageUrl: null, displayOrder: 1 }])
    useOnboardingStore.getState().setAccountCatalog({ categoryIds: [4401], productIds: [] })
    render(<CategoryStep issues={[]} confirm={() => undefined} />)
    const card = await screen.findByRole('button', { name: /Pickles/ })
    vi.useFakeTimers()
    fireEvent.click(card)
    expect(screen.queryByText('Pickles is saved, so it can’t be removed here.')).toBeTruthy()
    act(() => vi.advanceTimersByTime(4000))
    expect(screen.queryByText('Pickles is saved, so it can’t be removed here.')).toBeNull()
  })
})

// The reference cache is module-level with no reset; 48 other keys push every earlier entry out.
function emptyReferenceCache() {
  for (let index = 0; index < 48; index++) {
    writeReferenceCache(
      `test-filler:${index}`,
      { items: [], pageNumber: 0, pageSize: 9, totalElements: 0, totalPages: 0, lastPage: true },
      false,
    )
  }
}

describe('business step after a resume that read the catalog', () => {
  const type = (id: number) => ({ id, name: `Business ${id}`, icon: null, displayOrder: id })
  const wide = {
    items: Array.from({ length: 30 }, (_, index) => type(index + 1)),
    pageNumber: 0, pageSize: 100, totalElements: 30, totalPages: 1, lastPage: true,
  }

  async function resumeThenRender() {
    emptyReferenceCache()
    vi.spyOn(vendorOnboardingService, 'getVendorContext').mockResolvedValue(mapVendorContext({
      data: {
        vendor_id: '88', vendor_status: 'SETTING_UP', approval_status: 'PENDING',
        onboarding: { status: 'IN_PROGRESS', next_step: 4 },
      },
    }))
    vi.spyOn(vendorOnboardingService, 'getVendorProfile').mockResolvedValue({
      businessName: 'Store', businessType: 'Business 3', ownerName: '', contactPerson: '', contactNumber: '',
    })
    vi.spyOn(vendorOnboardingService, 'getVendorCategories').mockResolvedValue([])
    const getBusinessTypes = vi.spyOn(vendorOnboardingService, 'getBusinessTypes')
    getBusinessTypes.mockResolvedValueOnce(wide)
    await loadServerOnboardingState('88')
    getBusinessTypes.mockClear()
    useOnboardingStore.getState().updateDraft((current) => ({ ...current, catalogSource: 'account' }), 3)
    render(<BusinessStep issues={[]} />)
    return getBusinessTypes
  }

  it('shows the first nine types without asking for them', async () => {
    const getBusinessTypes = await resumeThenRender()

    expect(await screen.findByRole('button', { name: /Business 1$/ })).toBeTruthy()
    // Let the zero-delay fetch timer run, were there one.
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)) })

    expect(getBusinessTypes).not.toHaveBeenCalled()
    const cards = screen.getAllByRole('button', { name: /^Business \d+$/ })
    expect(cards.map((card) => card.textContent)).toEqual(
      Array.from({ length: 9 }, (_, index) => `Business ${index + 1}`),
    )
  })

  it('requests page 1 of nine when the vendor shows more', async () => {
    const getBusinessTypes = await resumeThenRender()
    getBusinessTypes.mockResolvedValue({
      items: [type(10), type(11)], pageNumber: 1, pageSize: 9, totalElements: 30, totalPages: 4, lastPage: false,
    })

    fireEvent.click(await screen.findByRole('button', { name: 'Show more' }))

    await waitFor(() => expect(getBusinessTypes).toHaveBeenCalledTimes(1))
    expect(getBusinessTypes.mock.calls[0][0]).toMatchObject({ pageNumber: 1, pageSize: 9 })
    expect(await screen.findByRole('button', { name: /Business 10$/ })).toBeTruthy()
  })

  it('still requests a keyword search with the keyword', async () => {
    const getBusinessTypes = await resumeThenRender()
    getBusinessTypes.mockResolvedValue({
      items: [type(21)], pageNumber: 0, pageSize: 9, totalElements: 1, totalPages: 1, lastPage: true,
    })

    fireEvent.change(await screen.findByLabelText('Search business type'), { target: { value: 'bakery' } })
    fireEvent.submit(screen.getByRole('search'))

    await waitFor(() => expect(getBusinessTypes).toHaveBeenCalledTimes(1))
    expect(getBusinessTypes.mock.calls[0][0]).toMatchObject({ keyword: 'bakery', pageNumber: 0, pageSize: 9 })
  })
})

describe('product step reads a category only once its panel has been opened', () => {
  const product = (id: number, name: string) => ({
    id, name, description: null, icon: null, imageUrl: null, measurementId: null, measurementName: 'COUNT',
  })
  const category = (id: number, name: string) => ({
    id, businessTypeId: 51, name, description: null, imageUrl: null, displayOrder: id,
  })

  function setup() {
    emptyReferenceCache()
    const read = vi.spyOn(vendorOnboardingService, 'getProductsByCategory').mockImplementation(async (categoryId) => ({
      items: [product(categoryId * 10 + 1, `Item of ${categoryId}`)],
      pageNumber: 0, pageSize: 12, totalElements: 1, totalPages: 1, lastPage: true,
    }))
    setCatalogDraft(51, [category(510, 'Fruit'), category(511, 'Dairy'), category(512, 'Bakery')])
    return read
  }

  const readIds = (read: ReturnType<typeof setup>) => read.mock.calls.map((call) => call[0])

  function setPanelOpen(categoryId: number, open: boolean) {
    const details = document.getElementById(`category-products-${categoryId}`)
    if (!(details instanceof HTMLDetailsElement)) throw new Error(`Expected a panel for category ${categoryId}`)
    act(() => {
      details.open = open
      fireEvent(details, new Event('toggle'))
    })
  }

  const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)) })

  it('reads only the panel open by default on the first render', async () => {
    const read = setup()
    render(<ProductStep issues={[]} confirm={() => undefined} />)

    expect(await screen.findByRole('button', { name: /Item of 510/ })).toBeTruthy()
    await settle()

    expect(readIds(read)).toEqual([510])
  })

  it('reads another panel exactly once when it is opened, and not again on reopening', async () => {
    const read = setup()
    render(<ProductStep issues={[]} confirm={() => undefined} />)
    await screen.findByRole('button', { name: /Item of 510/ })

    setPanelOpen(511, true)
    expect(await screen.findByRole('button', { name: /Item of 511/ })).toBeTruthy()
    expect(readIds(read)).toEqual([510, 511])

    setPanelOpen(510, true)
    setPanelOpen(511, true)
    await settle()

    expect(readIds(read)).toEqual([510, 511])
    expect(readIds(read).filter((id) => id === 510)).toHaveLength(1)
  })

  it('counts a closed panel’s selected products without reading it', async () => {
    const read = setup()
    useOnboardingStore.getState().updateDraft((current) => ({
      ...current,
      products: [{ ...product(5121, 'Rye Loaf'), categoryId: 512 }],
    }), 5)
    render(<ProductStep issues={[]} confirm={() => undefined} />)
    await screen.findByRole('button', { name: /Item of 510/ })
    await settle()

    const summary = document.getElementById('category-products-512')?.querySelector('summary')
    expect(summary?.textContent).toContain('1 selected')
    expect(readIds(read)).toEqual([510])
  })
})
