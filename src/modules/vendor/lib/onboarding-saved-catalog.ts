import { createEmptyRuntimeState } from '../data/onboarding-defaults'
import type { OnboardingStep, VendorOnboardingDraftV1 } from '../types/onboarding'
import { stepFields, withSavedValues, type FieldEdits } from './onboarding-draft-merge'
import { stepSnapshot, type SavedBaselines } from './onboarding-progress'

/**
 * Saved and unsaved catalog, kept apart.
 *
 * Saved is what the account holds (in demo, what the simulated save stored); unsaved is only
 * in the draft. Each catalog step builds from the step before it as saved: Step 5 offers
 * products only under saved categories, and Step 6 sizes only for saved products. A pick
 * under an unsaved parent stays in the draft, hidden and unsent, until that parent is saved.
 * Step 10 counts and judges the saved catalog alone; unsaved input there is one pending line
 * per step (see `pendingSteps`).
 */
export type CatalogLists = Pick<VendorOnboardingDraftV1, 'categories' | 'products' | 'skus'>

export type SavedCatalogState = {
  draft: VendorOnboardingDraftV1
  editedSteps: readonly OnboardingStep[]
  fieldEdits: FieldEdits
  savedBaselines: SavedBaselines
  /** Assigned on the account: a write that failed part way still counts what it assigned. */
  accountCatalog: { categoryIds: readonly number[]; productIds: readonly number[] }
}

type CatalogStep = 4 | 5 | 6
const STEP_LIST = { 4: 'categories', 5: 'products', 6: 'skus' } as const

/**
 * A step's saved list, judged as `pendingSteps` judges it: the known baseline; else the draft's
 * own copy while the step holds no edits; else each edited field's recorded saved value, and
 * nothing when the edit recorded none (an old-format draft).
 */
function savedList<S extends CatalogStep>(step: S, state: SavedCatalogState): CatalogLists[(typeof STEP_LIST)[S]] {
  const key = STEP_LIST[step]
  const baseline = state.savedBaselines[step] as Partial<CatalogLists> | undefined
  if (baseline) return baseline[key] as CatalogLists[typeof key]
  if (!state.editedSteps.includes(step)) return state.draft[key]
  const saved = withSavedValues(state.draft, state.fieldEdits, stepFields(step))
  return saved ? saved[key] : []
}

/** `list`, unless filtering dropped something: unchanged lists keep their identity. */
function kept<T>(list: T[], filtered: T[]): T[] {
  return filtered.length === list.length ? list : filtered
}

/** Draft entries the account holds that a stale saved list does not name yet. */
function withAssigned<T extends { id: number }>(saved: T[], draft: T[], assigned: readonly number[]): T[] {
  if (!assigned.length) return saved
  const named = new Set(saved.map((item) => item.id))
  const extra = draft.filter((item) => assigned.includes(item.id) && !named.has(item.id))
  return extra.length ? [...saved, ...extra] : saved
}

/**
 * The saved catalog. A saved list never holds what hangs off an unsaved pick: a product under
 * a category chosen but not saved, or a size of such a product, is not saved either.
 */
export function savedCatalog(state: SavedCatalogState): CatalogLists {
  const { draft, accountCatalog } = state
  const categories = withAssigned(savedList(4, state), draft.categories, accountCatalog.categoryIds)
  const categoryIds = new Set([...categories.map((category) => category.id), ...accountCatalog.categoryIds])
  const products = withAssigned(savedList(5, state), draft.products, accountCatalog.productIds)
  const savedProducts = kept(products, products.filter((product) =>
    categoryIds.has(product.categoryId) || !draft.categories.some((category) => category.id === product.categoryId)))
  const productIds = new Set(savedProducts.map((product) => product.id))
  const skus = savedList(6, state)
  return { categories, products: savedProducts, skus: kept(skus, skus.filter((sku) => productIds.has(sku.productId))) }
}

/**
 * The draft as Step 5 or 6 shows, checks and saves it. Step 5 holds the saved categories and
 * every product chosen under them; Step 6 the saved products and every size of theirs.
 */
export function stepCatalog(step: 5 | 6, draft: VendorOnboardingDraftV1, saved: CatalogLists): VendorOnboardingDraftV1 {
  const categoryIds = new Set(saved.categories.map((category) => category.id))
  const productIds = new Set(saved.products.map((product) => product.id))
  const categories = kept(draft.categories, draft.categories.filter((category) => categoryIds.has(category.id)))
  const products = kept(draft.products, draft.products.filter((product) =>
    step === 5 ? categoryIds.has(product.categoryId) : productIds.has(product.id)))
  const skus = kept(draft.skus, draft.skus.filter((sku) => productIds.has(sku.productId)))
  if (categories === draft.categories && products === draft.products && skus === draft.skus) return draft
  return { ...draft, categories, products, skus }
}

/** What a Continue on `step` checks and writes: Steps 5 and 6 leave hidden picks behind. */
export function stepSaveDraft(step: OnboardingStep, state: SavedCatalogState): VendorOnboardingDraftV1 {
  return step === 5 || step === 6 ? stepCatalog(step, state.draft, savedCatalog(state)) : state.draft
}

/** The saved catalog once a save of `step` lands: that step's list becomes what it sends. */
export function savedCatalogAfterSave(step: OnboardingStep, state: SavedCatalogState): CatalogLists {
  if (step !== 4 && step !== 5 && step !== 6) return savedCatalog(state)
  const sent = stepSnapshot(step, stepSaveDraft(step, state), createEmptyRuntimeState())
  return savedCatalog({ ...state, savedBaselines: { ...state.savedBaselines, [step]: sent } })
}

/** The draft with its catalog replaced by the saved one: what Step 10 counts and judges. */
export function withSavedCatalog(draft: VendorOnboardingDraftV1, saved: CatalogLists): VendorOnboardingDraftV1 {
  return { ...draft, ...saved }
}
