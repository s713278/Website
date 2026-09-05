import type { ReferencePage } from '@/shared/api'

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
