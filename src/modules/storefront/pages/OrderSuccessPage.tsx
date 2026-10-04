import { useEffect } from 'react'
import { Link, Navigate, useLocation, useParams } from 'react-router-dom'
import { Check } from 'lucide-react'
import { StorePageFooter } from '@/modules/storefront/components/StorePageFooter'
import { StorefrontHeader } from '@/modules/storefront/components/StorefrontHeader'
import { useStorePage } from '@/modules/storefront/hooks/useStorePage'
import { useCartStore } from '@/modules/storefront/store/cart-store'
import { storeOrderPath, storePath } from '@/modules/storefront/lib/store-paths'

type SuccessState = {
  storeName?: string
}

export function OrderSuccessPage() {
  const { storeId = '', orderId = '' } = useParams()
  const location = useLocation()
  const state = (location.state as SuccessState | null) ?? {}
  const { store, loading, wrapperRef } = useStorePage(storeId, { network: 'cache-first' })
  const itemCount = useCartStore((s) => s.itemCount(storeId))
  const clearVendor = useCartStore((s) => s.clearVendor)

  useEffect(() => {
    if (storeId) clearVendor(storeId)
  }, [storeId, clearVendor])

  const storeName = state.storeName ?? store?.name ?? 'Store'

  if (!storeId || !orderId) return <Navigate to="/orders" replace />

  return (
    <div ref={wrapperRef} className="flex min-h-screen flex-col bg-[var(--store-bg,#f8fafc)]">
      <StorefrontHeader store={store} storeId={storeId} storeName={storeName} storeLoading={loading} cartCount={itemCount} />

      <main className="store-shell-inner flex-1 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:py-5">
        <div className="mx-auto w-full max-w-md text-center sm:max-w-lg sm:rounded-2xl sm:border sm:border-slate-100 sm:bg-white sm:px-6 sm:py-5 sm:shadow-sm">
          <span className="md-pop-in mx-auto inline-flex size-12 items-center justify-center rounded-full border border-emerald-200 bg-[var(--store-theme-soft,rgba(16,185,129,0.16))] text-[var(--store-theme,var(--md-green-700))]">
            <Check className="size-6" strokeWidth={2.5} aria-hidden />
          </span>
          <h1 className="font-display mt-2 text-xl font-bold leading-tight text-slate-900">
            Order Created Successfully!
          </h1>
          <p className="mt-2 text-xs text-slate-500">Order ID</p>
          <p className="mt-0.5 break-all text-lg font-bold tracking-wide text-[var(--store-theme,var(--md-green-800))]">
            {orderId}
          </p>

          <div className="mt-3 flex flex-col items-center">
            <Link
              to={storeOrderPath(storeId, orderId)}
              className="inline-flex min-h-9 items-center px-3 text-sm font-semibold text-[var(--store-theme,var(--md-green-700))] hover:underline"
            >
              View Order Details
            </Link>
            <Link
              to={storePath(storeId)}
              className="inline-flex min-h-9 items-center px-3 text-sm font-medium text-slate-500 hover:text-slate-700"
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      </main>

      {store ? <StorePageFooter store={store} /> : null}
    </div>
  )
}
