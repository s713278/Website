import { useEffect, useRef, useState } from 'react'
import { catalogService, getErrorMessage } from '@/shared/api'
import type { Store } from '@/modules/storefront/types'
import { applyStoreTheme, clearStoreTheme } from '@/shared/lib/theme'

/** Load store data and apply vendor theme on a page wrapper. */
export function useStorePage(storeId: string) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [store, setStore] = useState<Store | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    void catalogService
      .getStore(storeId)
      .then((data) => {
        if (cancelled) return
        setStore(data)
        if (!data) setError('Store not found')
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err, 'Could not load store'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [storeId])

  useEffect(() => {
    const root = wrapperRef.current
    if (!store || !root) return
    applyStoreTheme(store.theme, root)
    return () => clearStoreTheme(root)
  }, [store])

  return { store, loading, error, wrapperRef }
}
