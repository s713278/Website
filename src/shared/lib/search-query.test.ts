import { describe, expect, it } from 'vitest'
import {
  isSearchActive,
  isSearchApiReady,
  isSearchTooShort,
  matchesSearchQuery,
  SEARCH_API_MIN_CHARS,
  SEARCH_MIN_CHARS,
  searchMinCharsMessage,
  searchUiMinChars,
} from './search-query'

describe('search-query thresholds', () => {
  it('uses 2 characters for live API UI and 2 for demo', () => {
    expect(searchUiMinChars(true)).toBe(SEARCH_API_MIN_CHARS)
    expect(searchUiMinChars(false)).toBe(SEARCH_MIN_CHARS)
  })

  it('treats a single character as too short and not yet active', () => {
    expect(isSearchTooShort('a')).toBe(true)
    expect(isSearchActive('a')).toBe(false)
    expect(isSearchApiReady('a')).toBe(false)
  })

  it('on live, allows 2 characters for the API', () => {
    const min = searchUiMinChars(true)

    expect(isSearchTooShort('a', min)).toBe(true)
    expect(isSearchActive('a', min)).toBe(false)
    expect(isSearchApiReady('a')).toBe(false)

    expect(isSearchTooShort('bi', min)).toBe(false)
    expect(isSearchActive('bi', min)).toBe(true)
    expect(isSearchApiReady('bi')).toBe(true)
  })

  it('starts demo matching at SEARCH_MIN_CHARS', () => {
    const query = 'b'.repeat(SEARCH_MIN_CHARS)

    expect(isSearchTooShort(query)).toBe(false)
    expect(isSearchActive(query)).toBe(true)
    expect(isSearchApiReady(query)).toBe(true)
  })

  it('ignores surrounding whitespace when measuring length', () => {
    expect(isSearchTooShort(' a ')).toBe(true)
    expect(isSearchActive(' bi ')).toBe(true)
    expect(isSearchApiReady(' pick ')).toBe(true)
  })

  it('keeps an empty box inactive and without a hint', () => {
    expect(isSearchTooShort('')).toBe(false)
    expect(isSearchTooShort('   ')).toBe(false)
    expect(isSearchActive('')).toBe(false)
  })

  it('builds the min-character hint from the given minimum', () => {
    expect(searchMinCharsMessage()).toBe(
      `Type ${SEARCH_MIN_CHARS} or more characters to search`,
    )

    expect(searchMinCharsMessage(SEARCH_API_MIN_CHARS)).toBe(
      `Type ${SEARCH_API_MIN_CHARS} or more characters to search`,
    )
  })

  it('matches catalog text case-insensitively', () => {
    expect(matchesSearchQuery('Garlic Pickle', 'gar')).toBe(true)
    expect(matchesSearchQuery('Garlic Pickle', 'xyz')).toBe(false)
  })
})