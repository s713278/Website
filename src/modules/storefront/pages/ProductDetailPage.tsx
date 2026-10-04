import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { ProductDetailPanel } from '@/modules/storefront/components/ProductDetailPanel'
import { StorePageStates } from '@/modules/storefront/components/StorePageStates'
import { useStorePage } from '@/modules/storefront/hooks/useStorePage'
import { storePath } from '@/modules/storefront/lib/store-paths'
import { useCartStore } from '@/modules/storefront/store/cart-store'
import type { Product } from '@/modules/storefront/types'
import { StoreSubscriptionNotice } from '@/modules/storefront/components/StoreSubscriptionNotice'
import { isStoreClosedForSubscription } from '@/modules/storefront/lib/store-subscription'
import { getErrorMessage, getStorefrontProduct, isApiError } from '@/shared/api'

export function ProductDetailPage() {
  const { storeId = '', productId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const skuId = searchParams.get('sku')?.trim() ?? ''

  const itemCount = useCartStore((s) => s.itemCount(storeId))

  const { store, loading: storeLoading, error: storeError, wrapperRef } = useStorePage(
    storeId,
    { network: 'cache-first' },
  )
  const shopClosed = Boolean(store && isStoreClosedForSubscription(store.subscriptionStatus))

  const [product, setProduct] = useState<Product | null>(null)
  const [productLoading, setProductLoading] = useState(true)
  const [productError, setProductError] = useState('')

  useEffect(() => {
    if (shopClosed) {
      setProduct(null)
      setProductError('')
      setProductLoading(false)
      return
    }
    if (!storeId || !productId) {
      setProduct(null)
      setProductError('Missing product.')
      setProductLoading(false)
      return
    }

    let cancelled = false
    setProductLoading(true)
    setProductError('')

    void getStorefrontProduct(storeId, productId)
      .then((data) => {
        if (cancelled) return
        setProduct(data)
      })
      .catch((err) => {
        if (cancelled) return
        setProduct(null)
        if (isApiError(err) && err.status === 401) {
          setProductError('This product cannot be loaded right now.')
          return
        }
        setProductError(getErrorMessage(err, 'Could not load product.'))
      })
      .finally(() => {
        if (!cancelled) setProductLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [storeId, productId, shopClosed])
  const loading = shopClosed ? storeLoading : storeLoading || productLoading
  const error = shopClosed ? storeError : storeError || productError

  return (
    <StorePageStates
      wrapperRef={wrapperRef}
      loading={loading}
      error={error}
      ready={shopClosed || Boolean(store && product)}
      loadingLabel="Loading product…"
      emptyTitle="Product unavailable"
      emptyDescription="This product is not available."
      backHref={storePath(storeId)}
    >
      {shopClosed && store ? (
        <StoreSubscriptionNotice store={store} />
      ) : store && product ? (
        <ProductDetailPanel
          store={store}
          product={product}
          cartCount={itemCount}
          preferredSkuId={skuId || undefined}
        />
      ) : null}
    </StorePageStates>
  )
}
