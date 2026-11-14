import type { ValidationIssue } from '../types/onboarding'
import type { RetainableCatalog } from './onboarding-catalog-limits'

/**
 * Repairs for drafts and accounts the old business-type behaviour left behind.
 *
 * Before the type locked at its first save, a vendor could switch it after saving, pick the
 * new type's categories and products, and leave them unsaved in this browser's draft, or
 * save them too. The saved type itself is restored by the type resolver; these rules settle
 * the catalog around it, silently:
 *
 * - unsaved selections that belong to another type leave the draft;
 * - nothing the account holds is ever dropped or reassigned: a catalog that is already
 *   mixed on the account is only detected, so the wizard can send the vendor to support.
 */

/**
 * The draft catalog without unsaved selections of a business type other than `savedTypeId`,
 * and without the products and sizes under them. An assigned category stays whatever its
 * recorded type, as does one an assigned product sits under, and so does a category whose
 * type is not recorded: nothing says it is another type's. Returns `catalog` itself when
 * nothing is dropped.
 */
export function dropOtherTypeSelections<T extends RetainableCatalog>(
  catalog: T,
  savedTypeId: number,
  account: { categoryIds: readonly number[]; productIds: readonly number[] },
): T {
  const assignedCategoryIds = new Set(account.categoryIds)
  const assignedProductIds = new Set(account.productIds)
  for (const product of catalog.products) {
    if (assignedProductIds.has(product.id)) assignedCategoryIds.add(product.categoryId)
  }
  const categories = catalog.categories.filter((category) => assignedCategoryIds.has(category.id)
    || category.businessTypeId === null || category.businessTypeId === savedTypeId)
  if (categories.length === catalog.categories.length) return catalog
  const categoryIds = new Set(categories.map((category) => category.id))
  const products = catalog.products.filter((product) => categoryIds.has(product.categoryId))
  const productIds = new Set(products.map((product) => product.id))
  const skus = catalog.skus.filter((sku) => productIds.has(sku.productId))
  return { ...catalog, categories, products, skus }
}

/**
 * Whether the account's assigned categories are confirmed to span the saved type and another:
 * some are on the saved type's complete category list and some are not. Without that complete
 * list (`undefined`) nothing is confirmed, and neither is it when none is on the list: that
 * says the list or the type is wrong, not that the catalog is mixed.
 *
 * Only lists the visit read anyway are used, never one read for this check alone, and the
 * assigned categories are those read on entry: an entry saved later in the visit is not on a
 * list read earlier. The assigned-categories read names no type
 * (`docs/API_GAPS.md#saved-business-type-is-not-readable-or-enforced`).
 */
export function assignedCatalogIsMixed(
  assignedCategoryIds: readonly number[],
  savedTypeCategoryIds: readonly number[] | undefined,
): boolean {
  if (!savedTypeCategoryIds) return false
  const listed = new Set(savedTypeCategoryIds)
  return assignedCategoryIds.some((id) => listed.has(id)) && assignedCategoryIds.some((id) => !listed.has(id))
}

export const MIXED_CATALOG_MESSAGE = 'Your catalog has categories from more than one business type. Contact support to continue.'

/** What holds submission back while the saved catalog is mixed: support, not an edit. */
export function mixedCatalogIssues(mixed: boolean): ValidationIssue[] {
  return mixed ? [{ step: 4, field: 'catalog-mixed', message: MIXED_CATALOG_MESSAGE }] : []
}
