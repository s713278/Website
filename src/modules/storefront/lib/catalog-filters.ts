import type { Product, Store, StoreCategory } from '@/modules/storefront/types'
import { getProductVariants } from '@/modules/storefront/lib/product-variants'

/** Show every product. */
export const ALL_CATEGORY = 'all' as const

export type CategoryFilter = typeof ALL_CATEGORY | number | string

function variantUnitsText(product: Product): string {
  return getProductVariants(product)
    .map((variant) => variant.unit)
    .filter(Boolean)
    .join(' ')
}

function wordPrefixMatch(text: string, query: string): boolean {
  if (!text || !query) return false
  const hay = text.toLowerCase()
  const q = query.toLowerCase()
  if (hay.startsWith(q)) return true
  return hay.split(/\s+/).some((word) => word.startsWith(q))
}

/** Avoid matching "he" inside description words like "the". */
export function productMatchesSearch(product: Product, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true

  const name = product.name?.trim().toLowerCase() ?? ''
  const category = product.category?.trim().toLowerCase() ?? ''
  const units = variantUnitsText(product).toLowerCase()
  const description = product.description?.trim().toLowerCase() ?? ''

  if (q.length < 3) {
    return (
      wordPrefixMatch(name, q) ||
      wordPrefixMatch(category, q) ||
      wordPrefixMatch(units, q)
    )
  }

  return (
    name.includes(q) ||
    category.includes(q) ||
    units.includes(q) ||
    wordPrefixMatch(description, q)
  )
}

export function productMatchesCategory(product: Product, filter?: CategoryFilter) {
  if (!filter || filter === ALL_CATEGORY) return true
  if (typeof filter === 'number') return product.categoryId === filter
  const needle = filter.trim().toLowerCase()
  return product.category?.trim().toLowerCase() === needle
}

/** Chip value: prefer numeric id, otherwise category name. */
export function categoryFilterValue(category: StoreCategory): CategoryFilter {
  return category.categoryId ?? category.label
}

/**
 * Storefront categories are usually name + image only.
 * Products teach category_id — attach it to the matching chip by name.
 */
export function buildCategories(store: Store, products: Product[] = []): StoreCategory[] {
  const catalog = [...products, ...store.products]
  const idByName = new Map<string, number>()
  for (const product of catalog) {
    const name = product.category?.trim().toLowerCase()
    if (name && product.categoryId != null) idByName.set(name, product.categoryId)
  }

  if (store.categories?.length) {
    return store.categories.map((category) => {
      const categoryId =
        category.categoryId ?? idByName.get(category.label.trim().toLowerCase())
      return categoryId != null ? { ...category, categoryId } : category
    })
  }

  const seen = new Set<string>()
  const fromProducts: StoreCategory[] = []
  for (const product of catalog) {
    const label = product.category?.trim()
    if (!label) continue
    const key = product.categoryId != null ? String(product.categoryId) : label.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    fromProducts.push({
      label,
      categoryId: product.categoryId,
    })
  }
  return fromProducts
}

export function categoryLabel(categories: StoreCategory[], filter: CategoryFilter): string {
  if (filter === ALL_CATEGORY) return 'All Products'
  if (typeof filter === 'number') {
    return categories.find((category) => category.categoryId === filter)?.label ?? 'Products'
  }
  return categories.find(
    (category) => category.label.trim().toLowerCase() === filter.trim().toLowerCase(),
  )?.label ?? filter
}

/** Upgrade name-only selection to numeric id once products teach it. */
export function resolveCategoryFilter(
  categories: StoreCategory[],
  filter: CategoryFilter,
): CategoryFilter {
  if (filter === ALL_CATEGORY || typeof filter === 'number') return filter
  const match = categories.find(
    (category) => category.label.trim().toLowerCase() === filter.trim().toLowerCase(),
  )
  return match?.categoryId ?? filter
}

export function isCategoryActive(filter: CategoryFilter, category: StoreCategory) {
  if (filter === ALL_CATEGORY) return false
  if (typeof filter === 'number') return category.categoryId === filter
  return category.label.trim().toLowerCase() === filter.trim().toLowerCase()
}

export function filterProducts(
  products: Product[],
  categoryFilter: CategoryFilter,
  query: string,
): Product[] {
  return products.filter(
    (product) =>
      productMatchesCategory(product, categoryFilter) &&
      productMatchesSearch(product, query),
  )
}

export function parseCategoryFilter(filter?: CategoryFilter) {
  if (!filter || filter === ALL_CATEGORY) {
    return { categoryId: undefined, categoryName: undefined } as const
  }
  if (typeof filter === 'number') {
    return { categoryId: filter, categoryName: undefined } as const
  }
  return { categoryId: undefined, categoryName: filter } as const
}
