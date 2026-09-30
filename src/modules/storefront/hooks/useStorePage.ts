import { useEffect, useRef, useState } from 'react'
import { catalogService, getErrorMessage } from '@/shared/api'
import type { Store } from '@/modules/storefront/types'
import { applyStoreTheme, clearStoreTheme } from '@/shared/lib/theme'

/** Session cache so back-nav to store/cart is instant (Blinkit-style). */
const storeCache = new Map<string, Store>()
let lastCachedStoreId: string | null = null

/** A store already loaded this session, e.g. for the login screen's shop name and logo. */
export function getCachedStore(storeId: string): Store | null {
  return storeCache.get(storeId) ?? null
}

/** The store most recently loaded this session, for routes that carry no store id. */
export function peekLastCachedStoreId(): string | null {
  return lastCachedStoreId
}

/**
 * `network` (default): always read the storefront. `cache-first`: read it only on a cache miss.
 * `cache-only`: never read it; chrome shows only a cached store.
 */
export type StorePageNetwork = 'network' | 'cache-first' | 'cache-only'

/** Load store data and apply vendor theme on a page wrapper. */
export function useStorePage(storeId: string, { network = 'network' }: { network?: StorePageNetwork } = {}) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const cached = storeCache.get(storeId) ?? null
  const [store, setStore] = useState<Store | null>(cached)
  const [loading, setLoading] = useState(!cached && network !== 'cache-only')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const hit = storeCache.get(storeId)
    setStore(hit ?? null)
    setError('')
    if (network === 'cache-only' || (hit && network === 'cache-first')) {
      setLoading(false)
      return
    }
    setLoading(!hit)

    void catalogService
      .getStore(storeId)
      .then((data) => {
        if (cancelled) return
        if (data) {
          storeCache.set(storeId, data)
          lastCachedStoreId = storeId
        }
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
  }, [storeId, network])

  useEffect(() => {
    const root = wrapperRef.current
    if (!store || !root) return
    applyStoreTheme(store.theme, root)
    return () => clearStoreTheme(root)
  }, [store])

  return { store, loading, error, wrapperRef }
}
