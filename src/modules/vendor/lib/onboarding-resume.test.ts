import { describe, expect, it } from 'vitest'
import { SAMPLE_MEASUREMENT_CATALOG } from '../data/onboarding-measurement-sample'
import type {
  BusinessTypeReference,
  CheckoutOptionsSnapshot,
  VendorCategoryRef,
  VendorContext,
  VendorProductRef,
  VendorProfile,
  VendorSkuRef,
} from '@/shared/api'
import { createEmptyRuntimeState } from '../data/onboarding-defaults'
import {
  backendResumeStep,
  buildResumeDraft,
  derivedResumeStep,
  earliestIncompleteStep,
  furthestSavedStep,
  resumeStep,
  isVendorApproved,
  isStoreSubmitted,
  resumePaymentDetails,
  type ServerOnboardingState,
} from './onboarding-resume'
import { readinessIssues } from './onboarding-validation'
import { parsePersistedEnvelope, toPersistedDraft } from './onboarding-persistence'

const BUSINESS_TYPE: BusinessTypeReference = {
  id: 7,
  name: 'Beverages & Juice Center',
  icon: null,
  displayOrder: 1,
}

function context(overrides: Partial<VendorContext> = {}): VendorContext {
  return {
    vendorId: '91',
    businessName: 'SK Organic Store',
    storeIdentifier: null,
    vendorStatus: 'INACTIVE',
    approvalStatus: 'PENDING',
    membershipRole: 'OWNER',
    onboarding: { status: 'IN_PROGRESS', description: 'Step 2 is completed', nextStep: null },
    subscription: {
      tier: 'SILVER',
      planName: 'Silver',
      status: 'TRIAL',
      limits: { maxCategories: 10, maxProducts: 50, maxSkus: 100, maxImages: 50 },
      usage: { categories: 2, products: 5, skus: 12, images: 3 },
    },
    eligibleFeatures: ['DASHBOARD'],
    ...overrides,
  }
}

const PROFILE: VendorProfile = {
  businessName: 'SK Organic Store',
  businessType: BUSINESS_TYPE.name,
  ownerName: 'Sanjay Kumar',
  contactPerson: 'Sanjay Kumar',
  contactNumber: '9876543210',
}

const CATEGORIES: VendorCategoryRef[] = [
  { vendorCategoryId: 501, platformCategoryId: 10, name: 'Juices', imageUrl: null },
]

const PRODUCTS: VendorProductRef[] = [
  { vendorProductId: 900, platformProductId: 31, platformCategoryId: 10, name: 'Orange Juice', measurementId: 2 },
]

const SKUS: VendorSkuRef[] = [
  {
    vendorProductId: 900,
    skuId: 4021,
    name: 'Orange Juice-1 L',
    size: '1 L',
    displayName: 'Orange Juice',
    description: 'Cold pressed',
    isActive: true,
    listPrice: 180,
    salePrice: 160,
    quantity: 1,
    unit: 'L',
  },
]

const CHECKOUT: CheckoutOptionsSnapshot = {
  fulfillmentType: 'HOME_DELIVERY',
  orderAcceptancePolicy: 'AUTO_ACCEPT',
  schedulingStrategy: 'FIXED_WINDOW',
  schedulingConfig: { min_delivery_days: 1, max_delivery_days: 4 },
  shippingConfig: { deliveryCharge: 25, freeDeliveryThreshold: 500 },
  slots: [{ startTime: '09:00', endTime: '12:00' }],
  consentTitle: '',
  consentText: '',
  payments: [{ type: 'CASH_ON_DELIVERY', isDefault: true, details: {} }],
}

/** A vendor who has saved everything the account can hold, but has not submitted. */
function fullState(overrides: Partial<ServerOnboardingState> = {}): ServerOnboardingState {
  return {
    context: context(),
    profile: PROFILE,
    categories: CATEGORIES,
    products: PRODUCTS,
    skus: SKUS,
    checkout: CHECKOUT,
    businessTypes: [BUSINESS_TYPE],
    measurements: SAMPLE_MEASUREMENT_CATALOG,
    ...overrides,
  }
}

const SUBMITTED_CONTEXT = context({
  vendorStatus: 'ACTIVE',
  storeIdentifier: 'sk-organic-store',
  approvalStatus: 'PENDING',
})

describe('submission and approval', () => {
  it('reads submission from vendor_status and approval from approval_status', () => {
    expect(isStoreSubmitted(fullState({ context: SUBMITTED_CONTEXT }))).toBe(true)
    expect(isVendorApproved(fullState({ context: SUBMITTED_CONTEXT }))).toBe(false)
    expect(isVendorApproved(fullState({ context: context({ approvalStatus: 'APPROVED' }) }))).toBe(true)
    expect(isStoreSubmitted(fullState())).toBe(false)
  })
})

describe('earliestIncompleteStep', () => {
  it('reports the first step with nothing saved behind it', () => {
    expect(earliestIncompleteStep(fullState({ profile: { ...PROFILE, businessType: 'Others' } }))).toBe(3)
    expect(earliestIncompleteStep(fullState({ categories: [] }))).toBe(4)
    expect(earliestIncompleteStep(fullState({ products: [] }))).toBe(5)
    expect(earliestIncompleteStep(fullState({ skus: [] }))).toBe(6)
    expect(earliestIncompleteStep(fullState({ checkout: null }))).toBe(7)
    expect(earliestIncompleteStep(fullState({ checkout: { ...CHECKOUT, payments: [] } }))).toBe(8)
  })

  it('stops at 9 for a vendor who has saved everything but not submitted', () => {
    // Branding cannot be read back before approval, so Step 9 is always re-confirmed.
    expect(earliestIncompleteStep(fullState())).toBe(9)
  })

  it('reports 10 once the store is submitted', () => {
    expect(earliestIncompleteStep(fullState({ context: SUBMITTED_CONTEXT }))).toBe(10)
  })
})

/** `onboarding.next_step`, as both /verify-otp and /context return it. */
function withNextStep(nextStep: number | null, overrides: Partial<ServerOnboardingState> = {}) {
  const base = fullState(overrides)
  return {
    ...base,
    context: { ...base.context, onboarding: { ...base.context.onboarding, nextStep } },
  }
}

describe('resumeStep — the backend pointer decides', () => {
  it('opens where the backend says, not where the resources imply', () => {
    // The case that proves the point. Verified on a submitted account: three products,
    // two priced, delivery and payments saved. The account "looks" incomplete at Step 6;
    // the vendor genuinely finished Step 8 and the backend reports 9.
    const stranded = withNextStep(9, {
      products: [
        ...PRODUCTS,
        { vendorProductId: 901, platformProductId: 32, platformCategoryId: 10, name: 'Apple Juice', measurementId: 2 },
      ],
    })

    expect(earliestIncompleteStep(stranded)).toBe(6)
    expect(resumeStep(stranded)).toBe(9)
  })

  it('takes next_step verbatim across the setup range', () => {
    for (const step of [3, 4, 5, 6, 7, 8, 9, 10] as const) {
      expect(resumeStep(withNextStep(step))).toBe(step)
    }
  })

  it('treats a post-setup pointer as the review step', () => {
    // The backend reports 11 once setup is complete.
    expect(backendResumeStep(withNextStep(11).context)).toBe(10)
    expect(backendResumeStep(withNextStep(99).context)).toBe(10)
  })

  it('never sends a signed-in vendor back to the identity steps', () => {
    // Steps 1-2 establish the session that is already established.
    expect(backendResumeStep(withNextStep(1).context)).toBe(3)
    expect(backendResumeStep(withNextStep(2).context)).toBe(3)
  })

  it('ignores the pointer once the store is submitted', () => {
    const submitted = withNextStep(6, {
      context: {
        ...SUBMITTED_CONTEXT,
        onboarding: { ...SUBMITTED_CONTEXT.onboarding, nextStep: 6 },
      },
    })
    expect(resumeStep(submitted)).toBe(10)
  })

  it('falls back to the derivation only when the field is missing', () => {
    expect(backendResumeStep(withNextStep(null).context)).toBeNull()
    expect(resumeStep(withNextStep(null))).toBe(derivedResumeStep(withNextStep(null)))
  })
})

describe('derivedResumeStep — fallback only, if the contract drops next_step', () => {
  it('still keeps a vendor past Step 6 despite an unpriced product', () => {
    // Products cannot be unassigned (403, Admin only), so a leftover unpriced product is
    // permanent. Reopening Step 6 for it would discard Steps 7 and 8 on every visit.
    const stranded = fullState({
      products: [
        ...PRODUCTS,
        { vendorProductId: 901, platformProductId: 32, platformCategoryId: 10, name: 'Apple Juice', measurementId: 2 },
      ],
    })

    expect(earliestIncompleteStep(stranded)).toBe(6)
    expect(furthestSavedStep(stranded)).toBe(8)
    expect(derivedResumeStep(stranded)).toBe(9)
  })

  it('reports the furthest step the account can prove', () => {
    expect(furthestSavedStep(fullState({ profile: { ...PROFILE, businessType: 'Others' }, categories: [], products: [], skus: [], checkout: null }))).toBeNull()
    expect(furthestSavedStep(fullState({ categories: [], products: [], skus: [], checkout: null }))).toBe(3)
    expect(furthestSavedStep(fullState({ products: [], skus: [], checkout: null }))).toBe(4)
    expect(furthestSavedStep(fullState({ skus: [], checkout: null }))).toBe(5)
    expect(furthestSavedStep(fullState({ checkout: null }))).toBe(6)
    expect(furthestSavedStep(fullState({ checkout: { ...CHECKOUT, payments: [] } }))).toBe(7)
    expect(furthestSavedStep(fullState())).toBe(8)
    expect(furthestSavedStep(fullState({ context: SUBMITTED_CONTEXT }))).toBe(10)
  })

  it('never runs ahead of a genuine gap at the front of setup', () => {
    // Nothing saved past categories, so there is no work to protect: open at the gap.
    const early = fullState({ products: [], skus: [], checkout: null })
    expect(derivedResumeStep(early)).toBe(5)
  })

  it('stops at 9 before submission, and 10 afterwards', () => {
    expect(derivedResumeStep(fullState())).toBe(9)
    expect(derivedResumeStep(fullState({ context: SUBMITTED_CONTEXT }))).toBe(10)
  })

  it('opens a brand-new account at Step 3', () => {
    expect(derivedResumeStep(fullState({
      profile: { ...PROFILE, businessType: 'Others' }, categories: [], products: [], skus: [], checkout: null,
    }))).toBe(3)
  })
})

describe('buildResumeDraft', () => {
  it('hydrates every step the account can supply', () => {
    const { draft, openAt, furthestVisitedStep } = buildResumeDraft(fullState())

    expect(openAt).toBe(9)
    expect(furthestVisitedStep).toBe(9)
    expect(draft.mobileVerified).toBe(true)
    expect(draft.business.businessType).toEqual(BUSINESS_TYPE)
    expect(draft.business.ownerName).toBe('Sanjay Kumar')
    expect(draft.categories.map((category) => category.id)).toEqual([10])
    expect(draft.products.map((product) => product.id)).toEqual([31])
    expect(draft.skus).toHaveLength(1)
    expect(draft.skus[0]).toMatchObject({ id: 'sku-4021', productId: 31, name: 'Orange Juice', salePrice: 160 })
    expect(draft.delivery.fixedWindow).toEqual({ minDeliveryDays: 1, maxDeliveryDays: 4 })
    expect(draft.delivery.slots).toEqual([{ id: 'slot-1', startTime: '09:00', endTime: '12:00' }])
    expect(draft.payments).toContainEqual({ type: 'CASH_ON_DELIVERY', enabled: true, isDefault: true })
    expect(draft.storefront.storeName).toBe('SK Organic Store')
  })

  it('hydrates a submitted vendor too, not just an unfinished one', () => {
    // A submitted store still has to show its own catalog and settings on Steps 3-9.
    const { draft, openAt } = buildResumeDraft(fullState({ context: SUBMITTED_CONTEXT }))

    expect(openAt).toBe(10)
    expect(draft.currentStep).toBe(10)
    expect(draft.completedSteps).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect(draft.categories).toHaveLength(1)
    expect(draft.products).toHaveLength(1)
    expect(draft.skus).toHaveLength(1)
    expect(draft.payments.find((payment) => payment.type === 'CASH_ON_DELIVERY')?.enabled).toBe(true)
  })

  it('restores the order WhatsApp number from the vendor record', () => {
    // Nothing else can supply it: the storefront read 404s before approval, and runtime
    // state is never persisted. Without it Step 9 fails E.164 validation on every resume.
    const { orderWhatsapp } = buildResumeDraft(fullState())
    expect(orderWhatsapp).toBe('+919876543210')
  })

  it('leaves an unconfigured vendor at Step 3 with an empty draft', () => {
    const { draft, openAt } = buildResumeDraft({
      context: context(),
      profile: { ...PROFILE, businessType: 'Others' },
      categories: [],
      products: [],
      skus: [],
      checkout: null,
      businessTypes: [BUSINESS_TYPE],
      measurements: SAMPLE_MEASUREMENT_CATALOG,
    })

    expect(openAt).toBe(3)
    expect(draft.business.businessType).toBeNull()
    expect(draft.categories).toEqual([])
  })
})

describe('a resumed draft is submittable', () => {
  it('raises no readiness issues once Step 9 branding is confirmed', () => {
    // The end-to-end guard: everything the account gave back has to survive the wizard's
    // own validators, or the vendor is blocked on Step 6 and Step 10 with no way forward.
    const resumed = buildResumeDraft(fullState({ context: SUBMITTED_CONTEXT }))
    const runtime = {
      ...createEmptyRuntimeState(),
      orderWhatsapp: resumed.orderWhatsapp,
      paymentDetails: resumePaymentDetails(CHECKOUT, createEmptyRuntimeState().paymentDetails),
    }
    const draft = {
      ...resumed.draft,
      storefront: { ...resumed.draft.storefront, businessLocation: 'Indore' },
    }

    expect(readinessIssues(draft, runtime)).toEqual([])
  })
})

describe('a partial resume still produces a loadable draft', () => {
  // `getBusinessTypes` is wrapped in `optional()`, so it can fail while the vendor's
  // categories load fine. Attributing those categories to business type `0` used to make
  // the draft unpersistable — the validator rejects a zero reference id — so a transient
  // read failure came back as "your saved draft is damaged" on the next reload.
  function stateWithoutBusinessTypes(): ServerOnboardingState {
    return fullState({ businessTypes: [] })
  }

  it('records unknown attribution as null rather than zero', () => {
    const { draft } = buildResumeDraft(stateWithoutBusinessTypes())

    expect(draft.business.businessType).toBeNull()
    expect(draft.categories.length).toBeGreaterThan(0)
    for (const category of draft.categories) {
      expect(category.businessTypeId).toBeNull()
    }
  })

  it('round-trips through the draft validator', () => {
    const { draft, furthestVisitedStep } = buildResumeDraft(stateWithoutBusinessTypes())
    const envelope = {
      version: 4,
      revision: 1,
      updatedAt: new Date().toISOString(),
      ownerId: '91',
      furthestVisitedStep,
      hasLocalEdits: false,
      draft: toPersistedDraft(draft),
      previewSnapshot: null,
    }

    expect(parsePersistedEnvelope(JSON.parse(JSON.stringify(envelope)))).not.toBeNull()
  })

  it('still attributes categories when the lookup succeeds', () => {
    const { draft } = buildResumeDraft(fullState())
    for (const category of draft.categories) {
      expect(category.businessTypeId).toBe(BUSINESS_TYPE.id)
    }
  })
})
