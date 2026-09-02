import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { readSearchQuery } from '@/shared/lib/search-query'

/** URL `?q=` sync for shareable search. Does not trim mid-typing — callers should debounce. */
export function useSearchQueryParam() {
  const [params, setParams] = useSearchParams()
  const query = readSearchQuery(params.toString())

  const setQuery = useCallback(
    (next: string) => {
      setParams(
        (prev) => {
          const updated = new URLSearchParams(prev)
          if (next.trim()) updated.set('q', next.trim())
          else updated.delete('q')
          return updated
        },
        { replace: true },
      )
    },
    [setParams],
  )

  return { query, setQuery }
}
