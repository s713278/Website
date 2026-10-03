import { useEffect, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import {
  StoreContactBlock,
  StorePageStates,
  StorefrontFooter,
  StorefrontHeader,
} from '@/modules/storefront/components'
import { StoreSubscriptionNotice } from '@/modules/storefront/components/StoreSubscriptionNotice'
import { useStorePage } from '@/modules/storefront/hooks/useStorePage'
import { storePath } from '@/modules/storefront/lib/store-paths'
import { isStoreClosedForSubscription } from '@/modules/storefront/lib/store-subscription'
import { useCartStore } from '@/modules/storefront/store/cart-store'
import { catalogService, getErrorMessage, hasStoreContactContent, type StoreContact } from '@/shared/api'

export function StoreContactPage() {
  const { storeId = '' } = useParams()
  const itemCount = useCartStore((s) => s.itemCount(storeId))
  const { store, loading: storeLoading, wrapperRef } = useStorePage(storeId, { network: 'cache-first' })
  const [contact, setContact] = useState<StoreContact | null>(null)
  const [contactLoading, setContactLoading] = useState(true)
  const [contactError, setContactError] = useState('')
  const shopClosed = Boolean(store && isStoreClosedForSubscription(store.subscriptionStatus))

  useEffect(() => {
    if (shopClosed) {
      setContactLoading(false)
      return
    }

    let cancelled = false
    setContact(null)
    setContactError('')
    setContactLoading(true)

    void catalogService
      .getStoreContact(storeId)
      .then((data) => {
        if (!cancelled) setContact(data)
      })
      .catch((err) => {
        if (!cancelled) setContactError(getErrorMessage(err, 'Could not load contact details'))
      })
      .finally(() => {
        if (!cancelled) setContactLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [storeId, shopClosed])

  const shown = hasStoreContactContent(contact) ? contact : null
  const shopHref = storePath(storeId)

  if (!shopClosed && !contactLoading && !contactError && !shown) {
    return <Navigate to={shopHref} replace />
  }

  return (
    <StorePageStates
      wrapperRef={wrapperRef}
      loading={contactLoading || storeLoading}
      error={shown ? '' : contactError}
      ready={shopClosed || Boolean(shown)}
      loadingLabel="Loading contact…"
      emptyTitle="Contact details unavailable"
      emptyDescription="This shop has not published contact details."
      backHref={shopHref}
      backLabel="Back to store"
    >
      {shopClosed && store ? (
        <StoreSubscriptionNotice store={store} />
      ) : shown ? (
        <>
          <StorefrontHeader
            store={store}
            storeId={storeId}
            storeName={shown.businessName}
            cartCount={itemCount}
          />
          <main className="flex-1 bg-[#f3faf6]">
            <div className="store-shell-inner py-6 sm:py-8">
              <StoreContactBlock contact={shown} />
            </div>
          </main>
          <StorefrontFooter
            storeName={shown.businessName}
            logoUrl={store?.theme?.logoImage}
            location={[shown.mainAddress?.city, shown.mainAddress?.state].filter(Boolean).join(', ') || undefined}
          />
        </>
      ) : null}
    </StorePageStates>
  )
}
