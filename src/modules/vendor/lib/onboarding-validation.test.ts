import { describe, expect, it } from 'vitest'
import {
  createEmptyOnboardingDraft,
  createEmptyRuntimeState,
} from '../data/onboarding-defaults'
import type {
  DraftSku,
  SelectedProduct,
  VendorOnboardingDraftV1,
} from '../types/onboarding'
import { readinessIssues, validateStep } from './onboarding-validation'

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

  it('still rejects two SKUs identical in name, quantity and unit', () => {
    const draft = draftWith(
      [product(1, 'Milk')],
      [
        sku({ id: 'sku-1', productId: 1, name: 'Milk', quantity: 1, unit: 'L' }),
        sku({ id: 'sku-2', productId: 1, name: 'Milk', quantity: 1, unit: 'L' }),
      ],
    )

    const issues = validateStep(6, draft, runtime)
    expect(issues.some((issue) => issue.field === 'sku-sku-2-name')).toBe(true)
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
      issue.message.includes('Sale price'),
    )
    expect(priceIssue?.field).toBe('sku-sku-4021-sale-price')
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
