import type { DraftCategory, DraftSku, SelectedProduct } from '../types/onboarding'
import { isAccountSkuId, serverSkuIdOf } from './onboarding-sku-id'

/**
 * Cumulative catalog capacity: what the vendor's account would hold if the current draft
 * were saved on top of what is already assigned.
 *
 * A vendor account is capped on categories, products, and sizes together, and assignment
 * is one-way — nothing here can be given back. So the number a limit must be checked
 * against is never the draft count alone; it is the *projected account total*, the union
 * of what the account already holds and what this draft would add. Counting the draft
 * alone is the over-limit bug: after any path that empties the draft while keeping the
 * account writes (a business-type change on Step 3), the draft count resets to zero and a
 * fresh full allowance opens on top of a full account.
 *
 * These are pure so both the interactive controls and the validation "second line of
 * defence" can share one answer, testable without rendering.
 */

/** Distinct ids across the account snapshot and the draft. */
function unionCount(accountIds: readonly number[], draftIds: readonly number[]): number {
  const distinct = new Set(accountIds)
  for (const id of draftIds) distinct.add(id)
  return distinct.size
}

/**
 * Projected category count = |account categories ∪ draft categories|.
 *
 * A draft category already on the account is the same slot, counted once. A pending
 * authored category carries a negative id the account never returns, so it always adds.
 */
export function projectedCategoryTotal(
  accountCategoryIds: readonly number[],
  draftCategoryIds: readonly number[],
): number {
  return unionCount(accountCategoryIds, draftCategoryIds)
}

/** Projected product count = |account products ∪ draft products|. */
export function projectedProductTotal(
  accountProductIds: readonly number[],
  draftProductIds: readonly number[],
): number {
  return unionCount(accountProductIds, draftProductIds)
}

/**
 * Projected size count against `maxSkus`, post-save.
 *
 * An account size counts once, whether or not the current draft still shows it — a
 * business-type change empties the draft but leaves those sizes on the account. A draft
 * size that carries an account id (`sku-<serverId>`) is an edit or in-place replacement of
 * that same account size, so it is net-zero: already counted in the account set, never as
 * removed-plus-added. Only a genuinely new local size (`draft-sku-*`) consumes a fresh
 * slot.
 */
export function projectedSkuTotal(
  accountSkuIds: readonly number[],
  draftSkus: readonly DraftSku[],
): number {
  const distinct = new Set(accountSkuIds)
  let newLocalSizes = 0
  for (const sku of draftSkus) {
    const serverId = serverSkuIdOf(sku.id)
    if (serverId != null) distinct.add(serverId)
    else newLocalSizes += 1
  }
  return distinct.size + newLocalSizes
}

export type RetainableCatalog = {
  categories: DraftCategory[]
  products: SelectedProduct[]
  skus: DraftSku[]
}

/**
 * The portion of a draft catalog that is already saved to the account.
 *
 * A business-type change on Step 3 clears the working catalog, because the selections
 * belong to the previous business type. But category and product assignment is one-way, and
 * a size saved to the account cannot be silently dropped either: clearing an assigned entry
 * from the draft loses it from view while it stays on the account. That resets the live
 * preview to zero and — once the account is at a plan limit — strands the vendor on Step 4
 * with an empty draft they cannot refill and a "choose at least one" gate they cannot pass.
 *
 * So a change keeps whatever the account already holds and clears only the unsaved
 * selections: assigned categories, assigned products under a kept category, and the sizes
 * carrying account ids (`sku-<id>`) on those products. A product's unsaved local sizes go
 * with the rest of the unsaved work.
 */
export function retainAssignedCatalog(
  draft: RetainableCatalog,
  account: { categoryIds: readonly number[]; productIds: readonly number[] },
): RetainableCatalog {
  const assignedCategoryIds = new Set(account.categoryIds)
  const assignedProductIds = new Set(account.productIds)
  const categories = draft.categories.filter((category) => assignedCategoryIds.has(category.id))
  const products = draft.products.filter(
    (product) => assignedProductIds.has(product.id) && assignedCategoryIds.has(product.categoryId),
  )
  const keptProductIds = new Set(products.map((product) => product.id))
  const skus = draft.skus.filter((sku) => keptProductIds.has(sku.productId) && isAccountSkuId(sku.id))
  return { categories, products, skus }
}
