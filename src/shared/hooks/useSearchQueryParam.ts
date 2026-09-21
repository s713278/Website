import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  isSearchOpenRequested,
  readSearchQuery,
  SEARCH_OPEN_PARAM,
} from '@/shared/lib/search-query'

/** URL `?q=` / `?search=1` sync for shareable search. Does not trim mid-typing — callers should debounce. */
export function useSearchQueryParam() {
  const [params, setParams] = useSearchParams()
  const query = readSearchQuery(params.toString())
  const searchRequested = isSearchOpenRequested(params.toString())

  const setQuery = useCallback(
    (next: string) => {
      setParams(
        (prev) => {
          const updated = new URLSearchParams(prev)
          if (next.trim()) {
            updated.set('q', next.trim())
            updated.delete(SEARCH_OPEN_PARAM)
          } else {
            updated.delete('q')
            updated.delete(SEARCH_OPEN_PARAM)
          }
          return updated
        },
        { replace: true },
      )
    },
    [setParams],
  )

  return { query, setQuery, searchRequested }
}
