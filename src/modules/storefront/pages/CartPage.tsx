import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ShoppingBag } from 'lucide-react'
import { StoreCartView } from '@/modules/storefront/components/StoreCartView'
import { StorePageStates } from '@/modules/storefront/components/StorePageStates'
import { StoreSubscriptionNotice } from '@/modules/storefront/components/StoreSubscriptionNotice'
import { useStorePage } from '@/modules/storefront/hooks/useStorePage'
import {
  cartActionErrorMessage,
  syncVendorCart,
} from '@/modules/storefront/lib/cart-actions'
import {
  redirectCartUnauthorized,
  requestSetCartQty,
} from '@/modules/storefront/lib/request-add-to-cart'
import { storeCartPath, storePath } from '@/modules/storefront/lib/store-paths'
import { isStoreClosedForSubscription } from '@/modules/storefront/lib/store-subscription'
import { useCartStore } from '@/modules/storefront/store/cart-store'
import { Button } from '@/shared/components'
import { useAuthStore } from '@/shared/auth/store/auth-store'

/** Store cart at `/stores/:storeId/cart`. `/cart` redirects here when the cart has items. */
export function CartPage() {
  const { storeId } = useParams()
  const lines = useCartStore((s) => s.lines)

  if (!storeId) {
    const cartStoreId = lines[0]?.storeId
    if (cartStoreId) return <Navigate to={storeCartPath(cartStoreId)} replace />
    return <EmptyCart />
  }

  return <CartForStore storeId={storeId} />
}

function CartForStore({ storeId }: { storeId: string }) {
  const navigate = useNavigate()
  const location = useLocation()
  const user = useAuthStore((s) => s.user)
  const { store, loading, error, wrapperRef } = useStorePage(storeId, { network: 'cache-first' })
  const storeClosed = store ? isStoreClosedForSubscription(store.subscriptionStatus) : false
  const lines = useCartStore((s) => s.lines)
  const itemCount = useCartStore((s) => s.itemCount(storeId))
  const hydratedRef = useRef(false)
  const hydratedUserId = useRef(user?.id)
  const [pendingQtyIds, setPendingQtyIds] = useState(() => new Set<string>())
  const [removingIds, setRemovingIds] = useState(() => new Set<string>())
  const fromPath = `${location.pathname}${location.search}`

  function markSet(setter: typeof setPendingQtyIds, itemId: string, pending: boolean) {
    setter((prev) => {
      const next = new Set(prev)
      if (pending) next.add(itemId)
      else next.delete(itemId)
      return next
    })
  }

  async function runQtyAction(itemId: string, action: () => Promise<boolean>) {
    markSet(setPendingQtyIds, itemId, true)
    try {
      await action()
    } finally {
      markSet(setPendingQtyIds, itemId, false)
    }
  }

  async function runRemoveAction(itemId: string, action: () => Promise<boolean>) {
    markSet(setRemovingIds, itemId, true)
    try {
      await action()
    } finally {
      markSet(setRemovingIds, itemId, false)
    }
  }

  // Cold-start hydrate once per identity. Do not re-run when the user clears the last item.
  useEffect(() => {
    if (hydratedUserId.current !== user?.id) {
      hydratedRef.current = false
      hydratedUserId.current = user?.id
    }
    if (!store || user?.role !== 'customer') return
    if (storeClosed) return
    if (hydratedRef.current) return
    hydratedRef.current = true
    void syncVendorCart(store.id, store.name).catch((error) => {
      if (redirectCartUnauthorized(error, navigate, fromPath, store.id, store.name)) return
      window.alert(cartActionErrorMessage(error))
    })
  }, [store, storeClosed, user?.id, user?.role, navigate, fromPath])

  return (
    <StorePageStates
      wrapperRef={wrapperRef}
      loading={loading && !store}
      error={error}
      ready={Boolean(store)}
      loadingLabel="Loading cart…"
      emptyTitle="Store not found"
      emptyDescription="This store may be offline."
      backHref={storePath(storeId)}
    >
      {store && storeClosed ? (
        <StoreSubscriptionNotice store={store} />
      ) : store ? (
        <StoreCartView
          store={store}
          lines={lines}
          cartCount={itemCount}
          pendingQtyIds={pendingQtyIds}
          removingIds={removingIds}
          onSetQty={(itemId, qty) => {
            void runQtyAction(itemId, () =>
              requestSetCartQty({
                user,
                navigate,
                storeId: store.id,
                storeName: store.name,
                itemId,
                qty,
                returnTo: fromPath,
                onError: (message) => window.alert(message),
              }),
            )
          }}
          onRemove={(itemId) => {
            void runRemoveAction(itemId, () =>
              requestSetCartQty({
                user,
                navigate,
                storeId: store.id,
                storeName: store.name,
                itemId,
                qty: 0,
                returnTo: fromPath,
                onError: (message) => window.alert(message),
              }),
            )
          }}
          onBack={() => navigate(storePath(store.id))}
        />
      ) : null}
    </StorePageStates>
  )
}

function EmptyCart() {
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <span className="mx-auto inline-flex size-14 items-center justify-center rounded-full bg-slate-100 text-slate-500">
        <ShoppingBag className="size-7" aria-hidden />
      </span>
      <h1 className="mt-4 text-xl font-bold text-slate-900">Your cart is empty</h1>
      <p className="mt-2 text-sm text-slate-600">Add items from a store to get started.</p>
      <Link to="/stores" className="mt-5 inline-block">
        <Button className="rounded-lg px-6">Browse stores</Button>
      </Link>
    </div>
  )
}
