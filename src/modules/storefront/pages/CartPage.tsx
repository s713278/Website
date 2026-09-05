import { useEffect } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { ShoppingBag } from 'lucide-react'
import { StoreCartView } from '@/modules/storefront/components/StoreCartView'
import { StorePageStates } from '@/modules/storefront/components/StorePageStates'
import { useStorePage } from '@/modules/storefront/hooks/useStorePage'
import { storeCartPath, storePath } from '@/modules/storefront/lib/store-paths'
import { useCartStore } from '@/modules/storefront/store/cart-store'
import { Button } from '@/shared/components'

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
  const { store, loading, error, wrapperRef } = useStorePage(storeId)
  const lines = useCartStore((s) => s.lines)
  const setQty = useCartStore((s) => s.setQty)
  const removeItem = useCartStore((s) => s.removeItem)
  const syncLinePrices = useCartStore((s) => s.syncLinePrices)
  const itemCount = useCartStore((s) => s.itemCount(storeId))

  useEffect(() => {
    if (store) syncLinePrices(store.products)
  }, [store, syncLinePrices])

  return (
    <StorePageStates
      wrapperRef={wrapperRef}
      loading={loading}
      error={error}
      ready={Boolean(store)}
      loadingLabel="Loading cart…"
      emptyTitle="Store not found"
      emptyDescription="This store may be offline."
      backHref={storePath(storeId)}
    >
      {store ? (
        <StoreCartView
          store={store}
          lines={lines}
          cartCount={itemCount}
          onSetQty={setQty}
          onRemove={removeItem}
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
