import { describe, expect, it } from 'vitest'
import type { BusinessTypeReference } from '@/shared/api'
import { createEmptyOnboardingDraft, createEmptyRuntimeState } from '../data/onboarding-defaults'
import type {
  DraftCategory,
  DraftSku,
  PaymentOptionDraft,
  SelectedProduct,
  VendorOnboardingDraftV1,
} from '../types/onboarding'
import { buildReviewSummary, maskContact } from './onboarding-review-summary'

const BUSINESS_TYPE: BusinessTypeReference = { id: 7, name: 'Home foods', icon: null, displayOrder: null }

function category(id: number, name: string): DraftCategory {
  return { id, name, businessTypeId: 7, description: null, imageUrl: null, displayOrder: null }
}

function product(id: number): SelectedProduct {
  return { id, name: `Product ${id}`, description: null, imageUrl: null, measurementId: null, measurementName: null, categoryId: 1 }
}

function sku(id: string, active: boolean): DraftSku {
  return {
    id,
    productId: 1,
    name: 'Regular',
    description: '',
    skuType: 'ITEM',
    measurementType: 'WEIGHT',
    unit: 'kg',
    quantity: 1,
    listPrice: 100,
    salePrice: 90,
    active,
    homeDelivery: true,
    storePickup: true,
  }
}

function payment(type: PaymentOptionDraft['type'], enabled: boolean): PaymentOptionDraft {
  return { type, enabled, isDefault: false }
}

function draftWith(overrides: (draft: VendorOnboardingDraftV1) => void): VendorOnboardingDraftV1 {
  const draft = createEmptyOnboardingDraft()
  overrides(draft)
  return draft
}

describe('maskContact', () => {
  it('shows only the last four digits of a full number', () => {
    expect(maskContact('9876543210')).toBe('•••••• 3210')
  })

  it('strips spacing and other non-digits before masking', () => {
    expect(maskContact('98765 43210')).toBe('•••••• 3210')
  })

  it('returns null for an empty or blank value so the row can be dropped', () => {
    expect(maskContact('')).toBeNull()
    expect(maskContact('   ')).toBeNull()
  })

  it('never exposes more than the last four digits of a partial number', () => {
    // A brief can render before Step 9 validation passes, so a half-typed number must not
    // reveal its full self. The fixed mask also hides how many digits were entered.
    expect(maskContact('98765')).toBe('•••••• 8765')
  })
})

describe('buildReviewSummary catalog group', () => {
  it('carries the chosen business type name, or null when none is chosen', () => {
    expect(buildReviewSummary(createEmptyOnboardingDraft(), createEmptyRuntimeState()).catalog.businessType).toBeNull()
    const draft = draftWith((current) => {
      current.business.businessType = BUSINESS_TYPE
    })
    expect(buildReviewSummary(draft, createEmptyRuntimeState()).catalog.businessType).toBe('Home foods')
  })

  it('shows at most three category names and counts the rest as +N', () => {
    const draft = draftWith((current) => {
      current.categories = [
        category(1, 'Snacks'),
        category(2, 'Sweets'),
        category(3, 'Pickles'),
        category(4, 'Spices'),
        category(5, 'Drinks'),
      ]
    })
    const catalog = buildReviewSummary(draft, createEmptyRuntimeState()).catalog
    expect(catalog.categoryNames).toEqual(['Snacks', 'Sweets', 'Pickles'])
    expect(catalog.extraCategoryCount).toBe(2)
  })

  it('reports no overflow when three or fewer categories are chosen', () => {
    const draft = draftWith((current) => {
      current.categories = [category(1, 'Snacks'), category(2, 'Sweets')]
    })
    const catalog = buildReviewSummary(draft, createEmptyRuntimeState()).catalog
    expect(catalog.categoryNames).toEqual(['Snacks', 'Sweets'])
    expect(catalog.extraCategoryCount).toBe(0)
  })

  it('counts products and splits active from inactive sizes', () => {
    const draft = draftWith((current) => {
      current.products = [product(1), product(2)]
      current.skus = [sku('a', true), sku('b', true), sku('c', false)]
    })
    const catalog = buildReviewSummary(draft, createEmptyRuntimeState()).catalog
    expect(catalog.productCount).toBe(2)
    expect(catalog.activeSizeCount).toBe(2)
    expect(catalog.inactiveSizeCount).toBe(1)
  })
})

describe('buildReviewSummary orders group', () => {
  it('describes the configured fulfilment choice', () => {
    const draft = draftWith((current) => {
      current.delivery.fulfillmentType = 'BOTH'
    })
    expect(buildReviewSummary(draft, createEmptyRuntimeState()).orders.fulfilment).toBe('Delivery & pickup')
  })

  it('lists only enabled payment methods', () => {
    const draft = draftWith((current) => {
      current.payments = [
        payment('PRE_PAID', true),
        payment('ONLINE', false),
        payment('CASH_ON_DELIVERY', true),
      ]
    })
    expect(buildReviewSummary(draft, createEmptyRuntimeState()).orders.paymentMethods).toEqual([
      'UPI',
      'Cash on delivery',
    ])
  })

  it('masks the order number and drops the optional support number when absent', () => {
    const runtime = createEmptyRuntimeState()
    runtime.orderWhatsapp = '9876543210'
    const orders = buildReviewSummary(createEmptyOnboardingDraft(), runtime).orders
    expect(orders.orderWhatsapp).toBe('•••••• 3210')
    expect(orders.supportWhatsapp).toBeNull()
  })

  it('masks the support number when one is provided', () => {
    const runtime = createEmptyRuntimeState()
    runtime.orderWhatsapp = '9876543210'
    runtime.supportWhatsapp = '9000000001'
    expect(buildReviewSummary(createEmptyOnboardingDraft(), runtime).orders.supportWhatsapp).toBe('•••••• 0001')
  })
})

describe('buildReviewSummary store group', () => {
  it('trims the store name and location, and reports blanks as null', () => {
    const blank = buildReviewSummary(createEmptyOnboardingDraft(), createEmptyRuntimeState()).store
    expect(blank.storeName).toBeNull()
    expect(blank.businessLocation).toBeNull()

    const draft = draftWith((current) => {
      current.storefront.storeName = '  Lakshmi Home Foods  '
      current.storefront.businessLocation = 'Hyderabad'
    })
    const store = buildReviewSummary(draft, createEmptyRuntimeState()).store
    expect(store.storeName).toBe('Lakshmi Home Foods')
    expect(store.businessLocation).toBe('Hyderabad')
  })
})
