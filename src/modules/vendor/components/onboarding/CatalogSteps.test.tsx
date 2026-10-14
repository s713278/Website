// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import categoryFallbackImage from '@/assets/onboarding/category-fallback.svg'
import productFallbackImage from '@/assets/onboarding/product-fallback.svg'
import { vendorOnboardingService } from '@/shared/api'
import { useOnboardingStore } from '../../store/onboarding-store'
import { writeReferenceCache } from '../../lib/onboarding-catalog-cache'
import { invalidateOnboardingResources } from '../../lib/onboarding-resource-cache'
import { loadAccountResource } from '../../lib/onboarding-resume'
import { BusinessStep, CategoryStep, ProductStep } from './CatalogSteps'

afterEach(() => {
  cleanup()
  useOnboardingStore.getState().abandonDraft()
  useOnboardingStore.getState().setProductLimit(null)
  useOnboardingStore.getState().setAccountCatalog({ categoryIds: [], productIds: [] })
  vi.restoreAllMocks()
  vi.useRealTimers()
  invalidateOnboardingResources()
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

  it('shows skeleton tiles, not loading text, while more categories load', async () => {
    const category = (id: number) => ({ id, businessTypeId: 45, name: `Category ${id}`, description: null, icon: null, imageUrl: null, displayOrder: id })
    let resolveMore: (page: Awaited<ReturnType<typeof vendorOnboardingService.getCategories>>) => void = () => undefined
    vi.spyOn(vendorOnboardingService, 'getCategories')
      .mockResolvedValueOnce({ items: [category(4501)], pageNumber: 0, pageSize: 9, totalElements: 2, totalPages: 2, lastPage: false })
      .mockImplementationOnce(() => new Promise((resolve) => { resolveMore = resolve }))
    setCatalogDraft(45, [])
    render(<CategoryStep issues={[]} confirm={() => undefined} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Show more categories' }))

    expect((await screen.findByRole('status')).textContent).toBe('Loading more categories.')
    expect(screen.getByRole('button', { name: 'Show more categories' })).toHaveProperty('disabled', true)
    expect(document.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(3)

    await act(async () => resolveMore({ items: [category(4502)], pageNumber: 1, pageSize: 9, totalElements: 2, totalPages: 2, lastPage: true }))
    expect(screen.getByRole('status').textContent).toBe('All categories are loaded.')
    expect(document.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(0)
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
    const getBusinessTypes = vi.spyOn(vendorOnboardingService, 'getBusinessTypes')
    getBusinessTypes.mockResolvedValueOnce(wide)
    await loadAccountResource('88', 'businessTypes')
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

    fireEvent.click(await screen.findByRole('button', { name: 'Show more business types' }))

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

describe('catalog lists in sets of nine', () => {
  afterEach(() => vi.unstubAllGlobals())

  const product = (id: number) => ({
    id, name: `Item ${id}`, description: null, icon: null, imageUrl: null, measurementId: null, measurementName: 'COUNT',
  })
  const category = (id: number) => ({ id, businessTypeId: 53, name: `Category ${id}`, description: null, icon: null, imageUrl: null, displayOrder: id })
  const ids = (from: number, count: number) => Array.from({ length: count }, (_, index) => from + index)
  const shownNames = (pattern: RegExp) => screen.getAllByRole('button', { name: pattern }).map((card) => card.textContent?.match(pattern)?.[0])

  it('counts saved products in the first nine and leads with them, then shows the rest on request', async () => {
    const read = vi.spyOn(vendorOnboardingService, 'getProductsByCategory')
      .mockResolvedValueOnce({ items: ids(5201, 9).map(product), pageNumber: 0, pageSize: 9, totalElements: 12, totalPages: 2, lastPage: false })
      .mockResolvedValueOnce({ items: ids(5210, 3).map(product), pageNumber: 1, pageSize: 9, totalElements: 12, totalPages: 2, lastPage: true })
    setCatalogDraft(52, [{ id: 520, businessTypeId: 52, name: 'Bakery', description: null, imageUrl: null, displayOrder: 1 }])
    useOnboardingStore.getState().updateDraft((current) => ({
      ...current,
      products: [{ ...product(5298), categoryId: 520 }, { ...product(5299), categoryId: 520 }],
    }), 5)
    render(<ProductStep issues={[]} confirm={() => undefined} />)
    await screen.findByRole('button', { name: /Item 5201/ })

    expect(read.mock.calls[0][1]).toMatchObject({ pageNumber: 0, pageSize: 9 })
    expect(shownNames(/Item \d+/)).toEqual(['Item 5298', 'Item 5299', ...ids(5201, 7).map((id) => `Item ${id}`)])

    fireEvent.click(screen.getByRole('button', { name: 'Show more products' }))

    expect(await screen.findByRole('button', { name: /Item 5212/ })).toBeTruthy()
    expect(read.mock.calls[1][1]).toMatchObject({ pageNumber: 1, pageSize: 9 })
    expect(shownNames(/Item \d+/)).toHaveLength(14)
    expect(screen.queryByRole('button', { name: 'Show more products' })).toBeNull()
  })

  it('swaps the button for scroll loading after the first Show more press, focusing the first new card', async () => {
    const observers: Array<{ callback: IntersectionObserverCallback; disconnected: boolean }> = []
    vi.stubGlobal('IntersectionObserver', class {
      entry: { callback: IntersectionObserverCallback; disconnected: boolean }
      constructor(callback: IntersectionObserverCallback) {
        this.entry = { callback, disconnected: false }
        observers.push(this.entry)
      }
      observe() {}
      disconnect() { this.entry.disconnected = true }
    })
    const read = vi.spyOn(vendorOnboardingService, 'getCategories')
      .mockResolvedValueOnce({ items: ids(5301, 9).map(category), pageNumber: 0, pageSize: 9, totalElements: 27, totalPages: 3, lastPage: false })
      .mockResolvedValueOnce({ items: ids(5310, 9).map(category), pageNumber: 1, pageSize: 9, totalElements: 27, totalPages: 3, lastPage: false })
      .mockResolvedValueOnce({ items: ids(5319, 9).map(category), pageNumber: 2, pageSize: 9, totalElements: 27, totalPages: 3, lastPage: true })
    setCatalogDraft(53, [])
    render(<CategoryStep issues={[]} confirm={() => undefined} />)
    await screen.findByRole('button', { name: /Category 5301/ })

    expect(observers).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Show more categories' }))
    expect(await screen.findByRole('button', { name: /Category 5318/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Show more categories' })).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /Category 5310/ }))

    const live = observers.filter((observer) => !observer.disconnected)
    expect(live).toHaveLength(1)
    act(() => live[0].callback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver))

    expect(await screen.findByRole('button', { name: /Category 5327/ })).toBeTruthy()
    expect(read.mock.calls.map((call) => call[0]?.pageNumber)).toEqual([0, 1, 2])
  })

  it('lets a submitted store browse more business types while its saved type stays locked', async () => {
    emptyReferenceCache()
    const type = (id: number) => ({ id, name: `Business ${id}`, icon: null, displayOrder: id })
    vi.spyOn(vendorOnboardingService, 'getBusinessTypes').mockResolvedValueOnce({
      items: ids(5401, 9).map(type), pageNumber: 0, pageSize: 9, totalElements: 18, totalPages: 2, lastPage: false,
    })
    useOnboardingStore.getState().updateDraft((current) => ({ ...current, catalogSource: 'account' }), 3)
    render(<BusinessStep issues={[]} readOnly />)

    const card = await screen.findByRole('button', { name: /Business 5401/ })
    expect(card.matches(':disabled')).toBe(true)
    expect(screen.getByRole('button', { name: 'Show more business types' }).matches(':disabled')).toBe(false)
  })

  it('moves focus to the list when a press reveals locked business types', async () => {
    emptyReferenceCache()
    const type = (id: number) => ({ id, name: `Business ${id}`, icon: null, displayOrder: id })
    vi.spyOn(vendorOnboardingService, 'getBusinessTypes')
      .mockResolvedValueOnce({ items: ids(5501, 9).map(type), pageNumber: 0, pageSize: 9, totalElements: 18, totalPages: 2, lastPage: false })
      .mockResolvedValueOnce({ items: ids(5510, 9).map(type), pageNumber: 1, pageSize: 9, totalElements: 18, totalPages: 2, lastPage: true })
    useOnboardingStore.getState().updateDraft((current) => ({ ...current, catalogSource: 'account' }), 3)
    render(<BusinessStep issues={[]} readOnly />)
    await screen.findByRole('button', { name: /Business 5501/ })

    fireEvent.click(screen.getByRole('button', { name: 'Show more business types' }))

    await screen.findByRole('button', { name: /Business 5518/ })
    expect(document.activeElement).toBe(screen.getByRole('region', { name: 'Business type choices' }))
  })

  it('shows a category the vendor authors at once, even with nine already shown', async () => {
    emptyReferenceCache()
    vi.spyOn(vendorOnboardingService, 'getCategories').mockResolvedValueOnce({
      items: ids(5601, 9).map(category), pageNumber: 0, pageSize: 9, totalElements: 18, totalPages: 2, lastPage: false,
    })
    setCatalogDraft(53, [])
    render(<CategoryStep issues={[]} confirm={() => undefined} />)
    await screen.findByRole('button', { name: /Category 5609/ })

    act(() => useOnboardingStore.getState().updateDraft((current) => ({
      ...current,
      categories: [{ ...category(-1_000_001), name: 'Category authored' }],
    }), 4))

    expect(screen.getByRole('button', { name: /Category authored/ })).toBeTruthy()
    expect(screen.getAllByRole('button', { name: /Category (\d+|authored)/ })).toHaveLength(9)
  })

  it('leads with a newly authored category when nine choices were already saved', async () => {
    emptyReferenceCache()
    vi.spyOn(vendorOnboardingService, 'getCategories').mockResolvedValueOnce({
      items: ids(5901, 9).map(category), pageNumber: 0, pageSize: 9, totalElements: 18, totalPages: 2, lastPage: false,
    })
    setCatalogDraft(53, ids(5990, 9).map(category))
    render(<CategoryStep issues={[]} confirm={() => undefined} />)
    await screen.findByRole('button', { name: /Category 5990/ })

    act(() => { useOnboardingStore.getState().addPendingCategory({ name: 'Category authored', businessTypeId: 53 }) })

    expect(shownNames(/Category (\d+|authored)/)).toEqual(['Category authored', ...ids(5990, 8).map((id) => `Category ${id}`)])
  })

  it('still offers Show more when a search matches nothing loaded, and loads the next page', async () => {
    emptyReferenceCache()
    const read = vi.spyOn(vendorOnboardingService, 'getCategories')
      .mockResolvedValueOnce({ items: ids(5801, 9).map(category), pageNumber: 0, pageSize: 9, totalElements: 18, totalPages: 2, lastPage: false })
      .mockResolvedValueOnce({
        items: [...ids(5810, 8).map(category), { ...category(5818), name: 'Pickles' }],
        pageNumber: 1, pageSize: 9, totalElements: 18, totalPages: 2, lastPage: true,
      })
    setCatalogDraft(58, [])
    render(<CategoryStep issues={[]} confirm={() => undefined} />)
    await screen.findByRole('button', { name: /Category 5801/ })

    fireEvent.change(screen.getByLabelText('Search category'), { target: { value: 'pickles' } })

    expect(screen.getByText('No categories found')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Show more categories' }))

    const match = await screen.findByRole('button', { name: /Pickles/ })
    expect(read.mock.calls.map((call) => call[0]?.pageNumber)).toEqual([0, 1])
    expect(document.activeElement).toBe(match)
    expect(screen.queryByText('No categories found')).toBeNull()
  })

  it('loads only on presses while a search is active, never on scroll', async () => {
    emptyReferenceCache()
    const observers: Array<{ callback: IntersectionObserverCallback; disconnected: boolean }> = []
    vi.stubGlobal('IntersectionObserver', class {
      entry: { callback: IntersectionObserverCallback; disconnected: boolean }
      constructor(callback: IntersectionObserverCallback) {
        this.entry = { callback, disconnected: false }
        observers.push(this.entry)
      }
      observe() {}
      disconnect() { this.entry.disconnected = true }
    })
    const read = vi.spyOn(vendorOnboardingService, 'getCategories')
      .mockResolvedValueOnce({ items: ids(5831, 9).map(category), pageNumber: 0, pageSize: 9, totalElements: 27, totalPages: 3, lastPage: false })
      .mockResolvedValueOnce({ items: ids(5840, 9).map(category), pageNumber: 1, pageSize: 9, totalElements: 27, totalPages: 3, lastPage: false })
      .mockResolvedValueOnce({ items: ids(5849, 9).map(category), pageNumber: 2, pageSize: 9, totalElements: 27, totalPages: 3, lastPage: true })
    setCatalogDraft(58, [])
    render(<CategoryStep issues={[]} confirm={() => undefined} />)
    await screen.findByRole('button', { name: /Category 5831/ })

    fireEvent.change(screen.getByLabelText('Search category'), { target: { value: 'pickles' } })
    fireEvent.click(screen.getByRole('button', { name: 'Show more categories' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Show more categories' }).matches(':disabled')).toBe(false))
    expect(read).toHaveBeenCalledTimes(2)

    act(() => observers.filter((observer) => !observer.disconnected).forEach((observer) =>
      observer.callback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver)))
    expect(read).toHaveBeenCalledTimes(2)

    fireEvent.click(screen.getByRole('button', { name: 'Show more categories' }))
    await waitFor(() => expect(read).toHaveBeenCalledTimes(3))
    expect(read.mock.calls.map((call) => call[0]?.pageNumber)).toEqual([0, 1, 2])
  })

  it('does not load again when the step re-renders with the end of the list in view', async () => {
    emptyReferenceCache()
    const observers: Array<{ callback: IntersectionObserverCallback; disconnected: boolean }> = []
    vi.stubGlobal('IntersectionObserver', class {
      entry: { callback: IntersectionObserverCallback; disconnected: boolean }
      constructor(callback: IntersectionObserverCallback) {
        this.entry = { callback, disconnected: false }
        observers.push(this.entry)
      }
      observe() {}
      disconnect() { this.entry.disconnected = true }
    })
    vi.spyOn(vendorOnboardingService, 'getCategories')
      .mockResolvedValueOnce({ items: ids(5701, 9).map(category), pageNumber: 0, pageSize: 9, totalElements: 27, totalPages: 3, lastPage: false })
      .mockResolvedValueOnce({ items: ids(5710, 9).map(category), pageNumber: 1, pageSize: 9, totalElements: 27, totalPages: 3, lastPage: false })
    setCatalogDraft(53, [])
    render(<CategoryStep issues={[]} confirm={() => undefined} />)
    await screen.findByRole('button', { name: /Category 5701/ })
    fireEvent.click(screen.getByRole('button', { name: 'Show more categories' }))
    await screen.findByRole('button', { name: /Category 5718/ })
    const built = observers.length

    act(() => useOnboardingStore.getState().updateDraft((current) => ({ ...current }), 4))

    expect(observers).toHaveLength(built)
  })
})
