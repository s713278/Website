import { beforeEach, describe, expect, it } from 'vitest'
import { createEmptyOnboardingDraft } from '../data/onboarding-defaults'
import type { CatalogSource, OnboardingStep } from '../types/onboarding'
import { PENDING_ID_BASE } from '../lib/onboarding-pending-id'
import {
  selectCatalogPolicy,
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
