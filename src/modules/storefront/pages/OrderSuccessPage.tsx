import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Check, Copy, ShieldCheck } from 'lucide-react'
import { ordersService, type CustomerOrder } from '@/shared/api'
import { StorePageFooter } from '@/modules/storefront/components/StorePageFooter'
import { StorePageStates } from '@/modules/storefront/components/StorePageStates'
import { StorefrontHeader } from '@/modules/storefront/components/StorefrontHeader'
import { useStorePage } from '@/modules/storefront/hooks/useStorePage'
import { storeCartPath, storePath } from '@/modules/storefront/lib/store-paths'
import { Button } from '@/shared/components'
import { formatCurrency } from '@/shared/lib/utils'
import { useAuthStore } from '@/shared/auth/store/auth-store'

type SuccessState = {
  storeName?: string
  deliverySlot?: string
  whatsappMessage?: string
}

export function OrderSuccessPage() {
  const { storeId = 'r1', orderId = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const state = (location.state as SuccessState | null) ?? {}
  const { store, loading, error, wrapperRef } = useStorePage(storeId)

  const [order, setOrder] = useState<CustomerOrder | null>(null)
  const [orderLoading, setOrderLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const user = useAuthStore((s) => s.user)
  
  useEffect(() => {
    if (!orderId) return
    let cancelled = false
    void ordersService
      .listMyOrders(user?.id)
      .then((orders) => {
        if (cancelled) return
        setOrder(orders.find((entry) => entry.id === orderId) ?? null)
      })
      .finally(() => {
        if (!cancelled) setOrderLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [orderId,user?.id])

  if (!orderId) return <Navigate to="/orders" replace />

  const storeName = state.storeName ?? store?.name ?? order?.storeName ?? 'Store'
  const deliverySlot = state.deliverySlot ?? '6 PM - 9 PM'

  async function copyOrderId() {
    try {
      await navigator.clipboard.writeText(orderId)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }

  return (
    <StorePageStates
      wrapperRef={wrapperRef}
      loading={loading || orderLoading}
      error={error}
      ready={Boolean(store)}
      loadingLabel="Loading order…"
      emptyTitle="Store not found"
      emptyDescription="This store may be offline."
      backHref={storePath(storeId)}
    >
      {store ? (
        <>
          <StorefrontHeader
            storeName={store.name}
            logoUrl={store.theme?.logoImage}
            cartCount={0}
            cartHref={storeCartPath(store.id)}
            searchOpen={false}
            onToggleSearch={() => navigate(storePath(store.id))}
            pageTitle="Order placed"
            onBack={() => navigate('/orders')}
          />

          <main className="store-shell-inner flex-1 py-8 sm:py-10">
            <div className="mx-auto max-w-lg rounded-3xl border border-slate-100 bg-white px-6 py-10 text-center shadow-sm sm:px-10">
              <span className="mx-auto inline-flex size-16 items-center justify-center rounded-full bg-[var(--store-theme-soft,rgba(16,185,129,0.14))] text-[var(--store-theme,var(--md-green-700))]">
                <Check className="size-8" strokeWidth={2.5} aria-hidden />
              </span>
              <h1 className="mt-5 text-2xl font-bold text-slate-900">Order placed!</h1>
              <p className="mt-2 text-sm text-slate-600">Thank you for shopping with {storeName}.</p>

              <div className="mx-auto mt-6 rounded-2xl border border-slate-100 bg-[var(--store-theme-soft,rgba(16,185,129,0.08))] px-5 py-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Order ID</p>
                <div className="mt-2 flex items-center justify-center gap-2">
                  <p className="min-w-0 break-all text-lg font-bold tracking-wide text-slate-900 sm:text-xl">
                    {orderId}
                  </p>
                  <button
                    type="button"
                    onClick={() => void copyOrderId()}
                    className="inline-flex size-9 items-center justify-center rounded-full text-slate-500 hover:bg-white hover:text-slate-800"
                    aria-label="Copy order ID"
                  >
                    {copied ? (
                      <Check className="size-4 text-[var(--store-theme,var(--md-green-600))]" />
                    ) : (
                      <Copy className="size-4" />
                    )}
                  </button>
                </div>
                <p className="mt-4 text-sm text-slate-600">
                  Delivery window:{' '}
                  <strong className="text-[var(--store-theme,var(--md-green-700))]">{deliverySlot}</strong>
                </p>
                {order ? (
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    Total: {formatCurrency(order.total)}
                  </p>
                ) : null}
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <Link to={storePath(store.id)}>
                  <Button className="w-full rounded-xl bg-[var(--store-theme,var(--md-green-800))] px-6 text-white hover:opacity-90 sm:w-auto">
                    Continue shopping
                  </Button>
                </Link>
                <Link to="/orders">
                  <Button
                    variant="outline"
                    className="w-full rounded-xl border-[var(--store-theme,var(--md-green-800))] text-[var(--store-theme,var(--md-green-800))] sm:w-auto"
                  >
                    Track order
                  </Button>
                </Link>
              </div>
            </div>

            <div className="mx-auto mt-6 flex max-w-lg items-center gap-3 rounded-2xl bg-[var(--store-theme-soft,rgba(16,185,129,0.14))] px-4 py-3 ring-1 ring-[var(--store-theme-muted,rgba(16,185,129,0.22))]">
              <ShieldCheck className="size-5 shrink-0 text-[var(--store-theme,var(--md-green-700))]" aria-hidden />
              <p className="text-sm text-slate-700">
                <strong className="text-slate-900">Safe. Secure. Reliable.</strong> Your order is on its way.
              </p>
            </div>
          </main>

          <StorePageFooter store={store} />
        </>
      ) : null}
    </StorePageStates>
  )
}
