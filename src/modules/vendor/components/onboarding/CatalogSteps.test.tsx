// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import categoryFallbackImage from '@/assets/onboarding/category-fallback.svg'
import productFallbackImage from '@/assets/onboarding/product-fallback.svg'
import { vendorOnboardingService } from '@/shared/api'
import { useOnboardingStore } from '../../store/onboarding-store'
import { CategoryStep, ProductStep } from './CatalogSteps'

afterEach(() => {
  cleanup()
  useOnboardingStore.getState().abandonDraft()
  vi.restoreAllMocks()
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
