/** Shared URL search-query helpers — reuse across storefront, vendor, etc. */
export const SEARCH_MIN_CHARS = 2
export const SEARCH_API_MIN_CHARS = 2
export const SEARCH_OPEN_PARAM = 'search'

export function readSearchQuery(search: string): string {
  return new URLSearchParams(search).get('q')?.trim() ?? ''
}

export function isSearchOpenRequested(search: string): boolean {
  const value = new URLSearchParams(search).get(SEARCH_OPEN_PARAM)
  return value === '1' || value === 'true'
}


export function matchesSearchQuery(text: string, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return text.toLowerCase().includes(q)
}

/** Live keyword APIs need 4 characters; demo can match locally from 2. */
export function searchUiMinChars(liveApi: boolean): number {
  return liveApi ? SEARCH_API_MIN_CHARS : SEARCH_MIN_CHARS
}

export function isSearchTooShort(query: string, minChars = SEARCH_MIN_CHARS): boolean {
  const length = query.trim().length
  return length > 0 && length < minChars
}

export function isSearchActive(query: string, minChars = SEARCH_MIN_CHARS): boolean {
  return query.trim().length >= minChars
}

export function isSearchApiReady(query: string): boolean {
  return query.trim().length >= SEARCH_API_MIN_CHARS
}

export function searchMinCharsMessage(minChars = SEARCH_MIN_CHARS): string {
  return `Type ${minChars} or more characters to search`
}
