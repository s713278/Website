import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createEmptyOnboardingDraft } from '../data/onboarding-defaults'
import { ONBOARDING_CONFIG, type CatalogSource, type OnboardingStep } from '../types/onboarding'
import { PENDING_ID_BASE } from '../lib/onboarding-pending-id'
import {
  continueWithCatalogPolicy,
  selectCategoryLimit,
  selectCatalogPolicy,
  selectCategoryLimitReached,
  selectProductLimit,
  selectProductLimitReached,
  selectProjectedCategoryTotal,
  selectProjectedProductTotal,
  selectProjectedSkuTotal,
  selectSkuLimit,
  selectSkuLimitReached,
  selectStoreIsSubmitted,
  useOnboardingStore,
} from './onboarding-store'

/**
 * `updateDraft`'s second argument is destructive by design: it exists to throw away
 * progress that a change has invalidated. The hazard is passing it for a write that is
 * not a vendor edit at all.
 *
 * `SkuStep` used to scaffold empty SKU rows with `updateDraft(…, 6)`. A vendor resuming
 * at Step 9 with one leftover unpriced product — the exact case `furthestSavedStep` was
 * written to protect — lost Steps 7-10 just by opening Step 6 to look at it. There is no
 * DOM runner here to assert against the component, so these lock the store behaviour the
 * fix depends on.
 */
function seedAt(step: OnboardingStep) {
  useOnboardingStore.setState({
    draft: {
      ...createEmptyOnboardingDraft(),
      currentStep: step,
      completedSteps: [1, 2, 3, 4, 5, 6, 7, 8] as OnboardingStep[],
    },
    furthestVisitedStep: step,
    persistenceInitialized: true,
    persistenceStatus: 'idle',
  })
}

describe('abandonDraft on explicit sign-out', () => {
  // The cleanup the module-scope sign-out subscription runs, and the whole of what
  // "Start over" does once it routes through logout(). After it runs, nothing about the
  // signed-in vendor — not the draft, not the account catalog it had read — survives to
  // read as fresh capacity when they sign back in.
  it('returns to the anonymous first step and retains no account snapshot', () => {
    useOnboardingStore.setState({
      draft: {
        ...createEmptyOnboardingDraft(),
        mobileVerified: true,
        maskedPhone: '•••• 43210',
        currentStep: 5,
        completedSteps: [1, 2, 3, 4] as OnboardingStep[],
      },
      furthestVisitedStep: 5,
      persistenceInitialized: true,
      persistenceStatus: 'idle',
      draftOwnerId: 'vendor-17',
    })
    useOnboardingStore.getState().setAccountCatalog({ categoryIds: [11, 12], productIds: [31], skuIds: [4021] })
    useOnboardingStore.getState().setStoreSubmission({
      storeIdentifier: 'sk-organic-store',
      vendorStatus: 'ACTIVE',
      approvalStatus: 'PENDING',
    })

    useOnboardingStore.getState().abandonDraft()

    const state = useOnboardingStore.getState()
    expect(state.draft.currentStep).toBe(1)
    expect(state.draft.mobileVerified).toBe(false)
    expect(state.furthestVisitedStep).toBe(1)
    expect(state.draftOwnerId).toBe(null)
    // A retained snapshot is the over-limit bug: read as the whole account, an empty one
    // grants fresh capacity; a stale non-empty one lies about what is assigned.
    expect(state.accountCatalog).toEqual({ categoryIds: [], productIds: [], skuIds: [] })
    expect(state.storeSubmission).toBe(null)
  })
})

describe('updateDraft and earlier progress', () => {
  beforeEach(() => {
    seedAt(9)
  })

  it('preserves the frontier when no invalidateFrom is given', () => {
    useOnboardingStore.getState().updateDraft((draft) => ({
      ...draft,
      skus: [...draft.skus],
    }))

    const state = useOnboardingStore.getState()
    expect(state.furthestVisitedStep).toBe(9)
    expect(state.draft.completedSteps).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(state.draft.currentStep).toBe(9)
  })

  it('collapses the frontier when invalidateFrom is given', () => {
    // The destructive behaviour is intended — this documents what passing the argument
    // costs, which is why a scaffolding write must not pass it.
    useOnboardingStore.getState().updateDraft((draft) => ({ ...draft }), 6)

    const state = useOnboardingStore.getState()
    expect(state.furthestVisitedStep).toBe(6)
    expect(state.draft.completedSteps).toEqual([1, 2, 3, 4, 5])
    expect(state.draft.currentStep).toBe(6)
  })
})

describe('updateDraft on a submitted store never collapses its completion', () => {
  // A store past onboarding (submitted for review) may still add categories and products,
  // but the later steps are already saved to the account, so an additive write must not
  // tear that completion down. Invalidation exists to make a still-in-setup vendor revisit
  // downstream steps; a submitted store has none to revisit. Without this, one add on
  // Step 4 or 5 re-locks the whole stepper. There is no DOM runner here, so these lock the
  // store behaviour the fix depends on.
  function seedSubmittedAt(step: OnboardingStep) {
    useOnboardingStore.setState({
      draft: {
        ...createEmptyOnboardingDraft(),
        currentStep: step,
        completedSteps: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as OnboardingStep[],
        publication: { state: 'prototype-complete', draftSlug: 'my-store', completedAt: '2026-08-30T00:00:00.000Z' },
      },
      furthestVisitedStep: 10,
      persistenceInitialized: true,
      persistenceStatus: 'idle',
    })
    useOnboardingStore.getState().setStoreSubmission({
      storeIdentifier: 'sk-store',
      vendorStatus: 'ACTIVE',
      approvalStatus: 'PENDING',
    })
  }

  afterEach(() => {
    useOnboardingStore.getState().setStoreSubmission(null)
  })

  it('keeps the frontier and completion intact when a category is added (invalidateFrom 4)', () => {
    seedSubmittedAt(4)
    useOnboardingStore.getState().addPendingCategory({ name: 'Snacks', businessTypeId: 1 })

    const state = useOnboardingStore.getState()
    expect(state.draft.completedSteps).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(state.furthestVisitedStep).toBe(10)
    expect(state.draft.currentStep).toBe(4)
    expect(state.draft.publication.state).toBe('prototype-complete')
    expect(state.draft.categories).toHaveLength(1)
  })

  it('keeps the frontier intact when a product is added (invalidateFrom 5)', () => {
    seedSubmittedAt(5)
    useOnboardingStore.getState().addPendingProduct({ name: 'Chips', categoryId: 1, measurementId: 1 })

    const state = useOnboardingStore.getState()
    expect(state.draft.completedSteps).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(state.furthestVisitedStep).toBe(10)
    expect(state.draft.products).toHaveLength(1)
  })

  it('still collapses the frontier for a store that is not submitted', () => {
    seedSubmittedAt(4)
    useOnboardingStore.getState().setStoreSubmission(null)
    useOnboardingStore.getState().addPendingCategory({ name: 'Snacks', businessTypeId: 1 })

    const state = useOnboardingStore.getState()
    // Not submitted: adding a category is a genuine setup edit, so downstream steps collapse.
    expect(state.draft.completedSteps).toEqual([1, 2, 3])
    expect(state.furthestVisitedStep).toBe(4)
  })
})

describe('completeStep and account sync', () => {
  // Demo and sample mode deliberately skip the backend write. Reporting those steps as
  // synced let the next account read overwrite work the vendor could still see.
  beforeEach(() => {
    seedAt(5)
    useOnboardingStore.setState({ hasLocalEdits: true })
  })

  it('keeps hasLocalEdits when the step was not written to the account', () => {
    useOnboardingStore.getState().completeStep(5, 6, { syncedWithAccount: false })

    expect(useOnboardingStore.getState().hasLocalEdits).toBe(true)
    expect(useOnboardingStore.getState().furthestVisitedStep).toBe(6)
  })

  it('clears hasLocalEdits once the step reached the account', () => {
    useOnboardingStore.getState().completeStep(5, 6, { syncedWithAccount: true })

    expect(useOnboardingStore.getState().hasLocalEdits).toBe(false)
  })

  it('defaults to synced, so identity steps still let the account hydrate', () => {
    useOnboardingStore.getState().completeStep(5, 6)

    expect(useOnboardingStore.getState().hasLocalEdits).toBe(false)
  })
})

/**
 * The whole catalog rule — which controls appear, which switches are allowed, and when
 * Continue is refused — is answered by one selector so it can be checked without rendering
 * the wizard. The transport is an explicit argument, not read from the environment, so a
 * live API and demo mode are both reachable here. These lock the two behaviours that used
 * to live untested in the component: sample is unreachable under a live API, and a stale
 * sample draft cannot Continue there.
 */
describe('selectCatalogPolicy', () => {
  function catalogState(catalogSource: CatalogSource, completedSteps: OnboardingStep[]) {
    return { draft: { ...createEmptyOnboardingDraft(), catalogSource, completedSteps } }
  }

  describe('canSwitchTo, in demo mode', () => {
    it('allows account→sample only before the business type step is complete', () => {
      expect(
        selectCatalogPolicy(catalogState('account', [1, 2]), { liveApi: false }).canSwitchTo('sample'),
      ).toBe(true)
      expect(
        selectCatalogPolicy(catalogState('account', [1, 2, 3]), { liveApi: false }).canSwitchTo('sample'),
      ).toBe(false)
    })

    it('allows sample→account before or after the business type step is complete', () => {
      expect(
        selectCatalogPolicy(catalogState('sample', [1, 2]), { liveApi: false }).canSwitchTo('account'),
      ).toBe(true)
      expect(
        selectCatalogPolicy(catalogState('sample', [1, 2, 3]), { liveApi: false }).canSwitchTo('account'),
      ).toBe(true)
    })

    it('refuses switching to the source already in effect', () => {
      expect(
        selectCatalogPolicy(catalogState('account', [1, 2]), { liveApi: false }).canSwitchTo('account'),
      ).toBe(false)
      expect(
        selectCatalogPolicy(catalogState('sample', [1, 2]), { liveApi: false }).canSwitchTo('sample'),
      ).toBe(false)
    })
  })

  describe('under a live API', () => {
    it('refuses every catalog-source switch, including to sample before the business type step', () => {
      // The demo-mode rule would allow account→sample here; the transport overrides it,
      // which is the whole reason the transport is an argument.
      expect(
        selectCatalogPolicy(catalogState('account', [1, 2]), { liveApi: true }).canSwitchTo('sample'),
      ).toBe(false)
      expect(
        selectCatalogPolicy(catalogState('sample', [1, 2]), { liveApi: true }).canSwitchTo('account'),
      ).toBe(false)
    })

    it('blocks Continue for a stale sample draft, and only then', () => {
      expect(
        selectCatalogPolicy(catalogState('sample', [1, 2]), { liveApi: true }).continueBlocked,
      ).toBe(true)
      expect(
        selectCatalogPolicy(catalogState('account', [1, 2]), { liveApi: true }).continueBlocked,
      ).toBe(false)
      expect(
        selectCatalogPolicy(catalogState('sample', [1, 2]), { liveApi: false }).continueBlocked,
      ).toBe(false)
    })

    it('routes blocked and allowed continuation through the pure Continue boundary', () => {
      const blockedPolicy = selectCatalogPolicy(catalogState('sample', [1, 2]), { liveApi: true })
      const allowedPolicy = selectCatalogPolicy(catalogState('account', [1, 2]), { liveApi: true })
      const events: string[] = []
      const branches = {
        blocked: () => events.push('blocked'),
        allowed: () => events.push('allowed'),
      }

      expect(continueWithCatalogPolicy(blockedPolicy, branches)).toBe(1)
      expect(events).toEqual(['blocked'])

      expect(continueWithCatalogPolicy(allowedPolicy, branches)).toBe(2)
      expect(events).toEqual(['blocked', 'allowed'])
    })
  })

  describe('control visibility', () => {
    it('shows the sample catalog control only in demo mode', () => {
      expect(
        selectCatalogPolicy(catalogState('account', [1, 2]), { liveApi: false }).sampleControlVisible,
      ).toBe(true)
      expect(
        selectCatalogPolicy(catalogState('account', [1, 2]), { liveApi: true }).sampleControlVisible,
      ).toBe(false)
    })

    it('shows the create control only while the account catalog is in effect', () => {
      // Authoring writes into the account catalog; there is nothing to author into the
      // synthetic sample data, so the control follows the source, not the transport.
      expect(
        selectCatalogPolicy(catalogState('account', [1, 2]), { liveApi: true }).createControlVisible,
      ).toBe(true)
      expect(
        selectCatalogPolicy(catalogState('account', [1, 2]), { liveApi: false }).createControlVisible,
      ).toBe(true)
      expect(
        selectCatalogPolicy(catalogState('sample', [1, 2]), { liveApi: false }).createControlVisible,
      ).toBe(false)
    })
  })
})

describe('selectCategoryLimit', () => {
  it('answers the live plan limit held by the onboarding store', () => {
    useOnboardingStore.getState().setCategoryLimit(7)

    expect(selectCategoryLimit(useOnboardingStore.getState())).toBe(7)
  })
})

/**
 * Assignment is one-way, so these predicates are the whole of what stops a vendor
 * unpicking something their account already holds. Seeded through `setAccountCatalog`
 * rather than `setState`, because that is the write path the wizard uses and the one
 * that keeps the predicates and the catalog in step.
 */
describe('assignment', () => {
  beforeEach(() => {
    useOnboardingStore.getState().setAccountCatalog({ categoryIds: [], productIds: [] })
  })

  it('reports a platform category the account already holds as assigned', () => {
    useOnboardingStore.getState().setAccountCatalog({ categoryIds: [12], productIds: [] })

    expect(useOnboardingStore.getState().isCategoryAssigned(12)).toBe(true)
    expect(useOnboardingStore.getState().isCategoryAssigned(13)).toBe(false)
  })

  it('reports a platform product the account already holds as assigned', () => {
    useOnboardingStore.getState().setAccountCatalog({ categoryIds: [12], productIds: [44] })

    expect(useOnboardingStore.getState().isProductAssigned(44)).toBe(true)
    expect(useOnboardingStore.getState().isProductAssigned(45)).toBe(false)
  })

  it('refuses nothing while the account catalog is empty, as in demo mode', () => {
    expect(useOnboardingStore.getState().isCategoryAssigned(12)).toBe(false)
    expect(useOnboardingStore.getState().isProductAssigned(44)).toBe(false)
  })

  it('records an assignment on top of what the account already held', () => {
    useOnboardingStore.getState().setAccountCatalog({ categoryIds: [12], productIds: [44] })

    useOnboardingStore.getState().recordAssignment({ categoryIds: [13], productIds: [45] })

    const state = useOnboardingStore.getState()
    expect(state.isCategoryAssigned(12)).toBe(true)
    expect(state.isCategoryAssigned(13)).toBe(true)
    expect(state.isProductAssigned(44)).toBe(true)
    expect(state.isProductAssigned(45)).toBe(true)
  })
})

/**
 * The account catalog used to be read once on entry, so a vendor could assign a
 * category, continue, come back and deselect it — and only discover on their next visit
 * that nothing had been removed. The successful write now grows the catalog, and the
 * refusal follows in the same visit.
 *
 * `recordAssignment` is what the write path calls as each request lands. No request is
 * involved here, which is the point — Continue gains no re-read.
 */
describe('an assignment recorded mid-visit', () => {
  beforeEach(() => {
    // A fresh account: the entry read found nothing assigned.
    useOnboardingStore.getState().setAccountCatalog({ categoryIds: [], productIds: [] })
  })

  it('refuses a category from the moment its write succeeds', () => {
    expect(useOnboardingStore.getState().isCategoryAssigned(12)).toBe(false)

    useOnboardingStore.getState().recordAssignment({ categoryIds: [12] })

    expect(useOnboardingStore.getState().isCategoryAssigned(12)).toBe(true)
  })

  it('refuses a product from the moment its write succeeds', () => {
    expect(useOnboardingStore.getState().isProductAssigned(44)).toBe(false)

    useOnboardingStore.getState().recordAssignment({ productIds: [44] })

    expect(useOnboardingStore.getState().isProductAssigned(44)).toBe(true)
    // A product write says nothing about categories.
    expect(useOnboardingStore.getState().isCategoryAssigned(12)).toBe(false)
  })

  it('keeps the batches that landed before a later one failed', () => {
    // Products are assigned a category at a time, so a step can report more than once
    // and then throw. What already reached the account still cannot be deselected.
    useOnboardingStore.getState().recordAssignment({ productIds: [44] })
    useOnboardingStore.getState().recordAssignment({ productIds: [45] })

    expect(useOnboardingStore.getState().isProductAssigned(44)).toBe(true)
    expect(useOnboardingStore.getState().isProductAssigned(45)).toBe(true)
  })
})

/**
 * Cumulative catalog limits: the projected account total, not the draft count, is what a
 * limit is checked against. These lock the store boundary the interactive controls and the
 * readiness validation both read, so a draft-clearing path (a business-type change) can
 * never reopen a fresh full allowance on top of a full account.
 */
describe('cumulative catalog limits', () => {
  beforeEach(() => {
    useOnboardingStore.setState({
      draft: createEmptyOnboardingDraft(),
      accountCatalog: { categoryIds: [], productIds: [], skuIds: [] },
      isCategoryAssigned: () => false,
      isProductAssigned: () => false,
    })
    useOnboardingStore.getState().setCategoryLimit(3)
    useOnboardingStore.getState().setProductLimit(4)
    useOnboardingStore.getState().setSkuLimit(5)
  })

  it('falls back to the configured defaults for a missing or zero live limit', () => {
    useOnboardingStore.getState().setProductLimit(null)
    useOnboardingStore.getState().setSkuLimit(0)

    expect(selectProductLimit(useOnboardingStore.getState())).toBe(ONBOARDING_CONFIG.maxProducts)
    expect(selectSkuLimit(useOnboardingStore.getState())).toBe(ONBOARDING_CONFIG.maxSkus)
  })

  it('records account SKU identity authoritatively, since sizes can be deleted', () => {
    useOnboardingStore.getState().setAccountCatalog({ categoryIds: [], productIds: [], skuIds: [4021, 4022] })

    // Unlike category/product assignment, a size write is the whole current set — a delete
    // has to shrink it, so the reported ids replace rather than merge.
    useOnboardingStore.getState().recordAssignment({ skuIds: [4022, 4030] })

    expect(useOnboardingStore.getState().accountCatalog.skuIds).toEqual([4022, 4030])
  })

  it('leaves SKU identity untouched when a category/product write reports no skuIds', () => {
    useOnboardingStore.getState().setAccountCatalog({ categoryIds: [], productIds: [], skuIds: [4021] })

    useOnboardingStore.getState().recordAssignment({ categoryIds: [12] })

    expect(useOnboardingStore.getState().accountCatalog.skuIds).toEqual([4021])
  })

  it('projects account usage plus new draft entries, reaching the limit early after a switch', () => {
    // Business type A left two categories, three products and four sizes on the account.
    useOnboardingStore.getState().setAccountCatalog({
      categoryIds: [11, 12],
      productIds: [31, 32, 33],
      skuIds: [4001, 4002, 4003, 4004],
    })
    // The draft is empty, as it is right after switching to business type B.
    expect(selectProjectedCategoryTotal(useOnboardingStore.getState())).toBe(2)
    expect(selectProjectedProductTotal(useOnboardingStore.getState())).toBe(3)
    expect(selectProjectedSkuTotal(useOnboardingStore.getState())).toBe(4)

    // Every limit is already at or past its cap purely from the account.
    useOnboardingStore.getState().setCategoryLimit(2)
    useOnboardingStore.getState().setProductLimit(3)
    useOnboardingStore.getState().setSkuLimit(4)
    expect(selectCategoryLimitReached(useOnboardingStore.getState())).toBe(true)
    expect(selectProductLimitReached(useOnboardingStore.getState())).toBe(true)
    expect(selectSkuLimitReached(useOnboardingStore.getState())).toBe(true)
  })

  it('counts a first-time account with zero usage against its full allowance', () => {
    useOnboardingStore.setState({
      draft: {
        ...createEmptyOnboardingDraft(),
        categories: [
          { id: 21, name: 'A', businessTypeId: 7, description: null, imageUrl: null, displayOrder: null },
          { id: 22, name: 'B', businessTypeId: 7, description: null, imageUrl: null, displayOrder: null },
        ],
      },
    })

    expect(selectProjectedCategoryTotal(useOnboardingStore.getState())).toBe(2)
    // Limit 3, usage 0, two in the draft: room for one more.
    expect(selectCategoryLimitReached(useOnboardingStore.getState())).toBe(false)
  })
})

/**
 * Changing the business type on Step 3 is a draft-clearing path. It must clear only the
 * unsaved selections: assignment is one-way, so categories, products, and account sizes
 * already saved cannot be dropped from view without blanking the live preview and — at a
 * plan limit — stranding the vendor on an empty Step 4 they cannot pass.
 */
describe('changeBusinessType', () => {
  const typeA = { id: 1, name: 'Bakery', icon: null, displayOrder: null }
  const typeB = { id: 2, name: 'Grocery', icon: null, displayOrder: null }

  function seedAssignedCatalog() {
    useOnboardingStore.setState({
      draft: {
        ...createEmptyOnboardingDraft(),
        business: { businessType: typeA, businessName: '', ownerName: '', contactPerson: '' },
        currentStep: 3,
        completedSteps: [1, 2, 3, 4, 5] as OnboardingStep[],
        categories: [
          { id: 11, name: 'Bread', businessTypeId: 1, description: null, imageUrl: null, displayOrder: null },
          { id: 12, name: 'Draft only', businessTypeId: 1, description: null, imageUrl: null, displayOrder: null },
        ],
        products: [
          { id: 31, name: 'Loaf', description: null, imageUrl: null, measurementId: null, measurementName: null, categoryId: 11 },
          { id: 32, name: 'Unsaved', description: null, imageUrl: null, measurementId: null, measurementName: null, categoryId: 12 },
        ],
        skus: [
          { id: 'sku-4001', productId: 31, name: 'Regular', description: '', skuType: 'ITEM', measurementType: 'COUNT', unit: 'pcs', quantity: 1, listPrice: 60, salePrice: 55, active: true, homeDelivery: true, storePickup: true },
          { id: 'draft-sku-31-2', productId: 31, name: 'Family', description: '', skuType: 'ITEM', measurementType: 'COUNT', unit: 'pcs', quantity: 2, listPrice: 100, salePrice: 90, active: true, homeDelivery: true, storePickup: true },
        ],
      },
      furthestVisitedStep: 5,
      persistenceInitialized: true,
      persistenceStatus: 'idle',
    })
    // The account holds only category 11, product 31, and size 4001.
    useOnboardingStore.getState().setAccountCatalog({ categoryIds: [11], productIds: [31], skuIds: [4001] })
  }

  it('keeps the saved catalog and clears only the unsaved selections', () => {
    seedAssignedCatalog()

    useOnboardingStore.getState().changeBusinessType(typeB)

    const { draft } = useOnboardingStore.getState()
    expect(draft.business.businessType).toEqual(typeB)
    // The saved category, product, and size survive; the browser-only ones are gone.
    expect(draft.categories.map((c) => c.id)).toEqual([11])
    expect(draft.products.map((p) => p.id)).toEqual([31])
    expect(draft.skus.map((s) => s.id)).toEqual(['sku-4001'])
  })

  it('leaves a maxed-out vendor able to pass Step 4 rather than stranded', () => {
    seedAssignedCatalog()
    useOnboardingStore.getState().setCategoryLimit(1)

    useOnboardingStore.getState().changeBusinessType(typeB)

    const state = useOnboardingStore.getState()
    // The saved category still satisfies "choose at least one", so the vendor is not stuck
    // on an empty step they cannot leave — even though no further category can be added.
    expect(state.draft.categories.length).toBe(1)
    expect(selectCategoryLimitReached(state)).toBe(true)
  })

  it('is a no-op for the same business type, so it cannot silently drop progress', () => {
    seedAssignedCatalog()

    useOnboardingStore.getState().changeBusinessType(typeA)

    const { draft } = useOnboardingStore.getState()
    // Unchanged: the guard prevents an invalidate-from-3 that would reset completed steps.
    expect(draft.completedSteps).toEqual([1, 2, 3, 4, 5])
    expect(draft.products.map((p) => p.id)).toEqual([31, 32])
  })
})

/**
 * A submitted store cannot be changed or started over, so setup has to know it is
 * submitted before it decides what to offer. The answer comes from `storeSubmission`,
 * which the entry read fills from the account — never from the local draft, which a
 * vendor's own browser can claim anything about.
 */
describe('whether the store is submitted', () => {
  beforeEach(() => {
    useOnboardingStore.getState().setStoreSubmission(null)
  })

  it('is false while the account reports no submission', () => {
    expect(selectStoreIsSubmitted(useOnboardingStore.getState())).toBe(false)
  })

  it('is true once the account reports one', () => {
    useOnboardingStore.getState().setStoreSubmission({
      storeIdentifier: 'sk-organic-store',
      vendorStatus: 'ACTIVE',
      approvalStatus: 'PENDING',
    })

    expect(selectStoreIsSubmitted(useOnboardingStore.getState())).toBe(true)
  })

  it('stays true when submission succeeded but its status read-back failed', () => {
    // The successful account action is evidence of submission even when the follow-up
    // read cannot yet refine the store identifier and approval details.
    useOnboardingStore.getState().setStoreSubmission({
      storeIdentifier: null,
      vendorStatus: null,
      approvalStatus: null,
    })

    expect(selectStoreIsSubmitted(useOnboardingStore.getState())).toBe(true)
  })

  it('ignores a local draft that claims completion', () => {
    // `publication.state` lives in the browser draft. Demo mode and a prototype walk
    // both set it, and neither means anything reached an account.
    useOnboardingStore.setState({
      draft: {
        ...createEmptyOnboardingDraft(),
        publication: { state: 'prototype-complete', draftSlug: 'my-store', completedAt: '2026-08-27' },
      },
    })

    expect(selectStoreIsSubmitted(useOnboardingStore.getState())).toBe(false)
  })
})

describe('authored pending entries', () => {
  beforeEach(() => {
    useOnboardingStore.setState({
      draft: { ...createEmptyOnboardingDraft(), currentStep: 4, completedSteps: [1, 2, 3] as OnboardingStep[] },
      furthestVisitedStep: 4,
      persistenceInitialized: true,
      persistenceStatus: 'idle',
      hasLocalEdits: false,
    })
  })

  it('mints a category into the reserved band and marks it pending', () => {
    const id = useOnboardingStore.getState().addPendingCategory({ name: 'Bakery', businessTypeId: 7 })

    expect(id).toBe(PENDING_ID_BASE)
    const [category] = useOnboardingStore.getState().draft.categories
    expect(category).toMatchObject({ id: PENDING_ID_BASE, name: 'Bakery', businessTypeId: 7, pending: true })
    // Authoring is a local edit that has not reached the account.
    expect(useOnboardingStore.getState().hasLocalEdits).toBe(true)
  })

  it('mints a product one below the lowest pending id and links its category', () => {
    const store = useOnboardingStore.getState()
    const categoryId = store.addPendingCategory({ name: 'Bakery', businessTypeId: 7 })
    const productId = store.addPendingProduct({ name: 'Sourdough', categoryId, measurementId: 3 })

    expect(productId).toBe(PENDING_ID_BASE - 1)
    const [product] = useOnboardingStore.getState().draft.products
    expect(product).toMatchObject({ id: PENDING_ID_BASE - 1, categoryId, measurementId: 3, pending: true })
  })

  it('removes a still-pending category and everything under it, leaving nothing behind', () => {
    const store = useOnboardingStore.getState()
    const categoryId = store.addPendingCategory({ name: 'Bakery', businessTypeId: 7 })
    const productId = store.addPendingProduct({ name: 'Sourdough', categoryId, measurementId: 3 })
    useOnboardingStore.getState().updateDraft((draft) => ({
      ...draft,
      skus: [{ id: 'draft-sku-1', productId, name: 'A', description: '', skuType: 'ITEM', measurementType: 'VOLUME', unit: 'L', quantity: 1, listPrice: 1, salePrice: 1, active: true, homeDelivery: true, storePickup: true }],
    }))

    useOnboardingStore.getState().removePendingEntry(categoryId)

    const draft = useOnboardingStore.getState().draft
    expect(draft.categories).toEqual([])
    expect(draft.products).toEqual([])
    expect(draft.skus).toEqual([])
  })

  it('removes a still-pending product and its SKUs but keeps its category', () => {
    const store = useOnboardingStore.getState()
    const categoryId = store.addPendingCategory({ name: 'Bakery', businessTypeId: 7 })
    const productId = store.addPendingProduct({ name: 'Sourdough', categoryId, measurementId: 3 })

    useOnboardingStore.getState().removePendingEntry(productId)

    const draft = useOnboardingStore.getState().draft
    expect(draft.categories.map((c) => c.id)).toEqual([categoryId])
    expect(draft.products).toEqual([])
  })

  it('ignores a non-pending id', () => {
    useOnboardingStore.setState({
      draft: {
        ...createEmptyOnboardingDraft(),
        categories: [{ id: 42, name: 'Account', businessTypeId: 7, description: null, imageUrl: null, displayOrder: null }],
      },
    })

    useOnboardingStore.getState().removePendingEntry(42)

    expect(useOnboardingStore.getState().draft.categories.map((c) => c.id)).toEqual([42])
  })

  it('records a created id into the draft, replacing the pending id and dropping pending', () => {
    const store = useOnboardingStore.getState()
    const categoryId = store.addPendingCategory({ name: 'Bakery', businessTypeId: 7 })
    store.addPendingProduct({ name: 'Sourdough', categoryId, measurementId: 3 })

    useOnboardingStore.getState().recordCreatedEntry({ kind: 'category', pendingId: categoryId, platformId: 5001 })

    const draft = useOnboardingStore.getState().draft
    expect(draft.categories[0]).toMatchObject({ id: 5001 })
    expect(draft.categories[0].pending).toBeUndefined()
    // The product that pointed at the pending category follows it to the platform id.
    expect(draft.products[0].categoryId).toBe(5001)
  })
})
