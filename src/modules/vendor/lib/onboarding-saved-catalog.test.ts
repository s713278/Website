import { describe, expect, it } from 'vitest'
import { createEmptyOnboardingDraft } from '../data/onboarding-defaults'
import type { DraftCategory, DraftSku, SelectedProduct, VendorOnboardingDraftV1 } from '../types/onboarding'
import {
  savedCatalog,
  savedCatalogAfterSave,
  stepCatalog,
  stepSaveDraft,
  withSavedCatalog,
  type SavedCatalogState,
} from './onboarding-saved-catalog'

const category = (id: number): DraftCategory => ({ id, businessTypeId: 1, name: `Category ${id}`, description: '', imageUrl: null, displayOrder: id })
const product = (id: number, categoryId: number): SelectedProduct => ({
  id, categoryId, name: `Product ${id}`, description: '', imageUrl: null, measurementId: null, measurementName: 'COUNT',
})
const size = (productId: number, n = 1, patch: Partial<DraftSku> = {}): DraftSku => ({
  id: `draft-sku-${productId}-${n}`, productId, name: '', description: '', skuType: 'ITEM',
  measurementType: 'COUNT', unit: 'pc', quantity: 1, listPrice: 100, salePrice: 90, active: true,
  homeDelivery: true, storePickup: false, ...patch,
})

function state(draft: Partial<VendorOnboardingDraftV1>, patch: Partial<SavedCatalogState> = {}): SavedCatalogState {
  return {
    draft: { ...createEmptyOnboardingDraft(), ...draft },
    editedSteps: [],
    fieldEdits: {},
    savedBaselines: {},
    accountCatalog: { categoryIds: [], productIds: [] },
    ...patch,
  }
}

// Category 1 and product 10 with its size are saved; category 2, product 11 and size 10-2 are picks.
const saved = {
  4: { categories: [category(1)] },
  5: { products: [product(10, 1)] },
  6: { skus: [size(10)] },
}
const picked = state({
  categories: [category(1), category(2)],
  products: [product(10, 1), product(11, 1), product(20, 2)],
  skus: [size(10), size(10, 2, { quantity: null }), size(11)],
}, { editedSteps: [4, 5, 6], savedBaselines: saved })

describe('savedCatalog', () => {
  it('is the saved baselines, leaving every unsaved pick out', () => {
    expect(savedCatalog(picked)).toEqual({ categories: [category(1)], products: [product(10, 1)], skus: [size(10)] })
  })

  it('takes an unedited step without a baseline from the draft, as demo does after a reload', () => {
    const demo = state({ categories: [category(1)], products: [product(10, 1)], skus: [size(10)] })
    expect(savedCatalog(demo)).toEqual({ categories: [category(1)], products: [product(10, 1)], skus: [size(10)] })
  })

  it('takes an edited step without a baseline from its recorded saved value, or nothing when none was recorded', () => {
    const edited = state(
      { categories: [category(1), category(2)], products: [product(10, 1)], skus: [] },
      { editedSteps: [4, 5], fieldEdits: { categories: { at: 1, saved: [category(1)] }, products: { at: 1 } } },
    )
    expect(savedCatalog(edited)).toEqual({ categories: [category(1)], products: [], skus: [] })
  })

  it('counts what the account holds even when a failed save left no baseline', () => {
    const partial = state(
      { categories: [category(1)], products: [product(10, 1), product(11, 1)] },
      { editedSteps: [5], fieldEdits: { products: { at: 1, saved: [] } }, savedBaselines: { 4: saved[4] },
        accountCatalog: { categoryIds: [1], productIds: [11] } },
    )
    expect(savedCatalog(partial).products).toEqual([product(11, 1)])
  })

  it('drops a saved product whose category is an unsaved pick, and the sizes of such a product', () => {
    const orphaned = state({ categories: [category(1)] }, { savedBaselines: { 4: { categories: [] }, 5: saved[5], 6: saved[6] } })
    expect(savedCatalog(orphaned)).toEqual({ categories: [], products: [], skus: [] })
  })

  it('keeps a saved product whose category is missing from the draft altogether', () => {
    const stray = state({}, { savedBaselines: { 4: { categories: [] }, 5: saved[5], 6: saved[6] } })
    expect(savedCatalog(stray)).toEqual({ categories: [], products: [product(10, 1)], skus: [size(10)] })
  })
})

describe('stepCatalog', () => {
  it('shows Step 5 the saved categories and every product chosen under them', () => {
    const step5 = stepCatalog(5, picked.draft, savedCatalog(picked))
    expect(step5.categories).toEqual([category(1)])
    expect(step5.products.map((item) => item.id)).toEqual([10, 11])
  })

  it('shows Step 6 the saved products and all of their sizes, saved or not', () => {
    const step6 = stepCatalog(6, picked.draft, savedCatalog(picked))
    expect(step6.products.map((item) => item.id)).toEqual([10])
    expect(step6.skus.map((sku) => sku.id)).toEqual(['draft-sku-10-1', 'draft-sku-10-2'])
  })

  it('returns the draft itself when nothing is hidden', () => {
    const plain = state({ categories: [category(1)], products: [product(10, 1)], skus: [size(10)] })
    expect(stepCatalog(6, plain.draft, savedCatalog(plain))).toBe(plain.draft)
  })
})

describe('stepSaveDraft', () => {
  it('sends Step 5 without products under an unsaved category', () => {
    expect(stepSaveDraft(5, picked).products.map((item) => item.id)).toEqual([10, 11])
  })

  it('leaves other steps the whole draft', () => {
    expect(stepSaveDraft(4, picked)).toBe(picked.draft)
  })
})

describe('savedCatalogAfterSave', () => {
  it('counts what the save sends as saved, and nothing it leaves hidden', () => {
    expect(savedCatalogAfterSave(4, picked).categories.map((item) => item.id)).toEqual([1, 2])
    expect(savedCatalogAfterSave(5, picked).products.map((item) => item.id)).toEqual([10, 11])
    expect(savedCatalogAfterSave(6, picked).skus.map((sku) => sku.id)).toEqual(['draft-sku-10-1', 'draft-sku-10-2'])
  })
})

describe('withSavedCatalog', () => {
  it('replaces only the catalog lists', () => {
    const replaced = withSavedCatalog(picked.draft, savedCatalog(picked))
    expect(replaced.products).toEqual([product(10, 1)])
    expect(replaced.storefront).toBe(picked.draft.storefront)
  })
})
