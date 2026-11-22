import { beforeEach, describe, expect, it } from 'vitest'
import type { ReferencePage } from '@/shared/api'
import {
  categoryReferenceCacheKey,
  readReferenceCache,
  seedCategoryFirstPage,
  writeReferenceCache,
} from './onboarding-catalog-cache'

type Item = { id: number; name: string }

const item = (id: number): Item => ({ id, name: `Type ${id}` })

function page(count: number, overrides: Partial<ReferencePage<Item>> = {}): ReferencePage<Item> {
  return {
    items: Array.from({ length: count }, (_, index) => item(index + 1)),
    pageNumber: 0,
    pageSize: 100,
    totalElements: count,
    totalPages: 1,
    lastPage: true,
    ...overrides,
  }
}

/**
 * The cache is module-level with no reset. It holds 48 keys and drops the oldest, so writing
 * 48 throwaway keys empties every other entry.
 */
function emptyCache() {
  for (let index = 0; index < 48; index++) {
    writeReferenceCache(`test-filler:${index}`, page(1), false)
  }
}

beforeEach(emptyCache)

describe('seedCategoryFirstPage', () => {
  const key = categoryReferenceCacheKey('account', 30)

  it('files the first six of a wider read as Step 4’s first page, leaving page 1 to Show more', () => {
    seedCategoryFirstPage('account', 30, page(14))

    expect(readReferenceCache<Item>(key)).toEqual({ items: [1, 2, 3, 4, 5, 6].map(item), pageNumber: 0, lastPage: false })
    expect(readReferenceCache<Item>(categoryReferenceCacheKey('account', 7))).toBeNull()
  })

  it('keeps a list that fits in one Step 4 page the last', () => {
    seedCategoryFirstPage('account', 30, page(6))

    expect(readReferenceCache<Item>(key)).toMatchObject({ pageNumber: 0, lastPage: true })
  })

  it('never replaces a page Step 4 already holds', () => {
    writeReferenceCache(key, page(2, { lastPage: false }), false)

    seedCategoryFirstPage('account', 30, page(14))

    expect(readReferenceCache<Item>(key)?.items).toEqual([item(1), item(2)])
  })

  it('ignores a page that is not page 0', () => {
    seedCategoryFirstPage('account', 30, page(14, { pageNumber: 1 }))

    expect(readReferenceCache<Item>(key)).toBeNull()
  })

  it('ignores a short page that is not the last, which cannot stand in for a first page', () => {
    seedCategoryFirstPage('account', 30, page(5, { lastPage: false }))

    expect(readReferenceCache<Item>(key)).toBeNull()
  })
})
