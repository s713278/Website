import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { readSearchQuery } from '@/shared/lib/search-query'

export function useSearchQueryParam() {
  const [params, setParams] = useSearchParams()
  const query = readSearchQuery(params.toString())

  const setQuery = useCallback(
    (next: string) => {
      setParams(
        (prev) => {
          const updated = new URLSearchParams(prev)
          const trimmed = next.trim()
          if (trimmed) updated.set('q', trimmed)
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
