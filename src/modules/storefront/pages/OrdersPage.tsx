import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { ShieldCheck, ShoppingBag } from 'lucide-react'
import { OrderCard } from '@/modules/storefront/components/OrderCard'
import { StorePageFooter } from '@/modules/storefront/components/StorePageFooter'
import { StorefrontHeader } from '@/modules/storefront/components/StorefrontHeader'
import { peekLastCachedStoreId, useStorePage } from '@/modules/storefront/hooks/useStorePage'
import {
  collectStoreOrdersFromPages,
  mergeOrderPages,
} from '@/modules/storefront/lib/orders-history'
import { customerLoginLink } from '@/modules/storefront/lib/cart-nav'
import { canShopAsCustomer } from '@/modules/storefront/lib/request-add-to-cart'
import { storeCartPath, storeOrdersPath, storePath, storeSearchPath } from '@/modules/storefront/lib/store-paths'
import { useCartStore } from '@/modules/storefront/store/cart-store'
import { ordersService, getErrorMessage, type CustomerOrder } from '@/shared/api'
import { useAuthStore } from '@/shared/auth/store/auth-store'
import { Button, EmptyState, Spinner } from '@/shared/components'

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
  const { store, wrapperRef } = useStorePage(storeId, { network: 'cache-only' })
  const [orders, setOrders] = useState<CustomerOrder[]>([])
  const [apiPage, setApiPage] = useState(0)
  const [lastPage, setLastPage] = useState(true)
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [ordersError, setOrdersError] = useState('')
  const [moreError, setMoreError] = useState('')
  const sentinelRef = useRef<HTMLDivElement>(null)
  const loadMoreLock = useRef(false)

  useEffect(() => {
    let cancelled = false
    setOrders([])
    setApiPage(0)
    setLastPage(true)
    setOrdersError('')
    setMoreError('')
    loadMoreLock.current = false
    if (!canShopAsCustomer(user)) {
      setOrdersLoading(false)
      return () => {
        cancelled = true
      }
    }
    setOrdersLoading(true)
    void collectStoreOrdersFromPages({
      storeId,
      startPage: 0,
      fetchPage: (page) => ordersService.listMyOrdersPage(user?.id, page),
      isCancelled: () => cancelled,
    })
      .then((snap) => {
        if (cancelled) return
        setOrders(snap.orders)
        setApiPage(snap.pageNumber)
        setLastPage(snap.lastPage)
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
  }, [storeId, user])

  const loadMore = useCallback(async () => {
    if (loadMoreLock.current || loadingMore || lastPage || ordersLoading) return
    loadMoreLock.current = true
    setLoadingMore(true)
    setMoreError('')
    try {
      const snap = await collectStoreOrdersFromPages({
        storeId,
        startPage: apiPage + 1,
        fetchPage: (page) => ordersService.listMyOrdersPage(user?.id, page),
      })
      setOrders((current) => mergeOrderPages(current, snap.orders))
      setApiPage(snap.pageNumber)
      setLastPage(snap.lastPage)
    } catch (err) {
      setMoreError(getErrorMessage(err, 'Could not load more orders'))
    } finally {
      loadMoreLock.current = false
      setLoadingMore(false)
    }
  }, [apiPage, lastPage, loadingMore, ordersLoading, storeId, user?.id])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (
      !sentinel ||
      lastPage ||
      ordersLoading ||
      orders.length === 0 ||
      moreError ||
      typeof IntersectionObserver === 'undefined'
    ) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore()
      },
      { root: null, rootMargin: '200px 0px', threshold: 0 },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [lastPage, loadMore, moreError, orders.length, ordersLoading])

  const visible = orders

  const shopName = store?.name ?? visible[0]?.storeName ?? 'this shop'
  const signedIn = canShopAsCustomer(user)
  const login = customerLoginLink(storeOrdersPath(storeId), {
    name: store?.name ?? shopName,
    logoUrl: store?.theme?.logoImage,
  })

  return (
    <div ref={wrapperRef} className="flex min-h-screen flex-col bg-[var(--store-bg,#f8fafc)]">
      <StorefrontHeader
        storeName={store?.name ?? shopName}
        logoUrl={store?.theme?.logoImage}
        cartHref={storeCartPath(storeId)}
        searchOpen={false}
        onToggleSearch={() => navigate(storeSearchPath(storeId))}
        pageTitle="My orders"
        onBack={() => navigate(storePath(storeId))}
      />

      <main className="store-shell-inner flex-1 py-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:py-8">
        <div className="mx-auto w-full max-w-3xl">
          <header className="mb-5 sm:mb-6">
            <div className="flex items-start gap-3">
              <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--store-theme-soft,rgba(16,185,129,0.14))] text-[var(--store-theme,var(--md-green-700))] sm:size-11">
                <ShoppingBag className="size-5" strokeWidth={2} aria-hidden />
              </span>
              <div className="min-w-0">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl lg:text-3xl">
                  Your orders
                </h1>
                <p className="mt-1 text-sm text-slate-500">Track orders from {shopName}</p>
              </div>
            </div>
          </header>

          {!signedIn ? (
            <EmptyState
              title="Sign in to see your orders"
              description="Use the Sign in button in the header to view orders from this shop."
              action={
                <Link to={login.to} state={login.state}>
                  <Button>Sign in</Button>
                </Link>
              }
            />
          ) : ordersLoading ? (
            <div className="py-16">
              <Spinner label="Loading orders…" />
            </div>
          ) : ordersError ? (
            <EmptyState title="Could not load orders" description={ordersError} />
          ) : visible.length === 0 ? (
            <EmptyState
              title="No orders yet"
              description="Your orders will show up here after checkout."
              action={
                <Link to={storePath(storeId)}>
                  <Button>Browse store</Button>
                </Link>
              }
            />
          ) : (
            <div className="space-y-4">
              {visible.map((order) => (
                <OrderCard key={order.id} order={order} storeId={storeId} />
              ))}
              {moreError ? (
                <div className="flex flex-col items-center gap-2 pt-1">
                  <p className="text-center text-sm text-red-600">{moreError}</p>
                  <Button type="button" variant="outline" size="sm" onClick={() => void loadMore()}>
                    Try again
                  </Button>
                </div>
              ) : !lastPage ? (
                <div
                  ref={sentinelRef}
                  className="flex justify-center py-3"
                  aria-hidden={loadingMore ? undefined : true}
                >
                  {loadingMore ? <Spinner label="Loading more orders…" /> : <span className="h-8" />}
                </div>
              ) : null}
            </div>
          )}

          {visible.length > 0 ? (
            <div className="mt-6 flex items-start gap-3 rounded-2xl bg-[var(--store-theme-soft,rgba(16,185,129,0.14))] px-4 py-3.5 ring-1 ring-[var(--store-theme-muted,rgba(16,185,129,0.22))] sm:mt-8 sm:items-center sm:gap-4 sm:px-5 sm:py-4">
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-[var(--store-theme,var(--md-green-700))] shadow-sm sm:size-10">
                <ShieldCheck className="size-5" strokeWidth={2} aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="font-semibold text-slate-900">Safe. Secure. Reliable.</p>
                <p className="text-sm text-slate-600">Your orders are protected and delivered with care.</p>
              </div>
            </div>
          ) : null}
        </div>
      </main>

      {store ? <StorePageFooter store={store} /> : null}
    </div>
  )
}
