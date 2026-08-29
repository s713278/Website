import { describe, expect, it } from 'vitest'
import type { DraftCategory, DraftSku, SelectedProduct } from '../types/onboarding'
import {
  projectedCategoryTotal,
  projectedProductTotal,
  projectedSkuTotal,
  retainAssignedCatalog,
} from './onboarding-catalog-limits'

function sku(id: string, productId: number): DraftSku {
  return {
    id,
    productId,
    name: 'Regular',
    description: '',
    skuType: 'ITEM',
    measurementType: 'VOLUME',
    unit: 'L',
    quantity: 1,
    listPrice: 60,
    salePrice: 55,
    active: true,
    homeDelivery: true,
    storePickup: true,
  }
}

function category(id: number): DraftCategory {
  return { id, name: `Category ${id}`, businessTypeId: 7, description: null, imageUrl: null, displayOrder: null }
}

function product(id: number, categoryId: number): SelectedProduct {
  return { id, name: `Product ${id}`, description: null, imageUrl: null, measurementId: null, measurementName: null, categoryId }
}

describe('projectedCategoryTotal', () => {
  it('counts account usage plus new draft categories', () => {
    // A vendor with two categories already on the account, choosing two more under a
    // different business type: the account total that matters is all four.
    expect(projectedCategoryTotal([11, 12], [21, 22])).toBe(4)
  })

  it('does not double-count a draft category already on the account', () => {
    // The first-pass draft *is* the account catalog, so the two must not add up to double.
    expect(projectedCategoryTotal([11, 12], [11, 12])).toBe(2)
  })

  it('counts an authored (pending) category that is not yet on the account', () => {
    // A pending category carries a negative id no account read will ever return.
    expect(projectedCategoryTotal([11], [-1001])).toBe(2)
  })

  it('is the reported allowance for a first-time account with zero usage', () => {
    expect(projectedCategoryTotal([], [21, 22, 23])).toBe(3)
  })
})

describe('projectedProductTotal', () => {
  it('counts account usage plus new draft products', () => {
    expect(projectedProductTotal([31, 32], [41, 42])).toBe(4)
  })

  it('does not double-count an already-assigned product', () => {
    expect(projectedProductTotal([31, 32], [31, 42])).toBe(3)
  })

  it('counts an authored (pending) product', () => {
    expect(projectedProductTotal([31], [-2001])).toBe(2)
  })
})

describe('projectedSkuTotal', () => {
  it('counts account sizes plus new local draft sizes', () => {
    // Account holds three sizes; the vendor adds two brand-new local ones under a
    // freshly chosen product.
    const draftSkus = [sku('draft-sku-41-1', 41), sku('draft-sku-41-2', 41)]
    expect(projectedSkuTotal([4021, 4022, 4023], draftSkus)).toBe(5)
  })

  it('treats an edited/replaced account size as net-zero', () => {
    // A resumed account size keeps its `sku-<serverId>` id through an edit, so it is the
    // same slot — counted once via the account set, never as removed-plus-added.
    const draftSkus = [sku('sku-4021', 41), sku('sku-4022', 41)]
    expect(projectedSkuTotal([4021, 4022], draftSkus)).toBe(2)
  })

  it('counts a new local size on top of edited account sizes', () => {
    const draftSkus = [sku('sku-4021', 41), sku('draft-sku-41-1', 41)]
    expect(projectedSkuTotal([4021], draftSkus)).toBe(2)
  })

  it('is the reported allowance for a first-time account with zero usage', () => {
    const draftSkus = [sku('draft-sku-41-1', 41), sku('draft-sku-41-2', 41)]
    expect(projectedSkuTotal([], draftSkus)).toBe(2)
  })
})

describe('retainAssignedCatalog', () => {
  it('keeps categories, products, and sizes the account already holds', () => {
    // Account holds category 11, product 31 under it, and one saved size for that product.
    const draft = {
      categories: [category(11)],
      products: [product(31, 11)],
      skus: [sku('sku-4001', 31)],
    }
    const retained = retainAssignedCatalog(draft, { categoryIds: [11], productIds: [31] })
    expect(retained).toEqual(draft)
  })

  it('drops selections that were never saved to the account', () => {
    // 11/31 are assigned; 12/32 were only picked in this browser. A business-type change
    // must clear the unsaved ones — but never the assigned ones, which are one-way.
    const draft = {
      categories: [category(11), category(12)],
      products: [product(31, 11), product(32, 12)],
      skus: [sku('sku-4001', 31), sku('draft-sku-32-1', 32)],
    }
    const retained = retainAssignedCatalog(draft, { categoryIds: [11], productIds: [31] })
    expect(retained.categories.map((c) => c.id)).toEqual([11])
    expect(retained.products.map((p) => p.id)).toEqual([31])
    expect(retained.skus.map((s) => s.id)).toEqual(['sku-4001'])
  })

  it('drops an unsaved local size even on a product that is kept', () => {
    // The product is assigned, but the second size was added in-browser and never saved.
    const draft = {
      categories: [category(11)],
      products: [product(31, 11)],
      skus: [sku('sku-4001', 31), sku('draft-sku-31-2', 31)],
    }
    const retained = retainAssignedCatalog(draft, { categoryIds: [11], productIds: [31] })
    expect(retained.skus.map((s) => s.id)).toEqual(['sku-4001'])
  })

  it('clears everything for an account with nothing assigned yet', () => {
    const draft = {
      categories: [category(11)],
      products: [product(31, 11)],
      skus: [sku('draft-sku-31-1', 31)],
    }
    const retained = retainAssignedCatalog(draft, { categoryIds: [], productIds: [] })
    expect(retained).toEqual({ categories: [], products: [], skus: [] })
  })
})
