import { useEffect, useRef, useState } from 'react'
import { catalogService, getErrorMessage } from '@/shared/api'
import type { Store } from '@/modules/storefront/types'
import { applyStoreTheme, clearStoreTheme } from '@/shared/lib/theme'

/** Session cache so back-nav to store/cart is instant (Blinkit-style). */
const storeCache = new Map<string, Store>()

/** Load store data and apply vendor theme on a page wrapper. */
export function useStorePage(storeId: string) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const cached = storeCache.get(storeId) ?? null
  const [store, setStore] = useState<Store | null>(cached)
  const [loading, setLoading] = useState(!cached)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const hit = storeCache.get(storeId)
    if (hit) {
      setStore(hit)
      setLoading(false)
      setError('')
    } else {
      setLoading(true)
      setError('')
    }

    void catalogService
      .getStore(storeId)
      .then((data) => {
        if (cancelled) return
        if (data) storeCache.set(storeId, data)
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
