import type { ReferencePage } from '@/shared/api'
import { ONBOARDING_CONFIG, type CatalogSource } from '../types/onboarding'

type IdentifiedReference = { id: number }

export type CachedReferenceSnapshot<T extends IdentifiedReference> = {
  items: T[]
  pageNumber: number
  lastPage: boolean
}

const MAX_CACHE_KEYS = 48
const referenceCache = new Map<string, CachedReferenceSnapshot<IdentifiedReference>>()

export function mergeReferenceItems<T extends IdentifiedReference>(
  ...groups: ReadonlyArray<ReadonlyArray<T>>
): T[] {
  const items = new Map<number, T>()
  for (const group of groups) {
    for (const item of group) items.set(item.id, item)
  }
  return Array.from(items.values())
}

export function appendMissingReferenceItems<T extends IdentifiedReference>(
  primary: ReadonlyArray<T>,
  fallback: ReadonlyArray<T>,
): T[] {
  const existingIds = new Set(primary.map((item) => item.id))
  return [
    ...primary,
    ...fallback.filter((item) => !existingIds.has(item.id)),
  ]
}

function touchCacheEntry(
  key: string,
  snapshot: CachedReferenceSnapshot<IdentifiedReference>,
) {
  referenceCache.delete(key)
  referenceCache.set(key, snapshot)

  while (referenceCache.size > MAX_CACHE_KEYS) {
    const oldestKey = referenceCache.keys().next().value
    if (typeof oldestKey !== 'string') break
    referenceCache.delete(oldestKey)
  }
}

export function readReferenceCache<T extends IdentifiedReference>(
  key: string,
): CachedReferenceSnapshot<T> | null {
  const cached = referenceCache.get(key)
  if (!cached) return null

  touchCacheEntry(key, cached)
  return {
    items: [...cached.items] as T[],
    pageNumber: cached.pageNumber,
    lastPage: cached.lastPage,
  }
}

export function writeReferenceCache<T extends IdentifiedReference>(
  key: string,
  page: ReferencePage<T>,
  append: boolean,
): CachedReferenceSnapshot<T> {
  const current = append ? readReferenceCache<T>(key) : null
  const snapshot: CachedReferenceSnapshot<T> = {
    items: current
      ? mergeReferenceItems(current.items, page.items)
      : mergeReferenceItems(page.items),
    pageNumber: page.pageNumber,
    lastPage: page.lastPage,
  }

  touchCacheEntry(key, snapshot)
  return snapshot
}

/** Step 3's key for one search of the business type list, paged by the step's page size. */
export function businessTypeCacheKey(mode: CatalogSource, query: string): string {
  return [
    'business',
    mode,
    `query:${query}`,
    `size:${ONBOARDING_CONFIG.businessTypePageSize}`,
    'sort:id:ASC',
  ].join(':')
}

/**
 * File Step 3's first unsearched page from a wider read of the same list, so the step's
 * first visit costs no request. `page` must be page 0 of the unfiltered list sorted by id
 * ascending. Later pages are left to the step's infinite scroll, and an entry the step
 * already holds is never replaced.
 */
export function seedBusinessTypeFirstPage<T extends IdentifiedReference>(
  mode: CatalogSource,
  page: ReferencePage<T>,
): void {
  const key = businessTypeCacheKey(mode, '')
  const size = ONBOARDING_CONFIG.businessTypePageSize
  // A short page that is not the last cannot stand in for a full first page.
  const complete = page.lastPage || page.items.length >= size
  if (page.pageNumber !== 0 || !complete || referenceCache.has(key)) return

  touchCacheEntry(key, {
    items: page.items.slice(0, size),
    pageNumber: 0,
    lastPage: page.lastPage && page.items.length <= size,
  })
}
