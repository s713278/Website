import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SAMPLE_MEASUREMENT_CATALOG } from '../data/onboarding-measurement-sample'
import {
  mapVendorContext,
  vendorOnboardingService,
  type BusinessTypeReference,
  type CheckoutOptionsSnapshot,
  type VendorCategoryRef,
  type VendorContext,
  type VendorProductRef,
  type VendorProfile,
  type VendorSkuRef,
} from '@/shared/api'
import { businessTypeCacheKey, readReferenceCache, writeReferenceCache } from './onboarding-catalog-cache'
import { createEmptyOnboardingDraft, createEmptyRuntimeState } from '../data/onboarding-defaults'
import { invalidateOnboardingResources } from './onboarding-resource-cache'
import {
  accountReadsForResumeStep,
  applyBusinessType,
  applyCategories,
  applyCheckout,
  applyProducts,
  applyProfile,
  applyResumeFrame,
  applyResumeState,
  applySkus,
  backendResumeStep,
  buildResumeDraft,
  derivedResumeStep,
  earliestIncompleteStep,
  furthestSavedStep,
  loadServerOnboardingState,
  resumeFromAccount,
  resumeStep,
  isVendorApproved,
  snapshotLoadedSteps,
  isStoreSubmitted,
  measurementCatalogsForResume,
  resolveBusinessType,
  resumeOrderWhatsapp,
  resumePaymentDetails,
  stepResources,
  type OnboardingResource,
  type ResumeApplyOptions,
  type ServerOnboardingState,
} from './onboarding-resume'
import type { OnboardingStep } from '../types/onboarding'
import { readinessIssues } from './onboarding-validation'
import { parsePersistedEnvelope, toPersistedDraft } from './onboarding-persistence'
import { deriveStoreState } from './store-state'

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
      currency: 'INR',
      monthlyPrice: 999,
      yearlyPrice: 9999,
      trialEndsAt: null,
      trialDays: null,
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
    priceId: 8021,
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
  schedulingStrategy: 'FIXED_WINDOW',
  schedulingConfig: { min_delivery_days: 1, max_delivery_days: 4 },
  shippingConfig: { deliveryCharge: 25, freeDeliveryThreshold: 500 },
  slots: [{ startTime: '09:00', endTime: '12:00' }],
  consentTitle: '',
  consentText: '',
  payments: [{ type: 'CASH_ON_DELIVERY', isDefault: true, details: {} }],
}

describe('measurementCatalogsForResume', () => {
  it('keeps sample units for size authoring but not product metadata after a failed read', () => {
    expect(measurementCatalogsForResume(null)).toEqual({
      measurements: SAMPLE_MEASUREMENT_CATALOG,
      productMeasurementCatalog: [],
    })

    expect(measurementCatalogsForResume(SAMPLE_MEASUREMENT_CATALOG)).toEqual({
      measurements: SAMPLE_MEASUREMENT_CATALOG,
      productMeasurementCatalog: SAMPLE_MEASUREMENT_CATALOG,
    })
  })
})

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
    productMeasurementCatalog: SAMPLE_MEASUREMENT_CATALOG,
    ...overrides,
  }
}

const SUBMITTED_CONTEXT = context({
  vendorStatus: 'ACTIVE',
  storeIdentifier: 'sk-organic-store',
  approvalStatus: 'PENDING',
  onboarding: { status: 'COMPLETED', nextStep: 11, description: null },
})

describe('accountReadsForResumeStep', () => {
  it.each([
    [3, []],
    [4, ['categories']],
    [5, ['categories', 'products', 'measurements']],
    [6, ['categories', 'products', 'measurements', 'skus']],
    [7, ['categories', 'products', 'measurements', 'skus', 'checkout']],
    [8, ['categories', 'products', 'measurements', 'skus', 'checkout']],
    [9, ['categories', 'products', 'measurements', 'skus', 'checkout']],
    [10, ['categories', 'products', 'measurements', 'skus', 'checkout']],
  ] as const)('returns the cumulative account reads for resume Step %i', (step, expected) => {
    expect(accountReadsForResumeStep(step)).toEqual(expected)
  })
})

describe('submission and approval', () => {
  it('reads submission from vendor_status and approval from approval_status', () => {
    expect(isStoreSubmitted(fullState({ context: SUBMITTED_CONTEXT }))).toBe(true)
    expect(isVendorApproved(fullState({ context: SUBMITTED_CONTEXT }))).toBe(false)
    expect(isVendorApproved(fullState({ context: context({ approvalStatus: 'APPROVED' }) }))).toBe(true)
    expect(isStoreSubmitted(fullState())).toBe(false)
  })

  it('keeps pending size creation unapproved even when the console opens the same submitted store', () => {
    // These readings must disagree: the backend still refuses size creation with HTTP 417
    // while pending. Sharing the console's temporary coercion would reopen a failing control.
    const state = fullState({ context: SUBMITTED_CONTEXT })

    expect(deriveStoreState(state.context)).toBe('OPEN')
    expect(isVendorApproved(state)).toBe(false)
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

  it('resumes unfinished setup even when the store is active', () => {
    const submitted = withNextStep(6, {
      context: {
        ...SUBMITTED_CONTEXT,
        onboarding: { ...SUBMITTED_CONTEXT.onboarding, nextStep: 6 },
      },
    })
    expect(resumeStep(submitted)).toBe(6)
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

  it('preserves the hidden size fields the account supplies and defaults the rest', () => {
    // Step 6 no longer edits a size's name, description, or per-size fulfilment. Resume must
    // still carry the name and description the account holds so hiding the controls never
    // erases them, and default the fulfilment flags the SKU read never returns.
    const { draft } = buildResumeDraft(fullState())

    expect(draft.skus[0]).toMatchObject({
      name: 'Orange Juice',
      description: 'Cold pressed',
      homeDelivery: true,
      storePickup: true,
    })
  })

  it("derives each SKU's measurement from its product and falls a stale unit back", () => {
    // The product is measured by VOLUME (id 2); a SKU stored in 'kg' predates that or was
    // written directly. Resume derives the measurement from the product and snaps the unit
    // to a valid one for it rather than resuming an off-product measurement.
    const { draft } = buildResumeDraft(
      fullState({ skus: [{ ...SKUS[0], unit: 'kg' }] }),
    )

    expect(draft.skus[0].measurementType).toBe('VOLUME')
    expect(draft.skus[0].unit).toBe('L')
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

  it('restores the order WhatsApp number as a ten-digit national number', () => {
    // Nothing else can supply it: the storefront read 404s before approval, and runtime
    // state is never persisted. Step 9 now holds national digits, so that is what resume gives.
    const { orderWhatsapp } = buildResumeDraft(fullState())
    expect(orderWhatsapp).toBe('9876543210')
  })

  it('strips a stored +91 country code back to the national number', () => {
    const { orderWhatsapp } = buildResumeDraft(
      fullState({ profile: { ...PROFILE, contactNumber: '+919876543210' } }),
    )
    expect(orderWhatsapp).toBe('9876543210')
  })

  it('leaves the order number empty when the stored value is not an Indian mobile', () => {
    // An unconvertible number yields an empty field and the vendor simply re-enters it,
    // rather than seeding Step 9 with a value its validator would reject anyway.
    const { orderWhatsapp } = buildResumeDraft(
      fullState({ profile: { ...PROFILE, contactNumber: '+14155552671' } }),
    )
    expect(orderWhatsapp).toBe('')
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
      productMeasurementCatalog: SAMPLE_MEASUREMENT_CATALOG,
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
      editedSteps: [],
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

describe('loadServerOnboardingState files Step 3\'s first page', () => {
  const accountKey = businessTypeCacheKey('account', '')
  const types = Array.from({ length: 30 }, (_, index) => ({
    id: index + 1, name: `Type ${index + 1}`, icon: null, displayOrder: index + 1,
  }))

  // The cache is module-level with no reset; 48 other keys push every earlier entry out.
  beforeEach(() => {
    for (let index = 0; index < 48; index++) {
      writeReferenceCache(`test-filler:${index}`, { items: [], pageNumber: 0, pageSize: 9, totalElements: 0, totalPages: 0, lastPage: true }, false)
    }
  })
  afterEach(() => {
    vi.restoreAllMocks()
    invalidateOnboardingResources()
  })

  function answerReads(businessType: string | null) {
    vi.spyOn(vendorOnboardingService, 'getVendorContext').mockResolvedValue(mapVendorContext({
      data: {
        vendor_id: '91', vendor_status: 'SETTING_UP', approval_status: 'PENDING',
        onboarding: { status: 'IN_PROGRESS', next_step: 4 },
      },
    }))
    vi.spyOn(vendorOnboardingService, 'getVendorProfile').mockResolvedValue({
      businessName: 'Store', businessType, ownerName: '', contactPerson: '', contactNumber: '',
    })
    vi.spyOn(vendorOnboardingService, 'getVendorCategories').mockResolvedValue([])
    return vi.spyOn(vendorOnboardingService, 'getBusinessTypes')
  }

  it('seeds the account key from the 100-row read when a type is saved', async () => {
    const getBusinessTypes = answerReads('Type 3')
    getBusinessTypes.mockResolvedValue({
      items: types, pageNumber: 0, pageSize: 100, totalElements: 30, totalPages: 1, lastPage: true,
    })

    const state = await loadServerOnboardingState('91')

    expect(getBusinessTypes).toHaveBeenCalledTimes(1)
    expect(state.businessTypes).toHaveLength(30)
    const seeded = readReferenceCache<{ id: number }>(accountKey)
    expect(seeded?.items.map((entry) => entry.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect(seeded).toMatchObject({ pageNumber: 0, lastPage: false })
  })

  it('seeds nothing when the read rejects', async () => {
    answerReads('Type 3').mockRejectedValue(new Error('offline'))

    const state = await loadServerOnboardingState('91')

    expect(state.businessTypes).toEqual([])
    expect(readReferenceCache(accountKey)).toBeNull()
  })

  it.each([null, 'Others'])('makes no read and seeds nothing for a saved type of %s', async (saved) => {
    const getBusinessTypes = answerReads(saved)

    await loadServerOnboardingState('91')

    expect(getBusinessTypes).not.toHaveBeenCalled()
    expect(readReferenceCache(accountKey)).toBeNull()
  })
})

describe('stepResources', () => {
  it.each([
    [1, false, [], false],
    [2, false, [], false],
    [3, false, ['profile', 'businessTypes'], false],
    [4, false, ['profile', 'businessTypes', 'categories'], false],
    [5, false, ['profile', 'businessTypes', 'categories', 'products'], true],
    [6, false, ['profile', 'businessTypes', 'categories', 'products', 'skus'], true],
    [7, false, ['checkout'], false],
    [8, false, ['checkout'], false],
    [9, false, ['profile', 'businessTypes'], false],
    [10, false, ['profile', 'businessTypes', 'categories', 'products', 'skus', 'checkout'], true],
    [10, true, ['profile'], false],
  ] as const)('Step %i (submitted: %s) needs %j, units %s', (step, submitted, account, units) => {
    expect(stepResources(step, { submitted })).toEqual({ account, units })
  })

  it('gives a submitted store the same sets as anyone else on Steps 3-9', () => {
    for (const step of [3, 4, 5, 6, 7, 8, 9] as const) {
      expect(stepResources(step, { submitted: true })).toEqual(stepResources(step, { submitted: false }))
    }
  })
})

describe('per-resource appliers', () => {
  const NONE: ResumeApplyOptions = { edited: new Set(), submitted: false }

  /** Every applier in dependency order, by hand, over every resource of the state. */
  function composeByHand(state: ServerOnboardingState) {
    const options = { ...NONE, submitted: isStoreSubmitted(state) }
    const businessType = resolveBusinessType(state.profile, state.businessTypes)
    let draft = applyResumeFrame(createEmptyOnboardingDraft(), resumeStep(state), options)
    draft = applyProfile(draft, state.profile, options)
    draft = applyBusinessType(draft, businessType, options)
    draft = applyCategories(draft, state.categories, businessType, options)
    draft = applyProducts(draft, state.products, options)
    draft = applySkus(draft, state.skus, state.products, state.measurements, options)
    draft = applyCheckout(draft, state.checkout, options)
    return {
      draft,
      orderWhatsapp: resumeOrderWhatsapp(state.profile),
      paymentDetails: resumePaymentDetails(state.checkout, createEmptyRuntimeState().paymentDetails),
    }
  }

  it.each([
    ['a full account', fullState()],
    ['a submitted store', fullState({ context: SUBMITTED_CONTEXT })],
    ['a vendor on Step 4', fullState({
      context: context({ onboarding: { status: 'IN_PROGRESS', description: null, nextStep: 4 } }),
      products: [], skus: [], checkout: null,
    })],
    ['an empty account', fullState({
      profile: null, categories: [], products: [], skus: [], checkout: null, businessTypes: [],
    })],
    ['a failed business-type lookup', fullState({ businessTypes: [] })],
    ['an unset business type', fullState({ profile: { ...PROFILE, businessType: 'Others' } })],
  ])('compose to exactly buildResumeDraft for %s', (_, state) => {
    const resumed = buildResumeDraft(state)
    const composed = composeByHand(state)

    expect(composed.draft).toEqual(resumed.draft)
    expect(composed.orderWhatsapp).toBe(resumed.orderWhatsapp)
    expect(composed.paymentDetails).toEqual(
      resumePaymentDetails(state.checkout, createEmptyRuntimeState().paymentDetails),
    )
    expect(applyResumeState(state, createEmptyOnboardingDraft(), {
      ...NONE, submitted: isStoreSubmitted(state),
    })).toEqual(resumed)
  })

  /** A local draft distinct from anything the account would produce. */
  function localDraft() {
    const draft = createEmptyOnboardingDraft()
    return {
      ...draft,
      currentStep: 5 as OnboardingStep,
      completedSteps: [1, 2, 3, 4] as OnboardingStep[],
      catalogSource: 'sample' as const,
      business: { businessType: { ...BUSINESS_TYPE, id: 99, name: 'Local' }, businessName: 'Local', ownerName: 'L', contactPerson: 'L' },
      categories: [{ id: 77, name: 'Local', imageUrl: null, businessTypeId: 99, description: null, displayOrder: null }],
      products: [],
      skus: [],
      delivery: { ...draft.delivery, consentTitle: 'Local terms' },
      payments: draft.payments.map((option) => ({ ...option, enabled: true })),
      storefront: { ...draft.storefront, storeName: 'Local' },
    }
  }

  it.each([
    [3, (draft: ReturnType<typeof localDraft>, options: ResumeApplyOptions) => applyBusinessType(draft, BUSINESS_TYPE, options), 'business.businessType'],
    [4, (draft: ReturnType<typeof localDraft>, options: ResumeApplyOptions) => applyCategories(draft, CATEGORIES, BUSINESS_TYPE, options), 'categories'],
    [5, (draft: ReturnType<typeof localDraft>, options: ResumeApplyOptions) => applyProducts(draft, PRODUCTS, options), 'products'],
    [6, (draft: ReturnType<typeof localDraft>, options: ResumeApplyOptions) => applySkus(draft, SKUS, PRODUCTS, SAMPLE_MEASUREMENT_CATALOG, options), 'skus'],
    [7, (draft: ReturnType<typeof localDraft>, options: ResumeApplyOptions) => applyCheckout(draft, CHECKOUT, options), 'delivery'],
    [8, (draft: ReturnType<typeof localDraft>, options: ResumeApplyOptions) => applyCheckout(draft, CHECKOUT, options), 'payments'],
    [9, (draft: ReturnType<typeof localDraft>, options: ResumeApplyOptions) => applyProfile(draft, PROFILE, options), 'storefront'],
  ] as const)('leave Step %i untouched while it has unsaved edits, unless submitted', (step, apply, path) => {
    const pick = (draft: object) => path.split('.').reduce<unknown>((value, key) => (value as Record<string, unknown>)[key], draft)
    const local = localDraft()

    const kept = apply(local, { edited: new Set([step]), submitted: false })
    expect(pick(kept)).toEqual(pick(local))

    const applied = apply(local, { edited: new Set(), submitted: false })
    expect(pick(applied)).not.toEqual(pick(local))

    const submitted = apply(local, { edited: new Set([step]), submitted: true })
    expect(pick(submitted)).toEqual(pick(applied))
  })

  it('apply the other step of a shared checkout read when only one is edited', () => {
    const local = localDraft()

    const draft = applyCheckout(local, CHECKOUT, { edited: new Set([7]), submitted: false })

    expect(draft.delivery).toEqual(local.delivery)
    expect(draft.payments).toEqual(applyCheckout(local, CHECKOUT, NONE).payments)
  })

  it('keep the business names with Step 9 edits', () => {
    const local = localDraft()

    const draft = applyProfile(local, PROFILE, { edited: new Set([9]), submitted: false })

    expect(draft.business).toEqual(local.business)
  })

  it('frame the draft only when nothing is edited or the store is submitted', () => {
    const local = localDraft()

    expect(applyResumeFrame(local, 7, { edited: new Set([4]), submitted: false })).toBe(local)

    for (const options of [NONE, { edited: new Set<OnboardingStep>([4]), submitted: true }]) {
      const framed = applyResumeFrame(local, 7, options)
      expect(framed).toMatchObject({
        currentStep: 7,
        completedSteps: [1, 2, 3, 4, 5, 6],
        mobileVerified: true,
        catalogSource: createEmptyOnboardingDraft().catalogSource,
      })
      // Resource sections are the appliers' business, not the frame's.
      expect(framed.categories).toBe(local.categories)
    }
  })

  it('never synthesize a zero business type id when the lookup missed', () => {
    const draft = applyCategories(createEmptyOnboardingDraft(), CATEGORIES, null, NONE)

    expect(draft.categories.map((category) => category.businessTypeId)).toEqual([null])
  })
})

describe('snapshotLoadedSteps', () => {
  const ALL = new Set<OnboardingResource>(['profile', 'businessTypes', 'categories', 'products', 'skus', 'checkout'])
  const at = (nextStep: number) => context({ onboarding: { status: 'IN_PROGRESS', description: null, nextStep } })

  it('counts only the steps whose resources the snapshot read', () => {
    expect(snapshotLoadedSteps(fullState({ context: at(4) }), ALL)).toEqual([3, 4, 9])
    expect(snapshotLoadedSteps(fullState({ context: at(6) }), ALL)).toEqual([3, 4, 5, 6, 9])
    expect(snapshotLoadedSteps(fullState({ context: at(9) }), ALL)).toEqual([3, 4, 5, 6, 7, 8, 9])
    expect(snapshotLoadedSteps(fullState({ context: SUBMITTED_CONTEXT }), ALL)).toEqual([3, 4, 5, 6, 7, 8, 9])
  })

  it('reads everything when the pointer is missing', () => {
    expect(snapshotLoadedSteps(fullState(), ALL)).toEqual([3, 4, 5, 6, 7, 8, 9])
  })

  it('does not count a resource that did not resolve', () => {
    const withoutSkus = new Set([...ALL].filter((resource) => resource !== 'skus'))
    expect(snapshotLoadedSteps(fullState({ context: at(9) }), withoutSkus)).toEqual([3, 4, 5, 7, 8, 9])

    const withoutProfile = new Set([...ALL].filter((resource) => resource !== 'profile'))
    expect(snapshotLoadedSteps(fullState({ context: at(9) }), withoutProfile)).toEqual([7, 8])
  })

  it('needs business types only once a type is saved', () => {
    const withoutTypes = new Set([...ALL].filter((resource) => resource !== 'businessTypes'))
    expect(snapshotLoadedSteps(fullState({ context: at(4) }), withoutTypes)).toEqual([])
    expect(snapshotLoadedSteps(
      fullState({ context: at(4), profile: { ...PROFILE, businessType: 'Others' } }),
      withoutTypes,
    )).toEqual([3, 4, 9])
  })
})

describe('resumeFromAccount', () => {
  const ALL = new Set<OnboardingResource>(['profile', 'businessTypes', 'categories', 'products', 'skus', 'checkout'])
  const paymentDetails = createEmptyRuntimeState().paymentDetails

  function localDraft() {
    const draft = createEmptyOnboardingDraft()
    return {
      ...draft,
      currentStep: 5 as OnboardingStep,
      completedSteps: [1, 2, 3, 4] as OnboardingStep[],
      mobileVerified: true,
      products: [{ id: 77, name: 'Local', description: null, imageUrl: null, measurementId: null, measurementName: null, categoryId: 10 }],
    }
  }

  it('rebuilds the whole draft as before when nothing is edited', () => {
    const state = fullState()
    const resumed = resumeFromAccount(state, localDraft(), { edited: new Set(), paymentDetails, resolved: ALL })
    const expected = buildResumeDraft(state)

    expect(resumed.frameApplied).toBe(true)
    expect(resumed.draft).toEqual(expected.draft)
    expect(resumed.furthestVisitedStep).toBe(expected.furthestVisitedStep)
    expect(resumed.orderWhatsapp).toBe(expected.orderWhatsapp)
    expect(resumed.paymentDetails).toEqual(resumePaymentDetails(state.checkout, paymentDetails))
    expect(resumed.appliedSteps).toEqual([3, 4, 5, 6, 7, 8, 9])
  })

  it('lets the account win every step once the store is submitted', () => {
    const state = fullState({ context: SUBMITTED_CONTEXT })
    const resumed = resumeFromAccount(state, localDraft(), { edited: new Set([5]), paymentDetails, resolved: ALL })

    expect(resumed.frameApplied).toBe(true)
    expect(resumed.draft).toEqual(buildResumeDraft(state).draft)
  })

  it('applies only unedited steps that were read, and leaves the frame alone', () => {
    const state = fullState({ context: context({ onboarding: { status: 'IN_PROGRESS', description: null, nextStep: 6 } }) })
    const local = localDraft()
    const resumed = resumeFromAccount(state, local, { edited: new Set([5]), paymentDetails, resolved: ALL })
    const full = buildResumeDraft(state).draft

    expect(resumed.frameApplied).toBe(false)
    expect(resumed.furthestVisitedStep).toBeNull()
    expect(resumed.appliedSteps).toEqual([3, 4, 6, 9])
    expect(resumed.loadedSteps).toEqual([3, 4, 5, 6, 9])
    expect(resumed.draft.currentStep).toBe(5)
    expect(resumed.draft.completedSteps).toEqual([1, 2, 3, 4])
    expect(resumed.draft.catalogSource).toBe(local.catalogSource)
    expect(resumed.draft.categories).toEqual(full.categories)
    expect(resumed.draft.business).toEqual(full.business)
    expect(resumed.draft.products).toBe(local.products)
    expect(resumed.draft.skus).toEqual(full.skus)
    // Checkout was not read for Step 6, so Steps 7 and 8 keep what the browser holds.
    expect(resumed.draft.delivery).toBe(local.delivery)
    expect(resumed.draft.payments).toBe(local.payments)
    expect(resumed.paymentDetails).toBe(paymentDetails)
    expect(resumed.orderWhatsapp).toBe(buildResumeDraft(state).orderWhatsapp)
  })

  it('neither applies nor counts a step whose read failed', () => {
    const state = fullState({ context: context({ onboarding: { status: 'IN_PROGRESS', description: null, nextStep: 9 } }), skus: [] })
    const local = { ...localDraft(), skus: [] }
    const resolved = new Set([...ALL].filter((resource) => resource !== 'skus'))
    const resumed = resumeFromAccount(state, local, { edited: new Set([5]), paymentDetails, resolved })

    expect(resumed.appliedSteps).toEqual([3, 4, 7, 8, 9])
    expect(resumed.loadedSteps).not.toContain(6)
    expect(resumed.draft.skus).toBe(local.skus)
  })

  it('keeps the runtime values of edited steps', () => {
    const state = fullState({ context: context({ onboarding: { status: 'IN_PROGRESS', description: null, nextStep: 9 } }) })
    const resumed = resumeFromAccount(state, localDraft(), { edited: new Set([8, 9]), paymentDetails, resolved: ALL })

    expect(resumed.orderWhatsapp).toBeNull()
    expect(resumed.paymentDetails).toBe(paymentDetails)
  })
})
