import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Loader2, Package, ShoppingBag, X } from 'lucide-react'
import { loginPathForRole } from '@/app/router/role-home'
import { StorePageFooter } from '@/modules/storefront/components/StorePageFooter'
import { StorefrontHeader } from '@/modules/storefront/components/StorefrontHeader'
import {
  STOREFRONT_MOBILE_ACTION_PAD,
  StorefrontMobileActionBar,
} from '@/modules/storefront/components/StorefrontMobileActionBar'
import {
  lineAmount,
  lineUnitPrice,
  parseLineUnit,
  priceDetailsFromSummary,
  storeCartLines,
} from '@/modules/storefront/lib/cart-utils'
import { storeCartPath, storeCheckoutPath, storePath, storeSearchPath } from '@/modules/storefront/lib/store-paths'
import { summaryFromLines, useCartStore } from '@/modules/storefront/store/cart-store'
import type { CartLine, Store } from '@/modules/storefront/types'
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
  /** Lines waiting on qty +/- API. */
  pendingQtyIds?: ReadonlySet<string>
  /** Lines waiting on remove (X) API. */
  removingIds?: ReadonlySet<string>
}

export function StoreCartView({
  store,
  lines,
  cartCount,
  onSetQty,
  onRemove,
  onBack,
  pendingQtyIds,
  removingIds,
}: StoreCartViewProps) {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  // Read stored summary only — do not create objects inside the selector.
  const storedSummary = useCartStore((s) => s.summaries?.[store.id])
  const storeLines = useMemo(() => storeCartLines(lines, store.id), [lines, store.id])
  const summary = useMemo(
    () => storedSummary ?? summaryFromLines(storeLines),
    [storedSummary, storeLines],
  )
  const totals = priceDetailsFromSummary(summary)
  const itemCount = totals.itemCount

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
        onToggleSearch={() => navigate(storeSearchPath(store.id))}
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
                  {storeLines.map((line) => (
                    <CartLineRow
                      key={line.itemId}
                      line={line}
                      qtyPending={pendingQtyIds?.has(line.itemId) ?? false}
                      removing={removingIds?.has(line.itemId) ?? false}
                      onSetQty={onSetQty}
                      onRemove={onRemove}
                    />
                  ))}
                </ul>
              </section>
            </div>

            <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
              <div className="rounded-2xl border border-slate-100 bg-white p-4 sm:p-5">
                <h2 className="text-base font-bold text-slate-900">Price Details</h2>
                <dl className="mt-4 space-y-2.5 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-600">Subtotal ({itemCount} items)</dt>
                    <dd className="font-semibold text-slate-900">{formatCurrency(totals.subtotal)}</dd>
                  </div>
                  {totals.delivery > 0 ? (
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-600">Delivery</dt>
                      <dd className="font-semibold text-slate-900">{formatCurrency(totals.delivery)}</dd>
                    </div>
                  ) : null}
                  {totals.discount > 0 ? (
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-600">Discount</dt>
                      <dd className="font-semibold text-emerald-700">
                        −{formatCurrency(totals.discount)}
                      </dd>
                    </div>
                  ) : null}
                  {totals.service > 0 ? (
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-600">Service charge</dt>
                      <dd className="font-semibold text-slate-900">{formatCurrency(totals.service)}</dd>
                    </div>
                  ) : null}
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
  qtyPending,
  removing,
  onSetQty,
  onRemove,
}: {
  line: CartLine
  qtyPending: boolean
  removing: boolean
  onSetQty: (itemId: string, qty: number) => void
  onRemove: (itemId: string) => void
}) {
  const displayName = line.name.replace(/\s*\([^)]*\)\s*$/, '')
  const unit = parseLineUnit(line.name)
  const meta = unit
  const unitPrice = lineUnitPrice(line)
  const total = lineAmount(line)
  const busy = qtyPending || removing
  const imageUrl = line.imageUrl

  return (
    <li className="flex gap-3 py-4">
      <div className="size-[4.15rem] shrink-0 overflow-hidden rounded-xl border border-slate-100 bg-slate-50 sm:size-[4.5rem]">
        {imageUrl ? (
          <img src={imageUrl} alt="" className="size-full object-cover" />
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
            disabled={busy}
            onClick={() => onRemove(line.itemId)}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-red-600 disabled:pointer-events-none"
            aria-label={`Remove ${displayName}`}
            aria-busy={removing}
          >
            {removing ? (
              <Loader2 className="size-4 animate-spin text-slate-400" aria-hidden />
            ) : (
              <X className="size-4" strokeWidth={2} />
            )}
          </button>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <QuantityStepper
            value={line.qty}
            onChange={(qty) => onSetQty(line.itemId, qty)}
            pending={qtyPending}
            disabled={removing}
            min={0}
            label=""
            className="w-fit [&_button]:size-9 [&_span]:min-w-9"
          />
          <p className="text-sm font-bold text-slate-900">{formatCurrency(total)}</p>
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
