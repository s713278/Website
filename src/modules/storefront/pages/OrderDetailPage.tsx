import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { ordersService, getErrorMessage, type CustomerOrder } from '@/shared/api'
import { StorePageFooter } from '@/modules/storefront/components/StorePageFooter'
import { StorePageStates } from '@/modules/storefront/components/StorePageStates'
import { StorefrontHeader } from '@/modules/storefront/components/StorefrontHeader'
import { useStorePage } from '@/modules/storefront/hooks/useStorePage'
import {
  formatOrderDate,
  orderStatusLabel,
  resolveOrderItemImage,
} from '@/modules/storefront/lib/order-display'
import { storeCartPath, storeOrdersPath, storePath } from '@/modules/storefront/lib/store-paths'
import { useAuthStore } from '@/shared/auth/store/auth-store'
import { EmptyState } from '@/shared/components'
import { formatCurrency } from '@/shared/lib/utils'

export function OrderDetailPage() {
  const { storeId = '', orderId = '' } = useParams()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const { store, loading, error, wrapperRef } = useStorePage(storeId)
  const [order, setOrder] = useState<CustomerOrder | null>(null)
  const [orderLoading, setOrderLoading] = useState(true)
  const [orderError, setOrderError] = useState('')

  useEffect(() => {
    if (!orderId) return
    let cancelled = false
    setOrderLoading(true)
    void ordersService
      .getMyOrder(user?.id, orderId)
      .then((data) => {
        if (cancelled) return
        setOrder(data)
        if (!data) setOrderError('Order not found')
      })
      .catch((err) => {
        if (!cancelled) setOrderError(getErrorMessage(err, 'Could not load this order'))
      })
      .finally(() => {
        if (!cancelled) setOrderLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [orderId, user?.id])

  if (!storeId || !orderId) return <Navigate to="/orders" replace />

  return (
    <StorePageStates
      wrapperRef={wrapperRef}
      loading={loading || orderLoading}
      error={error || orderError}
      ready={Boolean(store && order)}
      loadingLabel="Loading order…"
      emptyTitle={orderError || 'Order not found'}
      emptyDescription="This order may belong to another account."
      backHref={storeOrdersPath(storeId)}
      backLabel="Back to orders"
    >
      {store && order ? (
        <>
          <StorefrontHeader
            storeName={store.name}
            logoUrl={store.theme?.logoImage}
            cartCount={0}
            cartHref={storeCartPath(store.id)}
            searchOpen={false}
            onToggleSearch={() => navigate(storePath(store.id))}
            pageTitle="Order details"
            onBack={() => navigate(storeOrdersPath(store.id))}
            activeNav="orders"
          />

          <main className="store-shell-inner flex-1 py-6 sm:py-8">
            <div className="mx-auto max-w-lg space-y-4">
              <section className="rounded-3xl border border-slate-100 bg-white px-5 py-5 shadow-sm sm:px-6">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Order ID</p>
                <p className="mt-1 break-all text-lg font-bold text-slate-900">{order.id}</p>
                <p className="mt-2 text-sm text-slate-500">
                  {order.storeName} · {formatOrderDate(order.placedAt)}
                </p>
                <p className="mt-3 text-sm font-semibold text-[var(--store-theme,var(--md-green-700))]">
                  {orderStatusLabel(order.status)}
                </p>
              </section>

              <section className="rounded-3xl border border-slate-100 bg-white px-5 py-5 shadow-sm sm:px-6">
                <h2 className="text-sm font-bold text-slate-900">Items</h2>
                {order.items.length === 0 ? (
                  <EmptyState title="No items listed" description="This order has no line items yet." />
                ) : (
                  <ul className="mt-3 divide-y divide-slate-100">
                    {order.items.map((item, index) => {
                      const imageUrl = resolveOrderItemImage(order, item)
                      return (
                        <li key={`${item.itemId ?? item.name}-${index}`} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                          <div className="size-14 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                            {imageUrl ? (
                              <img src={imageUrl} alt="" className="size-full object-cover" />
                            ) : (
                              <div className="flex size-full items-center justify-center text-xl">🛒</div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                            <p className="mt-0.5 text-xs text-slate-500">Qty {item.qty}</p>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
                <div className="mt-4 flex justify-between border-t border-slate-100 pt-4 text-sm font-bold">
                  <span className="text-slate-600">Total</span>
                  <span className="text-[var(--store-theme,var(--md-green-700))]">
                    {formatCurrency(order.total)}
                  </span>
                </div>
              </section>

              <Link
                to={storePath(store.id)}
                className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-[var(--store-theme,var(--md-green-800))] text-sm font-semibold text-white hover:opacity-90"
              >
                Continue shopping
              </Link>
            </div>
          </main>

          <StorePageFooter store={store} />
        </>
      ) : null}
    </StorePageStates>
  )
}
