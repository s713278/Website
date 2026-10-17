// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import categoryFallbackImage from '@/assets/onboarding/category-fallback.svg'
import productFallbackImage from '@/assets/onboarding/product-fallback.svg'
import { vendorOnboardingService } from '@/shared/api'
import { useOnboardingStore } from '../../store/onboarding-store'
import { writeReferenceCache } from '../../lib/onboarding-catalog-cache'
import { ONBOARDING_CONFIG } from '../../types/onboarding'
import { invalidateOnboardingResources } from '../../lib/onboarding-resource-cache'
import { loadAccountResource } from '../../lib/onboarding-resume'
import { readCategoryReferenceFirstPage, readProductReferenceFirstPage, resetFirstPageReadsForTests } from '../../hooks/use-onboarding-catalog'
import { BusinessStep, CategoryStep, ProductStep } from './CatalogSteps'

afterEach(() => {
  cleanup()
  useOnboardingStore.getState().abandonDraft()
  useOnboardingStore.getState().setProductLimit(null)
  useOnboardingStore.getState().setAccountCatalog({ categoryIds: [], productIds: [] })
  vi.restoreAllMocks()
  vi.useRealTimers()
  invalidateOnboardingResources()
  resetFirstPageReadsForTests()
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

  it('shows a spinner below the list, not skeleton tiles, while more categories load', async () => {
    const category = (id: number) => ({ id, businessTypeId: 45, name: `Category ${id}`, description: null, icon: null, imageUrl: null, displayOrder: id })
    let resolveMore: (page: Awaited<ReturnType<typeof vendorOnboardingService.getCategories>>) => void = () => undefined
    vi.spyOn(vendorOnboardingService, 'getCategories')
      .mockResolvedValueOnce({ items: [category(4501)], pageNumber: 0, pageSize: 9, totalElements: 2, totalPages: 2, lastPage: false })
      .mockImplementationOnce(() => new Promise((resolve) => { resolveMore = resolve }))
    setCatalogDraft(45, [])
    render(<CategoryStep issues={[]} confirm={() => undefined} />)
    const spinner = () => document.querySelector('#categories ~ div > svg.animate-spin')

    fireEvent.click(await screen.findByRole('button', { name: 'Show more categories' }))

    expect((await screen.findByRole('status')).textContent).toBe('Loading more categories.')
    expect(screen.getByRole('button', { name: 'Show more categories' }).getAttribute('aria-disabled')).toBe('true')
    expect(screen.getByRole('button', { name: /Category 4501/ })).toBeTruthy()
    expect(spinner()?.getAttribute('aria-hidden')).toBe('true')
    expect(document.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(0)

    await act(async () => resolveMore({ items: [category(4502)], pageNumber: 1, pageSize: 9, totalElements: 2, totalPages: 2, lastPage: true }))
    expect(screen.getByRole('status').textContent).toBe('All categories are loaded.')
    expect(spinner()).toBeNull()
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

describe('business step loading', () => {
  const page = (id: number) => ({
    items: [{ id, name: `Business ${id}`, icon: null, displayOrder: id }],
    pageNumber: 0, pageSize: 9, totalElements: 1, totalPages: 1, lastPage: true,
  })
  const stepSpinner = () => screen.queryByRole('status', { name: 'Loading this step' })

  it('shows only the step spinner until the first list arrives, then the search and the list', async () => {
    emptyReferenceCache()
    let resolveFirst: (value: ReturnType<typeof page>) => void = () => undefined
    const read = vi.spyOn(vendorOnboardingService, 'getBusinessTypes')
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve }))
    useOnboardingStore.getState().updateDraft((current) => ({ ...current, catalogSource: 'account' }), 3)
    render(<BusinessStep issues={[]} />)

    expect(stepSpinner()).toBeTruthy()
    expect(screen.queryByLabelText('Search business type')).toBeNull()

    await waitFor(() => expect(read).toHaveBeenCalledTimes(1))
    expect(stepSpinner()).toBeTruthy()
    await act(async () => resolveFirst(page(61)))
    expect(await screen.findByRole('button', { name: /Business 61$/ })).toBeTruthy()
    expect(stepSpinner()).toBeNull()
    expect(screen.getByLabelText('Search business type')).toBeTruthy()
  })

  it('keeps the search input mounted while a search loads, with the spinner in the list', async () => {
    emptyReferenceCache()
    let resolveSearch: (value: ReturnType<typeof page>) => void = () => undefined
    vi.spyOn(vendorOnboardingService, 'getBusinessTypes')
      .mockResolvedValueOnce(page(62))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSearch = resolve }))
    useOnboardingStore.getState().updateDraft((current) => ({ ...current, catalogSource: 'account' }), 3)
    render(<BusinessStep issues={[]} />)
    await screen.findByRole('button', { name: /Business 62$/ })

    const input = screen.getByLabelText('Search business type')
    input.focus()
    fireEvent.change(input, { target: { value: 'bakery' } })
    fireEvent.submit(screen.getByRole('search'))

    expect(await screen.findByRole('status', { name: 'Loading business types' })).toBeTruthy()
    expect(stepSpinner()).toBeNull()
    expect(screen.getByLabelText('Search business type')).toBe(input)
    expect(document.activeElement).toBe(input)

    await act(async () => resolveSearch(page(63)))
    expect(await screen.findByRole('button', { name: /Business 63$/ })).toBeTruthy()
    expect(screen.queryByRole('status', { name: 'Loading business types' })).toBeNull()
    expect(screen.getByLabelText('Search business type')).toBe(input)
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

  const savedIn = (categoryId: number, id: number, name: string) => useOnboardingStore.getState().updateDraft((current) => ({
    ...current,
    products: [{ ...product(id, name), categoryId }],
  }), 5)
  const panel = (categoryId: number) => document.getElementById(`category-products-${categoryId}`)!

  it('shows a later-opened panel’s spinner alone, then its saved and listed products together', async () => {
    const read = setup()
    savedIn(511, 5119, 'Saved Milk')
    let resolveDairy: (page: Awaited<ReturnType<typeof vendorOnboardingService.getProductsByCategory>>) => void = () => undefined
    read.mockImplementationOnce(async () => ({
      items: [product(5101, 'Item of 510')], pageNumber: 0, pageSize: 12, totalElements: 1, totalPages: 1, lastPage: true,
    })).mockImplementationOnce(() => new Promise((resolve) => { resolveDairy = resolve }))
    render(<ProductStep issues={[]} confirm={() => undefined} />)
    await screen.findByRole('button', { name: /Item of 510/ })

    setPanelOpen(511, true)
    await waitFor(() => expect(readIds(read)).toEqual([510, 511]))
    const dairy = within(panel(511))
    expect(dairy.getByRole('status', { name: 'Loading products' })).toBeTruthy()
    expect(dairy.queryByRole('button', { name: /Saved Milk/ })).toBeNull()
    expect(dairy.queryByLabelText('Search in Dairy')).toBeNull()

    await act(async () => resolveDairy({
      items: [product(5111, 'Item of 511')], pageNumber: 0, pageSize: 12, totalElements: 1, totalPages: 1, lastPage: true,
    }))
    expect(dairy.getByRole('button', { name: /Saved Milk/ })).toBeTruthy()
    expect(dairy.getByRole('button', { name: /Item of 511/ })).toBeTruthy()
    expect(dairy.queryByRole('status', { name: 'Loading products' })).toBeNull()
    expect(dairy.getByLabelText('Search in Dairy')).toBeTruthy()
  })

  it('shows only the error when a panel’s first read fails, then every product at once on retry', async () => {
    const read = setup()
    savedIn(510, 5109, 'Saved Mango')
    read.mockRejectedValueOnce(new Error('Products are down'))
    render(<ProductStep issues={[]} confirm={() => undefined} />)
    const fruit = within(panel(510))

    expect(await fruit.findByText('Something went wrong')).toBeTruthy()
    expect(fruit.queryByText('Products are down')).toBeNull()
    expect(fruit.queryByRole('button', { name: /Saved Mango/ })).toBeNull()
    expect(fruit.queryByRole('button', { name: /Item of 510/ })).toBeNull()
    expect(fruit.queryByLabelText('Search in Fruit')).toBeNull()

    fireEvent.click(fruit.getByRole('button', { name: 'Try again' }))
    expect(await fruit.findByRole('button', { name: /Item of 510/ })).toBeTruthy()
    expect(fruit.getByRole('button', { name: /Saved Mango/ })).toBeTruthy()
    expect(fruit.queryByRole('alert')).toBeNull()
    expect(readIds(read)).toEqual([510, 510])
  })
})

describe('first-page reads in flight are shared', () => {
  const categoryPage = (id: number) => ({
    items: [{ id, businessTypeId: 77, name: `Category ${id}`, description: null, icon: null, imageUrl: null, displayOrder: 1 }],
    pageNumber: 0, pageSize: 9, totalElements: 1, totalPages: 1, lastPage: true,
  })

  it('sends one request for two concurrent prefetches of one category list', async () => {
    let resolve: (page: ReturnType<typeof categoryPage>) => void = () => undefined
    const read = vi.spyOn(vendorOnboardingService, 'getCategories')
      .mockImplementation(() => new Promise((settle) => { resolve = settle }))

    const first = readCategoryReferenceFirstPage('account', 77)
    const second = readCategoryReferenceFirstPage('account', 77)
    expect(read).toHaveBeenCalledTimes(1)
    resolve(categoryPage(7701))
    await expect(Promise.all([first, second])).resolves.toBeDefined()
    expect(read).toHaveBeenCalledTimes(1)
  })

  it('sends one request for two concurrent prefetches of one product panel, and reads again after a failure', async () => {
    const read = vi.spyOn(vendorOnboardingService, 'getProductsByCategory')
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValue({ items: [], pageNumber: 0, pageSize: 12, totalElements: 0, totalPages: 0, lastPage: true })

    const failed = await Promise.allSettled([readProductReferenceFirstPage('account', 7702), readProductReferenceFirstPage('account', 7702)])
    expect(failed.map((result) => result.status)).toEqual(['rejected', 'rejected'])
    expect(read).toHaveBeenCalledTimes(1)

    await readProductReferenceFirstPage('account', 7702)
    expect(read).toHaveBeenCalledTimes(2)
  })

  it('lets a category step that mounts mid-prefetch join the read instead of sending its own', async () => {
    let resolve: (page: ReturnType<typeof categoryPage>) => void = () => undefined
    const read = vi.spyOn(vendorOnboardingService, 'getCategories')
      .mockImplementation(() => new Promise((settle) => { resolve = settle }))
    setCatalogDraft(78, [])
    const prefetch = readCategoryReferenceFirstPage('account', 78)
    render(<CategoryStep issues={[]} confirm={() => undefined} />)
    await act(async () => { await new Promise((settle) => setTimeout(settle, 10)) })
    expect(read).toHaveBeenCalledTimes(1)

    await act(async () => resolve(categoryPage(7801)))
    await prefetch
    expect(await screen.findByRole('button', { name: /Category 7801/ })).toBeTruthy()
    expect(read).toHaveBeenCalledTimes(1)
  })
})

describe('catalog lists in sets of one page', () => {
  afterEach(() => vi.unstubAllGlobals())

  // Steps 4 and 5 show one server page per set; Step 3's business types keep their own size.
  const categorySet = ONBOARDING_CONFIG.categoryPageSize
  const productSet = ONBOARDING_CONFIG.productPageSize

  const product = (id: number) => ({
    id, name: `Item ${id}`, description: null, icon: null, imageUrl: null, measurementId: null, measurementName: 'COUNT',
  })
  const category = (id: number) => ({ id, businessTypeId: 53, name: `Category ${id}`, description: null, icon: null, imageUrl: null, displayOrder: id })
  const ids = (from: number, count: number) => Array.from({ length: count }, (_, index) => from + index)
  const shownNames = (pattern: RegExp) => screen.getAllByRole('button', { name: pattern }).map((card) => card.textContent?.match(pattern)?.[0])

  it('counts saved products in the first set and leads with them, then shows the rest on request', async () => {
    const total = productSet + 3
    const read = vi.spyOn(vendorOnboardingService, 'getProductsByCategory')
      .mockResolvedValueOnce({ items: ids(5201, productSet).map(product), pageNumber: 0, pageSize: productSet, totalElements: total, totalPages: 2, lastPage: false })
      .mockResolvedValueOnce({ items: ids(5201 + productSet, 3).map(product), pageNumber: 1, pageSize: productSet, totalElements: total, totalPages: 2, lastPage: true })
    setCatalogDraft(52, [{ id: 520, businessTypeId: 52, name: 'Bakery', description: null, imageUrl: null, displayOrder: 1 }])
    useOnboardingStore.getState().updateDraft((current) => ({
      ...current,
      products: [{ ...product(5298), categoryId: 520 }, { ...product(5299), categoryId: 520 }],
    }), 5)
    render(<ProductStep issues={[]} confirm={() => undefined} />)
    await screen.findByRole('button', { name: /Item 5201/ })

    expect(read.mock.calls[0][1]).toMatchObject({ pageNumber: 0, pageSize: productSet })
    expect(shownNames(/Item \d+/)).toEqual(['Item 5298', 'Item 5299', ...ids(5201, productSet - 2).map((id) => `Item ${id}`)])

    fireEvent.click(screen.getByRole('button', { name: 'Show more products' }))

    expect(await screen.findByRole('button', { name: new RegExp(`Item ${5200 + total}`) })).toBeTruthy()
    expect(read.mock.calls[1][1]).toMatchObject({ pageNumber: 1, pageSize: productSet })
    expect(shownNames(/Item \d+/)).toHaveLength(total + 2)
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
      .mockResolvedValueOnce({ items: ids(5301, categorySet).map(category), pageNumber: 0, pageSize: categorySet, totalElements: 3 * categorySet, totalPages: 3, lastPage: false })
      .mockResolvedValueOnce({ items: ids(5301 + categorySet, categorySet).map(category), pageNumber: 1, pageSize: categorySet, totalElements: 3 * categorySet, totalPages: 3, lastPage: false })
      .mockResolvedValueOnce({ items: ids(5301 + 2 * categorySet, categorySet).map(category), pageNumber: 2, pageSize: categorySet, totalElements: 3 * categorySet, totalPages: 3, lastPage: true })
    setCatalogDraft(53, [])
    render(<CategoryStep issues={[]} confirm={() => undefined} />)
    await screen.findByRole('button', { name: /Category 5301/ })

    expect(observers).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Show more categories' }))
    expect(await screen.findByRole('button', { name: new RegExp(`Category ${5300 + 2 * categorySet}`) })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Show more categories' })).toBeNull()
    // Focus and the scroll observer both arrive in passive effects, after the cards render.
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: new RegExp(`Category ${5301 + categorySet}`) })))

    await waitFor(() => expect(observers.filter((observer) => !observer.disconnected)).toHaveLength(1))
    const live = observers.filter((observer) => !observer.disconnected)
    act(() => live[0].callback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver))

    expect(await screen.findByRole('button', { name: new RegExp(`Category ${5300 + 3 * categorySet}`) })).toBeTruthy()
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
    expect(screen.getByRole('button', { name: 'Show more business types' }).getAttribute('aria-disabled')).toBe('false')
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
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('region', { name: 'Business type choices' })))
  })

  it('shows a category the vendor authors at once, even with a full set already shown', async () => {
    emptyReferenceCache()
    vi.spyOn(vendorOnboardingService, 'getCategories').mockResolvedValueOnce({
      items: ids(5601, categorySet).map(category), pageNumber: 0, pageSize: categorySet, totalElements: 2 * categorySet, totalPages: 2, lastPage: false,
    })
    setCatalogDraft(53, [])
    render(<CategoryStep issues={[]} confirm={() => undefined} />)
    await screen.findByRole('button', { name: new RegExp(`Category ${5600 + categorySet}`) })

    act(() => useOnboardingStore.getState().updateDraft((current) => ({
      ...current,
      categories: [{ ...category(-1_000_001), name: 'Category authored' }],
    }), 4))

    expect(screen.getByRole('button', { name: /Category authored/ })).toBeTruthy()
    expect(screen.getAllByRole('button', { name: /Category (\d+|authored)/ })).toHaveLength(categorySet)
  })

  it('leads with a newly authored category when a full set of choices was already saved', async () => {
    emptyReferenceCache()
    vi.spyOn(vendorOnboardingService, 'getCategories').mockResolvedValueOnce({
      items: ids(5901, categorySet).map(category), pageNumber: 0, pageSize: categorySet, totalElements: 2 * categorySet, totalPages: 2, lastPage: false,
    })
    setCatalogDraft(53, ids(5990, categorySet).map(category))
    render(<CategoryStep issues={[]} confirm={() => undefined} />)
    await screen.findByRole('button', { name: /Category 5990/ })

    act(() => { useOnboardingStore.getState().addPendingCategory({ name: 'Category authored', businessTypeId: 53 }) })

    expect(shownNames(/Category (\d+|authored)/)).toEqual(['Category authored', ...ids(5990, categorySet - 1).map((id) => `Category ${id}`)])
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
    await waitFor(() => expect(document.activeElement).toBe(match))
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
    await waitFor(() => expect(screen.getByRole('button', { name: 'Show more categories' }).getAttribute('aria-disabled')).toBe('false'))
    expect(read).toHaveBeenCalledTimes(2)

    // Unlike the unfiltered list, the press leaves the button in place and builds no scroll marker.
    expect(observers).toHaveLength(0)

    fireEvent.click(screen.getByRole('button', { name: 'Show more categories' }))
    await waitFor(() => expect(read).toHaveBeenCalledTimes(3))
    expect(read.mock.calls.map((call) => call[0]?.pageNumber)).toEqual([0, 1, 2])
  })

  it('keeps focus on Show more when a search press reveals no new match', async () => {
    emptyReferenceCache()
    let resolveMore: (page: Awaited<ReturnType<typeof vendorOnboardingService.getCategories>>) => void = () => undefined
    vi.spyOn(vendorOnboardingService, 'getCategories')
      .mockResolvedValueOnce({ items: ids(5861, 9).map(category), pageNumber: 0, pageSize: 9, totalElements: 27, totalPages: 3, lastPage: false })
      .mockImplementationOnce(() => new Promise((resolve) => { resolveMore = resolve }))
    setCatalogDraft(58, [])
    render(<CategoryStep issues={[]} confirm={() => undefined} />)
    await screen.findByRole('button', { name: /Category 5861/ })

    fireEvent.change(screen.getByLabelText('Search category'), { target: { value: 'pickles' } })
    const button = screen.getByRole('button', { name: 'Show more categories' })
    button.focus()
    fireEvent.click(button)

    expect((await screen.findByRole('status')).textContent).toBe('Loading more categories.')
    expect(document.activeElement).toBe(button)
    await act(async () => resolveMore({ items: ids(5870, 9).map(category), pageNumber: 1, pageSize: 9, totalElements: 27, totalPages: 3, lastPage: false }))
    expect(button.getAttribute('aria-disabled')).toBe('false')
    expect(document.activeElement).toBe(button)

    // The spent press must not hand focus to a match that appears later where it pointed.
    const search = screen.getByLabelText('Search category')
    search.focus()
    act(() => { useOnboardingStore.getState().addPendingCategory({ name: 'Pickles', businessTypeId: 58 }) })
    expect(screen.getByRole('button', { name: /Pickles/ })).toBeTruthy()
    expect(document.activeElement).toBe(search)
  })

  it('returns focus to the search when a press reveals no match and the list ends', async () => {
    emptyReferenceCache()
    vi.spyOn(vendorOnboardingService, 'getCategories')
      .mockResolvedValueOnce({ items: ids(5881, 9).map(category), pageNumber: 0, pageSize: 9, totalElements: 18, totalPages: 2, lastPage: false })
      .mockResolvedValueOnce({ items: ids(5890, 9).map(category), pageNumber: 1, pageSize: 9, totalElements: 18, totalPages: 2, lastPage: true })
    setCatalogDraft(58, [])
    render(<CategoryStep issues={[]} confirm={() => undefined} />)
    await screen.findByRole('button', { name: /Category 5881/ })

    fireEvent.change(screen.getByLabelText('Search category'), { target: { value: 'pickles' } })
    const button = screen.getByRole('button', { name: 'Show more categories' })
    button.focus()
    fireEvent.click(button)

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Show more categories' })).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Search category')))
  })

  it('leaves focus alone when a tap that never focused Show more ends the list without a match', async () => {
    emptyReferenceCache()
    vi.spyOn(vendorOnboardingService, 'getCategories')
      .mockResolvedValueOnce({ items: ids(5901, 9).map(category), pageNumber: 0, pageSize: 9, totalElements: 18, totalPages: 2, lastPage: false })
      .mockResolvedValueOnce({ items: ids(5910, 9).map(category), pageNumber: 1, pageSize: 9, totalElements: 18, totalPages: 2, lastPage: true })
    setCatalogDraft(59, [])
    render(<CategoryStep issues={[]} confirm={() => undefined} />)
    await screen.findByRole('button', { name: /Category 5901/ })

    fireEvent.change(screen.getByLabelText('Search category'), { target: { value: 'pickles' } })
    // iOS Safari: a tapped button never takes focus.
    expect(document.activeElement).toBe(document.body)
    fireEvent.click(screen.getByRole('button', { name: 'Show more categories' }))

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Show more categories' })).toBeNull())
    expect(document.activeElement).toBe(document.body)
  })

  it('drops a pending press when the search changes, so returning to it focuses no card', async () => {
    emptyReferenceCache()
    let resolveMore: (page: Awaited<ReturnType<typeof vendorOnboardingService.getCategories>>) => void = () => undefined
    vi.spyOn(vendorOnboardingService, 'getCategories')
      .mockResolvedValueOnce({ items: ids(5921, 9).map(category), pageNumber: 0, pageSize: 9, totalElements: 27, totalPages: 3, lastPage: false })
      .mockImplementationOnce(() => new Promise((resolve) => { resolveMore = resolve }))
    setCatalogDraft(59, [])
    render(<CategoryStep issues={[]} confirm={() => undefined} />)
    await screen.findByRole('button', { name: /Category 5921/ })

    const search = screen.getByLabelText('Search category')
    fireEvent.change(search, { target: { value: 'category 595' } })
    const button = screen.getByRole('button', { name: 'Show more categories' })
    button.focus()
    fireEvent.click(button)
    expect((await screen.findByRole('status')).textContent).toBe('Loading more categories.')

    search.focus()
    fireEvent.change(search, { target: { value: 'zz' } })
    await act(async () => resolveMore({ items: ids(5950, 9).map(category), pageNumber: 1, pageSize: 9, totalElements: 27, totalPages: 3, lastPage: false }))
    fireEvent.change(search, { target: { value: 'category 595' } })

    expect(await screen.findByRole('button', { name: /Category 5950/ })).toBeTruthy()
    expect(document.activeElement).toBe(search)
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
      .mockResolvedValueOnce({ items: ids(5701, categorySet).map(category), pageNumber: 0, pageSize: categorySet, totalElements: 3 * categorySet, totalPages: 3, lastPage: false })
      .mockResolvedValueOnce({ items: ids(5701 + categorySet, categorySet).map(category), pageNumber: 1, pageSize: categorySet, totalElements: 3 * categorySet, totalPages: 3, lastPage: false })
    setCatalogDraft(53, [])
    render(<CategoryStep issues={[]} confirm={() => undefined} />)
    await screen.findByRole('button', { name: /Category 5701/ })
    fireEvent.click(screen.getByRole('button', { name: 'Show more categories' }))
    await screen.findByRole('button', { name: new RegExp(`Category ${5700 + 2 * categorySet}`) })
    // The observer is built in a passive effect; count it only once it exists.
    await waitFor(() => expect(observers).toHaveLength(1))
    const built = observers.length

    act(() => useOnboardingStore.getState().updateDraft((current) => ({ ...current }), 4))

    expect(observers).toHaveLength(built)
  })
})

describe('a freshly authored entry scrolls into view', () => {
  let scrollIntoView: PropertyDescriptor | undefined
  const scrolls = vi.fn()

  function stubLayout(reduceMotion: boolean) {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: reduceMotion })))
    scrollIntoView = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollIntoView')
    Object.defineProperty(Element.prototype, 'scrollIntoView', { configurable: true, value: scrolls })
  }

  afterEach(() => {
    scrolls.mockReset()
    vi.unstubAllGlobals()
    if (scrollIntoView) Object.defineProperty(Element.prototype, 'scrollIntoView', scrollIntoView)
    else delete (Element.prototype as Partial<Element>).scrollIntoView
  })

  const category = (id: number) => ({ id, businessTypeId: 61, name: `Category ${id}`, description: null, icon: null, imageUrl: null, displayOrder: id })

  function renderCategories() {
    emptyReferenceCache()
    vi.spyOn(vendorOnboardingService, 'getCategories').mockResolvedValueOnce({
      items: [category(6101), category(6102)], pageNumber: 0, pageSize: 9, totalElements: 2, totalPages: 1, lastPage: true,
    })
    setCatalogDraft(61, [])
    render(<CategoryStep issues={[]} confirm={() => undefined} />)
  }

  it('scrolls a category authored under a search to its card, once the cleared search shows it, and announces it', async () => {
    stubLayout(false)
    renderCategories()
    await screen.findByRole('button', { name: /Category 6101/ })
    fireEvent.change(screen.getByLabelText('Search category'), { target: { value: 'nothing matches' } })
    expect(screen.queryByRole('button', { name: /Category 6101/ })).toBeNull()

    fireEvent.change(screen.getByPlaceholderText('Category name'), { target: { value: 'Pickles' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add Category' }))

    const card = await screen.findByRole('button', { name: /Pickles/ })
    expect(scrolls).toHaveBeenCalledTimes(1)
    expect(scrolls).toHaveBeenCalledWith({ behavior: 'smooth', block: 'nearest' })
    expect(scrolls.mock.contexts[0]).toBe(card)
    expect((screen.getByLabelText('Search category') as HTMLInputElement).value).toBe('')
    expect(screen.getByRole('status').textContent).toBe('Added Pickles')
  })

  it('neither scrolls nor announces when the vendor ticks a listed category', async () => {
    stubLayout(false)
    renderCategories()
    fireEvent.click(await screen.findByRole('button', { name: /Category 6102/ }))

    expect(screen.getByRole('button', { name: /Category 6102/ }).getAttribute('aria-pressed')).toBe('true')
    expect(scrolls).not.toHaveBeenCalled()
    expect(screen.getByRole('status').textContent).toBe('All categories are loaded.')
  })

  it('scrolls an authored product to its pending card, instantly when motion is reduced, and announces it', async () => {
    stubLayout(true)
    vi.spyOn(vendorOnboardingService, 'getProductsByCategory').mockResolvedValue({
      items: [{ id: 6201, name: 'Item 6201', description: null, icon: null, imageUrl: null, measurementId: null, measurementName: 'COUNT' }],
      pageNumber: 0, pageSize: 9, totalElements: 1, totalPages: 1, lastPage: true,
    })
    setCatalogDraft(62, [{ id: 620, businessTypeId: 62, name: 'Produce', description: null, imageUrl: null, displayOrder: 1 }])
    render(<ProductStep issues={[]} confirm={() => undefined} />)
    fireEvent.click(await screen.findByRole('button', { name: /Item 6201/ }))
    expect(scrolls).not.toHaveBeenCalled()
    const status = () => screen.getByText((_, element) => element?.matches('p[role="status"]') ?? false)
    expect(status().textContent).toBe('All products are loaded.')

    fireEvent.change(screen.getByPlaceholderText('Product name'), { target: { value: 'Mango pickle' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add Product' }))

    const remove = await screen.findByRole('button', { name: /Mango pickle, added by you/ })
    expect(scrolls).toHaveBeenCalledTimes(1)
    expect(scrolls).toHaveBeenCalledWith({ behavior: 'auto', block: 'nearest' })
    expect(scrolls.mock.contexts[0]).toBe(remove.parentElement)
    expect(status().textContent).toBe('Added Mango pickle')
  })
})
