import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { CheckoutView } from '@/modules/storefront/components/CheckoutView'
import { StorePageStates } from '@/modules/storefront/components/StorePageStates'
import { useStorePage } from '@/modules/storefront/hooks/useStorePage'
import { storeCartPath, storeCheckoutPath } from '@/modules/storefront/lib/store-paths'
import { useCartStore } from '@/modules/storefront/store/cart-store'

/** Store checkout at `/stores/:storeId/checkout`. `/checkout` redirects here. */
export function CheckoutPage() {
  const { storeId: paramStoreId } = useParams()
  const lines = useCartStore((s) => s.lines)
  const storeId = paramStoreId || lines[0]?.storeId

  if (!storeId) return <Navigate to="/cart" replace />
  if (!paramStoreId) return <Navigate to={storeCheckoutPath(storeId)} replace />

  return <CheckoutForStore storeId={storeId} />
}

function CheckoutForStore({ storeId }: { storeId: string }) {
  const navigate = useNavigate()
  const lines = useCartStore((s) => s.lines)
  const itemCount = useCartStore((s) => s.itemCount(storeId))
  const { store, loading, error, wrapperRef } = useStorePage(storeId)
  const storeLines = lines.filter((line) => line.storeId === storeId)

  if (!loading && storeLines.length === 0) {
    return <Navigate to={storeCartPath(storeId)} replace />
  }

  return (
    <StorePageStates
      wrapperRef={wrapperRef}
      loading={loading}
      error={error}
      ready={Boolean(store)}
      loadingLabel="Loading checkout…"
      emptyTitle="Store not found"
      emptyDescription="This store may be offline."
      backHref={storeCartPath(storeId)}
      backLabel="Back to cart"
    >
      {store ? (
        <CheckoutView
          store={store}
          lines={storeLines}
          cartCount={itemCount}
          onBack={() => navigate(storeCartPath(store.id))}
        />
      ) : null}
    </StorePageStates>
  )
}
