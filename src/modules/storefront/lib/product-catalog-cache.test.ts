import { afterEach, describe, expect, it } from 'vitest'
import type { Product } from '@/modules/storefront/types'
import {
  MAX_CACHED_PRODUCTS_PER_STORE,
  MAX_CACHED_STORES,
  clearAllProductCaches,
  clearStoreProductCache,
  claimStoreCatalogWarm,
  getCachedProductCount,
  mergeStoreProducts,
  peekCategoryProducts,
  releaseStoreCatalogWarm,
} from './product-catalog-cache'

function product(id: string, category?: string, categoryId?: number): Product {
  return {
    id,
    name: id,
    description: '',
    price: 100,
    veg: true,
    category,
    categoryId,
  }
}

afterEach(() => {
  clearAllProductCaches()
})

describe('product-catalog-cache', () => {
  it('merges and peeks by numeric category id', () => {
    mergeStoreProducts('s1', [
      product('a', 'Pickles', 31),
      product('b', 'Spice', 32),
    ])

    expect(peekCategoryProducts('s1', 31, 10).map((p) => p.id)).toEqual(['a'])
    expect(peekCategoryProducts('s1', 'all', 10).map((p) => p.id)).toEqual(['a', 'b'])
  })

  it('peeks by category name when id is unknown', () => {
    mergeStoreProducts('s1', [product('a', 'Pickles')])
    expect(peekCategoryProducts('s1', 'Pickles', 5).map((p) => p.id)).toEqual(['a'])
  })

  it('caps products per store', () => {
    const rows = Array.from({ length: MAX_CACHED_PRODUCTS_PER_STORE + 25 }, (_, i) =>
      product(`p${i}`),
    )
    mergeStoreProducts('s1', rows)
    expect(getCachedProductCount('s1')).toBe(MAX_CACHED_PRODUCTS_PER_STORE)
  })

  it('evicts oldest stores when over max store count', () => {
    for (let i = 0; i < MAX_CACHED_STORES + 2; i++) {
      mergeStoreProducts(`store-${i}`, [product('x')])
    }
    expect(getCachedProductCount('store-0')).toBe(0)
    expect(getCachedProductCount(`store-${MAX_CACHED_STORES + 1}`)).toBe(1)
  })

  it('warm claim is single-flight per store', () => {
    expect(claimStoreCatalogWarm('s1')).toBe(true)
    expect(claimStoreCatalogWarm('s1')).toBe(false)
    releaseStoreCatalogWarm('s1')
    expect(claimStoreCatalogWarm('s1')).toBe(true)
  })

  it('clearStoreProductCache removes one bucket', () => {
    mergeStoreProducts('s1', [product('a')])
    mergeStoreProducts('s2', [product('b')])
    clearStoreProductCache('s1')
    expect(getCachedProductCount('s1')).toBe(0)
    expect(getCachedProductCount('s2')).toBe(1)
  })
})
