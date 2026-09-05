import type { Product } from '@/modules/storefront/types'
import {
  ALL_CATEGORY,
  type CategoryFilter,
  productMatchesCategory,
} from '@/modules/storefront/lib/catalog-filters'

/** Soft cap — enough for instant category paint without unbounded memory. */
export const MAX_CACHED_PRODUCTS_PER_STORE = 500

/** Maximum number of storefronts kept in memory during one tab session. */
export const MAX_CACHED_STORES = 8

type StoreProductBucket = {
  products: Map<string, Product>
  /** Category index key → product IDs. */
  byCategory: Map<string, Set<string>>
  /** Prevent duplicate warm-prefetch requests for this store. */
  warmClaimed: boolean
}

const buckets = new Map<string, StoreProductBucket>()
const storeTouchOrder: string[] = []

function categoryIndexKeys(product: Product): string[] {
  const keys: string[] = []

  if (product.categoryId != null) {
    keys.push(`id:${product.categoryId}`)
  }

  const name = product.category?.trim().toLowerCase()

  if (name) {
    keys.push(`name:${name}`)
  }

  return keys
}

function categoryIndexKey(
  filter?: CategoryFilter,
): string | null {
  if (!filter || filter === ALL_CATEGORY) {
    return null
  }

  if (typeof filter === 'number') {
    return `id:${filter}`
  }

  return `name:${filter.trim().toLowerCase()}`
}

function touchStore(storeId: string): void {
  const index = storeTouchOrder.indexOf(storeId)

  if (index >= 0) {
    storeTouchOrder.splice(index, 1)
  }

  storeTouchOrder.push(storeId)
}

function evictOldestStoreIfNeeded(): void {
  while (storeTouchOrder.length > MAX_CACHED_STORES) {
    const oldest = storeTouchOrder.shift()

    if (oldest) {
      buckets.delete(oldest)
    }
  }
}

function createBucket(): StoreProductBucket {
  return {
    products: new Map<string, Product>(),
    byCategory: new Map<string, Set<string>>(),
    warmClaimed: false,
  }
}

/**
 * Get an existing bucket or create one.
 * Use this only when the cache may need to be created/updated.
 */
function bucketFor(storeId: string): StoreProductBucket {
  let bucket = buckets.get(storeId)

  if (!bucket) {
    bucket = createBucket()
    buckets.set(storeId, bucket)
  }

  touchStore(storeId)
  evictOldestStoreIfNeeded()

  return bucket
}

function indexProduct(
  bucket: StoreProductBucket,
  product: Product,
): void {
  for (const key of categoryIndexKeys(product)) {
    let ids = bucket.byCategory.get(key)

    if (!ids) {
      ids = new Set<string>()
      bucket.byCategory.set(key, ids)
    }

    ids.add(product.id)
  }
}

function unindexProduct(
  bucket: StoreProductBucket,
  productId: string,
  product: Product,
): void {
  for (const key of categoryIndexKeys(product)) {
    const ids = bucket.byCategory.get(key)

    if (!ids) continue

    ids.delete(productId)

    if (ids.size === 0) {
      bucket.byCategory.delete(key)
    }
  }
}

function trimBucket(bucket: StoreProductBucket): void {
  while (bucket.products.size > MAX_CACHED_PRODUCTS_PER_STORE) {
    const oldestId = bucket.products.keys().next().value as
      | string
      | undefined

    if (!oldestId) break

    const product = bucket.products.get(oldestId)

    if (product) {
      unindexProduct(bucket, oldestId, product)
    }

    bucket.products.delete(oldestId)
  }
}

/** Merge API page rows into the in-memory store bucket. */
export function mergeStoreProducts(
  storeId: string,
  products: Product[],
): void {
  if (!storeId || products.length === 0) return

  const bucket = bucketFor(storeId)

  for (const product of products) {
    if (!product.id) continue

    const previous = bucket.products.get(product.id)

    // Remove old category indexes before replacing the product.
    if (previous) {
      unindexProduct(bucket, product.id, previous)
    }

    // Upsert product.
    bucket.products.set(product.id, product)

    // Add the product to its current category indexes.
    indexProduct(bucket, product)
  }

  trimBucket(bucket)
}

/** Return products currently cached for a store. */
export function listCachedStoreProducts(
  storeId: string,
): Product[] {
  if (!storeId) return []

  const bucket = buckets.get(storeId)

  if (!bucket) return []

  touchStore(storeId)

  return Array.from(bucket.products.values())
}

/**
 * Optimistic category result from cached products.
 *
 * This result can be partial because the cache may not contain
 * the complete catalog yet. The API remains the source of truth.
 */
export function peekCategoryProducts(
  storeId: string,
  categoryFilter: CategoryFilter | undefined,
  limit: number,
): Product[] {
  if (!storeId || limit <= 0) return []

  const bucket = buckets.get(storeId)

  if (!bucket) return []

  touchStore(storeId)

  const indexKey = categoryIndexKey(categoryFilter)

  // Use the category index when possible.
  if (indexKey) {
    const ids = bucket.byCategory.get(indexKey)

    if (!ids?.size) return []

    const items: Product[] = []

    for (const id of ids) {
      const product = bucket.products.get(id)

      if (
        !product ||
        !productMatchesCategory(product, categoryFilter)
      ) {
        continue
      }

      items.push(product)

      if (items.length >= limit) {
        break
      }
    }

    return items
  }

  // ALL category — iterate through cached products.
  const items: Product[] = []

  for (const product of bucket.products.values()) {
    if (!productMatchesCategory(product, categoryFilter)) {
      continue
    }

    items.push(product)

    if (items.length >= limit) {
      break
    }
  }

  return items
}

/** Return the number of products currently cached for a store. */
export function getCachedProductCount(
  storeId: string,
): number {
  if (!storeId) return 0

  return buckets.get(storeId)?.products.size ?? 0
}

/**
 * Claim one warm prefetch per store.
 * Returns false if the store has already been claimed.
 */
export function claimStoreCatalogWarm(
  storeId: string,
): boolean {
  if (!storeId) return false

  const bucket = bucketFor(storeId)

  if (bucket.warmClaimed) {
    return false
  }

  bucket.warmClaimed = true

  return true
}

/**
 * Release the warm claim.
 *
 * Call this when the prefetch fails so it can be retried.
 */
export function releaseStoreCatalogWarm(
  storeId: string,
): void {
  if (!storeId) return

  const bucket = buckets.get(storeId)

  if (bucket) {
    bucket.warmClaimed = false
  }
}

/** Drop one store's product cache. */
export function clearStoreProductCache(
  storeId: string,
): void {
  if (!storeId) return

  buckets.delete(storeId)

  const index = storeTouchOrder.indexOf(storeId)

  if (index >= 0) {
    storeTouchOrder.splice(index, 1)
  }
}

/** Drop every in-memory catalog cache for this tab session. */
export function clearAllProductCaches(): void {
  buckets.clear()
  storeTouchOrder.length = 0
}