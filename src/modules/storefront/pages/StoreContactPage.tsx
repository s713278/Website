import { Navigate, useParams } from 'react-router-dom'
import { Phone } from 'lucide-react'
import {
  StoreContactBlock,
  StorePageFooter,
  StorePageStates,
  StorefrontHeader,
} from '@/modules/storefront/components'
import { StoreSubscriptionNotice } from '@/modules/storefront/components/StoreSubscriptionNotice'
import { useStorePage } from '@/modules/storefront/hooks/useStorePage'
import { hasStoreContactFacts } from '@/modules/storefront/lib/store-contact'
import { storePath } from '@/modules/storefront/lib/store-paths'
import { isStoreClosedForSubscription } from '@/modules/storefront/lib/store-subscription'
import { useCartStore } from '@/modules/storefront/store/cart-store'

export function StoreContactPage() {
  const { storeId = '' } = useParams()
  const itemCount = useCartStore((s) => s.itemCount(storeId))
  const { store, loading, error, wrapperRef } = useStorePage(storeId, { network: 'cache-first' })
  const shopClosed = Boolean(store && isStoreClosedForSubscription(store.subscriptionStatus))
  const shopHref = storePath(storeId)

  if (store && !shopClosed && !hasStoreContactFacts(store)) {
    return <Navigate to={shopHref} replace />
  }

  return (
    <StorePageStates
      wrapperRef={wrapperRef}
      loading={loading}
      error={error}
      ready={Boolean(store)}
      loadingLabel="Loading contact…"
      emptyTitle="Store not found"
      emptyDescription="This store may be offline."
      backHref="/stores"
      backLabel="Browse stores"
    >
      {shopClosed && store ? (
        <StoreSubscriptionNotice store={store} />
      ) : store ? (
        <>
          <StorefrontHeader store={store} cartCount={itemCount} />

          <main className="relative flex-1 overflow-hidden bg-[#f7fcf9]">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[19rem] bg-[#e8f6ee] sm:h-[21rem]" />
            <div className="pointer-events-none absolute inset-x-0 top-[16rem] h-32 bg-[linear-gradient(180deg,#e8f6ee,#f7fcf9)] sm:top-[18rem]" />

            <section className="store-shell-inner relative pb-16 pt-8 sm:pb-20 sm:pt-10">
              <div className="max-w-xl">
                <p className="inline-flex items-center gap-1.5 rounded-full bg-white/85 px-3 py-1 text-xs font-semibold text-emerald-700 shadow-sm ring-1 ring-emerald-100/80">
                  <Phone className="size-3.5" strokeWidth={2.25} aria-hidden />
                  Get in touch
                </p>
                <h1 className="font-display mt-4 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
                  Contact us
                </h1>
                <p className="mt-3 max-w-md text-[15px] leading-relaxed text-slate-500 sm:text-base">
                  We&apos;re here to help! Find our store or message us on WhatsApp.
                </p>
              </div>
            </section>

            <div className="store-shell-inner relative -mt-10 pb-10 sm:-mt-14 sm:pb-14">
              <StoreContactBlock store={store} />
            </div>
          </main>

          <StorePageFooter store={store} />
        </>
      ) : null}
    </StorePageStates>
  )
}
