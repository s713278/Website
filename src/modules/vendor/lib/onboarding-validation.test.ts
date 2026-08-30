import { describe, expect, it } from 'vitest'
import {
  createEmptyOnboardingDraft,
  createEmptyRuntimeState,
} from '../data/onboarding-defaults'
import {
  isAdditiveCatalogStep,
  type DraftSku,
  type OnboardingStep,
  type SelectedProduct,
  type VendorOnboardingDraftV1,
} from '../types/onboarding'
import type { MeasurementCatalog } from './onboarding-measurement'
import { additiveCatalogIssues, readinessIssues, validateStep } from './onboarding-validation'

function product(id: number, name: string): SelectedProduct {
  return {
    id,
    name,
    description: null,
    imageUrl: null,
    measurementId: null,
    measurementName: null,
    categoryId: 10,
  }
}

function sku(overrides: Partial<DraftSku> & Pick<DraftSku, 'id' | 'productId'>): DraftSku {
  return {
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
    ...overrides,
  }
}

function draftWith(products: SelectedProduct[], skus: DraftSku[]): VendorOnboardingDraftV1 {
  return { ...createEmptyOnboardingDraft(), products, skus }
}

const runtime = createEmptyRuntimeState()

describe('validateStep — step 6 SKUs', () => {
  it('accepts a SKU resumed from the vendor account', () => {
    // `buildResumeDraft` mints account IDs as `sku-<serverSkuId>`. A vendor signing back
    // in has only these, and every one of them is a real saved SKU.
    const draft = draftWith(
      [product(1, 'Cold Pressed Juice')],
      [sku({ id: 'sku-4021', productId: 1 })],
    )

    expect(validateStep(6, draft, runtime)).toEqual([])
  })

  it('accepts a locally created SKU', () => {
    const draft = draftWith(
      [product(1, 'Cold Pressed Juice')],
      [sku({ id: 'draft-sku-1-1', productId: 1 })],
    )

    expect(validateStep(6, draft, runtime)).toEqual([])
  })

  it('rejects a SKU whose ID belongs to neither scheme', () => {
    const draft = draftWith(
      [product(1, 'Cold Pressed Juice')],
      [sku({ id: 'whatever-1', productId: 1 })],
    )

    const issues = validateStep(6, draft, runtime)
    expect(issues.some((issue) => /ID/i.test(issue.message))).toBe(true)
  })

  it('treats two sizes of one product as distinct SKUs, not duplicate names', () => {
    // The server stores "<name>-<size>", so "Milk-1 L" and "Milk-500 ml" both strip back
    // to "Milk" on resume. They are different SKUs and the DB accepts both.
    const draft = draftWith(
      [product(1, 'Milk')],
      [
        sku({ id: 'sku-1', productId: 1, name: 'Milk', quantity: 1, unit: 'L' }),
        sku({ id: 'sku-2', productId: 1, name: 'Milk', quantity: 500, unit: 'ml' }),
      ],
    )

    expect(validateStep(6, draft, runtime)).toEqual([])
  })

  it('still rejects two sizes identical in quantity and unit, pointing at a visible field', () => {
    const draft = draftWith(
      [product(1, 'Milk')],
      [
        sku({ id: 'sku-1', productId: 1, name: 'Milk', quantity: 1, unit: 'L' }),
        sku({ id: 'sku-2', productId: 1, name: 'Milk', quantity: 1, unit: 'L' }),
      ],
    )

    // The hidden name can no longer differentiate sizes, so the duplicate issue lands on the
    // quantity control the compact card still renders rather than the removed name field.
    const issues = validateStep(6, draft, runtime)
    expect(issues.some((issue) => issue.field === 'sku-sku-2-quantity')).toBe(true)
  })

  it('still reports a product whose only SKU is inactive', () => {
    const draft = draftWith(
      [product(1, 'Cold Pressed Juice')],
      [sku({ id: 'sku-4021', productId: 1, active: false })],
    )

    const issues = validateStep(6, draft, runtime)
    expect(issues.some((issue) => issue.field === 'product-1')).toBe(true)
  })

  it('still reports a product with no SKUs at all', () => {
    const draft = draftWith([product(1, 'Cold Pressed Juice')], [])

    const issues = validateStep(6, draft, runtime)
    expect(issues.some((issue) => issue.field === 'product-1')).toBe(true)
  })

  it('points each SKU issue at the field ID the form renders', () => {
    // `SkuStep` renders inputs as `sku-<sku.id>-<field>`; the issue field has to match
    // it exactly or `focusField` silently falls back to the step heading.
    const draft = draftWith(
      [product(1, 'Cold Pressed Juice')],
      [sku({ id: 'sku-4021', productId: 1, salePrice: null })],
    )

    const priceIssue = validateStep(6, draft, runtime).find((issue) =>
      issue.message.includes('Price'),
    )
    expect(priceIssue?.field).toBe('sku-sku-4021-sale-price')
  })
})

describe('validateStep — step 6 purchasable size rules', () => {
  it('rejects a decimal quantity for a COUNT size at the visible quantity field', () => {
    // A count of things cannot be fractional; the fix must land on the quantity control the
    // compact card still renders.
    const draft = draftWith(
      [product(1, 'Eggs')],
      [sku({ id: 'sku-1', productId: 1, measurementType: 'COUNT', unit: 'pcs', quantity: 1.5 })],
    )

    const issues = validateStep(6, draft, runtime)
    expect(issues.some((item) => item.field === 'sku-sku-1-quantity')).toBe(true)
  })

  it('accepts a whole-number quantity for a COUNT size', () => {
    const draft = draftWith(
      [product(1, 'Eggs')],
      [sku({ id: 'sku-1', productId: 1, measurementType: 'COUNT', unit: 'pcs', quantity: 6 })],
    )

    expect(validateStep(6, draft, runtime)).toEqual([])
  })

  it('permits a positive decimal quantity for a non-COUNT size', () => {
    // Weight, volume and the other continuous measurements are sold in fractions.
    const draft = draftWith(
      [product(1, 'Rice')],
      [sku({ id: 'sku-1', productId: 1, measurementType: 'WEIGHT', unit: 'kg', quantity: 0.5 })],
    )

    expect(validateStep(6, draft, runtime)).toEqual([])
  })

  it('rejects an MRP with more than two decimal places', () => {
    const draft = draftWith(
      [product(1, 'Rice')],
      [sku({ id: 'sku-1', productId: 1, listPrice: 60.999, salePrice: 55 })],
    )

    const issues = validateStep(6, draft, runtime)
    expect(issues.some((item) => item.field === 'sku-sku-1-list-price')).toBe(true)
  })

  it('rejects a Price with more than two decimal places', () => {
    const draft = draftWith(
      [product(1, 'Rice')],
      [sku({ id: 'sku-1', productId: 1, listPrice: 60, salePrice: 55.005 })],
    )

    const issues = validateStep(6, draft, runtime)
    expect(issues.some((item) => item.field === 'sku-sku-1-sale-price')).toBe(true)
  })

  it('accepts monetary values with one or two decimal places', () => {
    const draft = draftWith(
      [product(1, 'Rice')],
      [sku({ id: 'sku-1', productId: 1, listPrice: 60.55, salePrice: 55.5 })],
    )

    expect(validateStep(6, draft, runtime)).toEqual([])
  })

  it('accepts a Price equal to MRP', () => {
    const draft = draftWith(
      [product(1, 'Rice')],
      [sku({ id: 'sku-1', productId: 1, listPrice: 60, salePrice: 60 })],
    )

    expect(validateStep(6, draft, runtime)).toEqual([])
  })

  it('rejects a Price above MRP at the visible sale-price field', () => {
    const draft = draftWith(
      [product(1, 'Rice')],
      [sku({ id: 'sku-1', productId: 1, listPrice: 60, salePrice: 61 })],
    )

    const issues = validateStep(6, draft, runtime)
    expect(issues.some((item) => item.field === 'sku-sku-1-sale-price')).toBe(true)
  })

  it('flags two sizes that share a quantity and unit even with different names and prices', () => {
    // Duplicate detection keys on the normalized quantity and unit alone: the hidden name
    // and the differing prices do not let two identical sizes coexist.
    const draft = draftWith(
      [product(1, 'Milk')],
      [
        sku({ id: 'sku-1', productId: 1, name: 'Small', quantity: 1, unit: 'L', listPrice: 60, salePrice: 50 }),
        sku({ id: 'sku-2', productId: 1, name: 'Large', quantity: 1, unit: 'L', listPrice: 60, salePrice: 55 }),
      ],
    )

    const issues = validateStep(6, draft, runtime)
    expect(issues.some((item) => item.field === 'sku-sku-2-quantity')).toBe(true)
  })
})

describe('readinessIssues respects the live plan limit', () => {
  // Step 4 accepts up to the vendor's real limit and writes those categories to the
  // account. If Step 10 re-checks against the hard-coded fallback of 2, it reports a
  // violation the vendor cannot act on — categories on the account cannot be unassigned
  // (403, Admin only) — so go-live is blocked permanently for any plan above the fallback.
  function draftWithCategories(count: number): VendorOnboardingDraftV1 {
    const base = createEmptyOnboardingDraft()
    return {
      ...base,
      categories: Array.from({ length: count }, (_, index) => ({
        id: index + 1,
        name: `Category ${index + 1}`,
        imageUrl: null,
        businessTypeId: 1,
        description: null,
        displayOrder: null,
      })),
    }
  }

  it('does not flag five categories when the plan allows five', () => {
    const issues = readinessIssues(draftWithCategories(5), createEmptyRuntimeState(), 5)
    expect(issues.filter((item) => item.field === 'categories')).toEqual([])
  })

  it('still flags categories beyond the plan limit', () => {
    const issues = readinessIssues(draftWithCategories(6), createEmptyRuntimeState(), 5)
    expect(issues.some((item) => item.field === 'categories')).toBe(true)
  })
})

describe('validateStep rejects an over-limit projected account total', () => {
  // The draft count alone is not what a limit gates. A business-type change empties the
  // draft while the account keeps every earlier write, so validation has to count the
  // projected account total — account usage plus what this draft adds — as the second
  // line of defence behind the disabled controls.
  function category(id: number): VendorOnboardingDraftV1['categories'][number] {
    return { id, name: `Category ${id}`, businessTypeId: 1, description: null, imageUrl: null, displayOrder: null }
  }

  it('rejects categories when account usage plus the draft exceeds the limit', () => {
    // Limit 2, two already on the account under business type A, one chosen under B.
    const draft = { ...createEmptyOnboardingDraft(), categories: [category(21)] }
    const issues = validateStep(4, draft, runtime, 2, [], {
      account: { categoryIds: [11, 12], productIds: [], skuIds: [] },
    })
    expect(issues.some((item) => item.field === 'categories')).toBe(true)
  })

  it('accepts categories that fit within the remaining account allowance', () => {
    // Limit 3, two on the account, one in the draft: projected 3, exactly at the cap.
    const draft = { ...createEmptyOnboardingDraft(), categories: [category(21)] }
    const issues = validateStep(4, draft, runtime, 3, [], {
      account: { categoryIds: [11, 12], productIds: [], skuIds: [] },
    })
    expect(issues.filter((item) => item.field === 'categories')).toEqual([])
  })

  it('does not double-count a draft category already on the account', () => {
    // The same two ids, so the projected total is 2, not 4.
    const draft = { ...createEmptyOnboardingDraft(), categories: [category(11), category(12)] }
    const issues = validateStep(4, draft, runtime, 2, [], {
      account: { categoryIds: [11, 12], productIds: [], skuIds: [] },
    })
    expect(issues.filter((item) => item.field === 'categories')).toEqual([])
  })

  it('rejects products when account usage plus the draft exceeds the limit', () => {
    const draft = draftWith([product(41, 'New')], [])
    const issues = validateStep(5, draft, runtime, undefined, [], {
      maxProducts: 3,
      account: { categoryIds: [], productIds: [31, 32, 33], skuIds: [] },
    })
    expect(issues.some((item) => item.field === 'products')).toBe(true)
  })

  it('does not double-count an already-assigned product', () => {
    const draft = draftWith([product(31, 'Existing')], [])
    const issues = validateStep(5, draft, runtime, undefined, [], {
      maxProducts: 3,
      account: { categoryIds: [], productIds: [31, 32, 33], skuIds: [] },
    })
    expect(issues.filter((item) => item.field === 'products')).toEqual([])
  })

  it('rejects sizes when the projected post-save count exceeds the limit', () => {
    // Three sizes on the account, one brand-new local one: projected 4 against a cap of 3.
    const draft = draftWith(
      [product(41, 'Juice')],
      [sku({ id: 'draft-sku-41-1', productId: 41 })],
    )
    const issues = validateStep(6, draft, runtime, undefined, [], {
      maxSkus: 3,
      account: { categoryIds: [], productIds: [], skuIds: [4001, 4002, 4003] },
    })
    expect(issues.some((item) => item.field === 'skus')).toBe(true)
  })

  it('treats an edited account size as net-zero, not removed-plus-added', () => {
    // The two account sizes, both edited in place, stay two — never four.
    const draft = draftWith(
      [product(41, 'Juice')],
      [sku({ id: 'sku-4001', productId: 41 }), sku({ id: 'sku-4002', productId: 41 })],
    )
    const issues = validateStep(6, draft, runtime, undefined, [], {
      maxSkus: 2,
      account: { categoryIds: [], productIds: [], skuIds: [4001, 4002] },
    })
    expect(issues.filter((item) => item.field === 'skus')).toEqual([])
  })

  it('rejects an over-limit projected total through the full readiness pass', () => {
    const draft = { ...createEmptyOnboardingDraft(), categories: [category(21)] }
    const issues = readinessIssues(draft, runtime, 2, [], {
      account: { categoryIds: [11, 12], productIds: [], skuIds: [] },
    })
    expect(issues.some((item) => item.field === 'categories')).toBe(true)
  })
})

describe('validateStep — step 6 measurement guard', () => {
  // A size's measurement is its product's measurement. Step 6 no longer lets a vendor
  // change it, but a stale draft, a restored draft, or a direct store write could still
  // carry a size whose measurement drifted off its product. Readiness must reject it.
  const CATALOG: MeasurementCatalog = [
    { id: 1, type: 'WEIGHT', units: ['kg', 'gr'], unitOptions: [0.5, 1, 2, 5] },
    { id: 2, type: 'VOLUME', units: ['L', 'ml'], unitOptions: [0.5, 1, 2, 5] },
    { id: 3, type: 'COUNT', units: ['pcs', 'dozen'], unitOptions: [1, 5, 10, 20] },
  ]

  function weightProduct(id: number, name: string): SelectedProduct {
    return { ...product(id, name), measurementId: 1, measurementName: null }
  }

  it('accepts a size measured in its product measurement', () => {
    const draft = draftWith(
      [weightProduct(1, 'Rice')],
      [sku({ id: 'sku-1', productId: 1, measurementType: 'WEIGHT', unit: 'kg' })],
    )

    expect(validateStep(6, draft, runtime, undefined, CATALOG)).toEqual([])
  })

  it('rejects a size whose measurement drifted off its product', () => {
    const draft = draftWith(
      [weightProduct(1, 'Rice')],
      [sku({ id: 'sku-1', productId: 1, measurementType: 'COUNT', unit: 'pcs' })],
    )

    const issues = validateStep(6, draft, runtime, undefined, CATALOG)
    expect(issues.some((item) => item.field === 'sku-sku-1')).toBe(true)
    // The off-measurement size cannot be the product's one valid active size either.
    expect(issues.some((item) => item.field === 'product-1')).toBe(true)
  })

  it('rejects the drift through the full readiness pass', () => {
    const draft = draftWith(
      [weightProduct(1, 'Rice')],
      [sku({ id: 'sku-1', productId: 1, measurementType: 'COUNT', unit: 'pcs' })],
    )

    const issues = readinessIssues(draft, runtime, undefined, CATALOG)
    expect(issues.some((item) => item.field === 'sku-sku-1')).toBe(true)
  })

  it('skips the measurement check when no catalog is available to resolve the product', () => {
    // Without a catalog the product measurement cannot be resolved, so the guard stays
    // quiet rather than resolving everything to COUNT and flagging valid sizes.
    const draft = draftWith(
      [weightProduct(1, 'Rice')],
      [sku({ id: 'sku-1', productId: 1, measurementType: 'WEIGHT', unit: 'kg' })],
    )

    expect(validateStep(6, draft, runtime)).toEqual([])
  })
})

describe('isAdditiveCatalogStep', () => {
  it('is true only for the catalog steps 4 and 5', () => {
    // Step 6 (sizes) is not additive: the backend rejects a new SKU while a store is under
    // review, so a submitted store adds categories and products only. See `CONTEXT.md`.
    const steps = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as OnboardingStep[]
    expect(steps.filter((step) => isAdditiveCatalogStep(step))).toEqual([4, 5])
  })
})

describe('additiveCatalogIssues — a submitted store only validates the delta', () => {
  function category(id: number): VendorOnboardingDraftV1['categories'][number] {
    return { id, name: `Category ${id}`, businessTypeId: 1, description: null, imageUrl: null, displayOrder: null }
  }

  it('does not require a category the way validateStep does', () => {
    // The account still holds its categories; adding none is allowed for a submitted store.
    const draft = createEmptyOnboardingDraft()
    const enforcement = { account: { categoryIds: [11, 12], productIds: [], skuIds: [] } }
    expect(additiveCatalogIssues(4, draft, 2, enforcement)).toEqual([])
    // validateStep, by contrast, would demand at least one category.
    expect(validateStep(4, draft, runtime, 2, [], enforcement).some((item) => item.field === 'categories')).toBe(true)
  })

  it('still rejects categories past the plan limit', () => {
    const draft = { ...createEmptyOnboardingDraft(), categories: [category(21)] }
    expect(additiveCatalogIssues(4, draft, 2, {
      account: { categoryIds: [11, 12], productIds: [], skuIds: [] },
    }).some((item) => item.field === 'categories')).toBe(true)
  })

  it('does not require a product or flag whole-store readiness on step 5', () => {
    const draft = createEmptyOnboardingDraft()
    expect(additiveCatalogIssues(5, draft, undefined, {
      maxProducts: 3,
      account: { categoryIds: [], productIds: [31], skuIds: [] },
    })).toEqual([])
  })

  it('still rejects products past the plan limit', () => {
    const draft = draftWith([product(41, 'New')], [])
    expect(additiveCatalogIssues(5, draft, undefined, {
      maxProducts: 3,
      account: { categoryIds: [], productIds: [31, 32, 33], skuIds: [] },
    }).some((item) => item.field === 'products')).toBe(true)
  })

  it('never validates sizes: step 6 is not additive for a submitted store', () => {
    // The backend rejects a new SKU while a store is under review, so Step 6 is read-only
    // for a submitted store and its size delta is never reached here. Even a draft carrying
    // a malformed new local size and a size count past the plan limit reports nothing.
    const draft = draftWith(
      [product(41, 'Juice')],
      [sku({ id: 'draft-sku-41-1', productId: 41, name: 'Large', listPrice: null, salePrice: null })],
    )
    expect(additiveCatalogIssues(6, draft, undefined, {
      maxSkus: 0,
      account: { categoryIds: [], productIds: [], skuIds: [4001, 4002, 4003] },
    })).toEqual([])
  })
})
