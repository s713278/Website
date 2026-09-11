import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ProductDetailPanel } from '@/modules/storefront/components/ProductDetailPanel'
import { StorePageStates } from '@/modules/storefront/components/StorePageStates'
import { useStorePage } from '@/modules/storefront/hooks/useStorePage'
import { storePath } from '@/modules/storefront/lib/store-paths'
import { useCartStore } from '@/modules/storefront/store/cart-store'
import type { Product } from '@/modules/storefront/types'
import { getErrorMessage, getProductSkuDetail } from '@/shared/api'

export function ProductDetailPage() {
  const { storeId = '', productId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const skuId = searchParams.get('sku')?.trim() ?? ''

  const navigate = useNavigate()
  const itemCount = useCartStore((s) => s.itemCount(storeId))

  const { store, loading: storeLoading, error: storeError, wrapperRef } = useStorePage(storeId)

  const [product, setProduct] = useState<Product | null>(null)
  const [productLoading, setProductLoading] = useState(true)
  const [productError, setProductError] = useState('')

  useEffect(() => {
    if (!productId || !skuId) {
      setProduct(null)
      setProductError(productId ? 'Missing pack size (sku).' : 'Missing product.')
      setProductLoading(false)
      return
    }

    let cancelled = false
    setProductLoading(true)
    setProductError('')

    void getProductSkuDetail(productId, skuId)
      .then((data) => {
        if (cancelled) return
        setProduct(data)
        if (!data) setProductError('Product not found')
      })
      .catch((err) => {
        if (!cancelled) {
          setProduct(null)
          setProductError(getErrorMessage(err, 'Could not load product.'))
        }
      })
      .finally(() => {
        if (!cancelled) setProductLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [productId, skuId])

  const loading = storeLoading || productLoading
  const error = storeError || productError

  return (
    <StorePageStates
      wrapperRef={wrapperRef}
      loading={loading}
      error={error}
      ready={Boolean(store && product)}
      loadingLabel="Loading product…"
      emptyTitle="Product not found"
      emptyDescription="This item may no longer be available."
      backHref={storePath(storeId)}
    >
      {store && product ? (
        <ProductDetailPanel
          store={store}
          product={product}
          cartCount={itemCount}
          onBack={() => navigate(storePath(store.id))}
          onSearch={() => navigate(storePath(store.id))}
        />
      ) : null}
    </StorePageStates>
  )
}
