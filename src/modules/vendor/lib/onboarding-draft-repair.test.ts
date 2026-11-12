import { describe, expect, it } from 'vitest'
import type { DraftCategory, DraftSku, SelectedProduct } from '../types/onboarding'
import { assignedCatalogIsMixed, dropOtherTypeSelections, MIXED_CATALOG_MESSAGE, mixedCatalogIssues } from './onboarding-draft-repair'

const SAVED = 7
const OTHER = 8
const category = (id: number, businessTypeId: number | null, pending?: true): DraftCategory => ({
  id, businessTypeId, name: `Category ${id}`, description: null, imageUrl: null, displayOrder: null, ...(pending ? { pending } : {}),
})
const product = (id: number, categoryId: number): SelectedProduct => ({
  id, categoryId, name: `Product ${id}`, description: null, imageUrl: null, measurementId: null, measurementName: null,
})
const size = (id: string, productId: number): DraftSku => ({
  id, productId, name: '', description: '', skuType: 'ITEM', measurementType: 'COUNT', unit: 'pc',
  quantity: 1, listPrice: 100, salePrice: 90, active: true, homeDelivery: true, storePickup: false,
})

describe('dropOtherTypeSelections', () => {
  it('drops unsaved categories of another type with their products and sizes, keeping the rest', () => {
    const catalog = {
      categories: [category(10, SAVED), category(20, OTHER), category(-1_000_001, OTHER, true), category(11, SAVED)],
      products: [product(31, 10), product(41, 20), product(-1_000_002, -1_000_001), product(32, 11)],
      skus: [size('sku-4001', 31), size('draft-sku-1', 41), size('draft-sku-2', -1_000_002), size('draft-sku-3', 32)],
    }
    expect(dropOtherTypeSelections(catalog, SAVED, { categoryIds: [10], productIds: [31] })).toEqual({
      categories: [category(10, SAVED), category(11, SAVED)],
      products: [product(31, 10), product(32, 11)],
      skus: [size('sku-4001', 31), size('draft-sku-3', 32)],
    })
  })

  it('never drops what the account holds, whatever type it was recorded under', () => {
    const catalog = {
      categories: [category(20, OTHER), category(21, OTHER)],
      products: [product(41, 20), product(42, 21)],
      skus: [size('sku-5001', 41), size('draft-sku-1', 42)],
    }
    // 20 is assigned; 21 is not, but a product under it is.
    expect(dropOtherTypeSelections(catalog, SAVED, { categoryIds: [20], productIds: [42] })).toBe(catalog)
  })

  it('keeps a category whose type is not recorded: nothing says it is another type’s', () => {
    const catalog = { categories: [category(20, null)], products: [product(41, 20)], skus: [] }
    expect(dropOtherTypeSelections(catalog, SAVED, { categoryIds: [], productIds: [] })).toBe(catalog)
  })

  it('keeps every other draft field', () => {
    const catalog = { categories: [category(20, OTHER)], products: [], skus: [], note: 'kept' }
    expect(dropOtherTypeSelections(catalog, SAVED, { categoryIds: [], productIds: [] }))
      .toEqual({ categories: [], products: [], skus: [], note: 'kept' })
  })
})

describe('assignedCatalogIsMixed', () => {
  it('confirms nothing without the saved type’s complete list', () => {
    expect(assignedCatalogIsMixed([10, 20], undefined)).toBe(false)
  })

  it('is mixed when an assigned category is missing from the saved type’s list', () => {
    expect(assignedCatalogIsMixed([10, 20], [10, 11])).toBe(true)
  })

  it('is not mixed when every assigned category is on the list, or none is assigned', () => {
    expect(assignedCatalogIsMixed([10, 11], [10, 11, 12])).toBe(false)
    expect(assignedCatalogIsMixed([], [10])).toBe(false)
  })

  it('confirms nothing when no assigned category is on the list: the list or the type is wrong', () => {
    expect(assignedCatalogIsMixed([10, 20], [])).toBe(false)
    expect(assignedCatalogIsMixed([10, 20], [30])).toBe(false)
  })
})

describe('mixedCatalogIssues', () => {
  it('holds submission on Step 4 with the support message only while mixed', () => {
    expect(mixedCatalogIssues(false)).toEqual([])
    expect(mixedCatalogIssues(true)).toEqual([{ step: 4, field: 'catalog-mixed', message: MIXED_CATALOG_MESSAGE }])
  })
})
