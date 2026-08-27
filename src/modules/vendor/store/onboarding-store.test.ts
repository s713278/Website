import { beforeEach, describe, expect, it } from 'vitest'
import { createEmptyOnboardingDraft } from '../data/onboarding-defaults'
import type { OnboardingStep } from '../types/onboarding'
import { useOnboardingStore } from './onboarding-store'

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
