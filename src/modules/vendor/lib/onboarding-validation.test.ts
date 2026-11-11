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
    // `applySkus` mints account IDs as `sku-<serverSkuId>`. A vendor signing back
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
    expect(issues).toContainEqual(expect.objectContaining({
      field: 'product-1', message: 'Turn on at least one size for Cold Pressed Juice.',
    }))
  })

  it('still reports a product with no SKUs at all', () => {
    const draft = draftWith([product(1, 'Cold Pressed Juice')], [])

    expect(validateStep(6, draft, runtime)).toEqual([
      expect.objectContaining({ field: 'product-1', message: 'Add a size for Cold Pressed Juice.' }),
    ])
  })

  it('points each SKU issue at the field ID the form renders', () => {
    // `SkuStep` renders inputs as `sku-<sku.id>-<field>`; the issue field has to match
    // it exactly or `focusField` silently falls back to the step heading.
    const draft = draftWith(
      [product(1, 'Cold Pressed Juice')],
      [sku({ id: 'sku-4021', productId: 1, salePrice: null })],
    )

    const priceIssue = validateStep(6, draft, runtime).find((issue) => issue.field.endsWith('-sale-price'))
    expect(priceIssue?.field).toBe('sku-sku-4021-sale-price')
    expect(priceIssue?.message).toBe('Required field.')
  })
})

describe('validateStep — step 6 blank fields and the product-level prompt', () => {
  const issuesAt = (issues: ReturnType<typeof validateStep>, field: string) =>
    issues.filter((item) => item.field === field).map((item) => item.message)

  it('reports exactly "Required field." on each blank quantity, MRP and Discounted price', () => {
    const draft = draftWith(
      [product(1, 'Rice')],
      [sku({ id: 'draft-sku-1-1', productId: 1, quantity: null, listPrice: null, salePrice: null })],
    )

    const issues = validateStep(6, draft, runtime)
    expect(issuesAt(issues, 'sku-draft-sku-1-1-quantity')).toEqual(['Required field.'])
    expect(issuesAt(issues, 'sku-draft-sku-1-1-list-price')).toEqual(['Required field.'])
    expect(issuesAt(issues, 'sku-draft-sku-1-1-sale-price')).toEqual(['Required field.'])
  })

  it('keeps the greater-than-zero messages for entered values that are not positive', () => {
    const draft = draftWith(
      [product(1, 'Rice')],
      [sku({ id: 'draft-sku-1-1', productId: 1, quantity: 0, listPrice: 0, salePrice: -1 })],
    )

    const issues = validateStep(6, draft, runtime)
    expect(issuesAt(issues, 'sku-draft-sku-1-1-quantity')).toEqual(['Quantity must be greater than zero.'])
    expect(issuesAt(issues, 'sku-draft-sku-1-1-list-price')).toEqual(['MRP must be greater than zero.'])
    expect(issuesAt(issues, 'sku-draft-sku-1-1-sale-price')).toEqual(['Discounted price must be greater than zero.'])
  })

  it('does not call two blank-quantity sizes duplicates', () => {
    const draft = draftWith(
      [product(1, 'Milk')],
      [
        sku({ id: 'draft-sku-1-1', productId: 1, quantity: null }),
        sku({ id: 'draft-sku-1-2', productId: 1, quantity: null }),
      ],
    )

    const issues = validateStep(6, draft, runtime)
    expect(issues.some((item) => item.message === 'Each size needs a unique quantity and unit.')).toBe(false)
    expect(issuesAt(issues, 'sku-draft-sku-1-1-quantity')).toEqual(['Required field.'])
    expect(issuesAt(issues, 'sku-draft-sku-1-2-quantity')).toEqual(['Required field.'])
  })

  it('asks the vendor to turn on a size when every size is valid but inactive', () => {
    const draft = draftWith(
      [product(1, 'Milk')],
      [
        sku({ id: 'sku-1', productId: 1, quantity: 1, active: false }),
        sku({ id: 'sku-2', productId: 1, quantity: 2, active: false }),
      ],
    )

    expect(validateStep(6, draft, runtime)).toEqual([
      expect.objectContaining({ field: 'product-1', message: 'Turn on at least one size for Milk.' }),
    ])
  })

  it('leaves the product prompt out while a size has a field problem', () => {
    const draft = draftWith(
      [product(1, 'Milk')],
      [
        sku({ id: 'sku-1', productId: 1, quantity: 1, active: false }),
        sku({ id: 'sku-2', productId: 1, quantity: 2, active: false, listPrice: null }),
      ],
    )

    const issues = validateStep(6, draft, runtime)
    expect(issues.some((item) => item.field === 'product-1')).toBe(false)
    expect(issuesAt(issues, 'sku-sku-2-list-price')).toEqual(['Required field.'])
  })

  it('never emits the retired "needs at least one size with a price" message', () => {
    const drafts = [
      draftWith([product(1, 'Milk')], [sku({ id: 'sku-1', productId: 1, active: false })]),
      draftWith([product(1, 'Milk')], [sku({ id: 'sku-1', productId: 1, listPrice: null, salePrice: null })]),
      draftWith([product(1, 'Milk')], []),
    ]
    for (const draft of drafts) {
      expect(validateStep(6, draft, runtime).some((item) => item.message.includes('needs at least one size'))).toBe(false)
    }
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

  it('enforces the smallest quantity supported by SKU updates', () => {
    const tooSmall = draftWith([product(1, 'Rice')], [sku({
      id: 'sku-1', productId: 1, quantity: 0.0000001,
    })])
    expect(validateStep(6, tooSmall, runtime)).toContainEqual(expect.objectContaining({ field: 'sku-sku-1-quantity' }))
    tooSmall.skus[0].quantity = 0.000001
    expect(validateStep(6, tooSmall, runtime)).toEqual([])
  })

  it('rejects an MRP with more than two decimal places', () => {
    const draft = draftWith(
      [product(1, 'Rice')],
      [sku({ id: 'sku-1', productId: 1, listPrice: 60.999, salePrice: 55 })],
    )

    const issues = validateStep(6, draft, runtime)
    expect(issues.some((item) => item.field === 'sku-sku-1-list-price')).toBe(true)
  })

  it('rejects a Discounted price with more than two decimal places', () => {
    const draft = draftWith(
      [product(1, 'Rice')],
      [sku({ id: 'sku-1', productId: 1, listPrice: 60, salePrice: 55.005 })],
    )

    const issues = validateStep(6, draft, runtime)
    expect(issues).toContainEqual(expect.objectContaining({
      field: 'sku-sku-1-sale-price', message: 'Discounted price can have at most two decimal places.',
    }))
  })

  it('accepts monetary values with one or two decimal places', () => {
    const draft = draftWith(
      [product(1, 'Rice')],
      [sku({ id: 'sku-1', productId: 1, listPrice: 60.55, salePrice: 55.5 })],
    )

    expect(validateStep(6, draft, runtime)).toEqual([])
  })

  it('accepts a Discounted price equal to MRP', () => {
    const draft = draftWith(
      [product(1, 'Rice')],
      [sku({ id: 'sku-1', productId: 1, listPrice: 60, salePrice: 60 })],
    )

    expect(validateStep(6, draft, runtime)).toEqual([])
  })

  it('rejects a Discounted price above MRP at the visible sale-price field', () => {
    const draft = draftWith(
      [product(1, 'Rice')],
      [sku({ id: 'sku-1', productId: 1, listPrice: 60, salePrice: 61 })],
    )

    const issues = validateStep(6, draft, runtime)
    expect(issues).toContainEqual(expect.objectContaining({
      field: 'sku-sku-1-sale-price', message: 'Discounted price cannot exceed MRP.',
    }))
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

describe('validateStep — step 5 needs a product in every chosen category', () => {
  function category(id: number): VendorOnboardingDraftV1['categories'][number] {
    return { id, name: `Category ${id}`, businessTypeId: 1, description: null, imageUrl: null, displayOrder: null }
  }

  function productIn(id: number, categoryId: number): SelectedProduct {
    return { ...product(id, `Product ${id}`), categoryId }
  }

  it('blocks Continue when a chosen category has no product', () => {
    const draft = {
      ...createEmptyOnboardingDraft(),
      categories: [category(10), category(20)],
      products: [productIn(1, 10), productIn(2, 10)],
    }
    expect(validateStep(5, draft, runtime)).toEqual([
      { step: 5, field: 'category-products-20', message: 'Choose at least one product in Category 20.' },
    ])
  })

  it('names every empty category, not just the first', () => {
    const draft = {
      ...createEmptyOnboardingDraft(),
      categories: [category(10), category(20), category(30)],
      products: [productIn(1, 10)],
    }
    expect(validateStep(5, draft, runtime).map((item) => item.field)).toEqual([
      'category-products-20',
      'category-products-30',
    ])
  })

  it('keeps the single prompt when no product is chosen at all', () => {
    const draft = { ...createEmptyOnboardingDraft(), categories: [category(10), category(20)] }
    expect(validateStep(5, draft, runtime).map((item) => item.field)).toEqual(['products'])
  })

  it('does not require a product per category for a submitted store', () => {
    const draft = {
      ...createEmptyOnboardingDraft(),
      categories: [category(10), category(20)],
      products: [productIn(1, 10)],
    }
    expect(additiveCatalogIssues(5, draft)).toEqual([])
  })

  it('allows Continue when every chosen category has a product', () => {
    const draft = {
      ...createEmptyOnboardingDraft(),
      categories: [category(10), category(20)],
      products: [productIn(1, 10), productIn(2, 20)],
    }
    expect(validateStep(5, draft, runtime)).toEqual([])
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
    // The size-level issue already blocks the product, so no product-level prompt is added.
    expect(issues.some((item) => item.field === 'product-1')).toBe(false)
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

  it('rejects new sizes with missing prices and a total past the plan limit', () => {
    const draft = draftWith(
      [product(41, 'Juice')],
      [sku({ id: 'draft-sku-41-1', productId: 41, name: 'Large', listPrice: null, salePrice: null })],
    )
    const issues = additiveCatalogIssues(6, draft, undefined, {
      maxSkus: 3,
      account: { categoryIds: [], productIds: [], skuIds: [4001, 4002, 4003] },
    })
    expect(issues.some((item) => item.field === 'skus')).toBe(true)
    expect(issues.some((item) => item.field === 'sku-draft-sku-41-1-list-price')).toBe(true)
  })

  it('allows an approved size addition without requiring every saved product to be priced', () => {
    const draft = draftWith(
      [product(41, 'Juice'), product(42, 'Unpriced product')],
      [sku({ id: 'sku-4001', productId: 41 }), sku({ id: 'draft-sku-41-1', productId: 41, quantity: 2 })],
    )
    expect(additiveCatalogIssues(6, draft, undefined, {
      maxSkus: 2,
      account: { categoryIds: [], productIds: [], skuIds: [4001] },
    })).toEqual([])
  })

  it('checks new sizes for duplicates against saved sizes', () => {
    const draft = draftWith(
      [product(41, 'Juice')],
      [sku({ id: 'sku-4001', productId: 41 }), sku({ id: 'draft-sku-41-1', productId: 41 })],
    )
    expect(additiveCatalogIssues(6, draft).length).toBeGreaterThan(0)
  })

  it('validates edits to saved sizes, duplicates among them included', () => {
    const draft = draftWith(
      [product(41, 'Juice')],
      [sku({ id: 'sku-4001', productId: 41, salePrice: 999 }), sku({ id: 'sku-4002', productId: 41 })],
    )
    expect(additiveCatalogIssues(6, draft)).toEqual(expect.arrayContaining([
      { step: 6, field: 'sku-sku-4001-sale-price', message: 'Discounted price cannot exceed MRP.' },
      { step: 6, field: 'sku-sku-4002-quantity', message: 'Each size needs a unique quantity and unit.' },
    ]))
  })

  it('requires each product with sizes to keep one switched on, saved sizes included', () => {
    const allOff = draftWith(
      [product(41, 'Juice'), product(42, 'Unpriced product')],
      [sku({ id: 'sku-4001', productId: 41, active: false }), sku({ id: 'sku-4002', productId: 41, quantity: 2, active: false })],
    )
    expect(additiveCatalogIssues(6, allOff)).toEqual([
      { step: 6, field: 'product-41', message: 'Turn on at least one size for Juice.' },
    ])

    const oneOn = draftWith(
      [product(41, 'Juice')],
      [sku({ id: 'sku-4001', productId: 41, active: false }), sku({ id: 'draft-sku-41-1', productId: 41, quantity: 2 })],
    )
    expect(additiveCatalogIssues(6, oneOn)).toEqual([])
  })

  it('blocks removing the only switched-on size while the remaining one is off', () => {
    const removedActive = draftWith(
      [product(41, 'Juice')],
      [sku({ id: 'sku-4002', productId: 41, quantity: 2, active: false })],
    )
    expect(additiveCatalogIssues(6, removedActive)).toEqual([
      { step: 6, field: 'product-41', message: 'Turn on at least one size for Juice.' },
    ])
  })

  it('rejects additions past the limit when inactive account sizes are not listed', () => {
    const draft = draftWith([product(41, 'Juice')], [sku({ id: 'draft-sku-41-1', productId: 41 })])
    const account = { categoryIds: [], productIds: [], skuIds: [4001], unlistedSkuCount: 1 }
    expect(additiveCatalogIssues(6, draft, undefined, { maxSkus: 2, account })
      .some((item) => item.field === 'skus')).toBe(true)
  })
})

describe('validateStep — step 9 WhatsApp numbers', () => {
  const draft = createEmptyOnboardingDraft()

  function orderIssue(orderWhatsapp: string): boolean {
    const state = { ...createEmptyRuntimeState(), orderWhatsapp }
    return validateStep(9, draft, state).some((item) => item.field === 'order-whatsapp')
  }

  function supportIssue(supportWhatsapp: string): boolean {
    // Order stays valid so only the support field can raise an issue.
    const state = { ...createEmptyRuntimeState(), orderWhatsapp: '9876543210', supportWhatsapp }
    return validateStep(9, draft, state).some((item) => item.field === 'support-whatsapp')
  }

  it('accepts a plain ten-digit Indian mobile as the order number', () => {
    expect(orderIssue('9876543210')).toBe(false)
  })

  it('rejects the order number when it is missing', () => {
    expect(orderIssue('')).toBe(true)
  })

  it('rejects an order number with fewer than ten digits', () => {
    expect(orderIssue('987654321')).toBe(true)
  })

  it('rejects an order number that does not start with 6, 7, 8, or 9', () => {
    expect(orderIssue('5876543210')).toBe(true)
  })

  it('does not ask the vendor for E.164 formatting in the order message', () => {
    const state = { ...createEmptyRuntimeState(), orderWhatsapp: '' }
    const message = validateStep(9, draft, state).find((item) => item.field === 'order-whatsapp')?.message ?? ''
    expect(message).not.toMatch(/E\.?164/i)
    expect(message).not.toContain('+91')
  })

  it('treats an empty support number as valid because support is optional', () => {
    expect(supportIssue('')).toBe(false)
  })

  it('accepts a valid ten-digit support number', () => {
    expect(supportIssue('8123456789')).toBe(false)
  })

  it('rejects an invalid support number when one is provided', () => {
    expect(supportIssue('12345')).toBe(true)
  })
})

describe('validateStep — step 4 leaves room for a product in every category', () => {
  function category(id: number): VendorOnboardingDraftV1['categories'][number] {
    return { id, name: `Category ${id}`, businessTypeId: 1, description: null, imageUrl: null, displayOrder: null }
  }

  // Step 5 needs a product in every chosen category and an assigned category cannot be
  // removed, so a category added with no product slot left would trap the vendor.
  it('rejects a new category when the product allowance is already used up', () => {
    const draft = {
      ...createEmptyOnboardingDraft(),
      categories: [category(10), category(20)],
      products: [{ ...product(1, 'Milk'), categoryId: 10 }],
    }
    const issues = validateStep(4, draft, runtime, 5, [], { maxProducts: 1 })
    expect(issues).toEqual([expect.objectContaining({ step: 4, field: 'categories' })])
    expect(issues[0].message).toMatch(/product/i)
  })

  it('counts products already on the account against the remaining room', () => {
    const draft = {
      ...createEmptyOnboardingDraft(),
      categories: [category(10), category(20), category(30)],
      products: [{ ...product(1, 'Milk'), categoryId: 10 }],
    }
    const account = { categoryIds: [10], productIds: [1, 2], skuIds: [] }
    expect(validateStep(4, draft, runtime, 5, [], { maxProducts: 3, account })).toHaveLength(1)
    expect(validateStep(4, draft, runtime, 5, [], { maxProducts: 4, account })).toEqual([])
  })

  it('accepts categories that already hold a product even at the product limit', () => {
    const draft = {
      ...createEmptyOnboardingDraft(),
      categories: [category(10), category(20)],
      products: [{ ...product(1, 'Milk'), categoryId: 10 }, { ...product(2, 'Rice'), categoryId: 20 }],
    }
    expect(validateStep(4, draft, runtime, 5, [], { maxProducts: 2 })).toEqual([])
  })

  it('does not apply to a submitted store, which need not fill every category', () => {
    const draft = { ...createEmptyOnboardingDraft(), categories: [category(10), category(20)] }
    expect(additiveCatalogIssues(4, draft, 5, { maxProducts: 0 })).toEqual([])
  })
})

describe('validateStep — step 5 coverage edge cases', () => {
  function category(id: number): VendorOnboardingDraftV1['categories'][number] {
    return { id, name: `Category ${id}`, businessTypeId: 1, description: null, imageUrl: null, displayOrder: null }
  }

  it('does not let a product outside the chosen categories cover an empty one', () => {
    const draft = {
      ...createEmptyOnboardingDraft(),
      categories: [category(10), category(20)],
      products: [{ ...product(1, 'Milk'), categoryId: 10 }, { ...product(2, 'Stray'), categoryId: 99 }],
    }
    expect(validateStep(5, draft, runtime).map((item) => item.field)).toEqual(['category-products-20'])
  })

  it('reports an empty category before the product limit', () => {
    const draft = {
      ...createEmptyOnboardingDraft(),
      categories: [category(10), category(20)],
      products: [{ ...product(1, 'Milk'), categoryId: 10 }, { ...product(2, 'Curd'), categoryId: 10 }],
    }
    expect(validateStep(5, draft, runtime, 5, [], { maxProducts: 1 }).map((item) => item.field)).toEqual([
      'category-products-20',
      'products',
    ])
  })

  it('surfaces an empty category again in the Step 10 readiness pass', () => {
    const draft = {
      ...createEmptyOnboardingDraft(),
      categories: [category(10), category(20)],
      products: [{ ...product(1, 'Milk'), categoryId: 10 }],
    }
    expect(readinessIssues(draft, runtime).some((item) => item.field === 'category-products-20')).toBe(true)
  })
})

describe('validateStep — step 7 counts are whole numbers and charges are money', () => {
  type Delivery = VendorOnboardingDraftV1['delivery']

  function deliveryIssues(patch: (delivery: Delivery) => Delivery): string[] {
    const draft = createEmptyOnboardingDraft()
    return validateStep(7, { ...draft, delivery: patch(draft.delivery) }, runtime).map((item) => item.field)
  }

  it('accepts the default delivery settings', () => {
    expect(deliveryIssues((delivery) => delivery)).toEqual([])
  })

  it('rejects a fractional delivery-day range', () => {
    expect(deliveryIssues((delivery) => ({ ...delivery, fixedWindow: { minDeliveryDays: 1.5, maxDeliveryDays: 3 } }))).toEqual(['fixed-window'])
    expect(deliveryIssues((delivery) => ({ ...delivery, fixedWindow: { minDeliveryDays: 1, maxDeliveryDays: 2.5 } }))).toEqual(['fixed-window'])
  })

  it('rejects fractional advance-booking days', () => {
    expect(deliveryIssues((delivery) => ({
      ...delivery,
      schedulingStrategy: 'CUSTOMER_SELECT_DATE',
      customerSelectDate: { ...delivery.customerSelectDate, minAdvanceBookingDays: 0.5 },
    }))).toEqual(['customer-date-range'])
  })

  it('rejects a fractional maximum orders per day', () => {
    expect(deliveryIssues((delivery) => ({
      ...delivery,
      schedulingStrategy: 'PREDEFINED_DAYS',
      predefinedDays: { days: ['MONDAY'], maxOrdersPerDay: 2.5 },
    }))).toEqual(['max-orders'])
  })

  it('rejects fractional preparation minutes', () => {
    expect(deliveryIssues((delivery) => ({
      ...delivery,
      schedulingStrategy: 'INSTANT',
      instant: { ...delivery.instant, minPrepTimeMinutes: 10.5 },
    }))).toEqual(['prep-range'])
  })

  it('rejects a delivery charge or free-delivery threshold with more than two decimals', () => {
    expect(deliveryIssues((delivery) => ({ ...delivery, shipping: { ...delivery.shipping, charge: 30.555 } }))).toEqual(['shipping-charge'])
    expect(deliveryIssues((delivery) => ({
      ...delivery,
      shippingStrategy: 'ORDER_AMOUNT_THRESHOLD',
      shipping: { ...delivery.shipping, freeDeliveryThreshold: 299.999 },
    }))).toEqual(['free-threshold'])
  })

  it('accepts a zero delivery charge and two-decimal amounts', () => {
    expect(deliveryIssues((delivery) => ({
      ...delivery,
      shippingStrategy: 'ORDER_AMOUNT_THRESHOLD',
      shipping: { charge: 0, freeDeliveryThreshold: 299.5 },
    }))).toEqual([])
    expect(deliveryIssues((delivery) => ({ ...delivery, shipping: { ...delivery.shipping, charge: 29.99 } }))).toEqual([])
  })

  it('rejects a cleared maximum (read as 0) and a maximum below the minimum', () => {
    expect(deliveryIssues((delivery) => ({ ...delivery, fixedWindow: { minDeliveryDays: 1, maxDeliveryDays: 0 } }))).toEqual(['fixed-window'])
    expect(deliveryIssues((delivery) => ({ ...delivery, fixedWindow: { minDeliveryDays: 4, maxDeliveryDays: 3 } }))).toEqual(['fixed-window'])
  })

  it('skips every home-delivery rule for store pickup', () => {
    expect(deliveryIssues((delivery) => ({
      ...delivery,
      fulfillmentType: 'STORE_PICKUP',
      fixedWindow: { minDeliveryDays: 1.5, maxDeliveryDays: 0 },
      shipping: { charge: -1, freeDeliveryThreshold: 0 },
      slots: [{ id: 'draft-slot-1', startTime: '12:00', endTime: '09:00' }],
    }))).toEqual([])
  })

  it('rejects a slot ending before it starts and an exact duplicate slot', () => {
    expect(deliveryIssues((delivery) => ({
      ...delivery,
      slots: [
        { id: 'draft-slot-1', startTime: '09:00', endTime: '12:00' },
        { id: 'draft-slot-2', startTime: '09:00', endTime: '12:00' },
        { id: 'draft-slot-3', startTime: '18:00', endTime: '17:00' },
      ],
    }))).toEqual(['slot-draft-slot-2', 'slot-draft-slot-3'])
  })
})

describe('validateStep — step 8 UPI details', () => {
  function upiIssues(upiId: string): string[] {
    const draft = createEmptyOnboardingDraft()
    const payments = draft.payments.map((payment) => ({
      ...payment,
      enabled: payment.type === 'PRE_PAID',
      isDefault: payment.type === 'PRE_PAID',
    }))
    const state = {
      ...createEmptyRuntimeState(),
      paymentDetails: { ...createEmptyRuntimeState().paymentDetails, upiId, upiAccountHolderName: 'Asha Rao' },
    }
    return validateStep(8, { ...draft, payments }, state).map((item) => item.field)
  }

  it('accepts a UPI ID in the name@bank form', () => {
    expect(upiIssues('asha.rao-1@okaxis')).toEqual([])
    expect(upiIssues('  9876543210@ybl ')).toEqual([])
  })

  it('rejects a UPI ID that is not in the name@bank form', () => {
    for (const value of ['asharao', 'asha@', '@okaxis', 'asha rao@okaxis', 'asha@ok axis', 'a@b@c']) {
      expect(upiIssues(value), value).toEqual(['upi-id'])
    }
  })

  it('still asks for a missing UPI ID', () => {
    expect(upiIssues('   ')).toEqual(['upi-id'])
  })
})

describe('validateStep — step 9 matches what the account accepts', () => {
  function validStoreDraft(): VendorOnboardingDraftV1 {
    const draft = createEmptyOnboardingDraft()
    return {
      ...draft,
      storefront: { ...draft.storefront, storeName: 'Asha Dairy', businessLocation: 'Indiranagar' },
    }
  }
  const storeRuntime = { ...createEmptyRuntimeState(), orderWhatsapp: '9876543210' }

  function storeIssues(patch: Partial<VendorOnboardingDraftV1['storefront']>): string[] {
    const draft = validStoreDraft()
    return validateStep(9, { ...draft, storefront: { ...draft.storefront, ...patch } }, storeRuntime).map((item) => item.field)
  }

  it('accepts a complete storefront', () => {
    expect(storeIssues({})).toEqual([])
  })

  // The store name is also saved as the business name, which the account requires to be
  // at least five characters; a shorter name would save the storefront and then fail.
  it('rejects a store name shorter than five characters', () => {
    expect(storeIssues({ storeName: 'Abc' })).toEqual(['store-name'])
    expect(storeIssues({ storeName: ' Abcd ' })).toEqual(['store-name'])
    expect(storeIssues({ storeName: 'Abcde' })).toEqual([])
  })

  it('accepts a store name of exactly 100 characters and rejects 101', () => {
    expect(storeIssues({ storeName: 'a'.repeat(100) })).toEqual([])
    expect(storeIssues({ storeName: 'a'.repeat(101) })).toEqual(['store-name'])
  })

  it('accepts Instagram handles and profile URLs the account accepts', () => {
    for (const instagram of ['asha.dairy', '@asha_dairy', 'https://instagram.com/asha.dairy', 'https://www.instagram.com/asha_dairy/']) {
      expect(storeIssues({ instagram }), instagram).toEqual([])
    }
  })

  it('rejects Instagram URLs the account refuses', () => {
    for (const instagram of [
      'https://instagram.com',
      'https://www.instagram.com/',
      'https://www.instagram.com/p/abc123/',
      'https://m.instagram.com/asha',
      'https://instagram.com/asha?igsh=x',
      'http://instagram.com/asha',
      'https://evil.com/instagram.com/asha',
    ]) {
      expect(storeIssues({ instagram }), instagram).toEqual(['instagram'])
    }
  })

  it('rejects a whitespace-only store name and location', () => {
    const draft = validStoreDraft()
    const blank = {
      ...draft,
      storefront: { ...draft.storefront, storeName: '     ', businessLocation: '   ' },
    }
    expect(validateStep(9, blank, storeRuntime).map((item) => item.field)).toEqual([
      'store-name',
      'business-location',
    ])
  })
})

describe('validateStep — step 1 phone', () => {
  it('asks for a valid mobile number in plain words', () => {
    expect(validateStep(1, createEmptyOnboardingDraft(), { ...runtime, phone: '123' })).toEqual([
      { step: 1, field: 'phone', message: 'Enter a valid mobile number.' },
    ])
  })
})
