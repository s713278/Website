import type { DraftSku, OnboardingStep, VendorOnboardingDraftV1 } from '../types/onboarding'
import { stepAfterSave } from './onboarding-progress'
import { validateDraftSku } from './onboarding-validation'

/**
 * Steps 4-6 depend on each other: every chosen category needs a product, and every product
 * a valid size that is switched on. Removals already prune what depends on them; additions
 * leave work on a later step. That work is shown and guided, never enforced by locking
 * navigation: Step 10's readiness check is what blocks submission.
 */
export type CatalogDependencyGaps = {
  /** Chosen categories with no product: Step 5 work. */
  categoryIds: number[]
  /** Products with no valid, switched-on size: Step 6 work. */
  productIds: number[]
}

/** Chosen categories with no product. */
export function categoriesWithoutProducts(draft: Pick<VendorOnboardingDraftV1, 'categories' | 'products'>): number[] {
  const covered = new Set(draft.products.map((product) => product.categoryId))
  return draft.categories.filter((category) => !covered.has(category.id)).map((category) => category.id)
}

/** Products with no size that is both switched on and valid. */
export function productsWithoutSize(draft: Pick<VendorOnboardingDraftV1, 'products' | 'skus'>): number[] {
  // Grouped once: the wizard runs this on every store change to mark the stepper.
  const sizesByProduct = new Map<number, DraftSku[]>()
  for (const sku of draft.skus) sizesByProduct.set(sku.productId, [...sizesByProduct.get(sku.productId) ?? [], sku])
  return draft.products
    .filter((product) => {
      const sizes = sizesByProduct.get(product.id) ?? []
      return !sizes.some((sku) => sku.active && !validateDraftSku(sku, sizes).length)
    })
    .map((product) => product.id)
}

export function catalogDependencyGaps(
  draft: Pick<VendorOnboardingDraftV1, 'categories' | 'products' | 'skus'>,
): CatalogDependencyGaps {
  return { categoryIds: categoriesWithoutProducts(draft), productIds: productsWithoutSize(draft) }
}

/**
 * Steps 5 and 6 that the account counts as done but now have missing work. A step not yet
 * done is left to its first-time Continue. A store under review cannot add sizes, so only
 * its Step 5 is marked; an approved store is marked as in setup.
 */
export function stepsNeedingAttention(
  gaps: CatalogDependencyGaps,
  completedSteps: readonly OnboardingStep[],
  submitted: boolean,
  approved: boolean,
): Array<5 | 6> {
  const steps: Array<5 | 6> = []
  if (gaps.categoryIds.length && completedSteps.includes(5)) steps.push(5)
  if (gaps.productIds.length && completedSteps.includes(6) && (!submitted || approved)) steps.push(6)
  return steps
}

/**
 * Where a successful save of `step` lands once catalog work is considered: a revisit save
 * stops first at the earliest step after it that needs attention, before the remembered
 * step; otherwise it lands where `stepAfterSave` says. The remembered step is kept until
 * it is reached, so 9 → 4 → 5 → 6 → 9.
 */
export function stepAfterCatalogSave(
  step: OnboardingStep,
  returnStep: OnboardingStep | null,
  attention: readonly OnboardingStep[],
): OnboardingStep {
  const target = stepAfterSave(step, returnStep)
  return [...attention].sort((a, b) => a - b).find((needed) => needed > step && needed < target) ?? target
}
