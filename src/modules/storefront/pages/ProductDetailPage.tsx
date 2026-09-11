import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ProductDetailPanel } from '@/modules/storefront/components/ProductDetailPanel'
import { StorePageStates } from '@/modules/storefront/components/StorePageStates'
import { useStorePage } from '@/modules/storefront/hooks/useStorePage'
import { requestAddToCart } from '@/modules/storefront/lib/request-add-to-cart'
import { storeCartPath, storePath } from '@/modules/storefront/lib/store-paths'
import { useCartStore } from '@/modules/storefront/store/cart-store'
import { useAuthStore } from '@/shared/auth/store/auth-store'

export function ProductDetailPage() {
  const { storeId = 'r1', productId = '' } = useParams()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
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
          onAdd={(variant, qty, options) =>
            requestAddToCart({
              user,
              navigate,
              storeId: store.id,
              storeName: store.name,
              product,
              variant,
              qty,
              returnTo: options?.returnTo ?? storeCartPath(store.id),
            })
          }
          onBack={() => navigate(storePath(store.id))}
          onSearch={() => navigate(storePath(store.id))}
        />
      ) : null}
    </StorePageStates>
  )
}
