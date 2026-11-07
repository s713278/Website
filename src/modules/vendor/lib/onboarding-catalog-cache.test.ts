import { beforeEach, describe, expect, it } from 'vitest'
import type { ReferencePage } from '@/shared/api'
import {
  businessTypeCacheKey,
  readReferenceCache,
  seedBusinessTypeFirstPage,
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

const accountKey = businessTypeCacheKey('account', '')
const sampleKey = businessTypeCacheKey('sample', '')

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

describe('seedBusinessTypeFirstPage', () => {
  it('files the first nine of a wider last page as a page that is not the last', () => {
    seedBusinessTypeFirstPage('account', page(30))

    const seeded = readReferenceCache<Item>(accountKey)
    expect(seeded?.items.map((entry) => entry.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect(seeded?.pageNumber).toBe(0)
    expect(seeded?.lastPage).toBe(false)
  })

  it('keeps the page last when everything fits in one step page', () => {
    seedBusinessTypeFirstPage('account', page(5))

    expect(readReferenceCache<Item>(accountKey)).toEqual({
      items: [1, 2, 3, 4, 5].map(item),
      pageNumber: 0,
      lastPage: true,
    })
  })

  it('files exactly nine items as the last page', () => {
    seedBusinessTypeFirstPage('account', page(9))

    expect(readReferenceCache<Item>(accountKey)).toMatchObject({ lastPage: true })
    expect(readReferenceCache<Item>(accountKey)?.items).toHaveLength(9)
  })

  it('leaves the sample catalog key empty', () => {
    seedBusinessTypeFirstPage('account', page(30))

    expect(readReferenceCache<Item>(sampleKey)).toBeNull()
  })

  it('never replaces an entry the step already holds', () => {
    writeReferenceCache(accountKey, page(2, { lastPage: false }), false)

    seedBusinessTypeFirstPage('account', page(30))

    expect(readReferenceCache<Item>(accountKey)).toEqual({
      items: [item(1), item(2)],
      pageNumber: 0,
      lastPage: false,
    })
  })

  it('ignores a page that is not page 0', () => {
    seedBusinessTypeFirstPage('account', page(30, { pageNumber: 1 }))

    expect(readReferenceCache<Item>(accountKey)).toBeNull()
  })

  it('ignores a short page that is not the last, which cannot stand in for a first page', () => {
    seedBusinessTypeFirstPage('account', page(5, { lastPage: false }))

    expect(readReferenceCache<Item>(accountKey)).toBeNull()
  })

  it('accepts a full page that is not the last', () => {
    seedBusinessTypeFirstPage('account', page(12, { lastPage: false }))

    expect(readReferenceCache<Item>(accountKey)).toMatchObject({ pageNumber: 0, lastPage: false })
    expect(readReferenceCache<Item>(accountKey)?.items).toHaveLength(9)
  })
})
