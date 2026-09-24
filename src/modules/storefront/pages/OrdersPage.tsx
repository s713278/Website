import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { Package, ShieldCheck, ShoppingBag } from 'lucide-react'
import { OrderCard } from '@/modules/storefront/components/OrderCard'
import { StorePageFooter } from '@/modules/storefront/components/StorePageFooter'
import { StorePageStates } from '@/modules/storefront/components/StorePageStates'
import { StorefrontHeader } from '@/modules/storefront/components/StorefrontHeader'
import { peekLastCachedStoreId, useStorePage } from '@/modules/storefront/hooks/useStorePage'
import { isPastOrder } from '@/modules/storefront/lib/order-display'
import { storeCartPath, storeOrdersPath, storePath } from '@/modules/storefront/lib/store-paths'
import { useCartStore } from '@/modules/storefront/store/cart-store'
import { ordersService, getErrorMessage } from '@/shared/api'
import { useAuthStore } from '@/shared/auth/store/auth-store'
import { Button, EmptyState } from '@/shared/components'
import { cn } from '@/lib/utils'

type OrdersTab = 'all' | 'past'

export function OrdersPage() {
  const { storeId: paramStoreId } = useParams()
  const cartStoreId = useCartStore((s) => s.lines[0]?.storeId)
  const storeId = paramStoreId || cartStoreId || peekLastCachedStoreId()

  if (!storeId) return <Navigate to="/stores" replace />
  if (!paramStoreId) return <Navigate to={storeOrdersPath(storeId)} replace />

  return <StoreOrders storeId={storeId} />
}

function StoreOrders({ storeId }: { storeId: string }) {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const { store, loading, error, wrapperRef } = useStorePage(storeId)
  const [orders, setOrders] = useState<Awaited<ReturnType<typeof ordersService.listMyOrders>>>([])
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [ordersError, setOrdersError] = useState('')
  const [tab, setTab] = useState<OrdersTab>('all')

  useEffect(() => {
    let cancelled = false
    setOrdersLoading(true)
    void ordersService
      .listMyOrders(user?.id)
      .then((data) => {
        if (!cancelled) setOrders(data)
      })
      .catch((err) => {
        if (!cancelled) setOrdersError(getErrorMessage(err, 'Could not load orders'))
      })
      .finally(() => {
        if (!cancelled) setOrdersLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [user?.id])

  const visible = useMemo(
    () =>
      orders.filter((order) => {
        if (tab === 'past' && !isPastOrder(order.status)) return false
        if (order.storeId && order.storeId !== storeId) return false
        return true
      }),
    [orders, tab, storeId],
  )

  return (
    <StorePageStates
      wrapperRef={wrapperRef}
      loading={loading || ordersLoading}
      error={error || ordersError}
      ready={Boolean(store)}
      loadingLabel="Loading orders…"
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
            pageTitle="My orders"
            onBack={() => navigate(storePath(store.id))}
            activeNav="orders"
          />

          <main className="store-shell-inner flex-1 py-6 sm:py-8">
            <div className="mx-auto max-w-3xl">
              <header className="mb-6">
                <div className="flex items-start gap-3">
                  <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-[var(--store-theme-soft,rgba(16,185,129,0.14))] text-[var(--store-theme,var(--md-green-700))]">
                    <ShoppingBag className="size-5" strokeWidth={2} aria-hidden />
                  </span>
                  <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                      Your orders
                    </h1>
                    <p className="mt-1 text-sm text-slate-500">Track orders from {store.name}</p>
                  </div>
                </div>

                <nav className="mt-5 flex gap-6 border-b border-slate-200" aria-label="Order filters">
                  <TabButton active={tab === 'all'} onClick={() => setTab('all')} icon={Package} label="All Orders" />
                  <TabButton
                    active={tab === 'past'}
                    onClick={() => setTab('past')}
                    icon={ShoppingBag}
                    label="Past Orders"
                  />
                </nav>
              </header>

              {orders.length === 0 ? (
                <EmptyState
                  title="No orders yet"
                  description="Your orders will show up here after checkout."
                  action={
                    <Link to={storePath(store.id)}>
                      <Button>Browse store</Button>
                    </Link>
                  }
                />
              ) : visible.length === 0 ? (
                <EmptyState
                  title={tab === 'past' ? 'No past orders' : 'No orders for this shop'}
                  description={
                    tab === 'past' ? 'Delivered orders will appear here.' : 'Place an order to see it here.'
                  }
                />
              ) : (
                <div className="space-y-4">
                  {visible.map((order) => (
                    <OrderCard key={order.id} order={order} storeId={store.id} />
                  ))}
                </div>
              )}

              {visible.length > 0 ? (
                <div className="mt-8 flex items-center gap-4 rounded-2xl bg-[var(--store-theme-soft,rgba(16,185,129,0.14))] px-5 py-4 ring-1 ring-[var(--store-theme-muted,rgba(16,185,129,0.22))]">
                  <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-[var(--store-theme,var(--md-green-700))] shadow-sm">
                    <ShieldCheck className="size-5" strokeWidth={2} aria-hidden />
                  </span>
                  <div>
                    <p className="font-semibold text-slate-900">Safe. Secure. Reliable.</p>
                    <p className="text-sm text-slate-600">Your orders are protected and delivered with care.</p>
                  </div>
                </div>
              ) : null}
            </div>
          </main>

          <StorePageFooter store={store} />
        </>
      ) : null}
    </StorePageStates>
  )
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: typeof Package
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        '-mb-px inline-flex items-center gap-2 border-b-2 pb-3 text-sm font-semibold transition',
        active
          ? 'border-[var(--store-theme,var(--md-green-700))] text-[var(--store-theme,var(--md-green-700))]'
          : 'border-transparent text-slate-500 hover:text-slate-700',
      )}
    >
      <Icon className="size-4" strokeWidth={2} aria-hidden />
      {label}
    </button>
  )
}
