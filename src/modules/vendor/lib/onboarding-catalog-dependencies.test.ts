import { describe, expect, it } from 'vitest'
import type { DraftSku, OnboardingStep, DraftCategory, SelectedProduct } from '../types/onboarding'
import {
  catalogDependencyGaps,
  stepAfterCatalogSave,
  stepsNeedingAttention,
} from './onboarding-catalog-dependencies'

const category = (id: number): DraftCategory => ({ id, businessTypeId: 1, name: `Category ${id}`, description: '', imageUrl: null, displayOrder: id })
const product = (id: number, categoryId: number): SelectedProduct => ({
  id, categoryId, name: `Product ${id}`, description: '', imageUrl: null, measurementId: null, measurementName: 'COUNT',
})
const size = (productId: number, patch: Partial<DraftSku> = {}): DraftSku => ({
  id: `draft-sku-${productId}-1`, productId, name: '', description: '', skuType: 'ITEM',
  measurementType: 'COUNT', unit: 'pc', quantity: 1, listPrice: 100, salePrice: 90, active: true,
  homeDelivery: true, storePickup: false, ...patch,
})
const ALL_DONE: OnboardingStep[] = [1, 2, 3, 4, 5, 6, 7, 8, 9]

describe('catalogDependencyGaps', () => {
  it('reports nothing when every category has a product and every product a valid active size', () => {
    expect(catalogDependencyGaps({
      categories: [category(1)], products: [product(10, 1)], skus: [size(10)],
    })).toEqual({ categoryIds: [], productIds: [] })
  })

  it('names a chosen category with no product', () => {
    expect(catalogDependencyGaps({
      categories: [category(1), category(2)], products: [product(10, 1)], skus: [size(10)],
    })).toEqual({ categoryIds: [2], productIds: [] })
  })

  it('names a product with no size, only an incomplete size, or only switched-off sizes', () => {
    const gaps = catalogDependencyGaps({
      categories: [category(1)],
      products: [product(10, 1), product(11, 1), product(12, 1), product(13, 1)],
      skus: [
        size(10),
        size(12, { listPrice: null, salePrice: null }),
        size(13, { active: false }),
      ],
    })
    expect(gaps).toEqual({ categoryIds: [], productIds: [11, 12, 13] })
  })

  it('accepts a product with one valid active size beside an unfinished one', () => {
    expect(catalogDependencyGaps({
      categories: [category(1)], products: [product(10, 1)],
      skus: [size(10), size(10, { id: 'draft-sku-10-2', quantity: null, active: false })],
    }).productIds).toEqual([])
  })
})

describe('stepsNeedingAttention', () => {
  const gaps = { categoryIds: [2], productIds: [11] }

  it('marks Steps 5 and 6 once each is done and has missing work', () => {
    expect(stepsNeedingAttention(gaps, ALL_DONE, false, false)).toEqual([5, 6])
    expect(stepsNeedingAttention({ categoryIds: [], productIds: [11] }, ALL_DONE, false, false)).toEqual([6])
  })

  it('leaves a step not yet done to its first-time Continue', () => {
    expect(stepsNeedingAttention(gaps, [1, 2, 3, 4, 5], false, false)).toEqual([5])
    expect(stepsNeedingAttention(gaps, [1, 2, 3, 4], false, false)).toEqual([])
  })

  it('marks only Step 5 for a store under review, which cannot add sizes', () => {
    expect(stepsNeedingAttention(gaps, ALL_DONE, true, false)).toEqual([5])
    expect(stepsNeedingAttention({ categoryIds: [], productIds: [11] }, ALL_DONE, true, false)).toEqual([])
  })

  it('marks an approved store as in setup', () => {
    expect(stepsNeedingAttention(gaps, ALL_DONE, true, true)).toEqual([5, 6])
  })
})

describe('stepAfterCatalogSave', () => {
  it('guides a revisit save to the missing step before returning', () => {
    // 9 → 4 (add a category) → 5 → 6 → 9.
    expect(stepAfterCatalogSave(4, 9, [5, 6])).toBe(5)
    expect(stepAfterCatalogSave(5, 9, [6])).toBe(6)
    expect(stepAfterCatalogSave(6, 9, [])).toBe(9)
  })

  it('skips a step with nothing missing', () => {
    expect(stepAfterCatalogSave(4, 9, [6])).toBe(6)
    expect(stepAfterCatalogSave(5, 9, [])).toBe(9)
  })

  it('returns straight to the remembered step when nothing is missing', () => {
    expect(stepAfterCatalogSave(4, 9, [])).toBe(9)
  })

  it('never guides backwards or past the remembered step', () => {
    expect(stepAfterCatalogSave(6, 9, [5])).toBe(9)
    expect(stepAfterCatalogSave(4, 5, [5, 6])).toBe(5)
  })

  it('keeps first-time Continue: the next step', () => {
    expect(stepAfterCatalogSave(4, null, [5, 6])).toBe(5)
    expect(stepAfterCatalogSave(5, null, [])).toBe(6)
  })
})
