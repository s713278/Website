import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { CheckoutView } from '@/modules/storefront/components/CheckoutView'
import { StorePageStates } from '@/modules/storefront/components/StorePageStates'
import { StoreSubscriptionNotice } from '@/modules/storefront/components/StoreSubscriptionNotice'
import { useStorePage } from '@/modules/storefront/hooks/useStorePage'
import { storeCartPath, storeCheckoutPath } from '@/modules/storefront/lib/store-paths'
import { isStoreClosedForSubscription } from '@/modules/storefront/lib/store-subscription'
import { useCartStore } from '@/modules/storefront/store/cart-store'
import { catalogService, type StorefrontCheckoutOptions } from '@/shared/api'

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
  // Prefer session cache for chrome/theme; checkout-specific config comes from checkout_options.
  const { store, loading, error, wrapperRef } = useStorePage(storeId, { network: 'cache-first' })
  const storeClosed = store ? isStoreClosedForSubscription(store.subscriptionStatus) : false
  const [checkoutOptions, setCheckoutOptions] = useState<StorefrontCheckoutOptions | null>(null)
  const [optionsLoading, setOptionsLoading] = useState(true)
  const [checkoutUnavailable, setCheckoutUnavailable] = useState(false)
  const storeLines = lines.filter((line) => line.storeId === storeId)

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

  if (!loading && !optionsLoading && storeLines.length === 0) {
    return <Navigate to={storeCartPath(storeId)} replace />
  }

  const pageLoading = loading || optionsLoading

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
