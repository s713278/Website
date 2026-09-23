import { type MouseEvent, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Loader2, Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { lineMatchesVariant } from '@/modules/storefront/lib/cart-line-match'
import { requestAddToCart, requestSetCartQty } from '@/modules/storefront/lib/request-add-to-cart'
import { storePath } from '@/modules/storefront/lib/store-paths'
import { variantCartId } from '@/modules/storefront/lib/product-variants'
import { useCartStore } from '@/modules/storefront/store/cart-store'
import type { Product, ProductVariant } from '@/modules/storefront/types'
import { useAuthStore } from '@/shared/auth/store/auth-store'

type ProductCartControlProps = {
  storeId: string
  storeName: string
  product: Product
  variant: ProductVariant
  className?: string
}

export function ProductCartControl({
  storeId,
  storeName,
  product,
  variant,
  className,
}: ProductCartControlProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const user = useAuthStore((s) => s.user)
  const [pending, setPending] = useState(false)
  const lineId = variantCartId(product.id, variant.id)
  const returnTo = `${location.pathname}${location.search}` || storePath(storeId)

  const qty = useCartStore((s) => {
    const line = s.lines.find((entry) =>
      lineMatchesVariant(entry, storeId, product.id, variant.id),
    )
    return line?.qty ?? 0
  })

  function stopNav(event: MouseEvent) {
    event.preventDefault()
    event.stopPropagation()
  }

  async function run(action: () => Promise<boolean>) {
    if (pending) return
    setPending(true)
    try {
      await action()
    } finally {
      setPending(false)
    }
  }

  function handleAdd(event: MouseEvent) {
    stopNav(event)
    void run(() =>
      requestAddToCart({
        user,
        navigate,
        storeId,
        storeName,
        product,
        variant,
        qty: 1,
        returnTo,
        onError: (message) => window.alert(message),
      }),
    )
  }

  function handleIncrease(event: MouseEvent) {
    stopNav(event)
    void run(() =>
      requestAddToCart({
        user,
        navigate,
        storeId,
        storeName,
        product,
        variant,
        qty: 1,
        returnTo,
        onError: (message) => window.alert(message),
      }),
    )
  }

  function handleDecrease(event: MouseEvent) {
    stopNav(event)
    const line = useCartStore
      .getState()
      .lines.find((entry) => lineMatchesVariant(entry, storeId, product.id, variant.id))
    const current = line?.qty ?? qty
    void run(() =>
      requestSetCartQty({
        user,
        navigate,
        storeId,
        storeName,
        itemId: lineId,
        qty: current - 1,
        products: [product],
        returnTo,
        onError: (message) => window.alert(message),
      }),
    )
  }

  const aria = variant.unit
    ? `Add ${product.name}, ${variant.unit}`
    : `Add ${product.name} to cart`

  if (qty <= 0) {
    return (
      <button
        type="button"
        disabled={pending}
        onClick={handleAdd}
        className={cn(
          'inline-flex h-9 min-h-9 min-w-[4.75rem] items-center justify-center gap-0.5 rounded-full border border-[var(--store-theme,var(--md-green-600))] bg-white px-3 text-[11px] font-bold uppercase tracking-wide text-[var(--store-theme,var(--md-green-700))] shadow-sm transition duration-150 hover:bg-[var(--store-theme-soft,rgba(16,185,129,0.14))] active:scale-95 disabled:pointer-events-none',
          className,
        )}
        aria-label={aria}
        aria-busy={pending}
      >
        {pending ? (
          <Loader2
            className="size-3.5 animate-spin text-[var(--store-theme,var(--md-green-700))]"
            aria-hidden
          />
        ) : (
          <>
            <Plus className="size-3.5" strokeWidth={2.5} aria-hidden />
            <span>Add</span>
          </>
        )}
      </button>
    )
  }

  return (
    <div
      className={cn(
        'inline-flex h-9 min-h-9 min-w-[5.75rem] items-stretch overflow-hidden rounded-full bg-[var(--store-theme,var(--md-green-600))] text-white shadow-sm',
        className,
      )}
      role="group"
      aria-label={`${product.name} quantity`}
      aria-busy={pending}
    >
      <button
        type="button"
        disabled={pending}
        onClick={handleDecrease}
        className="inline-flex w-9 shrink-0 items-center justify-center transition hover:bg-black/10 active:bg-black/15 active:scale-95 disabled:pointer-events-none"
        aria-label={`Decrease ${product.name} quantity`}
      >
        <Minus className="size-3.5" strokeWidth={2.5} aria-hidden />
      </button>
      <span
        className="flex min-w-[1.75rem] flex-1 items-center justify-center text-xs font-bold tabular-nums"
        aria-live="polite"
        aria-atomic="true"
      >
        {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : qty}
      </span>
      <button
        type="button"
        disabled={pending}
        onClick={handleIncrease}
        className="inline-flex w-9 shrink-0 items-center justify-center transition hover:bg-black/10 active:bg-black/15 active:scale-95 disabled:pointer-events-none"
        aria-label={`Increase ${product.name} quantity`}
      >
        <Plus className="size-3.5" strokeWidth={2.5} aria-hidden />
      </button>
    </div>
  )
}
