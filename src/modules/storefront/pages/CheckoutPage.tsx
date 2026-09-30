import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { CheckoutView } from '@/modules/storefront/components/CheckoutView'
import { StorePageStates } from '@/modules/storefront/components/StorePageStates'
import { StoreSubscriptionNotice } from '@/modules/storefront/components/StoreSubscriptionNotice'
import { getCachedStore, useStorePage } from '@/modules/storefront/hooks/useStorePage'
import { syncVendorCart } from '@/modules/storefront/lib/cart-actions'
import { storeCartPath, storeCheckoutPath } from '@/modules/storefront/lib/store-paths'
import { isStoreClosedForSubscription } from '@/modules/storefront/lib/store-subscription'
import { useCartStore } from '@/modules/storefront/store/cart-store'
import { catalogService, type StorefrontCheckoutOptions } from '@/shared/api'
import { useAuthStore } from '@/shared/auth/store/auth-store'

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
  const user = useAuthStore((s) => s.user)
  const lines = useCartStore((s) => s.lines)
  const itemCount = useCartStore((s) => s.itemCount(storeId))
  const { store, loading, error, wrapperRef } = useStorePage(storeId, { network: 'cache-first' })
  const cartHydrated = useRef(false)
  const storeClosed = store ? isStoreClosedForSubscription(store.subscriptionStatus) : false
  const [checkoutOptions, setCheckoutOptions] = useState<StorefrontCheckoutOptions | null>(null)
  const [optionsLoading, setOptionsLoading] = useState(true)
  const [checkoutUnavailable, setCheckoutUnavailable] = useState(false)
  const storeLines = lines.filter((line) => line.storeId === storeId)
  const [cartReady, setCartReady] = useState(() => storeLines.length > 0 || user?.role !== 'customer')

  useEffect(() => {
    if (cartHydrated.current || user?.role !== 'customer') return
    if (storeLines.length > 0) {
      setCartReady(true)
      return
    }
    cartHydrated.current = true
    void syncVendorCart(storeId, getCachedStore(storeId)?.name ?? store?.name ?? '')
      .catch(() => {
        /* empty cart still redirects below */
      })
      .finally(() => setCartReady(true))
  }, [store?.name, storeId, storeLines.length, user?.role])

  useEffect(() => {
    let cancelled = false
    setOptionsLoading(true)
    setCheckoutUnavailable(false)

    void catalogService
      .getStoreCheckoutOptions(storeId)
      .then((options) => {
        if (cancelled) return
        setCheckoutOptions(options)
        setCheckoutUnavailable(false)
      })
      .catch(() => {
        if (cancelled) return
        // Vendor has no delivery config — show customer-friendly empty state (not API copy).
        setCheckoutOptions(null)
        setCheckoutUnavailable(true)
      })
      .finally(() => {
        if (!cancelled) setOptionsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [storeId])

  if (!loading && !optionsLoading && cartReady && storeLines.length === 0) {
    return <Navigate to={storeCartPath(storeId)} replace />
  }

  const pageLoading = loading || optionsLoading || !cartReady

  return (
    <StorePageStates
      wrapperRef={wrapperRef}
      loading={pageLoading}
      error={error}
      ready={Boolean(store)}
      loadingLabel="Loading checkout…"
      emptyTitle="Store not found"
      emptyDescription="This store may be offline."
      backHref={storeCartPath(storeId)}
      backLabel="Back to cart"
    >
      {store && storeClosed ? (
        <StoreSubscriptionNotice store={store} />
      ) : store ? (
        <CheckoutView
          store={store}
          lines={storeLines}
          cartCount={itemCount}
          checkoutOptions={checkoutOptions}
          checkoutUnavailable={checkoutUnavailable}
          onBack={() => navigate(storeCartPath(store.id))}
        />
      ) : null}
    </StorePageStates>
  )
}
