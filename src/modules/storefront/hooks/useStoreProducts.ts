import { useCallback, useEffect, useRef, useState } from 'react'
import { catalogService, getErrorMessage, isApiError } from '@/shared/api'
import type { Product } from '@/modules/storefront/types'
import {
  ALL_CATEGORY,
  type CategoryFilter,
} from '@/modules/storefront/lib/catalog-filters'
import {
  claimStoreCatalogWarm,
  mergeStoreProducts,
  peekCategoryProducts,
  releaseStoreCatalogWarm,
} from '@/modules/storefront/lib/product-catalog-cache'

type Options = {
  pageSize?: number
  categoryFilter?: CategoryFilter
  enabled?: boolean
}

/** Fills cache for later category taps — runs after the first successful page load. */
const WARM_PAGE_SIZE = 100
const TRANSIENT_RETRY_MS = 800

function isTransientError(error: unknown) {
  return isApiError(error) && (error.kind === 'network' || error.kind === 'timeout')
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Paginated storefront products for one store.
 *
 * Flow:
 * 1. fetchPage(0) on mount / category change → peek cache first, then API replaces grid
 * 2. After first success → warm once (up to 100) into session cache for instant category taps
 * 3. loadMore() → append next page (browse mode)
 *
 * Transient network/timeout failures retry once (common when the API host is waking up).
 */
export function useStoreProducts(storeId: string, options: Options = {}) {
  const pageSize = options.pageSize ?? 10
  const categoryFilter =
    options.categoryFilter && options.categoryFilter !== ALL_CATEGORY
      ? options.categoryFilter
      : undefined
  const enabled = options.enabled !== false

  const [items, setItems] = useState<Product[]>(() =>
    enabled ? peekCategoryProducts(storeId, categoryFilter, pageSize) : [],
  )
  const [loading, setLoading] = useState(enabled)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastPage, setLastPage] = useState(true)
  const [totalElements, setTotalElements] = useState(0)
  const [nextPage, setNextPage] = useState(0)

  const requestId = useRef(0)
  const categoryRef = useRef(categoryFilter)
  categoryRef.current = categoryFilter

  const warmCatalog = useCallback(
    (id: string) => {
      if (!id || !claimStoreCatalogWarm(id)) return
      void catalogService
        .listStoreProducts(id, { pageNumber: 0, pageSize: WARM_PAGE_SIZE })
        .then((page) => {
          mergeStoreProducts(id, page.items)
          const peeked = peekCategoryProducts(id, categoryRef.current, pageSize)
          if (peeked.length) setItems((prev) => (prev.length ? prev : peeked))
        })
        .catch(() => {
          releaseStoreCatalogWarm(id)
        })
    },
    [pageSize],
  )

  const fetchPage = useCallback(
    async (pageNumber: number, mode: 'replace' | 'append') => {
      if (!enabled || !storeId) return
      const id = ++requestId.current

      if (mode === 'replace') {
        setItems(peekCategoryProducts(storeId, categoryFilter, pageSize))
        setLoading(true)
        setError(null)
      } else {
        setLoadingMore(true)
      }

      const finish = () => {
        if (id !== requestId.current) return
        setLoading(false)
        setLoadingMore(false)
      }

      const run = async (attempt: number): Promise<void> => {
        try {
          const page = await catalogService.listStoreProducts(storeId, {
            pageNumber,
            pageSize,
            categoryFilter,
          })
          if (id !== requestId.current) return

          mergeStoreProducts(storeId, page.items)
          setItems((prev) => (mode === 'replace' ? page.items : [...prev, ...page.items]))
          setLastPage(page.lastPage)
          setTotalElements(page.totalElements)
          setNextPage(pageNumber + 1)
          setError(null)
          finish()
          if (mode === 'replace') warmCatalog(storeId)
        } catch (err) {
          if (id !== requestId.current) return

          if (attempt < 1 && isTransientError(err)) {
            await wait(TRANSIENT_RETRY_MS)
            if (id !== requestId.current) return
            return run(attempt + 1)
          }

          setError(getErrorMessage(err))
          if (mode === 'replace' && peekCategoryProducts(storeId, categoryFilter, pageSize).length === 0) {
            setItems([])
            setLastPage(true)
            setTotalElements(0)
            setNextPage(0)
          }
          finish()
        }
      }

      await run(0)
    },
    [categoryFilter, enabled, pageSize, storeId, warmCatalog],
  )

  const reload = useCallback(() => {
    setNextPage(0)
    void fetchPage(0, 'replace')
  }, [fetchPage])

  const loadMore = useCallback(() => {
    if (!enabled || lastPage || loading || loadingMore) return
    void fetchPage(nextPage, 'append')
  }, [enabled, fetchPage, lastPage, loading, loadingMore, nextPage])

  useEffect(() => {
    if (!enabled) {
      setItems([])
      setLoading(false)
      setLoadingMore(false)
      setError(null)
      setLastPage(true)
      setTotalElements(0)
      setNextPage(0)
      return
    }
    reload()
    return () => {
      requestId.current += 1
    }
  }, [enabled, reload])

  return {
    items,
    loading: loading && items.length === 0,
    loadingMore,
    error,
    lastPage,
    totalElements,
    loadMore,
    reload,
  }
}
