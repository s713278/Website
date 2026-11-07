import { useEffect, useState } from 'react'
import { catalogService, getErrorMessage, isLiveApi } from '@/shared/api'
import type { Product } from '@/modules/storefront/types'
import { listCachedStoreProducts } from '@/modules/storefront/lib/product-catalog-cache'
import {
  isSearchActive,
  isSearchApiReady,
  matchesSearchQuery,
  searchUiMinChars,
} from '@/shared/lib/search-query'

function productMatchesKeyword(product: Product, keyword: string): boolean {
  if (matchesSearchQuery(product.name, keyword)) return true
  if (product.category && matchesSearchQuery(product.category, keyword)) return true
  if (product.description && matchesSearchQuery(product.description, keyword)) return true
  return false
}

function localSkuMatches(storeId: string, keyword: string): Product[] {
  return listCachedStoreProducts(storeId).filter((product) =>
    productMatchesKeyword(product, keyword),
  )
}

export function useStoreSkuSearch(storeId: string, keyword: string) {
  const needle = keyword.trim()
  const active = isSearchActive(needle, searchUiMinChars(isLiveApi()))
  const useApi = isSearchApiReady(needle)
  const [items, setItems] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!active) {
      setItems([])
      setError('')
      setLoading(false)
      return
    }

    const cached = localSkuMatches(storeId, needle)
    if (!useApi) {
      setItems(cached)
      setError('')
      setLoading(false)
      return
    }

    let cancelled = false
    setItems(cached)
    const timer = window.setTimeout(() => {
      setLoading(true)
      setError('')
      void catalogService
        .searchStoreSkus(storeId, needle)
        .then((page) => {
          if (!cancelled) setItems(page.items)
        })
        .catch((err) => {
          if (!cancelled) {
            setItems(cached)
            setError(getErrorMessage(err, 'Could not search products'))
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 300)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [storeId, needle, active, useApi])

  return { active, items, loading, error }
}
