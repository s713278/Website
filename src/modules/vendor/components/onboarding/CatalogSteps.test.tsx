// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import categoryFallbackImage from '@/assets/onboarding/category-fallback.svg'
import productFallbackImage from '@/assets/onboarding/product-fallback.svg'
import { vendorOnboardingService } from '@/shared/api'
import { useOnboardingStore } from '../../store/onboarding-store'
import { CategoryStep, ProductStep } from './CatalogSteps'

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
