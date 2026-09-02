import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, ChevronRight, Package, ShoppingBag, X } from 'lucide-react'
import { loginPathForRole } from '@/app/router/role-home'
import { ProductCard } from './ProductCard'
import { StorePageFooter } from '@/modules/storefront/components/StorePageFooter'
import { StorefrontHeader } from '@/modules/storefront/components/StorefrontHeader'
import {
  STOREFRONT_MOBILE_ACTION_PAD,
  StorefrontMobileActionBar,
} from '@/modules/storefront/components/StorefrontMobileActionBar'
import {
  cartTotals,
  findProductForCartLine,
  parseLineUnit,
  resolveLinePrice,
  storeCartLines,
  storeCartSubtotal,
} from '@/modules/storefront/lib/cart-utils'
import { storeCartPath, storeCheckoutPath, storePath } from '@/modules/storefront/lib/store-paths'
import type { CartLine, Product, Store } from '@/modules/storefront/types'
import { useAuthStore } from '@/shared/auth/store/auth-store'
import { Button, QuantityStepper } from '@/shared/components'
import { formatCurrency } from '@/shared/lib/utils'
import { cn } from '@/lib/utils'

type StoreCartViewProps = {
  store: Store
  lines: CartLine[]
  cartCount: number
  onSetQty: (itemId: string, qty: number) => void
  onRemove: (itemId: string) => void
  onBack: () => void
}

export function StoreCartView({
  store,
  lines,
  cartCount,
  onSetQty,
  onRemove,
  onBack,
}: StoreCartViewProps) {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const storeLines = useMemo(() => storeCartLines(lines, store.id), [lines, store.id])
  const itemCount = storeLines.reduce((sum, line) => sum + line.qty, 0)
  const subtotal = useMemo(
    () => storeCartSubtotal(lines, store.products, store.id),
    [lines, store.products, store.id],
  )
  const totals = cartTotals(subtotal, storeLines.length > 0)

  const suggestions = useMemo(() => {
    const popular = store.products.filter((product) => product.popular)
    const pool = popular.length >= 4 ? popular : store.products
    return pool.slice(0, 4)
  }, [store.products])

  function handleCheckout() {
    const checkoutPath = storeCheckoutPath(store.id)
    if (user?.role === 'customer') {
      navigate(checkoutPath)
      return
    }
    navigate(loginPathForRole('customer'), { state: { from: checkoutPath } })
  }

  return (
    <>
      <StorefrontHeader
        storeName={store.name}
        logoUrl={store.theme?.logoImage}
        cartCount={cartCount}
        cartHref={storeCartPath(store.id)}
        searchOpen={false}
        onToggleSearch={() => navigate(`${storePath(store.id)}?q=`)}
        pageTitle="Cart"
        onBack={onBack}
      />

      <main
        className={cn(
          'store-shell-inner flex-1 py-5 sm:py-6',
          storeLines.length > 0 && STOREFRONT_MOBILE_ACTION_PAD,
        )}
      >
        {storeLines.length === 0 ? (
          <EmptyStoreCart storeId={store.id} />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-6">
              <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
                <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
                  <h1 className="text-base font-bold text-slate-900 sm:text-lg">
                    Shopping Cart
                    <span className="ml-2 text-sm font-medium text-slate-500">
                      ({itemCount} {itemCount === 1 ? 'item' : 'items'})
                    </span>
                  </h1>
                </div>

                <ul className="divide-y divide-slate-100 px-4 sm:px-5">
                  {storeLines.map((line) => {
                    const product = findProductForCartLine(store.products, line.itemId)
                    return (
                      <CartLineRow
                        key={line.itemId}
                        line={line}
                        product={product}
                        unitPrice={resolveLinePrice(product, line)}
                        onSetQty={onSetQty}
                        onRemove={onRemove}
                      />
                    )
                  })}
                </ul>
              </section>

              {suggestions.length > 0 ? (
                <section>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h2 className="text-base font-bold text-slate-900 sm:text-lg">You may also like</h2>
                    <Link
                      to={storePath(store.id)}
                      className="inline-flex items-center gap-0.5 text-sm font-semibold text-[var(--store-theme,var(--md-green-700))] hover:underline"
                    >
                      View all
                      <ChevronRight className="size-4" aria-hidden />
                    </Link>
                  </div>
                  <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4 sm:gap-4">
                    {suggestions.map((product) => (
                      <ProductCard
                        key={product.id}
                        storeId={store.id}
                        storeName={store.name}
                        product={product}
                      />
                    ))}
                  </div>
                </section>
              ) : null}
            </div>

            <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
              <div className="rounded-2xl border border-slate-100 bg-white p-4 sm:p-5">
                <h2 className="text-base font-bold text-slate-900">Price Details</h2>
                <dl className="mt-4 space-y-2.5 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-600">Subtotal ({itemCount} items)</dt>
                    <dd className="font-semibold text-slate-900">{formatCurrency(totals.subtotal)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-600">Delivery Fee</dt>
                    <dd className="font-semibold text-slate-900">{formatCurrency(totals.delivery)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-600">Packaging Fee</dt>
                    <dd className="font-semibold text-slate-900">{formatCurrency(totals.packaging)}</dd>
                  </div>
                  <div className="flex justify-between gap-3 border-t border-dashed border-slate-200 pt-3">
                    <dt className="text-base font-bold text-slate-900">Total</dt>
                    <dd>
                      <p className="text-right text-base font-bold text-slate-900">
                        {formatCurrency(totals.total)}
                      </p>
                      <p className="text-right text-xs text-slate-500">(Incl. of all taxes)</p>
                    </dd>
                  </div>
                </dl>
              </div>

              <Button
                size="lg"
                fullWidth
                className="hidden h-11 rounded-[var(--store-button-radius,0.75rem)] bg-[var(--store-theme,var(--md-green-800))] text-white hover:bg-[var(--store-theme,var(--md-green-900))] lg:inline-flex"
                onClick={handleCheckout}
              >
                Proceed to Checkout
                <ArrowRight className="size-4" aria-hidden />
              </Button>
            </aside>
          </div>
        )}
      </main>

      {storeLines.length > 0 ? (
        <StorefrontMobileActionBar>
          <div className="mb-3 flex items-center justify-between gap-3 text-sm">
            <span className="font-medium text-slate-600">Total</span>
            <span className="text-lg font-bold text-slate-900">{formatCurrency(totals.total)}</span>
          </div>
          <Button
            size="lg"
            fullWidth
            className="h-11 rounded-[var(--store-button-radius,0.75rem)] bg-[var(--store-theme,var(--md-green-800))] text-white hover:bg-[var(--store-theme,var(--md-green-900))]"
            onClick={handleCheckout}
          >
            Proceed to Checkout
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        </StorefrontMobileActionBar>
      ) : null}

      <StorePageFooter store={store} />
    </>
  )
}

function CartLineRow({
  line,
  product,
  unitPrice,
  onSetQty,
  onRemove,
}: {
  line: CartLine
  product?: Product
  unitPrice: number
  onSetQty: (itemId: string, qty: number) => void
  onRemove: (itemId: string) => void
}) {
  const displayName = product?.name ?? line.name.replace(/\s*\([^)]*\)\s*$/, '')
  const unit = parseLineUnit(line.name)
  const meta = [unit, product?.spiceLevel].filter(Boolean).join(' · ')
  const lineTotal = unitPrice * line.qty

  return (
    <li className="flex gap-3 py-4">
      <div className="size-[4.15rem] shrink-0 overflow-hidden rounded-xl border border-slate-100 bg-slate-50 sm:size-[4.5rem]">
        {product?.imageUrl ? (
          <img src={product.imageUrl} alt="" className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center text-slate-400">
            <Package className="size-6" aria-hidden />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-slate-900 sm:text-[0.95rem]">
              {displayName}
            </h3>
            {meta ? <p className="mt-0.5 text-xs text-slate-500">{meta}</p> : null}
            <p className="mt-1 text-xs text-slate-500">{formatCurrency(unitPrice)} each</p>
          </div>
          <button
            type="button"
            onClick={() => onRemove(line.itemId)}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-red-600"
            aria-label={`Remove ${displayName}`}
          >
            <X className="size-4" strokeWidth={2} />
          </button>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <QuantityStepper
            value={line.qty}
            onChange={(qty) => onSetQty(line.itemId, qty)}
            label=""
            className="w-fit [&_button]:size-9 [&_span]:min-w-9"
          />
          <p className="text-sm font-bold text-slate-900">{formatCurrency(lineTotal)}</p>
        </div>
      </div>
    </li>
  )
}

function EmptyStoreCart({ storeId }: { storeId: string }) {
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-slate-100 bg-white px-6 py-12 text-center">
      <span className="mx-auto inline-flex size-14 items-center justify-center rounded-full bg-slate-100 text-slate-500">
        <ShoppingBag className="size-7" aria-hidden />
      </span>
      <h1 className="mt-4 text-xl font-bold text-slate-900">Your cart is empty</h1>
      <p className="mt-2 text-sm text-slate-600">Add pickles from the store to get started.</p>
      <Link to={storePath(storeId)} className="mt-5 inline-block">
        <Button className="rounded-lg bg-[var(--store-theme,var(--md-green-800))] px-6 text-white hover:bg-[var(--store-theme,var(--md-green-900))]">
          Continue shopping
        </Button>
      </Link>
    </div>
  )
}
