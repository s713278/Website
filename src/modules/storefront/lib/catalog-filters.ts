import type { Product, Store, StoreCategory } from '@/modules/storefront/types'
import { getProductVariants } from '@/modules/storefront/lib/product-variants'
import { matchesSearchQuery } from '@/shared/lib/search-query'

function productSearchText(product: Product): string {
  const units = getProductVariants(product)
    .map((variant) => variant.unit)
    .filter(Boolean)
    .join(' ')
  return `${product.name} ${product.description ?? ''} ${product.category ?? ''} ${units}`
}

export const ALL_CATEGORY = 'all'
export const PRODUCT_PREVIEW_LIMIT = 6

export function buildCategories(store: Store): StoreCategory[] {
  if (store.categories?.length) return store.categories
  const seen = new Set<string>()
  const fromProducts: StoreCategory[] = []
  for (const product of store.products) {
    const id = product.category?.trim().toLowerCase()
    if (!id || seen.has(id)) continue
    seen.add(id)
    fromProducts.push({ id, label: id.replace(/\b\w/g, (c) => c.toUpperCase()) })
  }
  return fromProducts
}

export function categoryLabel(categories: StoreCategory[], categoryId: string): string {
  if (categoryId === ALL_CATEGORY) return 'All Products'
  return categories.find((category) => category.id === categoryId)?.label ?? 'Products'
}

export function filterProducts(products: Product[], categoryId: string, query: string): Product[] {
  return products.filter((product) => {
    if (categoryId !== ALL_CATEGORY && (product.category?.toLowerCase() ?? '') !== categoryId) {
      return false
    }
    return matchesSearchQuery(productSearchText(product), query)
  })
}

export function previewProducts(products: Product[], limit = PRODUCT_PREVIEW_LIMIT): Product[] {
  return products.slice(0, limit)
}
