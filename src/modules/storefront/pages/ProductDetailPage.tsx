import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ProductDetailPanel } from '@/modules/storefront/components/ProductDetailPanel'
import { StorePageStates } from '@/modules/storefront/components/StorePageStates'
import { useStorePage } from '@/modules/storefront/hooks/useStorePage'
import { storePath } from '@/modules/storefront/lib/store-paths'
import { useCartStore } from '@/modules/storefront/store/cart-store'

export function ProductDetailPage() {
  const { storeId = 'r1', productId = '' } = useParams()
  const navigate = useNavigate()
  const addItem = useCartStore((s) => s.addItem)
  const itemCount = useCartStore((s) => s.itemCount(storeId))
  const { store, loading, error, wrapperRef } = useStorePage(storeId)

  const product = useMemo(
    () => store?.products.find((item) => item.id === productId) ?? null,
    [store, productId],
  )

  const productError = store && !product ? 'Product not found' : error

  return (
    <StorePageStates
      wrapperRef={wrapperRef}
      loading={loading}
      error={productError}
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
          onAdd={(variant, qty) => addItem(store.id, store.name, product, variant, qty)}
          onBack={() => navigate(storePath(store.id))}
          onSearch={() => navigate(`${storePath(store.id)}?q=`)}
        />
      ) : null}
    </StorePageStates>
  )
}
