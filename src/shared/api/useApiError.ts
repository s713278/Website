import { useCallback, useState } from 'react'
import { getErrorMessage } from '@mithra/api-client'

/**
 * Uniform feature error hook (no React Query in this app).
 * Optional for pages — mapping already happens in api-client via toApiError/getErrorMessage.
 */
export function useApiError(defaultFallback = 'Something went wrong. Please try again.') {
  const [error, setError] = useState('')
  const capture = useCallback(
    (err: unknown, fallback = defaultFallback) => {
      setError(getErrorMessage(err, fallback))
    },
    [defaultFallback],
  )
  const clear = useCallback(() => setError(''), [])
  return { error, setError, capture, clear }
}
